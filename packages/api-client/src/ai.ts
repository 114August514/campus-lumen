import type { AiChatRequest, AiChatResponse, AiProvidersResponse } from "./generated";
import type { CampusAgoraApiClientOptions } from "./meta";
import { requestJson } from "./request";

export interface AiRequestOptions extends CampusAgoraApiClientOptions {
  signal?: AbortSignal;
}

export function getAiProviders(
  options: CampusAgoraApiClientOptions = {},
): Promise<AiProvidersResponse> {
  return requestJson<AiProvidersResponse>(
    {
      baseUrl: options.baseUrl ?? "",
      fetchImpl: options.fetchImpl ?? globalThis.fetch.bind(globalThis),
      requestId: options.requestId,
    },
    "/api/v1/ai/providers",
  );
}

export function createAiCompletion(
  input: AiChatRequest,
  options: AiRequestOptions = {},
): Promise<AiChatResponse> {
  return requestJson<AiChatResponse>(
    {
      baseUrl: options.baseUrl ?? "",
      fetchImpl: options.fetchImpl ?? globalThis.fetch.bind(globalThis),
      requestId: options.requestId,
    },
    "/api/v1/ai/completions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: options.signal,
    },
  );
}
