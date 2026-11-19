// Labelled discovery replays for demonstrating run states (partial arrival, source
// failure, stop with a late result, limits) without the network. A replay is only
// ever started explicitly from the demo route; a live failure never falls back here.
import type {
  DiscoveryResponse,
  DiscoverySource,
  DiscoveryStreamOptions,
} from "@campus-agora/api-client";

export type ReplayScenario = "success" | "partial" | "late" | "limit";

export const replayScenarios: { id: ReplayScenario; label: string; note: string }[] = [
  { id: "success", label: "逐条到达", note: "两条正文先后到达，最后标记完成" },
  { id: "partial", label: "部分来源失败", note: "一条正文成功，一个来源读取失败" },
  {
    id: "late",
    label: "中止后迟到",
    note: "收到一条后请点“中止”；之后到达的结果不会写入",
  },
  {
    id: "limit",
    label: "达到上限",
    note: "达到本轮来源上限后停止，未读结果不冒充完成",
  },
];

export const REPLAY_LABEL = "演示回放（非实时查找）";

const limits = {
  maxHttpRequests: 48,
  maxPageBytes: 1_000_000,
  maxReads: 6,
  maxSeconds: 30,
  maxSources: 5,
};

function source(
  url: string,
  title: string,
  content: string,
  evidence: string[],
): DiscoverySource {
  return {
    url,
    title: `${title}（演示回放）`,
    institution: new URL(url).hostname,
    content: `演示回放节选，内容依据仓库中 2026-10-05 已采集的整理摘要改写，不是本次读取：${content}`,
    collectedAt: new Date().toISOString(),
    relevanceEvidence: evidence,
    searchSnippet: "",
    unknowns: ["演示回放内容；需要实际信息时请用联网查找或打开原站。"],
  };
}

const jiangHome = source(
  "https://jzuming.github.io/",
  "江祖铭个人主页",
  "主页显示 ATOMS 实验室及有资助的 PhD、Postdoc 和 RA 机会，建议发送 CV 与研究兴趣/计划；未写明截止日期或剩余名额。",
  ["有资助的 PhD、Postdoc 和 RA 机会", "建议发送 CV 与研究兴趣/计划"],
);
const jiangLab = source(
  "https://jzuming.github.io/lab.html",
  "ATOMS 实验室成员页",
  "公开成员页列有博士生和 RA/visiting students；成员列表不是指导体验证据。",
  ["RA/visiting students"],
);

function snapshot(
  query: string,
  sources: DiscoverySource[],
  patch: Partial<DiscoveryResponse> = {},
): DiscoveryResponse {
  return {
    query,
    provider: "duckduckgo_html",
    scope: REPLAY_LABEL,
    status: "partial",
    finished: false,
    collectedAt: new Date().toISOString(),
    limits,
    startedReads: sources.length + 1,
    completedReads: sources.length + 1,
    stopReason: "",
    sources,
    warnings: [],
    ...patch,
  };
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("aborted", "AbortError"));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

/** A runner with the same contract as the live streaming client. */
export function replayRunner(scenario: ReplayScenario, stepMs = 900) {
  return async (
    query: string,
    onProgress: (result: DiscoveryResponse) => void,
    options: DiscoveryStreamOptions,
  ): Promise<DiscoveryResponse> => {
    const signal = options.signal ?? undefined;
    onProgress(snapshot(query, [], { startedReads: 1, completedReads: 0 }));
    await wait(stepMs, signal);
    onProgress(snapshot(query, [jiangHome]));
    if (scenario === "late") {
      // The run waits long enough for the user to stop it; a late result is discarded.
      await wait(stepMs * 6, signal);
      return snapshot(query, [jiangHome, jiangLab], {
        status: "complete",
        finished: true,
      });
    }
    await wait(stepMs, signal);
    if (scenario === "partial") {
      return snapshot(query, [jiangHome], {
        status: "partial",
        finished: true,
        warnings: [
          {
            code: "read_failed",
            message: "该来源本次未取得可用 HTML 正文（演示回放中的模拟失败）。",
            url: "https://example.edu/replay-unavailable",
          },
        ],
      });
    }
    if (scenario === "limit") {
      return snapshot(query, [jiangHome, jiangLab], {
        status: "partial",
        finished: true,
        stopReason: "source_limit",
        warnings: [
          {
            code: "source_limit_reached",
            message: "本轮只读取前5个范围内页面，其余结果未读取（演示回放）。",
          },
        ],
      });
    }
    return snapshot(query, [jiangHome, jiangLab], {
      status: "complete",
      finished: true,
    });
  };
}

export type WarningKind = "no_results" | "search_failed" | "read_failed" | "limit";

/** Group the service's warnings the way users need to read them. */
export function classifyWarning(warning: { code: string; url?: string }): WarningKind {
  if (warning.code === "no_results" || warning.code === "directory_no_matches")
    return "no_results";
  if (warning.code === "source_limit_reached" || warning.code === "time_limit_reached")
    return "limit";
  return warning.url ? "read_failed" : "search_failed";
}
