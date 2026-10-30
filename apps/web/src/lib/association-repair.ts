import type { CandidateSnapshot } from "./exploration-store";

export type PrivateRecordDestination = "keep" | "move";

export function splitCandidateId(candidateId: string, routeId: string): string {
  return `${candidateId}--${routeId}`;
}

/**
 * Split one structured route without inventing evidence or copying private records.
 * Sources explicitly supporting the route move with it; sources shared with a
 * remaining route stay on both sides. General sources stay with the original.
 */
export function splitParticipationRoute(
  candidate: CandidateSnapshot,
  routeId: string,
): { remaining: CandidateSnapshot; split: CandidateSnapshot } {
  const routes = candidate.participationRoutes ?? [];
  const route = routes.find((item) => item.routeId === routeId);
  if (!route || routes.length < 2) {
    throw new Error("这个候选没有可拆分的多条结构化参与途径。");
  }
  const remainingRoutes = routes.filter((item) => item.routeId !== routeId);
  const splitId = splitCandidateId(candidate.candidateId, routeId);
  const splitSources = candidate.sources.filter((source) =>
    route.sourceUrls.includes(source.url),
  );
  if (!splitSources.length) {
    throw new Error("所选参与途径没有可对应的来源，请先修正来源关联。");
  }
  const remainingSourceUrls = new Set(
    remainingRoutes.flatMap((item) => item.sourceUrls),
  );
  const splitSourceUrls = new Set(route.sourceUrls);
  const remaining: CandidateSnapshot = {
    ...candidate,
    participationRoutes: remainingRoutes,
    participation: remainingRoutes.map((item) => item.details).join("\n"),
    sources: candidate.sources.filter(
      (source) =>
        !splitSourceUrls.has(source.url) || remainingSourceUrls.has(source.url),
    ),
  };
  const split: CandidateSnapshot = {
    ...candidate,
    candidateId: splitId,
    title: route.label,
    participationRoutes: [route],
    participation: route.details,
    sources: splitSources,
  };
  return { remaining, split };
}
