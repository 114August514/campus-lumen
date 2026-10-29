export interface SourceSnapshot {
  url: string;
  lookupUrl?: string;
  accessNote?: string;
  title: string;
  content: string;
  collectedAt: string;
  kind?: "snapshot" | "live";
  // Preserve the original page label; it is not necessarily an ISO date.
  publishedAt?: string;
  query?: string;
  relevanceEvidence?: string[];
  unknowns?: string[];
  collection?: SourceCollection;
}

export interface SourceCollection {
  method: "browser_dom" | "web_read";
  contentKind: "summary" | "body";
  readStatus: "partial" | "complete";
  scope: string;
  batchId: string;
}

export interface CandidateSnapshot {
  candidateId: string;
  name: string;
  institution: string;
  research: string;
  sources: SourceSnapshot[];
  type?: string;
  title?: string;
  description?: string;
  metadata?: Record<string, string>;
}

/** Identity fields of a public object, without its sources. */
export interface CandidateIdentity {
  candidateId: string;
  name: string;
  institution: string;
  research: string;
}

/**
 * Set when a public split affected this record. `previous` keeps the identity the
 * user originally saved; `pending` means the user still has to choose the object.
 */
export interface AssociationNote {
  correctionId: string;
  status: "relinked" | "pending" | "chosen";
  previous: Omit<CandidateIdentity, "research">;
  options: Omit<CandidateIdentity, "research">[];
  updatedAt: string;
}

/** The user's own triage decision for a saved object; only within one topic. */
export type Decision = "keep" | "maybe" | "exclude";

export const decisions: Decision[] = ["keep", "maybe", "exclude"];

export interface TopicCandidate {
  candidate: CandidateSnapshot;
  reason: string;
  questions: string[];
  savedAt: string;
  association?: AssociationNote;
  decision?: Decision;
}

/** Public opportunity fields copied at save time, so a topic survives data changes. */
export interface OpportunitySnapshot {
  opportunityId: string;
  name: string;
  types: string[];
  period: string;
  summary: string;
  entryUrl: string;
  checkedAt: string;
}

export interface TopicOpportunity {
  opportunity: OpportunitySnapshot;
  reason: string;
  questions: string[];
  savedAt: string;
  decision?: Decision;
  /** Pages the user read for this entry and chose to keep in this topic. */
  sources?: SourceSnapshot[];
}

export type SessionStage = "explore" | "discover" | "process";

/** The last comparison the user chose to keep, so the session can resume it. */
export interface LastComparison {
  question: string;
  ids: string[];
  perspective: string;
  at: string;
}

export interface SavedAnalysisPoint {
  text: string;
  evidenceRefs: string[];
  privateFragmentIds: string[];
}

/**
 * A privately saved AI organization result. It keeps which personal fragments were
 * sent (ids only) and the public evidence it cited, never other topics' content.
 */
export interface SavedAnalysis {
  id: string;
  question: string;
  createdAt: string;
  providerLabel: string;
  simulated: boolean;
  subjects: { id: string; name: string }[];
  evidence: {
    ref: string;
    subjectId: string;
    aspect: string;
    sourceTitle?: string;
    sourceUrl?: string;
  }[];
  sentFragmentIds: string[];
  sections: { kind: string; title: string; points: SavedAnalysisPoint[] }[];
  caveats: string[];
}

export interface ExplorationTopic {
  id: string;
  name: string;
  question: string;
  preferences: string;
  createdAt: string;
  updatedAt: string;
  candidates: TopicCandidate[];
  /** Optional so version-1 records saved before opportunities existed stay valid. */
  opportunities?: TopicOpportunity[];
  /** Opportunity types the exploration covers; absent or empty means all types. */
  types?: string[];
  stage?: SessionStage;
  lastComparison?: LastComparison;
  analyses?: SavedAnalysis[];
  /** A private note left when the user pauses this exploration. */
  pausedNote?: string;
}

export type ExplorationStoreErrorCode =
  | "read_failed"
  | "write_failed"
  | "corrupted_data"
  | "unsupported_version"
  | "validation_failed"
  | "not_found";

