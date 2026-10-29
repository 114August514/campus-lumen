// AI organization: build exactly what will be sent, then track what is known about
// its delivery. Personal content enters a request only by explicit per-item choice,
// and only from the current topic. Delivery states follow the evidence available:
// once fetch is called, a timeout or a stop can no longer prove nothing was sent.
import {
  type AnalysisEvidence,
  type AnalysisRequest,
  type AnalysisResponse,
  type AnalysisSimulation,
  CampusAgoraApiError,
  type RequestAnalysisOptions,
  requestAnalysis,
} from "@campus-agora/api-client";
import type { CatalogItem } from "./catalog";
import type { CompareRow } from "./compare";
import type { ExplorationTopic, SavedAnalysis } from "./exploration-store";
import { profileFor } from "./profiles";

export interface PrivateFragmentOption {
  id: string;
  kind: "reason" | "question";
  subjectId: string;
  subjectName: string;
  text: string;
}

/** The current topic's notes on these items; nothing from other topics. */
export function privateFragmentOptions(
  topic: ExplorationTopic | undefined,
  items: CatalogItem[],
): PrivateFragmentOption[] {
  if (!topic) return [];
  const options: PrivateFragmentOption[] = [];
  for (const item of items) {
    const record =
      item.kind === "entry"
        ? topic.opportunities?.find(
            (entry) => entry.opportunity.opportunityId === item.id,
          )
        : topic.candidates.find((entry) => entry.candidate.candidateId === item.id);
    if (!record) continue;
    const reason = record.reason.trim();
    if (reason) {
      options.push({
        id: `${item.id}#reason`,
        kind: "reason",
        subjectId: item.id,
        subjectName: item.name,
        text: reason.slice(0, 500),
      });
    }
    record.questions.forEach((question, index) => {
      const text = question.trim();
      if (!text) return;
      options.push({
        id: `${item.id}#q${index + 1}`,
        kind: "question",
        subjectId: item.id,
        subjectName: item.name,
        text: text.slice(0, 500),
      });
    });
  }
  return options;
}

/** Public evidence from a comparison table: one entry per cell with its first source. */
export function evidenceFromRows(rows: CompareRow[]): AnalysisEvidence[] {
  const evidence: AnalysisEvidence[] = [];
  for (const row of rows) {
    for (const cell of row.cells) {
      if (evidence.length >= 60) return evidence;
      const source = cell.sources[0];
      evidence.push({
        ref: `e${evidence.length + 1}`,
        subjectId: cell.itemId,
        aspect: row.followup ? "unknowns" : row.label,
        text: cell.text.slice(0, 800),
        ...(source
          ? {
              sourceTitle: source.title.slice(0, 200),
              sourceUrl: source.url,
              collectedAt: source.collectedAt,
            }
          : {}),
      });
    }
  }
  return evidence;
}

/** Public evidence for a mixed shortlist: what it is, its status, what is unknown. */
export function evidenceFromItems(items: CatalogItem[]): AnalysisEvidence[] {
  const evidence: AnalysisEvidence[] = [];
  const push = (item: CatalogItem, aspect: string, text: string) => {
    if (!text.trim() || evidence.length >= 60) return;
    evidence.push({
      ref: `e${evidence.length + 1}`,
      subjectId: item.id,
      aspect,
      text: text.slice(0, 800),
      sourceTitle: item.name.slice(0, 200),
      ...(item.entryUrl.startsWith("https://") ? { sourceUrl: item.entryUrl } : {}),
    });
  };
  for (const item of items) {
    push(item, "概况", item.summary);
    push(
      item,
      "状态",
      item.routeChips.length
        ? item.routeChips.map((chip) => chip.label).join("、")
        : item.period,
    );
    const unknowns =
      profileFor(item.id)
        ?.unknowns.map((claim) => claim.text)
        .join("；") ??
      item.entry?.caveat ??
      item.candidate?.unknowns ??
      "";
    push(item, "unknowns", unknowns);
  }
  return evidence;
}

export function buildAnalysisRequest(input: {
  operation: AnalysisRequest["operation"];
  question: string;
  items: CatalogItem[];
  evidence: AnalysisEvidence[];
  fragments: PrivateFragmentOption[];
  selected: ReadonlySet<string>;
  simulation?: AnalysisSimulation;
}): AnalysisRequest {
  return {
    operation: input.operation,
    question: input.question.trim().slice(0, 300),
    subjects: input.items.slice(0, 8).map((item) => ({
      id: item.id,
      name: item.name.slice(0, 120),
      kind: item.kind,
    })),
    evidence: input.evidence,
    selectedPrivateFragments: input.fragments
      .filter((fragment) => input.selected.has(fragment.id))
      .slice(0, 10)
      .map((fragment) => ({
        id: fragment.id,
        kind: fragment.kind,
        subjectId: fragment.subjectId,
        text: fragment.text,
      })),
    ...(input.simulation ? { simulation: input.simulation } : {}),
  };
}

