import { type AiChatRequest, CampusAgoraApiError } from "@campus-agora/api-client";
import type { Advisor } from "./advisors";
import type { ExplorationTopic } from "./exploration-store";

export type AiProvider = "school" | "custom";

export interface AiSelection {
  provider: AiProvider;
  task: string;
  candidate?: Advisor;
  includePublicContext: boolean;
  privateCandidateId?: string;
  topic?: ExplorationTopic;
  custom?: {
    baseUrl: string;
    model: string;
    apiKey: string;
  };
}

export function publicCandidateContext(candidate: Advisor): string {
  const sources = candidate.sources
    .map(
      (source) =>
        `来源：${source.title}\n链接：${source.url}\n取得时间：${source.collectedAt}\n内容：${source.content}`,
    )
    .join("\n\n");
  return [
    `候选：${candidate.name}`,
    `机构：${candidate.institution}`,
    `研究或岗位方向：${candidate.research}`,
    `方法与背景：${candidate.approach}`,
    `参与途径：${
      candidate.participationRoutes?.length
        ? candidate.participationRoutes
            .map((route) => `${route.label}：${route.details}`)
            .join("\n")
        : candidate.participation
    }`,
    `仍待确认：${candidate.unknowns}`,
    sources,
  ].join("\n");
}

/** Errors the API returns before contacting any AI service. */
const NOT_SENT_CODES = new Set([
  "validation_failed",
  "invalid_ai_provider",
  "school_ai_not_configured",
  "ai_busy",
]);

/**
 * "error" only when the content was certainly not sent, or the service
 * explicitly answered with a rejection; anything else may have been delivered.
 */
export function aiFailureState(failure: unknown): "error" | "uncertain" {
  if (
    failure instanceof CampusAgoraApiError &&
    failure.status > 0 &&
    (NOT_SENT_CODES.has(failure.code) || failure.code === "ai_provider_rejected")
  ) {
    return "error";
  }
  return "uncertain";
}

/** Build only from explicit UI selections; never read a whole topic as AI context. */
export function buildAiRequest(selection: AiSelection): AiChatRequest {
  const privateRecord = selection.privateCandidateId
    ? selection.topic?.candidates.find(
        (record) =>
          record.candidate.candidateId === selection.privateCandidateId &&
          record.reason.trim().length > 0,
      )
    : undefined;
  return {
    provider: selection.provider,
    task: selection.task.trim(),
    publicContext:
      selection.includePublicContext && selection.candidate
        ? publicCandidateContext(selection.candidate)
        : "",
    ...(privateRecord ? { personalContext: privateRecord.reason } : {}),
    ...(selection.provider === "custom" && selection.custom
      ? {
          baseUrl: selection.custom.baseUrl.trim(),
          model: selection.custom.model.trim(),
          apiKey: selection.custom.apiKey,
        }
      : {}),
  };
}