export class ExplorationStoreError extends Error {
  constructor(
    public readonly code: ExplorationStoreErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ExplorationStoreError";
  }
}

interface StoredExplorations {
  version: 1;
  topics: ExplorationTopic[];
}

interface PrivateRecordPatch {
  reason?: string;
  questions?: string[];
}

export const EXPLORATION_STORAGE_KEY = "campus-agora:explorations:v1";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === "string";
}

function isNonemptyText(value: unknown): value is string {
  return isText(value) && value.trim().length > 0;
}

function isDate(value: unknown): value is string {
  return isNonemptyText(value) && Number.isFinite(Date.parse(value));
}

function isWebUrl(value: unknown): value is string {
  if (!isNonemptyText(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isLookupUrl(value: unknown, sourceUrl: string): value is string {
  if (!isWebUrl(value)) return false;
  const url = new URL(value);
  const credentialKey =
    /(?:^|[_-])(?:token|auth|authorization|session|sessionid|password|credential|apikey|api_key)(?:$|[_-])/i;
  return (
    url.origin === new URL(sourceUrl).origin &&
    !url.username &&
    !url.password &&
    ![...url.searchParams.keys()].some((key) => credentialKey.test(key)) &&
    ![...new URLSearchParams(url.hash.slice(1)).keys()].some((key) =>
      credentialKey.test(key),
    )
  );
}

function isSource(value: unknown): value is SourceSnapshot {
  return (
    isObject(value) &&
    isWebUrl(value.url) &&
    (value.lookupUrl === undefined || isLookupUrl(value.lookupUrl, value.url)) &&
    (value.accessNote === undefined || isNonemptyText(value.accessNote)) &&
    isNonemptyText(value.title) &&
    isNonemptyText(value.content) &&
    isDate(value.collectedAt) &&
    (value.kind === undefined || value.kind === "snapshot" || value.kind === "live") &&
    (value.publishedAt === undefined || isNonemptyText(value.publishedAt)) &&
    (value.query === undefined || isText(value.query)) &&
    (value.relevanceEvidence === undefined ||
      (Array.isArray(value.relevanceEvidence) &&
        value.relevanceEvidence.every(isText))) &&
    (value.unknowns === undefined ||
      (Array.isArray(value.unknowns) && value.unknowns.every(isText))) &&
    (value.collection === undefined || isSourceCollection(value.collection))
  );
}

function isSourceCollection(value: unknown): value is SourceCollection {
  return (
    isObject(value) &&
    (value.method === "browser_dom" || value.method === "web_read") &&
    (value.contentKind === "summary" || value.contentKind === "body") &&
    (value.readStatus === "partial" || value.readStatus === "complete") &&
    isNonemptyText(value.scope) &&
    isNonemptyText(value.batchId)
  );
}

function isCandidate(value: unknown): value is CandidateSnapshot {
  return (
    isObject(value) &&
    isNonemptyText(value.candidateId) &&
    isNonemptyText(value.name) &&
    isNonemptyText(value.institution) &&
    isText(value.research) &&
    Array.isArray(value.sources) &&
    value.sources.every(isSource)
  );
}

function isIdentity(value: unknown): value is Omit<CandidateIdentity, "research"> {
  return (
    isObject(value) &&
    isNonemptyText(value.candidateId) &&
    isNonemptyText(value.name) &&
    isNonemptyText(value.institution)
  );
}

function isAssociation(value: unknown): value is AssociationNote {
  return (
    isObject(value) &&
    isNonemptyText(value.correctionId) &&
    (value.status === "relinked" ||
      value.status === "pending" ||
      value.status === "chosen") &&
    isIdentity(value.previous) &&
    Array.isArray(value.options) &&
    value.options.every(isIdentity) &&
    isDate(value.updatedAt)
  );
}

function isTopicCandidate(value: unknown): value is TopicCandidate {
  return (
    isObject(value) &&
    isCandidate(value.candidate) &&
    isText(value.reason) &&
    Array.isArray(value.questions) &&
    value.questions.every(isText) &&
    isDate(value.savedAt) &&
    (value.association === undefined || isAssociation(value.association)) &&
    (value.decision === undefined || isDecision(value.decision))
  );
}

function plainIdentity(item: CandidateIdentity | Omit<CandidateIdentity, "research">) {
  return {
    candidateId: item.candidateId,
    name: item.name,
    institution: item.institution,
  };
}

function isOpportunity(value: unknown): value is OpportunitySnapshot {
  return (
    isObject(value) &&
    isNonemptyText(value.opportunityId) &&
    isNonemptyText(value.name) &&
    Array.isArray(value.types) &&
    value.types.every(isNonemptyText) &&
    isText(value.period) &&
    isText(value.summary) &&
    isWebUrl(value.entryUrl) &&
    isNonemptyText(value.checkedAt)
  );
}

function isTopicOpportunity(value: unknown): value is TopicOpportunity {
  return (
    isObject(value) &&
    isOpportunity(value.opportunity) &&
    isText(value.reason) &&
    Array.isArray(value.questions) &&
    value.questions.every(isText) &&
    isDate(value.savedAt) &&
    (value.decision === undefined || isDecision(value.decision)) &&
    (value.sources === undefined ||
      (Array.isArray(value.sources) && value.sources.every(isSource)))
  );
}

function isDecision(value: unknown): value is Decision {
  return decisions.includes(value as Decision);
}

function isStage(value: unknown): value is SessionStage {
  return value === "explore" || value === "discover" || value === "process";
}

function isTextList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonemptyText);
}

function isLastComparison(value: unknown): value is LastComparison {
  return (
    isObject(value) &&
    isText(value.question) &&
    isTextList(value.ids) &&
    isText(value.perspective) &&
    isDate(value.at)
  );
}

function isSavedAnalysis(value: unknown): value is SavedAnalysis {
  return (
    isObject(value) &&
    isNonemptyText(value.id) &&
    isText(value.question) &&
    isDate(value.createdAt) &&
    isNonemptyText(value.providerLabel) &&
    typeof value.simulated === "boolean" &&
    Array.isArray(value.subjects) &&
    value.subjects.every(
      (item) => isObject(item) && isNonemptyText(item.id) && isNonemptyText(item.name),
    ) &&
    Array.isArray(value.evidence) &&
    value.evidence.every(
      (item) =>
        isObject(item) &&
        isNonemptyText(item.ref) &&
        isNonemptyText(item.subjectId) &&
        isText(item.aspect) &&
        (item.sourceTitle === undefined || isText(item.sourceTitle)) &&
        (item.sourceUrl === undefined || isWebUrl(item.sourceUrl)),
    ) &&
    isTextList(value.sentFragmentIds) &&
    Array.isArray(value.sections) &&
    value.sections.every(
      (section) =>
        isObject(section) &&
        isText(section.kind) &&
        isText(section.title) &&
        Array.isArray(section.points) &&
        section.points.every(
          (point) =>
            isObject(point) &&
            isText(point.text) &&
            Array.isArray(point.evidenceRefs) &&
            point.evidenceRefs.every(isText) &&
            Array.isArray(point.privateFragmentIds) &&
            point.privateFragmentIds.every(isText),
        ),
    ) &&
    Array.isArray(value.caveats) &&
    value.caveats.every(isText)
  );
}

function hasUniqueIds(ids: string[]): boolean {
  return new Set(ids).size === ids.length;
}

function isTopic(value: unknown): value is ExplorationTopic {
  return (
    isObject(value) &&
    isNonemptyText(value.id) &&
    isNonemptyText(value.name) &&
    isText(value.question) &&
    isText(value.preferences) &&
    isDate(value.createdAt) &&
    isDate(value.updatedAt) &&
    Array.isArray(value.candidates) &&
    value.candidates.every(isTopicCandidate) &&
    hasUniqueIds(value.candidates.map((entry) => entry.candidate.candidateId)) &&
    (value.opportunities === undefined ||
      (Array.isArray(value.opportunities) &&
        value.opportunities.every(isTopicOpportunity) &&
        hasUniqueIds(
          value.opportunities.map((entry) => entry.opportunity.opportunityId),
        ))) &&
    (value.types === undefined || isTextList(value.types)) &&
    (value.stage === undefined || isStage(value.stage)) &&
    (value.lastComparison === undefined || isLastComparison(value.lastComparison)) &&
    (value.analyses === undefined ||
      (Array.isArray(value.analyses) &&
        value.analyses.every(isSavedAnalysis) &&
        hasUniqueIds(value.analyses.map((entry) => entry.id)))) &&
    (value.pausedNote === undefined || isText(value.pausedNote))
  );
}

function isStoredExplorations(value: unknown): value is StoredExplorations {
  return (
    isObject(value) &&
    value.version === 1 &&
    Array.isArray(value.topics) &&
    value.topics.every(isTopic) &&
    hasUniqueIds(value.topics.map((topic) => topic.id))
  );
}

function cloneSource(source: SourceSnapshot): SourceSnapshot {
  return {
    url: source.url,
    ...(source.lookupUrl !== undefined ? { lookupUrl: source.lookupUrl } : {}),
    ...(source.accessNote !== undefined ? { accessNote: source.accessNote } : {}),
    title: source.title,
    content: source.content,
    collectedAt: source.collectedAt,
    ...(source.kind !== undefined ? { kind: source.kind } : {}),
    ...(source.publishedAt !== undefined ? { publishedAt: source.publishedAt } : {}),
    ...(source.query !== undefined ? { query: source.query } : {}),
    ...(source.relevanceEvidence !== undefined
      ? { relevanceEvidence: [...source.relevanceEvidence] }
      : {}),
    ...(source.unknowns !== undefined ? { unknowns: [...source.unknowns] } : {}),
    ...(source.collection !== undefined
      ? {
          collection: {
            method: source.collection.method,
            contentKind: source.collection.contentKind,
            readStatus: source.collection.readStatus,
            scope: source.collection.scope,
            batchId: source.collection.batchId,
          },
        }
      : {}),
  };
}

function cloneCandidate(candidate: CandidateSnapshot): CandidateSnapshot {
  return {
    candidateId: candidate.candidateId,
    name: candidate.name,
    institution: candidate.institution,
    research: candidate.research,
    ...(candidate.type ? { type: candidate.type } : {}),
    ...(candidate.title ? { title: candidate.title } : {}),
    ...(candidate.description ? { description: candidate.description } : {}),
    ...(candidate.metadata ? { metadata: { ...candidate.metadata } } : {}),
    sources: candidate.sources.map(cloneSource),
  };
}

function cloneOpportunity(opportunity: OpportunitySnapshot): OpportunitySnapshot {
  return {
    opportunityId: opportunity.opportunityId,
    name: opportunity.name,
    types: [...opportunity.types],
    period: opportunity.period,
    summary: opportunity.summary,
    entryUrl: opportunity.entryUrl,
    checkedAt: opportunity.checkedAt,
  };
}

function mergeSources(oldSources: SourceSnapshot[], newSources: SourceSnapshot[]) {
  const sources = new Map<string, SourceSnapshot>();
  for (const source of [...oldSources, ...newSources]) {
    const key = JSON.stringify([
      source.url,
      source.collectedAt,
      source.content,
      source.query,
      source.collection,
    ]);
    sources.set(key, { ...sources.get(key), ...source });
  }
  return [...sources.values()];
}

/**
 * Same-origin, same-browser storage only: no account, network transmission or sync.
 * Reads are fresh, and one setItem commits the whole update. Historical snapshots
 * remain usable; timestamps do not imply a currently open recruitment opportunity.
 */
export function createExplorationStore(
  storage: Pick<Storage, "getItem" | "setItem">,
  key = EXPLORATION_STORAGE_KEY,
) {
  function read(): StoredExplorations {
    let raw: string | null;
    try {
      raw = storage.getItem(key);
    } catch (cause) {
      throw new ExplorationStoreError("read_failed", "无法读取此浏览器的探索记录。", {
        cause,
      });
    }
    if (raw === null) return { version: 1, topics: [] };

    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch (cause) {
      throw new ExplorationStoreError(
        "corrupted_data",
        "探索记录无法解析，原记录仍保留，未覆盖。",
        { cause },
      );
    }
    if (isObject(data) && data.version !== 1) {
      throw new ExplorationStoreError(
        "unsupported_version",
        "此探索记录版本暂不支持，原记录仍保留。",
      );
    }
    if (!isStoredExplorations(data)) {
      throw new ExplorationStoreError(
        "corrupted_data",
        "探索记录内容不完整或失效，原记录仍保留，未覆盖。",
      );
    }
    return data;
  }

  function write(data: StoredExplorations) {
    if (!isStoredExplorations(data)) {
      throw new ExplorationStoreError(
        "validation_failed",
        "请检查主题、来源和记录内容。",
      );
    }
    try {
      storage.setItem(key, JSON.stringify(data));
    } catch (cause) {
      throw new ExplorationStoreError(
        "write_failed",
        "保存未成功，请保留当前编辑内容后重试。",
        { cause },
      );
    }
  }

  function mutateTopic(
    id: string,
    change: (topic: ExplorationTopic) => void,
    options: { touch?: boolean } = {},
  ): ExplorationTopic {
    const data = read();
    const topic = data.topics.find((entry) => entry.id === id);
    if (!topic) {
      throw new ExplorationStoreError("not_found", "这个探索主题已不存在。");
    }
    change(topic);
    // Navigation-only changes (like the current stage) do not count as activity.
    if (options.touch !== false) topic.updatedAt = new Date().toISOString();
    write(data);
    return topic;
  }

  return {
    listTopics(): ExplorationTopic[] {
      return read().topics;
    },
    getTopic(id: string): ExplorationTopic | undefined {
      return read().topics.find((topic) => topic.id === id);
    },
    createTopic(input: { name: string; question?: string; preferences?: string }) {
      const data = read();
      const now = new Date().toISOString();
      const topic: ExplorationTopic = {
        id: crypto.randomUUID(),
        name: input.name,
        question: input.question ?? "",
        preferences: input.preferences ?? "",
        createdAt: now,
        updatedAt: now,
        candidates: [],
        opportunities: [],
      };
      data.topics.push(topic);
      write(data);
      return topic;
    },
    updateTopic(
      id: string,
      patch: Partial<
        Pick<
          ExplorationTopic,
          "name" | "question" | "preferences" | "types" | "pausedNote"
        >
      >,
    ) {
      return mutateTopic(id, (topic) => {
        if (patch.name !== undefined) topic.name = patch.name;
        if (patch.question !== undefined) topic.question = patch.question;
        if (patch.preferences !== undefined) topic.preferences = patch.preferences;
        if (patch.types !== undefined) topic.types = [...patch.types];
        if (patch.pausedNote !== undefined) topic.pausedNote = patch.pausedNote;
      });
    },
    /** Remember where the user was in this session; not an activity update. */
    setStage(id: string, stage: SessionStage) {
      return mutateTopic(
        id,
        (topic) => {
          topic.stage = stage;
        },
        { touch: false },
      );
    },
    /** Set or clear the user's triage decision on one saved object of this topic. */
    setDecision(
      topicId: string,
      target: { kind: "candidate" | "opportunity"; id: string },
      decision: Decision | null,
    ) {
      return mutateTopic(topicId, (topic) => {
        const record =
          target.kind === "candidate"
            ? topic.candidates.find((item) => item.candidate.candidateId === target.id)
            : topic.opportunities?.find(
                (item) => item.opportunity.opportunityId === target.id,
              );
        if (!record) {
          throw new ExplorationStoreError("not_found", "这条记录已不在这个主题里。");
        }
        // undefined is dropped when the document is serialized.
        record.decision = decision ?? undefined;
      });
    },
    saveComparison(topicId: string, comparison: Omit<LastComparison, "at">) {
      return mutateTopic(topicId, (topic) => {
        topic.lastComparison = {
          question: comparison.question,
          ids: [...comparison.ids],
          perspective: comparison.perspective,
          at: new Date().toISOString(),
        };
      });
    },
    /** Newest first; keeps at most 20 saved results per topic. */
    saveAnalysis(topicId: string, analysis: SavedAnalysis) {
      if (!isSavedAnalysis(analysis)) {
        throw new ExplorationStoreError("validation_failed", "整理结果内容不完整。");
      }
      return mutateTopic(topicId, (topic) => {
        const others = (topic.analyses ?? []).filter((item) => item.id !== analysis.id);
        topic.analyses = [structuredClone(analysis), ...others].slice(0, 20);
      });
    },
    removeAnalysis(topicId: string, analysisId: string) {
      return mutateTopic(topicId, (topic) => {
        topic.analyses = (topic.analyses ?? []).filter(
          (item) => item.id !== analysisId,
        );
      });
    },
    saveCandidate(
      topicId: string,
      candidate: CandidateSnapshot,
      privateRecord: PrivateRecordPatch = {},
    ) {
      if (!isCandidate(candidate)) {
        throw new ExplorationStoreError("validation_failed", "候选或来源内容不完整。");
      }
      return mutateTopic(topicId, (topic) => {
        const existing = topic.candidates.find(
          (entry) => entry.candidate.candidateId === candidate.candidateId,
        );
        const snapshot = cloneCandidate(candidate);
        if (existing) {
          snapshot.sources = mergeSources(existing.candidate.sources, snapshot.sources);
          existing.candidate = snapshot;
        } else {
          topic.candidates.push({
            candidate: snapshot,
            reason: privateRecord.reason ?? "",
            questions: [...(privateRecord.questions ?? [])],
            savedAt: new Date().toISOString(),
          });
        }
      });
    },
    updateCandidate(topicId: string, candidateId: string, patch: PrivateRecordPatch) {
      return mutateTopic(topicId, (topic) => {
        const entry = topic.candidates.find(
          (record) => record.candidate.candidateId === candidateId,
        );
        if (!entry) {
          throw new ExplorationStoreError("not_found", "此候选已不在这个主题里。");
        }
        if (patch.reason !== undefined) entry.reason = patch.reason;
        if (patch.questions !== undefined) entry.questions = [...patch.questions];
      });
    },
    removeCandidate(topicId: string, candidateId: string) {
      return mutateTopic(topicId, (topic) => {
        topic.candidates = topic.candidates.filter(
          (entry) => entry.candidate.candidateId !== candidateId,
        );
      });
    },
    saveOpportunity(
      topicId: string,
      opportunity: OpportunitySnapshot,
      privateRecord: PrivateRecordPatch = {},
    ) {
      if (!isOpportunity(opportunity)) {
        throw new ExplorationStoreError("validation_failed", "机会内容或入口不完整。");
      }
      return mutateTopic(topicId, (topic) => {
        const records = topic.opportunities ?? [];
        const existing = records.find(
          (entry) => entry.opportunity.opportunityId === opportunity.opportunityId,
        );
        // Refresh public fields only; private reason and questions stay as saved.
        if (existing) {
          existing.opportunity = cloneOpportunity(opportunity);
        } else {
          records.push({
            opportunity: cloneOpportunity(opportunity),
            reason: privateRecord.reason ?? "",
            questions: [...(privateRecord.questions ?? [])],
            savedAt: new Date().toISOString(),
          });
        }
        topic.opportunities = records;
      });
    },
    updateOpportunity(
      topicId: string,
      opportunityId: string,
      patch: PrivateRecordPatch,
    ) {
      return mutateTopic(topicId, (topic) => {
        const entry = topic.opportunities?.find(
          (record) => record.opportunity.opportunityId === opportunityId,
        );
        if (!entry) {
          throw new ExplorationStoreError("not_found", "这项机会已不在这个主题里。");
        }
        if (patch.reason !== undefined) entry.reason = patch.reason;
        if (patch.questions !== undefined) entry.questions = [...patch.questions];
      });
    },
    /** Keep pages read for an entry; saves the entry first when it is new here. */
    saveOpportunityEvidence(
      topicId: string,
      opportunity: OpportunitySnapshot,
      sources: SourceSnapshot[],
    ) {
      if (!isOpportunity(opportunity) || !sources.every(isSource)) {
        throw new ExplorationStoreError("validation_failed", "机会或来源内容不完整。");
      }
      return mutateTopic(topicId, (topic) => {
        const records = topic.opportunities ?? [];
        let record = records.find(
          (entry) => entry.opportunity.opportunityId === opportunity.opportunityId,
        );
        if (!record) {
          record = {
            opportunity: cloneOpportunity(opportunity),
            reason: "",
            questions: [],
            savedAt: new Date().toISOString(),
          };
          records.push(record);
        }
        record.sources = mergeSources(record.sources ?? [], sources.map(cloneSource));
        topic.opportunities = records;
      });
    },
    removeOpportunity(topicId: string, opportunityId: string) {
      return mutateTopic(topicId, (topic) => {
        topic.opportunities = (topic.opportunities ?? []).filter(
          (entry) => entry.opportunity.opportunityId !== opportunityId,
        );
      });
    },
    /**
     * Apply planned association repairs in one write. A relink changes only the
     * record's identity; its saved sources, reason and questions stay as they were.
     */
    repairAssociations(
      repairs: (
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
          }
      )[],
    ): number {
      if (repairs.length === 0) return 0;
      const data = read();
      const now = new Date().toISOString();
      let applied = 0;
      for (const repair of repairs) {
        const topic = data.topics.find((item) => item.id === repair.topicId);
        const record = topic?.candidates.find(
          (item) => item.candidate.candidateId === repair.fromCandidateId,
        );
        if (!topic || !record) continue;
        const previous = plainIdentity(record.candidate);
        if (repair.kind === "relink") {
          if (
            topic.candidates.some(
              (item) =>
                item !== record &&
                item.candidate.candidateId === repair.target.candidateId,
            )
          ) {
            continue;
          }
          record.candidate = {
            ...record.candidate,
            candidateId: repair.target.candidateId,
            name: repair.target.name,
            institution: repair.target.institution,
            research: repair.target.research,
          };
          record.association = {
            correctionId: repair.correctionId,
            status: "relinked",
            previous,
            options: [plainIdentity(repair.target)],
            updatedAt: now,
          };
        } else {
          record.association = {
            correctionId: repair.correctionId,
            status: "pending",
            previous,
            options: repair.options.map(plainIdentity),
            updatedAt: now,
          };
        }
        topic.updatedAt = now;
        applied += 1;
      }
      if (applied > 0) write(data);
      return applied;
    },
    /** The user picks which split object a pending record refers to. */
    resolveAssociation(
      topicId: string,
      candidateId: string,
      target: CandidateIdentity,
    ) {
      return mutateTopic(topicId, (topic) => {
        const record = topic.candidates.find(
          (item) => item.candidate.candidateId === candidateId,
        );
        if (!record?.association || record.association.status !== "pending") {
          throw new ExplorationStoreError("not_found", "这条记录没有待确认的关联。");
        }
        if (
          !record.association.options.some(
            (item) => item.candidateId === target.candidateId,
          )
        ) {
          throw new ExplorationStoreError(
            "validation_failed",
            "只能从拆分后的对象中选择。",
          );
        }
        if (
          topic.candidates.some(
            (item) =>
              item !== record && item.candidate.candidateId === target.candidateId,
          )
        ) {
          throw new ExplorationStoreError(
            "validation_failed",
            "这个主题已有该对象的记录；两条记录的理由不会自动合并，可先移除其中一条再选择。",
          );
        }
        record.candidate = {
          ...record.candidate,
          candidateId: target.candidateId,
          name: target.name,
          institution: target.institution,
          research: target.research,
        };
        record.association = {
          ...record.association,
          status: "chosen",
          updatedAt: new Date().toISOString(),
        };
      });
    },
    deleteTopic(id: string) {
      const data = read();
      const remaining = data.topics.filter((topic) => topic.id !== id);
      if (remaining.length === data.topics.length) {
        throw new ExplorationStoreError("not_found", "这个探索主题已不存在。");
      }
      write({ version: 1, topics: remaining });
    },
  };
}

/** The store API returned by createExplorationStore. */
export type ExplorationStore = ReturnType<typeof createExplorationStore>;
