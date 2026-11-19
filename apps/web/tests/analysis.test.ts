import { describe, expect, test } from "bun:test";
import { type AnalysisResponse, CampusAgoraApiError } from "@campus-agora/api-client";
import {
  type AnalysisRunState,
  SCHOOL_ANALYSIS_WAIT_MS,
  buildAnalysisRequest,
  createAnalysisRun,
  evidenceFromItems,
  evidenceFromRows,
  privateFragmentOptions,
  toSavedAnalysis,
  waitFor,
} from "../src/lib/analysis";
import type { CatalogItem } from "../src/lib/catalog";
import { findItem } from "../src/lib/catalog";
import { buildCompareRows } from "../src/lib/compare";
import type { ExplorationTopic } from "../src/lib/exploration-store";

function advisorItem(id: string): CatalogItem {
  const found = findItem(id);
  if (!found) throw new Error(`missing item ${id}`);
  return found;
}

function topicWithReasons(
  id: string,
  candidate: CatalogItem,
  reason: string,
): ExplorationTopic {
  if (!candidate.candidate) throw new Error("item lacks candidate");
  return {
    id,
    name: `主题 ${id}`,
    question: "",
    preferences: "",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    candidates: [
      {
        candidate: candidate.candidate,
        reason,
        questions: [`${id} 的问题`],
        savedAt: "2026-10-01T00:00:00.000Z",
      },
    ],
    opportunities: [],
  };
}

function response(analysisId = "analysis-1"): AnalysisResponse {
  return {
    analysisId,
    caveats: ["模拟结果，仅供参考。"],
    createdAt: "2026-10-20T00:00:00.000Z",
    operation: "compare",
    provider: {
      id: "simulated-organizer",
      label: "模拟整理服务",
      retention: "none",
      simulated: true,
    },
    question: "问题",
    received: {
      evidenceRefs: ["e1"],
      privateFragmentIds: [],
      subjectIds: ["zhuoran-song"],
    },
    sections: [
      {
        kind: "differences",
        title: "差异",
        points: [{ text: "要点", evidenceRefs: ["e1"], privateFragmentIds: [] }],
      },
    ],
  };
}

interface SenderCtl {
  send: (
    body: unknown,
    options: { onDispatched?: () => void; signal?: AbortSignal },
  ) => Promise<AnalysisResponse>;
  /** Resolves once the sender has been invoked. */
  invoked: Promise<void>;
  /** Resolves once onDispatched has been called (or immediately when not used). */
  dispatched: Promise<void>;
  settle: (outcome: "ok" | "api-error" | "network-error") => void;
}

/** Deterministic sender: the test decides when (and how) it settles. */
function controlledSender(reportDispatch = true): SenderCtl {
  const invoked = Promise.withResolvers<void>();
  const dispatched = Promise.withResolvers<void>();
  const outcome = Promise.withResolvers<"ok" | "api-error" | "network-error">();
  const send = (
    _body: unknown,
    options: { onDispatched?: () => void; signal?: AbortSignal },
  ): Promise<AnalysisResponse> => {
    invoked.resolve();
    queueMicrotask(() => {
      if (reportDispatch) {
        options.onDispatched?.();
        dispatched.resolve();
      } else {
        dispatched.resolve();
      }
    });
    options.signal?.addEventListener("abort", () => {
      outcome.reject(new DOMException("Aborted", "AbortError"));
    });
    return outcome.promise.then((mode) => {
      if (mode === "ok") return response();
      if (mode === "api-error") {
        throw new CampusAgoraApiError("service unavailable", {
          code: "unavailable",
          status: 503,
          requestId: "req-503",
        });
      }
      throw new CampusAgoraApiError("Network request failed", {
        code: "network_error",
        status: 0,
      });
    });
  };
  return { send, invoked, dispatched, settle: outcome.resolve };
}

