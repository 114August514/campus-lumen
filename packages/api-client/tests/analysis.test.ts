import { afterEach, expect, test } from "bun:test";
import {
  CampusAgoraApiError,
  requestAnalysis,
  type AnalysisRequest,
  type AnalysisResponse,
} from "../src";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

const request: AnalysisRequest = {
  operation: "compare",
  question: "哪个更适合机器学习？",
  subjects: [
    { id: "a", name: "候选甲", kind: "advisor" },
    { id: "b", name: "候选乙", kind: "advisor" },
  ],
  evidence: [
    { ref: "e1", subjectId: "a", aspect: "方向", text: "机器学习与系统研究。" },
  ],
  selectedPrivateFragments: [
    { id: "p1", kind: "reason", subjectId: "a", text: "我想学习机器学习" },
  ],
};

const response: AnalysisResponse = {
  analysisId: "analysis-test",
  operation: "compare",
  question: request.question,
  createdAt: "2026-10-29T00:00:00Z",
  provider: {
    id: "simulated-organizer",
    label: "模拟整理服务",
    simulated: true,
    retention: "none",
  },
  received: {
    subjectIds: ["a", "b"],
    evidenceRefs: ["e1"],
    privateFragmentIds: ["p1"],
  },
  sections: [],
  caveats: ["模拟输出"],
};

test("requestAnalysis dispatches the exact body and returns the typed response", async () => {
  const events: string[] = [];
  globalThis.fetch = async (url, init) => {
    events.push("fetch");
    expect(String(url)).toBe("http://api.test/api/v1/analyses");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual(request);
    return new Response(JSON.stringify(response), {
      headers: { "content-type": "application/json" },
    });
  };

  const result = await requestAnalysis(request, {
    baseUrl: "http://api.test",
    onDispatched: () => events.push("dispatched"),
  });
  expect(events).toEqual(["fetch", "dispatched"]);
  expect(result).toEqual(response);
});

test("requestAnalysis exposes a 422 field validation error", async () => {
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        code: "validation_failed",
        message: "invalid",
        requestId: "validation-1",
        details: { fields: [{ field: "subjects", message: "invalid" }] },
      }),
      { status: 422, headers: { "content-type": "application/json" } },
    );

  await expect(requestAnalysis(request)).rejects.toMatchObject({
    name: "CampusAgoraApiError",
    code: "validation_failed",
    status: 422,
    requestId: "validation-1",
  });
});

test("requestAnalysis exposes the simulated 503 error", async () => {
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        code: "analysis_simulated_failure",
        message: "simulated failure",
        requestId: "failure-1",
      }),
      { status: 503, headers: { "content-type": "application/json" } },
    );

  await expect(requestAnalysis(request)).rejects.toMatchObject({
    code: "analysis_simulated_failure",
    status: 503,
    requestId: "failure-1",
  });
});

test("requestAnalysis forwards abort and throws the existing typed API error", async () => {
  const controller = new AbortController();
  globalThis.fetch = (_url, init) => {
    const { promise, reject } = Promise.withResolvers<Response>();
    expect(init?.signal).toBe(controller.signal);
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), {
      once: true,
    });
    return promise;
  };

  const pending = requestAnalysis(request, { signal: controller.signal });
  controller.abort(new DOMException("stopped", "AbortError"));
  try {
    await pending;
    throw new Error("expected request to reject");
  } catch (error) {
    expect(error).toBeInstanceOf(CampusAgoraApiError);
    expect(error).toMatchObject({ code: "network_error", status: 0 });
  }
});
