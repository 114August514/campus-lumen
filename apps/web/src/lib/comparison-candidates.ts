import type { Advisor } from "./advisors";
import type { CandidateSnapshot } from "./exploration-store";

/**
 * A saved object that is not in the public catalog (for example one created from a
 * live reading). Only its identity and retained sources are reused; private notes
 * are never copied, and unstructured fields say so instead of inventing facts.
 */
export function savedCandidateForComparison(candidate: CandidateSnapshot): Advisor {
  return {
    ...candidate,
    approach: "由你确认关联的已读来源；尚未自动提取研究方法或岗位职责。",
    participation: "参与条件尚未结构化核实，请核对下列来源的对象、年份和途径。",
    unknowns: "身份关联由你确认；当前名额、具体条件与实际参与体验仍需按原文核实。",
  };
}
