// Repair of mistaken public associations (advisor-task-design.md "错误合并如何修正").
// A maintainer records a split in a public file; the public list is rebuilt from it,
// and saved topic records are re-pointed only when their own source URLs identify
// one new object. Private reasons are never read, copied or rewritten here.
import type { Advisor } from "./advisors";
import type { CandidateIdentity, ExplorationTopic } from "./exploration-store";

export interface SplitTarget {
  candidateId: string;
  name: string;
  institution: string;
  research?: string;
  approach?: string;
  participation?: string;
  unknowns?: string;
  /** Every source of the merged record must be assigned to exactly one target. */
  sourceUrls: string[];
}

export interface AssociationCorrection {
  correctionId: string;
  decidedAt: string;
  reason: string;
  fromCandidateId: string;
  into: SplitTarget[];
}

export interface CorrectionNote {
  correctionId: string;
  decidedAt: string;
  reason: string;
  fromCandidateId: string;
}

type RecordValue = Record<string, unknown>;

function object(value: unknown, fields: string[], context: string): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`关联更正的${context}需要是对象。`);
  }
  const record = value as RecordValue;
  if (Object.keys(record).some((key) => !fields.includes(key))) {
    throw new Error(`关联更正的${context}包含未约定字段；更正文件不能包含私人记录。`);
  }
  return record;
}

function text(value: unknown, context: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`关联更正的${context}需要是非空字符串。`);
  }
  return value;
}

function optionalText(value: unknown, context: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error(`关联更正的${context}需要是字符串。`);
  return value;
}

/** Parses the public correction file; rejects anything beyond the agreed fields. */
export function parseAssociationCorrections(input: unknown): AssociationCorrection[] {
  const file = object(input, ["version", "corrections"], "文件");
  if (file.version !== 1) throw new Error("关联更正文件版本不受支持。");
  if (!Array.isArray(file.corrections)) throw new Error("关联更正需要是数组。");
  const ids = new Set<string>();
  return file.corrections.map((value): AssociationCorrection => {
    const record = object(
      value,
      ["correctionId", "decidedAt", "reason", "fromCandidateId", "into"],
      "条目",
    );
    const correctionId = text(record.correctionId, "标识");
    if (ids.has(correctionId)) throw new Error(`关联更正${correctionId}重复。`);
    ids.add(correctionId);
    const decidedAt = text(record.decidedAt, "决定时间");
    if (!Number.isFinite(Date.parse(decidedAt))) {
      throw new Error(`关联更正${correctionId}的决定时间无效。`);
    }
    if (!Array.isArray(record.into) || record.into.length < 2) {
      throw new Error(`关联更正${correctionId}需要拆成至少两个对象。`);
    }
    return {
      correctionId,
      decidedAt,
      reason: text(record.reason, "更正依据"),
      fromCandidateId: text(record.fromCandidateId, "原对象标识"),
      into: record.into.map((item): SplitTarget => {
        const target = object(
          item,
          [
            "candidateId",
            "name",
            "institution",
            "research",
            "approach",
            "participation",
            "unknowns",
            "sourceUrls",
          ],
          "拆分对象",
        );
        if (
          !Array.isArray(target.sourceUrls) ||
          target.sourceUrls.length === 0 ||
          !target.sourceUrls.every((url) => typeof url === "string" && url.trim())
        ) {
          throw new Error(`关联更正${correctionId}的每个拆分对象至少需要一个来源URL。`);
        }
        return {
          candidateId: text(target.candidateId, "拆分对象标识"),
          name: text(target.name, "拆分对象名称"),
          institution: text(target.institution, "拆分对象机构"),
          research: optionalText(target.research, "研究说明"),
          approach: optionalText(target.approach, "工作说明"),
          participation: optionalText(target.participation, "参与说明"),
          unknowns: optionalText(target.unknowns, "未知事项"),
          sourceUrls: target.sourceUrls as string[],
        };
      }),
    };
  });
}

/**
 * Rebuild a public list after splits. Corrections whose original id is not in this
 * list are ignored here (they may belong to another list); every source of a split
 * record must be assigned to exactly one target, so nothing is silently dropped.
 */
