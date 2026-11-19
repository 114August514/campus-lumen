import { useCallback } from "react";
import { type CatalogItem, toSaveTarget } from "../lib/catalog";
import type {
  CandidateSnapshot,
  Decision,
  ExplorationTopic,
} from "../lib/exploration-store";
import { useAppState } from "./app-state";

export interface PrivateRecord {
  reason: string;
  questions: string[];
  decision?: Decision;
}

/** This topic's own record for the item, or undefined. Never looks at other topics. */
export function recordFor(
  topic: ExplorationTopic | undefined,
  item: CatalogItem,
): PrivateRecord | undefined {
  if (!topic) return undefined;
  return item.kind === "entry"
    ? topic.opportunities?.find(
        (record) => record.opportunity.opportunityId === item.id,
      )
    : topic.candidates.find((record) => record.candidate.candidateId === item.id);
}

/** Save, annotate and triage items in the current session only. */
export function useSessionActions() {
  const { topic, mutate, setMessage } = useAppState();

  const requireTopic = useCallback(() => {
    if (topic) return topic;
    setMessage({
      tone: "info",
      text: "先在“探索”中保存为探索主题，再把对象加入；浏览和比较不需要保存。",
    });
    return undefined;
  }, [topic, setMessage]);

  const addItem = useCallback(
    (item: CatalogItem, notes: Partial<PrivateRecord> = {}) => {
      const current = requireTopic();
      if (!current) return false;
      const target = toSaveTarget(item);
      return mutate(
        (store) =>
          target.kind === "candidate"
            ? store.saveCandidate(current.id, target.snapshot, notes)
            : store.saveOpportunity(current.id, target.snapshot, notes),
        `已加入“${current.name}”。私人理由只保存在这个主题。`,
      );
    },
    [mutate, requireTopic],
  );

  /** Store a newly read candidate (or new evidence for one) in the current topic. */
  const saveCandidateSnapshot = useCallback(
    (snapshot: CandidateSnapshot, success: string) => {
      const current = requireTopic();
      if (!current) return false;
      return mutate((store) => store.saveCandidate(current.id, snapshot), success);
    },
    [mutate, requireTopic],
  );

  const removeItem = useCallback(
    (item: CatalogItem) => {
      if (!topic) return false;
      return mutate(
        (store) =>
          item.kind === "entry"
            ? store.removeOpportunity(topic.id, item.id)
            : store.removeCandidate(topic.id, item.id),
        "已从这个主题移除；其他主题和公共资料不受影响。",
      );
    },
    [mutate, topic],
  );

  const updateNotes = useCallback(
    (item: CatalogItem, reason: string, questions: string[]) => {
      if (!topic) return false;
      return mutate(
        (store) =>
          item.kind === "entry"
            ? store.updateOpportunity(topic.id, item.id, { reason, questions })
            : store.updateCandidate(topic.id, item.id, { reason, questions }),
        "私人理由和待问已保存。",
      );
    },
    [mutate, topic],
  );

  const setDecision = useCallback(
    (item: CatalogItem, decision: Decision | null) => {
      if (!topic) return false;
      return mutate((store) =>
        store.setDecision(
          topic.id,
          { kind: item.kind === "entry" ? "opportunity" : "candidate", id: item.id },
          decision,
        ),
      );
    },
    [mutate, topic],
  );

  return {
    topic,
    addItem,
    saveCandidateSnapshot,
    removeItem,
    updateNotes,
    setDecision,
  };
}
