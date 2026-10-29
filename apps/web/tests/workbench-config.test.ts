import { describe, expect, test } from "bun:test";
import {
  comparisonSupportedCandidateIds,
  internshipComparisonSupportedCandidateIds,
} from "../src/lib/advisor-comparison";
import { allOpportunities } from "../src/lib/advisors";
import {
  EXPLORATION_STORAGE_KEY,
  createExplorationStore,
} from "../src/lib/exploration-store";
import {
  DEFAULT_WORKBENCH_SELECTION,
  WORKBENCH_PREVIEW_STORAGE_KEY,
  createPreviewStorage,
  isWorkbenchCandidateId,
  parseWorkbenchMessage,
  parseWorkbenchSelection,
  searchFromSelection,
  selectionFromSearch,
  workbenchNavigateMessage,
  workbenchSelectionMessage,
} from "../src/workbench/workbench-config";

const realCandidate = allOpportunities[0];
if (!realCandidate) throw new Error("built-in sample candidates are missing");

describe("workbench selection", () => {
  test("default selection points at real built-in sample content", () => {
    expect(isWorkbenchCandidateId(DEFAULT_WORKBENCH_SELECTION.candidateId)).toBe(
      true,
    );
    expect(allOpportunities.length).toBeGreaterThan(0);
    for (const id of [
      ...comparisonSupportedCandidateIds,
      ...internshipComparisonSupportedCandidateIds,
    ]) {
      expect(isWorkbenchCandidateId(id)).toBe(true);
    }
  });

  test("URL parameters round-trip a valid selection", () => {
    const selection = {
      screen: "compare",
      candidateId: realCandidate.candidateId,
      pair: "internships",
    } as const;
    const parsed = selectionFromSearch(`?${searchFromSelection(selection)}`);
    expect(parsed).toEqual(selection);
  });

  test("URL parsing falls back per field instead of trusting input", () => {
    const parsed = selectionFromSearch(
      "?screen=admin&candidate=not-a-real-candidate&pair=everything",
    );
    expect(parsed).toEqual(DEFAULT_WORKBENCH_SELECTION);
    // Valid fields survive alongside invalid ones.
    const mixed = selectionFromSearch(
      `?screen=detail&candidate=${realCandidate.candidateId}&pair=nope`,
    );
    expect(mixed.screen).toBe("detail");
    expect(mixed.candidateId).toBe(realCandidate.candidateId);
    expect(mixed.pair).toBe("advisors");
  });

  test("strict message selection parse rejects unknown screens and candidates", () => {
    expect(
      parseWorkbenchSelection({
        screen: "detail",
        candidateId: realCandidate.candidateId,
        pair: "advisors",
      }),
    ).toEqual({
      screen: "detail",
      candidateId: realCandidate.candidateId,
      pair: "advisors",
    });
    expect(
      parseWorkbenchSelection({
        screen: "settings",
        candidateId: realCandidate.candidateId,
        pair: "advisors",
      }),
    ).toBeNull();
    expect(
      parseWorkbenchSelection({
        screen: "detail",
        candidateId: "javascript:alert(1)",
        pair: "advisors",
      }),
    ).toBeNull();
    expect(parseWorkbenchSelection(null)).toBeNull();
    expect(parseWorkbenchSelection("detail")).toBeNull();
  });
});

describe("workbench message protocol", () => {
  const selection = {
    screen: "home",
    candidateId: realCandidate.candidateId,
    pair: "advisors",
  } as const;

  test("accepts well-formed shell and canvas messages", () => {
    expect(parseWorkbenchMessage(workbenchSelectionMessage(selection))).toEqual({
      source: "campus-lumen-workbench",
      type: "selection",
      selection,
    });
    expect(parseWorkbenchMessage(workbenchNavigateMessage(selection))?.type).toBe(
      "navigate",
    );
  });

  test("ignores foreign, malformed or hostile messages", () => {
    expect(parseWorkbenchMessage(null)).toBeNull();
    expect(parseWorkbenchMessage(undefined)).toBeNull();
    expect(parseWorkbenchMessage("selection")).toBeNull();
    expect(parseWorkbenchMessage({ source: "other-tool", type: "selection", selection })).toBeNull();
    expect(
      parseWorkbenchMessage({
        source: "campus-lumen-workbench",
        type: "execute",
        selection,
      }),
    ).toBeNull();
    expect(
      parseWorkbenchMessage({
        source: "campus-lumen-workbench",
        type: "selection",
        selection: { screen: "home", candidateId: "fake", pair: "advisors" },
      }),
    ).toBeNull();
  });
});

describe("preview storage isolation", () => {
  test("preview saves never touch the product exploration key", () => {
    const previewStorage = createPreviewStorage();
    const store = createExplorationStore(
      previewStorage,
      WORKBENCH_PREVIEW_STORAGE_KEY,
    );
    expect(WORKBENCH_PREVIEW_STORAGE_KEY).not.toBe(EXPLORATION_STORAGE_KEY);

    const topic = store.createTopic({ name: "预览主题（仅内存）" });
    store.saveCandidate(topic.id, {
      candidateId: realCandidate.candidateId,
      name: realCandidate.name,
      institution: realCandidate.institution,
      research: realCandidate.research,
      sources: realCandidate.sources,
    });

    // The product's storage backend sees nothing from the preview session.
    const productStorage = createPreviewStorage();
    const productStore = createExplorationStore(productStorage);
    expect(productStore.listTopics()).toEqual([]);
    expect(productStorage.getItem(EXPLORATION_STORAGE_KEY)).toBeNull();
    // The preview record exists only under the workbench key in its own map.
    expect(previewStorage.getItem(EXPLORATION_STORAGE_KEY)).toBeNull();
    expect(previewStorage.getItem(WORKBENCH_PREVIEW_STORAGE_KEY)).not.toBeNull();
    expect(store.listTopics()).toHaveLength(1);
  });

  test("separate preview sessions do not share records", () => {
    const first = createExplorationStore(
      createPreviewStorage(),
      WORKBENCH_PREVIEW_STORAGE_KEY,
    );
    const second = createExplorationStore(
      createPreviewStorage(),
      WORKBENCH_PREVIEW_STORAGE_KEY,
    );
    first.createTopic({ name: "第一个画布的临时主题" });
    expect(second.listTopics()).toEqual([]);
  });
});