export function applyAssociationCorrections<T extends Advisor>(
  candidates: T[],
  corrections: AssociationCorrection[],
): (T & { correctionNote?: CorrectionNote })[] {
  let result: (T & { correctionNote?: CorrectionNote })[] = [...candidates];
  for (const correction of corrections) {
    const original = result.find(
      (item) => item.candidateId === correction.fromCandidateId,
    );
    if (!original) continue;
    const targetIds = correction.into.map((target) => target.candidateId);
    if (new Set(targetIds).size !== targetIds.length) {
      throw new Error(`关联更正${correction.correctionId}的拆分对象标识重复。`);
    }
    for (const id of targetIds) {
      if (
        id !== original.candidateId &&
        result.some((item) => item.candidateId === id)
      ) {
        throw new Error(
          `关联更正${correction.correctionId}的对象${id}与已有对象重复。`,
        );
      }
    }
    const assigned = correction.into.flatMap((target) => target.sourceUrls);
    if (new Set(assigned).size !== assigned.length) {
      throw new Error(`关联更正${correction.correctionId}把同一来源分给了多个对象。`);
    }
    const originalUrls = new Set(original.sources.map((source) => source.url));
    const unknown = assigned.filter((url) => !originalUrls.has(url));
    if (unknown.length) {
      throw new Error(`关联更正${correction.correctionId}引用了原对象中没有的来源。`);
    }
    if (assigned.length !== originalUrls.size) {
      throw new Error(`关联更正${correction.correctionId}还有来源没有分配给任何对象。`);
    }
    const note: CorrectionNote = {
      correctionId: correction.correctionId,
      decidedAt: correction.decidedAt,
      reason: correction.reason,
      fromCandidateId: correction.fromCandidateId,
    };
    const split = correction.into.map((target) => {
      const keepsIdentity = target.candidateId === original.candidateId;
      return {
        ...original,
        candidateId: target.candidateId,
        name: target.name,
        institution: target.institution,
        // Only the object keeping the original id inherits unconfirmed descriptions.
        research: target.research ?? (keepsIdentity ? original.research : ""),
        approach: target.approach ?? (keepsIdentity ? original.approach : ""),
        participation:
          target.participation ?? (keepsIdentity ? original.participation : ""),
        unknowns:
          target.unknowns ??
          (keepsIdentity ? original.unknowns : "拆分后尚未整理；以所附来源为准。"),
        sources: original.sources.filter((source) =>
          target.sourceUrls.includes(source.url),
        ),
        correctionNote: note,
      };
    });
    const index = result.indexOf(original);
    result = [...result.slice(0, index), ...split, ...result.slice(index + 1)];
  }
  return result;
}

export type AssociationRepair =
  | {
      kind: "relink";
      topicId: string;
      fromCandidateId: string;
      correctionId: string;
      target: CandidateIdentity;
    }
  | {
      kind: "pending";
      topicId: string;
      fromCandidateId: string;
      correctionId: string;
      options: CandidateIdentity[];
    };

function identity(target: SplitTarget): CandidateIdentity {
  return {
    candidateId: target.candidateId,
    name: target.name,
    institution: target.institution,
    research: target.research ?? "",
  };
}

/**
 * Decide, from each saved record's own source URLs only, whether it can be re-pointed
 * to one split object. Ambiguous or colliding records wait for the user. Records
 * already handled for a correction are skipped, so planning is idempotent.
 */
export function planAssociationRepairs(
  topics: ExplorationTopic[],
  corrections: AssociationCorrection[],
): AssociationRepair[] {
  const repairs: AssociationRepair[] = [];
  for (const topic of topics) {
    for (const record of topic.candidates) {
      for (const correction of corrections) {
        if (record.candidate.candidateId !== correction.fromCandidateId) continue;
        if (record.association?.correctionId === correction.correctionId) continue;
        const urls = record.candidate.sources.map((source) => source.url);
        const matched = correction.into.filter((target) =>
          urls.some((url) => target.sourceUrls.includes(url)),
        );
        const allMatched = urls.every((url) =>
          correction.into.some((target) => target.sourceUrls.includes(url)),
        );
        const only = matched.length === 1 && allMatched ? matched[0] : undefined;
        if (only && only.candidateId === record.candidate.candidateId) continue;
        const collides =
          only &&
          topic.candidates.some(
            (other) => other.candidate.candidateId === only.candidateId,
          );
        if (only && !collides) {
          repairs.push({
            kind: "relink",
            topicId: topic.id,
            fromCandidateId: correction.fromCandidateId,
            correctionId: correction.correctionId,
            target: identity(only),
          });
        } else {
          repairs.push({
            kind: "pending",
            topicId: topic.id,
            fromCandidateId: correction.fromCandidateId,
            correctionId: correction.correctionId,
            options: correction.into.map(identity),
          });
        }
      }
    }
  }
  return repairs;
}
