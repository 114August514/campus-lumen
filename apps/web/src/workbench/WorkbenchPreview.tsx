// Dev workbench canvas: renders the real product screens (explore home,
// candidate detail, comparison) with the repository's built-in public sample
// data. Saving goes through the real exploration store code backed by
// in-memory storage only; the canvas never touches the browser's exploration
// records and never starts external discovery.
import { Banner, Stack, Text } from "@primer/react";
import { useState } from "react";
import {
  AdvisorComparison,
  type ComparisonNotes,
} from "../components/AdvisorComparison";
import { AdvisorDetail } from "../components/AdvisorDetail";
import { ExploreHome } from "../components/ExploreHome";
import {
  type AnyComparisonFocus,
  type AnyComparisonPerspective,
  comparisonSupportedCandidateIds,
  internshipComparisonSupportedCandidateIds,
} from "../lib/advisor-comparison";
import { allOpportunities } from "../lib/advisors";
import { getSupplementalSources } from "../lib/comparison-followup";
import {
  type CandidateSnapshot,
  createExplorationStore,
} from "../lib/exploration-store";
import {
  WORKBENCH_PREVIEW_STORAGE_KEY,
  type WorkbenchPair,
  type WorkbenchSelection,
  createPreviewStorage,
} from "./workbench-config";

function createPreviewSession() {
  const store = createExplorationStore(
    createPreviewStorage(),
    WORKBENCH_PREVIEW_STORAGE_KEY,
  );
  const topic = store.createTopic({
    name: "预览主题（仅内存）",
    question: "工作台画布预览",
  });
  return { store, topicId: topic.id };
}

interface CompareState {
  pair: WorkbenchPair;
  perspective: AnyComparisonPerspective;
  focus: AnyComparisonFocus;
  removedIds: string[];
  notes: Record<string, ComparisonNotes>;
}

function freshCompareState(pair: WorkbenchPair): CompareState {
  return {
    pair,
    perspective: pair === "internships" ? "role" : "research",
    focus: "open",
    removedIds: [],
    notes: {},
  };
}

interface Feedback {
  variant: "success" | "warning";
  text: string;
}

export function WorkbenchPreview({
  selection,
  onNavigate,
}: {
  selection: WorkbenchSelection;
  onNavigate?: (next: WorkbenchSelection) => void;
}) {
  const [session] = useState(createPreviewSession);
  const [, setRevision] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [compare, setCompare] = useState(() => freshCompareState(selection.pair));
  if (compare.pair !== selection.pair) {
    // Switching the comparison pair resets its temporary state, like leaving
    // and reopening a comparison in the product.
    setCompare(freshCompareState(selection.pair));
  }
  // Feedback belongs to the content it was produced on; switching the preview
  // screen, candidate or pair clears it so stale success notes cannot
  // describe a different view.
  const [feedbackSelection, setFeedbackSelection] = useState(selection);
  if (
    feedbackSelection.screen !== selection.screen ||
    feedbackSelection.candidateId !== selection.candidateId ||
    feedbackSelection.pair !== selection.pair
  ) {
    setFeedbackSelection(selection);
    setFeedback(null);
  }
  const topic = session.store.getTopic(session.topicId);
  const advisor = allOpportunities.find(
    (item) => item.candidateId === selection.candidateId,
  );
  const baseIds =
    selection.pair === "internships"
      ? internshipComparisonSupportedCandidateIds
      : comparisonSupportedCandidateIds;
  const comparisonCandidates = baseIds
    .filter((id) => !compare.removedIds.includes(id))
    .flatMap((id) => {
      const found = allOpportunities.find((item) => item.candidateId === id);
      return found ? [found] : [];
    });

  function navigate(next: WorkbenchSelection) {
    setFeedback(null);
    onNavigate?.(next);
  }

  function saveCandidate(
    candidate: CandidateSnapshot,
    reason: string,
    questions: string[],
  ) {
    session.store.saveCandidate(session.topicId, candidate, { reason, questions });
    setRevision((value) => value + 1);
    setFeedback({
      variant: "success",
      text: `已把${candidate.name}保存到内存预览主题；刷新画布即消失，浏览器中的探索记录不受影响。`,
    });
  }

  return (
    <Stack gap="spacious">
      <div aria-live="polite">
        {feedback && (
          <Banner variant={feedback.variant} layout="compact" title={feedback.text} />
        )}
      </div>
      {selection.screen === "home" ? (
        <ExploreHome
          advisors={allOpportunities}
          onOpenAdvisors={() => navigate({ ...selection, screen: "detail" })}
          onOpenAdvisor={(candidateId) =>
            navigate({ ...selection, screen: "detail", candidateId })
          }
          onOpenType={() =>
            setFeedback({
              variant: "warning",
              text: "“机会与入口”界面暂未纳入工作台第一版，请在正式页面查看。",
            })
          }
        />
      ) : selection.screen === "detail" ? (
        advisor && (
          <AdvisorDetail advisor={advisor} topic={topic} onSave={saveCandidate} />
        )
      ) : (
        <AdvisorComparison
          candidates={comparisonCandidates}
          perspective={compare.perspective}
          focus={compare.focus}
          topicName={topic?.name}
          notes={compare.notes}
          supplementalSources={Object.fromEntries(
            comparisonCandidates.map((candidate) => [
              candidate.candidateId,
              getSupplementalSources(candidate, topic),
            ]),
          )}
          onFollowup={(candidate) =>
            setFeedback({
              variant: "warning",
              text: `工作台不发起外部查找；${candidate.name}的补查请在正式页面的比较视图中进行。`,
            })
          }
          onPerspectiveChange={(value) =>
            setCompare((state) => ({ ...state, perspective: value }))
          }
          onFocusChange={(value) => setCompare((state) => ({ ...state, focus: value }))}
          onRemove={(id) =>
            setCompare((state) => ({
              ...state,
              removedIds: [...state.removedIds, id],
            }))
          }
          onReturn={() => navigate({ ...selection, screen: "detail" })}
          onNotesChange={(id, notes) =>
            setCompare((state) => ({
              ...state,
              notes: { ...state.notes, [id]: notes },
            }))
          }
          onSave={(candidate, notes) => {
            const questions = notes.questions
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean);
            session.store.saveCandidate(session.topicId, candidate, {
              reason: notes.reason,
              questions,
            });
            if (
              topic?.candidates.some(
                (record) => record.candidate.candidateId === candidate.candidateId,
              )
            ) {
              session.store.updateCandidate(session.topicId, candidate.candidateId, {
                reason: notes.reason,
                questions,
              });
            }
            setRevision((value) => value + 1);
            setFeedback({
              variant: "success",
              text: `已把${candidate.name}的比较记录保存到内存预览主题；刷新画布即消失，浏览器中的探索记录不受影响。`,
            });
          }}
        />
      )}
      <Text as="p" size="small">
        预览画布：组件与数据来自正式页面的真实实现和仓库内置公开样例；保存只写入内存。
      </Text>
    </Stack>
  );
}
