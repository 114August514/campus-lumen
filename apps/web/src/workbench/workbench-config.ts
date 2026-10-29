// Shared configuration for the dev-only UI workbench: which real screen and
// content the canvas shows, how that selection travels through URL parameters
// and postMessage, and the in-memory storage used instead of localStorage.
// Only repository built-in public sample candidates are valid preview content.
import { allOpportunities } from "../lib/advisors";

export type WorkbenchScreen = "home" | "detail" | "compare";
export type WorkbenchPair = "advisors" | "internships";

export interface WorkbenchSelection {
  screen: WorkbenchScreen;
  candidateId: string;
  pair: WorkbenchPair;
}

// Deliberately different from the product's EXPLORATION_STORAGE_KEY, and only
// ever used with in-memory storage; this key must never reach localStorage.
export const WORKBENCH_PREVIEW_STORAGE_KEY = "campus-lumen:workbench-preview:v1";
export const WORKBENCH_MESSAGE_SOURCE = "campus-lumen-workbench";

const workbenchScreens: readonly WorkbenchScreen[] = ["home", "detail", "compare"];
const workbenchPairs: readonly WorkbenchPair[] = ["advisors", "internships"];

export function isWorkbenchScreen(value: unknown): value is WorkbenchScreen {
  return (
    typeof value === "string" && (workbenchScreens as readonly string[]).includes(value)
  );
}

export function isWorkbenchPair(value: unknown): value is WorkbenchPair {
  return (
    typeof value === "string" && (workbenchPairs as readonly string[]).includes(value)
  );
}

export function isWorkbenchCandidateId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    allOpportunities.some((item) => item.candidateId === value)
  );
}

export const DEFAULT_WORKBENCH_SELECTION: WorkbenchSelection = {
  screen: "home",
  candidateId: allOpportunities[0]?.candidateId ?? "",
  pair: "advisors",
};

function isSelectionRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Strict parse for cross-document messages: every field must be valid. */
export function parseWorkbenchSelection(value: unknown): WorkbenchSelection | null {
  if (!isSelectionRecord(value)) return null;
  if (
    isWorkbenchScreen(value.screen) &&
    isWorkbenchCandidateId(value.candidateId) &&
    isWorkbenchPair(value.pair)
  ) {
    return { screen: value.screen, candidateId: value.candidateId, pair: value.pair };
  }
  return null;
}

/** Lenient parse for deep links: each invalid field falls back to its default. */
export function selectionFromSearch(search: string): WorkbenchSelection {
  const params = new URLSearchParams(search);
  const screen = params.get("screen");
  const candidateId = params.get("candidate");
  const pair = params.get("pair");
  return {
    screen: isWorkbenchScreen(screen) ? screen : DEFAULT_WORKBENCH_SELECTION.screen,
    candidateId: isWorkbenchCandidateId(candidateId)
      ? candidateId
      : DEFAULT_WORKBENCH_SELECTION.candidateId,
    pair: isWorkbenchPair(pair) ? pair : DEFAULT_WORKBENCH_SELECTION.pair,
  };
}

export function searchFromSelection(selection: WorkbenchSelection): string {
  const params = new URLSearchParams();
  params.set("screen", selection.screen);
  params.set("candidate", selection.candidateId);
  params.set("pair", selection.pair);
  return params.toString();
}

export type WorkbenchMessageType = "selection" | "navigate";

export interface WorkbenchMessage {
  source: typeof WORKBENCH_MESSAGE_SOURCE;
  type: WorkbenchMessageType;
  selection: WorkbenchSelection;
}

export function workbenchSelectionMessage(
  selection: WorkbenchSelection,
): WorkbenchMessage {
  return { source: WORKBENCH_MESSAGE_SOURCE, type: "selection", selection };
}

export function workbenchNavigateMessage(
  selection: WorkbenchSelection,
): WorkbenchMessage {
  return { source: WORKBENCH_MESSAGE_SOURCE, type: "navigate", selection };
}

export function parseWorkbenchMessage(data: unknown): WorkbenchMessage | null {
  if (!isSelectionRecord(data)) return null;
  if (data.source !== WORKBENCH_MESSAGE_SOURCE) return null;
  if (data.type !== "selection" && data.type !== "navigate") return null;
  const selection = parseWorkbenchSelection(data.selection);
  if (!selection) return null;
  return { source: WORKBENCH_MESSAGE_SOURCE, type: data.type, selection };
}

/**
 * Session-scoped storage for the preview canvas. The preview store is built on
 * this shim, so workbench saves never read or write the product's localStorage
 * keys and disappear with the canvas.
 */
export function createPreviewStorage(): Pick<Storage, "getItem" | "setItem"> {
  const data = new Map<string, string>();
  return {
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      data.set(key, String(value));
    },
  };
}
