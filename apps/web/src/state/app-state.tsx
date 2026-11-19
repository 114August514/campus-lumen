// Shared application state: the browser topic store (exploration sessions), the
// current session with its resume pointer, the per-session comparison tray and the
// demo-only simulation options. Private records never leave the current topic.
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { associationCorrections } from "../lib/advisors";
import { planAssociationRepairs } from "../lib/association-repair";
import type { CatalogItem, ItemKind } from "../lib/catalog";
import type { ReplayScenario } from "../lib/demo-replay";
import {
  type ExplorationTopic,
  type ExplorationStore as Store,
  createExplorationStore,
} from "../lib/exploration-store";

export const LAST_TOPIC_STORAGE_KEY = "campus-agora:last-topic:v1";

/** null = no pointer (legacy install or unreadable); "" = explicit 暂不保存. */
function readLastTopicId(): string | null {
  try {
    return window.localStorage.getItem(LAST_TOPIC_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function resolveInitialTopicId(
  topics: ExplorationTopic[],
  lastId: string | null,
): string {
  if (lastId === "") return "";
  if (lastId !== null && topics.some((topic) => topic.id === lastId)) return lastId;
  return byRecency(topics)[0]?.id ?? "";
}

/** Most recently active explorations first, like a session list. */
export function byRecency(topics: ExplorationTopic[]): ExplorationTopic[] {
  return [...topics].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

interface Startup {
  store: Store | null;
  topics: ExplorationTopic[];
  topicId: string;
  error: string;
  notice: string;
}

function loadExplorations(): Startup {
  try {
    const store = createExplorationStore(window.localStorage);
    // Apply recorded public splits to saved records before showing them.
    const repaired = store.repairAssociations(
      planAssociationRepairs(store.listTopics(), associationCorrections),
    );
    const topics = store.listTopics();
    return {
      store,
      topics,
      topicId: resolveInitialTopicId(topics, readLastTopicId()),
      error: "",
      notice: repaired
        ? `公开资料有更正，${repaired}条主题记录的关联已调整或待你确认。私人理由和待问未改动。`
        : "",
    };
  } catch (error) {
    return {
      store: null,
      topics: [],
      topicId: "",
      error: `本地保存不可用：${error instanceof Error ? error.message : "无法读取浏览器资料"}。仍可以浏览和查找。`,
      notice: "",
    };
  }
}

// Loading also writes association repairs, so it must run once per page load even
// when StrictMode calls state initializers twice.
let startup: Startup | undefined;
function loadOnce(): Startup {
  startup ??= loadExplorations();
  return startup;
}

export type AnalysisOutcome = "ok" | "delay" | "hang" | "error";

export interface DemoOptions {
  analysisOutcome: AnalysisOutcome;
  replay: ReplayScenario | null;
}

export interface CompareTray {
  kind: ItemKind | null;
  ids: string[];
}

export interface AppMessage {
  tone: "success" | "critical" | "info";
  text: string;
  at: number;
}

interface AppState {
  store: Store | null;
  topics: ExplorationTopic[];
  topic: ExplorationTopic | undefined;
  topicId: string;
  /** remember=false switches without moving the resume pointer (temporary sessions). */
  selectTopic: (id: string, options?: { remember?: boolean }) => void;
  /** Run a store change, refresh topics, and report failures without losing input. */
  mutate: (change: (store: Store) => void, success?: string) => boolean;
  createTopic: (input: {
    name: string;
    question?: string;
    preferences?: string;
    types?: string[];
  }) => string | null;
  message: AppMessage | null;
  setMessage: (message: Omit<AppMessage, "at"> | null) => void;
  /** Drop a message that was set before the user moved to another view. */
  clearStaleMessage: () => void;
  storageError: string;
  tray: CompareTray;
  toggleCompare: (item: CatalogItem) => void;
  setCompareIds: (kind: ItemKind | null, ids: string[]) => void;
  demo: DemoOptions;
  setDemo: (patch: Partial<DemoOptions>) => void;
}

const Context = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(loadOnce);
  const [topics, setTopics] = useState(initial.topics);
  const [topicId, setTopicId] = useState(initial.topicId);
  const [message, setMessageState] = useState<AppMessage | null>(
    initial.notice ? { tone: "info", text: initial.notice, at: Date.now() } : null,
  );
  const setMessage = useCallback((next: Omit<AppMessage, "at"> | null) => {
    setMessageState(next ? { ...next, at: Date.now() } : null);
  }, []);
  const clearStaleMessage = useCallback(() => {
    // A message set within the navigation that just happened still belongs to it.
    setMessageState((current) =>
      current && Date.now() - current.at > 1500 ? null : current,
    );
  }, []);
  // One comparison tray per session, so switching topics never shows another
  // topic's saved objects or a stale count.
  const [trays, setTrays] = useState<Record<string, CompareTray>>({});
  const [demo, setDemoState] = useState<DemoOptions>({
    analysisOutcome: "ok",
    replay: null,
  });

  const store = initial.store;
  const topic = topics.find((item) => item.id === topicId);

  const selectTopic = useCallback(
    (id: string, options: { remember?: boolean } = {}) => {
      setTopicId(id);
      if (options.remember === false) return;
      try {
        window.localStorage.setItem(LAST_TOPIC_STORAGE_KEY, id);
      } catch {
        // Resume is best-effort; switching still works in this page.
      }
    },
    [],
  );

  const mutate = useCallback(
    (change: (store: Store) => void, success?: string) => {
      if (!store) {
        setMessage({ tone: "critical", text: initial.error || "本地保存不可用。" });
        return false;
      }
      try {
        change(store);
        setTopics(store.listTopics());
        if (success) setMessage({ tone: "success", text: success });
        return true;
      } catch (error) {
        setMessage({
          tone: "critical",
          text: error instanceof Error ? error.message : "保存未成功，请重试。",
        });
        return false;
      }
    },
    [store, initial.error, setMessage],
  );

  const createTopic = useCallback<AppState["createTopic"]>(
    (input) => {
      let created = "";
      const ok = mutate((current) => {
        const topic = current.createTopic(input);
        if (input.types?.length) current.updateTopic(topic.id, { types: input.types });
        created = topic.id;
      });
      if (!ok) return null;
      selectTopic(created);
      return created;
    },
    [mutate, selectTopic],
  );

  const tray = trays[topicId] ?? { kind: null, ids: [] };

  const setCompareIds = useCallback(
    (kind: ItemKind | null, ids: string[]) => {
      setTrays((current) => ({
        ...current,
        [topicId]: { kind: ids.length ? kind : null, ids },
      }));
    },
    [topicId],
  );

  const toggleCompare = useCallback(
    (item: CatalogItem) => {
      const current = trays[topicId] ?? { kind: null, ids: [] };
      if (current.ids.includes(item.id)) {
        setCompareIds(
          current.kind,
          current.ids.filter((id) => id !== item.id),
        );
        return;
      }
      if (current.kind && current.kind !== item.kind) {
        setCompareIds(item.kind, [item.id]);
        setMessage({
          tone: "info",
          text: "不同类型的对象用不同的比较问题；比较栏已换成这一类。",
        });
        return;
      }
      if (current.ids.length >= 4) {
        setMessage({ tone: "info", text: "一次最多比较 4 个对象；先移除一个再加入。" });
        return;
      }
      setCompareIds(item.kind, [...current.ids, item.id]);
    },
    [trays, topicId, setCompareIds, setMessage],
  );

  const value = useMemo<AppState>(
    () => ({
      store,
      topics,
      topic,
      topicId,
      selectTopic,
      mutate,
      createTopic,
      message,
      setMessage,
      clearStaleMessage,
      storageError: initial.error,
      tray,
      toggleCompare,
      setCompareIds,
      demo,
      setDemo: (patch) => setDemoState((current) => ({ ...current, ...patch })),
    }),
    [
      store,
      topics,
      topic,
      topicId,
      selectTopic,
      mutate,
      createTopic,
      message,
      setMessage,
      clearStaleMessage,
      initial.error,
      tray,
      toggleCompare,
      setCompareIds,
      demo,
    ],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAppState(): AppState {
  const value = useContext(Context);
  if (!value) throw new Error("useAppState must be used inside AppStateProvider");
  return value;
}