function collectStates(): {
  states: AnalysisRunState[];
  onChange: (s: AnalysisRunState) => void;
} {
  const states: AnalysisRunState[] = [];
  return {
    states,
    onChange: (state) => states.push(state),
  };
}

const request = {
  operation: "compare" as const,
  question: "怎样选择",
  subjects: [{ id: "zhuoran-song", name: "宋卓然", kind: "advisor" as const }],
  evidence: [],
  selectedPrivateFragments: [],
};

describe("analysis", () => {
  test("privateFragmentOptions lists only the given topic's notes", () => {
    const song = advisorItem("zhuoran-song");
    const topicA = topicWithReasons("topic-a", song, "A 主题的私人理由");
    const topicB = topicWithReasons("topic-b", song, "B 主题的私人理由");

    const optionsA = privateFragmentOptions(topicA, [song]);
    expect(optionsA.map((option) => option.text)).toContain("A 主题的私人理由");
    expect(optionsA.map((option) => option.text)).toContain("topic-a 的问题");
    expect(optionsA.map((option) => option.text)).not.toContain("B 主题的私人理由");
    expect(optionsA.every((option) => option.subjectId === song.id)).toBe(true);

    const optionsB = privateFragmentOptions(topicB, [song]);
    expect(optionsB.map((option) => option.text)).toContain("B 主题的私人理由");
    expect(optionsB.map((option) => option.text)).not.toContain("A 主题的私人理由");

    // No topic → no private options at all.
    expect(privateFragmentOptions(undefined, [song])).toHaveLength(0);
    // An item with no record in this topic contributes nothing.
    const other = advisorItem("wang-xiang");
    expect(privateFragmentOptions(topicA, [other])).toHaveLength(0);
  });

  test("buildAnalysisRequest includes only selected ids and caps fragments at 10", () => {
    const song = advisorItem("zhuoran-song");
    const fragments = privateFragmentOptions(
      topicWithReasons("topic-a", song, "理由"),
      [song],
    );
    const manyFragments = Array.from({ length: 14 }, (_, index) => ({
      ...fragments[0],
      id: `fragment-${index}`,
    }));
    const selected = new Set(["fragment-3", "fragment-5", "fragment-9"]);
    const built = buildAnalysisRequest({
      operation: "compare",
      question: "  怎样选择  ",
      items: [song],
      evidence: [],
      fragments: manyFragments,
      selected,
    });
    expect(built.selectedPrivateFragments.map((fragment) => fragment.id)).toEqual([
      "fragment-3",
      "fragment-5",
      "fragment-9",
    ]);
    // All 14 selected → capped at 10.
    const capped = buildAnalysisRequest({
      operation: "compare",
      question: "q",
      items: [song],
      evidence: [],
      fragments: manyFragments,
      selected: new Set(manyFragments.map((fragment) => fragment.id)),
    });
    expect(capped.selectedPrivateFragments).toHaveLength(10);
    expect(built.question).toBe("怎样选择");
  });

  test("buildAnalysisRequest caps subjects at 8", () => {
    const ids = [
      "zhuoran-song",
      "wang-xiang",
      "xiong-yingfei",
      "tianqi-chen",
      "charles-zhang",
      "shangding-gu",
      "zuming-jiang",
      "ustc-research-plan",
      "fusep-2026",
    ];
    const items = ids
      .map(findItem)
      .filter((item): item is CatalogItem => Boolean(item));
    const built = buildAnalysisRequest({
      operation: "shortlist",
      question: "q",
      items,
      evidence: [],
      fragments: [],
      selected: new Set(),
    });
    expect(built.subjects).toHaveLength(8);
  });

  test("a school request never carries demo simulation and waits long enough for the model", () => {
    const items = ["zuming-jiang", "zhuoran-song"]
      .map((id) => findItem(id))
      .filter((item): item is CatalogItem => Boolean(item));
    const base = {
      operation: "compare" as const,
      question: "q",
      items,
      evidence: [],
      fragments: [],
      selected: new Set<string>(),
      simulation: { outcome: "hang" as const },
    };
    const school = buildAnalysisRequest({ ...base, provider: "school" });
    expect(school.provider).toBe("school");
    expect(school.simulation).toBeUndefined();
    expect(waitFor(school)).toBe(SCHOOL_ANALYSIS_WAIT_MS);
    expect(SCHOOL_ANALYSIS_WAIT_MS).toBeGreaterThan(60_000);
    const simulated = buildAnalysisRequest(base);
    expect(simulated.provider).toBeUndefined();
    expect(simulated.simulation).toEqual({ outcome: "hang" });
    expect(waitFor(simulated)).toBeLessThan(SCHOOL_ANALYSIS_WAIT_MS);
  });

  test("evidence text is single-line, control-char free and within the limit", () => {
    const song = advisorItem("zhuoran-song");
    const rows = buildCompareRows([song], "research");
    const fromRows = evidenceFromRows(rows);
    expect(fromRows.length).toBeGreaterThan(0);
    for (const entry of fromRows) {
      expect(entry.text).not.toMatch(/[\r\n]/);
      // biome-ignore lint/suspicious/noControlCharactersInRegex: asserting control characters are stripped
      expect(entry.text).not.toMatch(/[\x00-\x1f\x7f]/);
      expect(entry.text.length).toBeLessThanOrEqual(800);
    }
    const fromItems = evidenceFromItems([song]);
    expect(fromItems.length).toBeGreaterThan(0);
    for (const entry of fromItems) {
      expect(entry.text).not.toMatch(/[\r\n]/);
      // biome-ignore lint/suspicious/noControlCharactersInRegex: asserting control characters are stripped
      expect(entry.text).not.toMatch(/[\x00-\x1f\x7f]/);
      expect(entry.text.length).toBeLessThanOrEqual(800);
    }
    // Multi-line profile cell text must arrive flattened, not truncated mid-way.
    const researchRow = rows.find((row) => row.id === "research");
    const cellText = researchRow?.cells[0].text ?? "";
    expect(cellText).toContain("\n");
    expect(fromRows[0].text).toBe(
      cellText
        .replace(/\s*[\r\n]+\s*/g, "；")
        // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control characters is the point
        .replace(/[ -]/g, " ")
        .trim()
        .slice(0, 800),
    );
  });

  test("a returned response settles the run as returned", async () => {
    const { states, onChange } = collectStates();
    const ctl = controlledSender();
    const run = createAnalysisRun(onChange, { send: ctl.send, timeoutMs: 60_000 });
    const pending = run.start(request);
    await ctl.dispatched;
    ctl.settle("ok");
    await pending;
    expect(run.getState().delivery).toBe("returned");
    expect(run.getState().response?.analysisId).toBe("analysis-1");
    expect(run.getState().stoppedByUser).toBe(false);
    const deliveries = states.map((state) => state.delivery);
    expect(deliveries).toContain("waiting");
    expect(deliveries[deliveries.length - 1]).toBe("returned");
  });

  test("stop after dispatch is unknown with stoppedByUser", async () => {
    const { states, onChange } = collectStates();
    const ctl = controlledSender();
    const run = createAnalysisRun(onChange, { send: ctl.send, timeoutMs: 60_000 });
    const pending = run.start(request);
    await ctl.dispatched;
    run.stop();
    await pending;
    expect(run.getState().delivery).toBe("unknown");
    expect(run.getState().stoppedByUser).toBe(true);
    expect(run.getState().detail).toContain("可能已经收到");
    expect(states.some((state) => state.delivery === "waiting")).toBe(true);
  });

  test("stop before dispatch leaves the run not_sent", async () => {
    const { onChange } = collectStates();
    // This sender never reports dispatch, so the request is never marked sent.
    const ctl = controlledSender(false);
    const run = createAnalysisRun(onChange, { send: ctl.send, timeoutMs: 60_000 });
    const pending = run.start(request);
    run.stop();
    await pending;
    expect(run.getState().delivery).toBe("not_sent");
    expect(run.getState().stoppedByUser).toBe(true);
    expect(run.getState().detail).toContain("没有发送");
  });

  test("timeout after dispatch is unknown, not an error", async () => {
    const { onChange } = collectStates();
    const ctl = controlledSender();
    const run = createAnalysisRun(onChange, { send: ctl.send, timeoutMs: 30 });
    const pending = run.start(request);
    await ctl.dispatched;
    await pending;
    expect(run.getState().delivery).toBe("unknown");
    expect(run.getState().stoppedByUser).toBe(false);
    expect(run.getState().detail).toContain("超时");
  });

  test("an API error with status and requestId is service_error", async () => {
    const { onChange } = collectStates();
    const ctl = controlledSender();
    const run = createAnalysisRun(onChange, { send: ctl.send, timeoutMs: 60_000 });
    const pending = run.start(request);
    await ctl.dispatched;
    ctl.settle("api-error");
    await pending;
    expect(run.getState().delivery).toBe("service_error");
    expect(run.getState().detail).toContain("service unavailable");
    expect(run.getState().stoppedByUser).toBe(false);
  });

  test("a network error after dispatch is unknown", async () => {
    const { onChange } = collectStates();
    const ctl = controlledSender();
    const run = createAnalysisRun(onChange, { send: ctl.send, timeoutMs: 60_000 });
    const pending = run.start(request);
    await ctl.dispatched;
    ctl.settle("network-error");
    await pending;
    expect(run.getState().delivery).toBe("unknown");
    expect(run.getState().detail).toContain("可能已经发送");
  });

  test("a superseded first run resolving late never overwrites the second run", async () => {
    const { onChange } = collectStates();
    // One sender serves both runs: the first call hangs, the second resolves.
    const first = controlledSender();
    const second = controlledSender();
    let call = 0;
    const send: typeof first.send = (body, options) => {
      call += 1;
      return (call === 1 ? first : second).send(body, options);
    };
    const run = createAnalysisRun(onChange, {
      send,
      timeoutMs: 60_000,
    });
    const firstPending = run.start(request);
    await first.dispatched;
    // First request is dispatched and hanging; start a second one.
    const secondPending = run.start(request);
    await second.dispatched;
    second.settle("ok");
    await secondPending;
    expect(run.getState().delivery).toBe("returned");
    // Now let the first sender resolve late; it must be ignored.
    first.settle("ok");
    await firstPending;
    expect(run.getState().delivery).toBe("returned");
    expect(run.getState().response?.analysisId).toBe("analysis-1");
  });

  test("toSavedAnalysis keeps sent fragment ids and cited evidence only", () => {
    const song = advisorItem("zhuoran-song");
    const built = buildAnalysisRequest({
      operation: "compare",
      question: "q",
      items: [song],
      evidence: [
        {
          ref: "e1",
          subjectId: song.id,
          aspect: "研究什么",
          text: "公开证据",
          sourceTitle: "来源标题",
          sourceUrl: "https://example.org/source",
        },
      ],
      fragments: [],
      selected: new Set(),
    });
    const saved = toSavedAnalysis(built, {
      ...response("analysis-9"),
      received: {
        evidenceRefs: ["e1"],
        privateFragmentIds: ["zhuoran-song#reason"],
        subjectIds: [song.id],
      },
    });
    expect(saved.id).toBe("analysis-9");
    expect(saved.sentFragmentIds).toEqual(["zhuoran-song#reason"]);
    expect(saved.subjects).toEqual([{ id: song.id, name: song.name }]);
    expect(saved.evidence[0]).toMatchObject({
      ref: "e1",
      subjectId: song.id,
      aspect: "研究什么",
      sourceTitle: "来源标题",
      sourceUrl: "https://example.org/source",
    });
    expect("text" in saved.evidence[0]).toBe(false);
    expect(saved.simulated).toBe(true);
  });
});
