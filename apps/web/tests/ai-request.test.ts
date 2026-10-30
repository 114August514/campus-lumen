import { describe, expect, test } from "bun:test";
import { advisors } from "../src/lib/advisors";
import { CampusAgoraApiError } from "@campus-agora/api-client";
import { aiFailureState, buildAiRequest } from "../src/lib/ai-request";
import type { ExplorationTopic } from "../src/lib/exploration-store";

const candidate = advisors[0];
const other = advisors[1];
const topic: ExplorationTopic = {
  id: "topic-a",
  name: "主题A",
  question: "不自动发送的主题问题",
  preferences: "不自动发送的偏好",
  createdAt: "2026-10-28T00:00:00.000Z",
  updatedAt: "2026-10-28T00:00:00.000Z",
  candidates: [
    {
      candidate,
      reason: "只选择这一条私人理由",
      questions: ["不发送的疑问"],
      savedAt: "2026-10-28T00:00:00.000Z",
    },
    {
      candidate: other,
      reason: "同主题未选择的私人理由",
      questions: [],
      savedAt: "2026-10-28T00:00:00.000Z",
    },
  ],
};
const otherTopic: ExplorationTopic = {
  ...topic,
  id: "topic-b",
  name: "主题B",
  candidates: [
    {
      candidate,
      reason: "其他主题的私人内容",
      questions: [],
      savedAt: "2026-10-28T00:00:00.000Z",
    },
  ],
};

describe("explicit AI input selection", () => {
  test("contains only the task and one selected reason, not the rest of either topic", () => {
    const request = buildAiRequest({
      provider: "school",
      task: "解释这条理由与公开资料的关系",
      privateCandidateId: candidate.candidateId,
      topic,
    });
    expect(request.personalContext).toBe("只选择这一条私人理由");
    expect(request.publicContext).toBe("");
    const serialized = JSON.stringify(request);
    expect(serialized).not.toContain("不自动发送");
    expect(serialized).not.toContain("不发送的疑问");
    expect(serialized).not.toContain("同主题未选择");
    expect(serialized).not.toContain(otherTopic.candidates[0].reason);
  });

  test("unchecking private input and public evidence removes both from a later request", () => {
    const request = buildAiRequest({
      provider: "school",
      task: "只回答这个问题",
      candidate,
      includePublicContext: false,
      topic,
    });
    expect(request.personalContext).toBeUndefined();
    expect(request.publicContext).toBe("");
    expect(JSON.stringify(request)).not.toContain("私人理由");
  });

  test("public evidence is opt-in and custom credentials stay only in the request", () => {
    const request = buildAiRequest({
      provider: "custom",
      task: "比较研究问题",
      candidate,
      includePublicContext: true,
      custom: {
        baseUrl: " https://api.example.com/v1 ",
        model: " test-model ",
        apiKey: "ephemeral-test-key",
      },
    });
    expect(request.publicContext).toContain(candidate.research);
    expect(request.baseUrl).toBe("https://api.example.com/v1");
    expect(request.model).toBe("test-model");
    expect(request.apiKey).toBe("ephemeral-test-key");
    expect(request.personalContext).toBeUndefined();
  });
});

describe("AI send state after a failure", () => {
  const apiError = (code: string, status: number) =>
    new CampusAgoraApiError("failed", { code, status });

  test("errors raised before contacting the service are definite failures", () => {
    for (const code of [
      "validation_failed",
      "invalid_ai_provider",
      "school_ai_not_configured",
      "ai_busy",
    ]) {
      expect(aiFailureState(apiError(code, 422))).toBe("error");
    }
    expect(aiFailureState(apiError("ai_provider_rejected", 502))).toBe("error");
  });

  test("upstream, proxy, network and abort failures stay possibly sent", () => {
    expect(aiFailureState(apiError("ai_upstream_failed", 502))).toBe("uncertain");
    expect(aiFailureState(apiError("ai_invalid_response", 502))).toBe("uncertain");
    expect(aiFailureState(apiError("internal_error", 500))).toBe("uncertain");
    expect(aiFailureState(apiError("network_error", 0))).toBe("uncertain");
    expect(aiFailureState(new DOMException("aborted", "AbortError"))).toBe("uncertain");
  });
});
