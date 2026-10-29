import type { AnalysisRequest, AnalysisResponse } from "./generated";
import { requestJson } from "./request";

export interface RequestAnalysisOptions {
  signal?: AbortSignal;
  baseUrl?: string;
  onDispatched?: () => void;
}

export function requestAnalysis(
  body: AnalysisRequest,
  options: RequestAnalysisOptions = {},
): Promise<AnalysisResponse> {
  const response = requestJson<AnalysisResponse>(
    {
      baseUrl: options.baseUrl ?? "",
      fetchImpl: globalThis.fetch.bind(globalThis),
    },
    "/api/v1/analyses",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: options.signal,
    },
  );
  options.onDispatched?.();
  return response;
}
