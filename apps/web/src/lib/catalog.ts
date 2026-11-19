// One catalog over every opportunity type, so the 探索 → 发现 → 处理 flow is the same
// for advisors, internships and curated entries. Source data and its parsing rules
// (batches, corrections, internship review) stay where they are; this only adapts.
import { type Advisor, advisors, internships } from "./advisors";
import { savedCandidateForComparison } from "./comparison-candidates";
import type {
  CandidateSnapshot,
  ExplorationTopic,
  OpportunitySnapshot,
  TopicOpportunity,
} from "./exploration-store";
import {
  type Opportunity,
  type OpportunityTiming,
  type OpportunityType,
  opportunities,
  opportunityTypeText,
} from "./opportunities";
import { type RouteStatus, profileFor } from "./profiles";
import { matchScore } from "./text-match";

export type ItemKind = "advisor" | "internship" | "entry";

/** Where an item's information came from, shown on every row. */
export type ItemOrigin = "catalog" | "saved-live" | "saved-snapshot";

export interface RouteChip {
  label: string;
  status: RouteStatus;
}

export interface CatalogItem {
  id: string;
  kind: ItemKind;
  types: OpportunityType[];
  name: string;
  org: string;
  summary: string;
  /** Entry timing; candidates use route chips instead and stay "unknown" here. */
  timing: OpportunityTiming;
  period: string;
  routeChips: RouteChip[];
  sourceCount: number;
  /** Newest collection or check time (ISO date or YYYY-MM-DD). */
  latestAt: string;
  entryUrl: string;
  /** Official pages that the discovery service may read directly. */
  readableUrls: { url: string; title: string }[];
  origin: ItemOrigin;
  candidate?: Advisor;
  entry?: Opportunity;
  searchText: string;
}

export const kindText: Record<ItemKind, string> = {
  advisor: "导师",
  internship: "实习岗位",
  entry: "机会与资源",
};

function latest(dates: string[]): string {
  return dates.reduce(
    (newest, date) => (Date.parse(date) > Date.parse(newest) ? date : newest),
    dates[0] ?? "",
  );
}

function readableSources(candidate: CandidateSnapshot) {
  const seen = new Set<string>();
  const pages: { url: string; title: string }[] = [];
  for (const source of candidate.sources) {
    const official = source.collection?.method === "web_read" || source.kind === "live";
    if (!official || seen.has(source.url)) continue;
    seen.add(source.url);
    pages.push({ url: source.url, title: source.title });
  }
  return pages;
}

function candidateItem(
  candidate: Advisor,
  kind: "advisor" | "internship",
  origin: ItemOrigin,
): CatalogItem {
  const profile = profileFor(candidate.candidateId);
  const routeChips: RouteChip[] = (profile?.routes ?? [])
    .filter((route) => route.status !== "not-stated")
    .map((route) => ({ label: route.label, status: route.status }));
  const types: OpportunityType[] =
    kind === "internship"
      ? ["internship"]
      : profile?.routes.some(
            (route) => route.kind === "graduate" && route.status === "evidenced",
          )
        ? ["research", "graduate"]
        : ["research"];
  const pages = readableSources(candidate);
  const entryUrl = pages[0]?.url ?? candidate.sources[0]?.url ?? "";
  return {
    id: candidate.candidateId,
    kind,
    types,
    name: candidate.name,
    org: candidate.institution,
    summary: profile?.summary.text ?? candidate.research,
    timing: "unknown",
    period:
      kind === "internship"
        ? "旧批次线索，当前状态待核"
        : "招生与参与信息以采集时的公开表述为准",
    routeChips,
    sourceCount: candidate.sources.length,
    latestAt: latest(candidate.sources.map((source) => source.collectedAt)),
    entryUrl,
    readableUrls: pages,
    origin,
    candidate,
    searchText: [
      candidate.name,
      candidate.institution,
      candidate.research,
      candidate.approach,
      candidate.participation,
      candidate.unknowns,
      profile?.themes.map((theme) => theme.text).join(" ") ?? "",
      ...types.map((type) => opportunityTypeText[type]),
    ].join(" "),
  };
}

function entryItem(entry: Opportunity): CatalogItem {
  return {
    id: entry.id,
    kind: "entry",
    types: entry.types,
    name: entry.name,
    org: new URL(entry.entry.url).hostname,
    summary: entry.summary,
    timing: entry.timing,
    period: entry.period,
    routeChips: [],
    sourceCount: 1,
    latestAt: entry.entry.checkedAt,
    entryUrl: entry.entry.url,
    readableUrls: [{ url: entry.entry.url, title: entry.entry.label }],
    origin: "catalog",
    entry,
    searchText: [
      entry.name,
      entry.summary,
      entry.conditions,
      entry.support ?? "",
      entry.caveat,
      entry.period,
      ...entry.types.map((type) => opportunityTypeText[type]),
    ].join(" "),
  };
}

export const catalog: CatalogItem[] = [
  ...advisors.map((item) => candidateItem(item, "advisor", "catalog")),
  ...internships.map((item) => candidateItem(item, "internship", "catalog")),
  ...opportunities.map(entryItem),
];

const catalogById = new Map(catalog.map((item) => [item.id, item]));

export function typeCounts(
  items: CatalogItem[] = catalog,
): Record<OpportunityType, number> {
  const counts = Object.fromEntries(
    Object.keys(opportunityTypeText).map((type) => [type, 0]),
  ) as Record<OpportunityType, number>;
  for (const item of items) for (const type of item.types) counts[type] += 1;
  return counts;
}

