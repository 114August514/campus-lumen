import { describe, expect, test } from "bun:test";
import { splitParticipationRoute } from "../src/lib/association-repair";
import {
  type CandidateSnapshot,
  EXPLORATION_STORAGE_KEY,
  createExplorationStore,
} from "../src/lib/exploration-store";

class MemoryStorage {
  data = new Map<string, string>();
  failWrite = false;

  getItem(key: string) {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    if (this.failWrite) throw new Error("quota exceeded");
    this.data.set(key, value);
  }
}

const sources: CandidateSnapshot["sources"] = [
  {
    url: "https://example.org/profile",
    title: "研究主页",
    content: "研究方向与一般联系说明",
    collectedAt: "2026-10-01T00:00:00.000Z",
  },
  {
    url: "https://example.org/graduate",
    title: "博士申请",
    content: "博士申请途径",
    collectedAt: "2026-10-01T00:00:00.000Z",
  },
  {
    url: "https://example.org/ra",
    title: "研究助理",
    content: "RA参与途径",
    collectedAt: "2026-10-01T00:00:00.000Z",
  },
  {
    url: "https://example.org/contact",
    title: "共同联系依据",
    content: "同时支持博士和RA的公开联系说明",
    collectedAt: "2026-10-01T00:00:00.000Z",
  },
];

function candidate(): CandidateSnapshot {
  return {
    candidateId: "researcher",
    name: "示例导师",
    institution: "示例大学",
    research: "系统研究",
    approach: "程序分析",
    participation: "博士与RA",
    unknowns: "名额未知",
    participationRoutes: [
      {
        routeId: "phd",
        label: "博士申请",
        details: "博士途径",
        sourceUrls: [
          "https://example.org/graduate",
          "https://example.org/contact",
        ],
      },
      {
        routeId: "ra",
        label: "研究助理",
        details: "RA途径",
        sourceUrls: ["https://example.org/ra", "https://example.org/contact"],
      },
      {
        routeId: "internship",
        label: "科研实习",
        details: "实习途径",
        sourceUrls: ["https://example.org/contact"],
      },
    ],
    sources: sources.map((source) => ({ ...source })),
  };
}

describe("participation-route association repair", () => {
  test("splits structured routes and sources without changing private records or another topic", () => {
    const storage = new MemoryStorage();
    const store = createExplorationStore(storage);
    const first = store.createTopic({ name: "第一主题" });
    const second = store.createTopic({ name: "第二主题" });
    const input = candidate();
    store.saveCandidate(first.id, input, {
      reason: "只保留在原记录",
      questions: ["原记录待问项"],
    });
    store.saveCandidate(second.id, input, {
      reason: "另一主题不变",
      questions: ["B的待问项"],
    });
    const beforeSecond = store.getTopic(second.id);

    store.splitCandidateParticipation(first.id, "researcher", "ra", "keep");

    const reopened = createExplorationStore(storage);
    const records = reopened.getTopic(first.id)?.candidates;
    const original = records?.find((record) => record.candidate.candidateId === "researcher");
    const split = records?.find(
      (record) => record.candidate.candidateId === "researcher--ra",
    );
    expect(original?.candidate.participationRoutes?.map((route) => route.routeId)).toEqual([
      "phd",
      "internship",
    ]);
    expect(original?.reason).toBe("只保留在原记录");
    expect(original?.questions).toEqual(["原记录待问项"]);
    expect(split?.candidate.participationRoutes?.map((route) => route.routeId)).toEqual([
      "ra",
    ]);
    expect(split?.candidate.participation).toBe("RA途径");
    expect(split?.reason).toBe("");
    expect(split?.questions).toEqual([]);
    expect(split?.candidate.sources.map((source) => source.url)).toEqual([
      "https://example.org/ra",
      "https://example.org/contact",
    ]);
    expect(original?.candidate.sources.map((source) => source.url)).toEqual([
      "https://example.org/profile",
      "https://example.org/graduate",
      "https://example.org/contact",
    ]);
    const repairedUrls = [...(original?.candidate.sources ?? []), ...(split?.candidate.sources ?? [])]
      .map((source) => source.url)
      .sort();
    expect([...new Set(repairedUrls)]).toEqual(input.sources.map((source) => source.url).sort());
    expect(reopened.getTopic(second.id)).toEqual(beforeSecond);
    expect(input).toEqual(candidate());
  });

  test("moves a saved private record only to the user-selected side", () => {
    const store = createExplorationStore(new MemoryStorage());
    const topic = store.createTopic({ name: "私人归属" });
    store.saveCandidate(topic.id, candidate(), {
      reason: "这条理由属于RA",
      questions: ["RA如何申请"],
    });

    store.splitCandidateParticipation(topic.id, "researcher", "ra", "move");

    const records = store.getTopic(topic.id)?.candidates;
    const original = records?.find((record) => record.candidate.candidateId === "researcher");
    const split = records?.find(
      (record) => record.candidate.candidateId === "researcher--ra",
    );
    expect(original).toMatchObject({ reason: "", questions: [] });
    expect(split).toMatchObject({
      reason: "这条理由属于RA",
      questions: ["RA如何申请"],
    });
    expect(records?.filter((record) => record.reason === "这条理由属于RA")).toHaveLength(1);
  });

  test("rejects invalid or duplicate splits and failed writes without losing the original", () => {
    const storage = new MemoryStorage();
    const store = createExplorationStore(storage);
    const topic = store.createTopic({ name: "失败保护" });
    store.saveCandidate(topic.id, candidate(), { reason: "仍然保留" });
    expect(() =>
      store.splitCandidateParticipation(topic.id, "researcher", "missing", "keep"),
    ).toThrow("没有可拆分");
    store.splitCandidateParticipation(topic.id, "researcher", "ra", "keep");
    expect(() =>
      store.splitCandidateParticipation(topic.id, "researcher", "ra", "keep"),
    ).toThrow();

    const beforeFailure = storage.getItem(EXPLORATION_STORAGE_KEY);
    storage.failWrite = true;
    expect(() =>
      store.splitCandidateParticipation(topic.id, "researcher", "phd", "move"),
    ).toThrow("保存未成功");
    expect(storage.getItem(EXPLORATION_STORAGE_KEY)).toBe(beforeFailure);
  });

  test("keeps legacy plain-text candidates usable and does not mutate split input", () => {
    const legacy = candidate();
    delete legacy.participationRoutes;
    expect(() => splitParticipationRoute(legacy, "phd")).toThrow("没有可拆分");

    const input = candidate();
    const before = structuredClone(input);
    splitParticipationRoute(input, "phd");
    expect(input).toEqual(before);
  });
});
