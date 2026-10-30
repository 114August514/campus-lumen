import type { Advisor } from "./advisors";
import type { CandidateSnapshot, ExplorationTopic } from "./exploration-store";

/** Only the active topic contributes saved objects; private notes are never copied. */
export function comparisonCandidatesForTopic(
  publicCandidates: Advisor[],
  topic?: ExplorationTopic,
): Advisor[] {
  const candidates = new Map(publicCandidates.map((item) => [item.candidateId, item]));
  for (const { candidate } of topic?.candidates ?? []) {
    candidates.set(candidate.candidateId, savedCandidateForComparison(candidate));
  }
  return [...candidates.values()];
}

export function savedCandidateForComparison(candidate: CandidateSnapshot): Advisor {
  return {
    ...candidate,
    approach:
      candidate.approach ?? "由你确认关联的已读来源；尚未自动提取研究方法或岗位职责。",
    participation:
      candidate.participation ??
      candidate.participationRoutes?.map((route) => route.details).join("\n") ??
      "参与条件尚未结构化核实，请核对下列来源的对象、年份和途径。",
    unknowns:
      candidate.unknowns ??
      "身份关联由你确认；当前名额、具体条件与实际参与体验仍需按原文核实。",
  };
}