/** A saved object that is not (or no longer) in the catalog, rebuilt from its snapshot. */
function savedCandidateItem(snapshot: CandidateSnapshot): CatalogItem {
  const kind = snapshot.type === "internship" ? "internship" : "advisor";
  const origin = snapshot.sources.some((source) => source.kind === "live")
    ? "saved-live"
    : "saved-snapshot";
  return candidateItem(savedCandidateForComparison(snapshot), kind, origin);
}

function savedEntryItem(record: TopicOpportunity): CatalogItem {
  const snapshot = record.opportunity;
  return {
    id: snapshot.opportunityId,
    kind: "entry",
    types: snapshot.types.filter(
      (type): type is OpportunityType => type in opportunityTypeText,
    ),
    name: snapshot.name,
    org: new URL(snapshot.entryUrl).hostname,
    summary: snapshot.summary,
    timing: "unknown",
    period: snapshot.period,
    routeChips: [],
    sourceCount: 1,
    latestAt: snapshot.checkedAt,
    entryUrl: snapshot.entryUrl,
    readableUrls: [{ url: snapshot.entryUrl, title: snapshot.name }],
    origin: "saved-snapshot",
    searchText: `${snapshot.name} ${snapshot.summary}`,
  };
}

/**
 * Resolve an id for display: the public catalog first, then only the given topic's
 * own saved objects. Other topics are never consulted.
 */
export function findItem(
  id: string,
  topic?: ExplorationTopic,
): CatalogItem | undefined {
  const fromCatalog = catalogById.get(id);
  if (fromCatalog) return fromCatalog;
  const candidate = topic?.candidates.find(
    (record) => record.candidate.candidateId === id,
  );
  if (candidate && candidate.association?.status !== "pending") {
    return savedCandidateItem(candidate.candidate);
  }
  const entry = topic?.opportunities?.find(
    (record) => record.opportunity.opportunityId === id,
  );
  return entry ? savedEntryItem(entry) : undefined;
}

export interface SessionRecord {
  item: CatalogItem;
  recordKind: "candidate" | "opportunity";
  reason: string;
  questions: string[];
  savedAt: string;
  decision?: "keep" | "maybe" | "exclude";
  pendingAssociation: boolean;
}

/** Every object saved in one topic, resolved to catalog items (catalog data wins). */
export function sessionRecords(topic?: ExplorationTopic): SessionRecord[] {
  if (!topic) return [];
  const candidates = topic.candidates.map((record) => ({
    item:
      record.association?.status === "pending"
        ? savedCandidateItem(record.candidate)
        : (catalogById.get(record.candidate.candidateId) ??
          savedCandidateItem(record.candidate)),
    recordKind: "candidate" as const,
    reason: record.reason,
    questions: record.questions,
    savedAt: record.savedAt,
    decision: record.decision,
    pendingAssociation: record.association?.status === "pending",
  }));
  const entries = (topic.opportunities ?? []).map((record) => ({
    item: catalogById.get(record.opportunity.opportunityId) ?? savedEntryItem(record),
    recordKind: "opportunity" as const,
    reason: record.reason,
    questions: record.questions,
    savedAt: record.savedAt,
    decision: record.decision,
    pendingAssociation: false,
  }));
  return [...candidates, ...entries];
}

export interface CatalogQuery {
  text?: string;
  types?: OpportunityType[];
  hideHistorical?: boolean;
}

/** Ranked matches; an empty query lists everything in the selected types. */
export function searchCatalog(
  query: CatalogQuery,
  items: CatalogItem[] = catalog,
): CatalogItem[] {
  const text = query.text?.trim() ?? "";
  const filtered = items.filter(
    (item) =>
      (!query.types?.length ||
        item.types.some((type) => query.types?.includes(type))) &&
      (!query.hideHistorical || item.timing !== "historical"),
  );
  if (!text) return filtered;
  return filtered
    .map((item) => ({ item, score: matchScore(text, item.searchText) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);
}

/** Public snapshot to store when the user adds an item to a topic. */
export function toSaveTarget(
  item: CatalogItem,
):
  | { kind: "candidate"; snapshot: CandidateSnapshot }
  | { kind: "opportunity"; snapshot: OpportunitySnapshot } {
  if (item.candidate) return { kind: "candidate", snapshot: item.candidate };
  if (item.entry) {
    return {
      kind: "opportunity",
      snapshot: {
        opportunityId: item.entry.id,
        name: item.entry.name,
        types: item.entry.types,
        period: item.entry.period,
        summary: item.entry.summary,
        entryUrl: item.entry.entry.url,
        checkedAt: item.entry.entry.checkedAt,
      },
    };
  }
  return {
    kind: "opportunity",
    snapshot: {
      opportunityId: item.id,
      name: item.name,
      types: item.types,
      period: item.period,
      summary: item.summary,
      entryUrl: item.entryUrl,
      checkedAt: item.latestAt,
    },
  };
}

export function isSaved(
  topic: ExplorationTopic | undefined,
  item: CatalogItem,
): boolean {
  if (!topic) return false;
  return item.kind === "entry"
    ? Boolean(
        topic.opportunities?.some(
          (record) => record.opportunity.opportunityId === item.id,
        ),
      )
    : topic.candidates.some((record) => record.candidate.candidateId === item.id);
}