export type DeliveryState =
  | "not_sent"
  | "waiting"
  | "returned"
  | "service_error"
  | "unknown";

export interface AnalysisRunState {
  delivery: DeliveryState;
  request?: AnalysisRequest;
  response?: AnalysisResponse;
  /** Why delivery is unknown or failed, in user terms. */
  detail: string;
  stoppedByUser: boolean;
}

type Sender = (
  body: AnalysisRequest,
  options: RequestAnalysisOptions,
) => Promise<AnalysisResponse>;

export const ANALYSIS_WAIT_MS = 12_000;

/** One request at a time; a superseded or stopped request never updates the state. */
export function createAnalysisRun(
  onChange: (state: AnalysisRunState) => void,
  options: { send?: Sender; timeoutMs?: number } = {},
) {
  let state: AnalysisRunState = {
    delivery: "not_sent",
    detail: "",
    stoppedByUser: false,
  };
  let sequence = 0;
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let dispatched = false;

  function publish(next: AnalysisRunState) {
    state = next;
    onChange(state);
  }

  function settle(request: number, next: Omit<AnalysisRunState, "request">) {
    if (request !== sequence) return;
    clearTimeout(timer);
    controller = undefined;
    publish({ ...next, request: state.request });
  }

  function interrupt(detail: string, stoppedByUser: boolean) {
    if (!controller) return;
    sequence += 1;
    clearTimeout(timer);
    controller.abort();
    controller = undefined;
    publish({
      delivery: dispatched ? "unknown" : "not_sent",
      request: state.request,
      detail: dispatched ? detail : "请求尚未发出就已停止，内容没有发送。",
      stoppedByUser,
    });
  }

  return {
    getState: () => state,
    /** Stop waiting. A request already handed to the network is not withdrawn. */
    stop() {
      interrupt("你停止了等待。请求已发出，服务可能已经收到；停止不会撤回它。", true);
    },
    dispose() {
      sequence += 1;
      clearTimeout(timer);
      controller?.abort();
    },
    reset() {
      sequence += 1;
      clearTimeout(timer);
      controller?.abort();
      controller = undefined;
      dispatched = false;
      publish({ delivery: "not_sent", detail: "", stoppedByUser: false });
    },
    async start(request: AnalysisRequest) {
      sequence += 1;
      const current = sequence;
      clearTimeout(timer);
      controller?.abort();
      controller = new AbortController();
      dispatched = false;
      state = { delivery: "not_sent", request, detail: "", stoppedByUser: false };
      timer = setTimeout(() => {
        if (current === sequence) {
          interrupt("等待超时，未收到服务回应。请求已发出，服务可能已经收到。", false);
        }
      }, options.timeoutMs ?? ANALYSIS_WAIT_MS);
      try {
        const response = await (options.send ?? requestAnalysis)(request, {
          signal: controller.signal,
          onDispatched: () => {
            if (current !== sequence) return;
            dispatched = true;
            publish({ delivery: "waiting", request, detail: "", stoppedByUser: false });
          },
        });
        settle(current, {
          delivery: "returned",
          response,
          detail: "",
          stoppedByUser: false,
        });
      } catch (error) {
        if (
          error instanceof CampusAgoraApiError &&
          error.status > 0 &&
          error.requestId
        ) {
          settle(current, {
            delivery: "service_error",
            detail: `服务已收到请求并返回错误：${error.message}`,
            stoppedByUser: false,
          });
          return;
        }
        settle(current, {
          delivery: dispatched ? "unknown" : "not_sent",
          detail: dispatched
            ? "连接中断，未能确认服务是否收到请求；内容可能已经发送。"
            : "请求未能发出，内容没有发送。",
          stoppedByUser: false,
        });
      }
    },
  };
}

/** Private copy of a returned result, keyed to what was actually sent. */
export function toSavedAnalysis(
  request: AnalysisRequest,
  response: AnalysisResponse,
): SavedAnalysis {
  return {
    id: response.analysisId,
    question: response.question,
    createdAt: response.createdAt,
    providerLabel: response.provider.label,
    simulated: response.provider.simulated,
    subjects: request.subjects.map((subject) => ({
      id: subject.id,
      name: subject.name,
    })),
    evidence: request.evidence.map((item) => ({
      ref: item.ref,
      subjectId: item.subjectId,
      aspect: item.aspect,
      ...(item.sourceTitle ? { sourceTitle: item.sourceTitle } : {}),
      ...(item.sourceUrl ? { sourceUrl: item.sourceUrl } : {}),
    })),
    sentFragmentIds: response.received.privateFragmentIds,
    sections: response.sections.map((section) => ({
      kind: section.kind,
      title: section.title,
      points: section.points.map((point) => ({ ...point })),
    })),
    caveats: [...response.caveats],
  };
}
