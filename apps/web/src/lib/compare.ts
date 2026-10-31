// Question × object comparison for every item kind. Advisor rows come from the
// source-bound profiles; other rows quote the item's own fields and retained
// sources. Nothing is scored, and a missing fact is shown as missing.
import type { Advisor } from "./advisors";
import type { CatalogItem, ItemKind } from "./catalog";
import type { ExplorationTopic, SourceSnapshot } from "./exploration-store";
import type { OpportunityTiming } from "./opportunities";
import {
  type BoundClaim,
  type CandidateProfile,
  type ParticipationRoute,
  type RouteStatus,
  profileFor,
} from "./profiles";

export type Perspective =
  | "research"
  | "short-term"
  | "graduate"
  | "role"
  | "growth"
  | "practical"
  | "overview";

export const perspectives: Record<ItemKind, { id: Perspective; label: string }[]> = {
  advisor: [
    { id: "research", label: "研究方向" },
    { id: "short-term", label: "短期参与" },
    { id: "graduate", label: "研究生" },
  ],
  internship: [
    { id: "role", label: "岗位与课题" },
    { id: "growth", label: "成长途径" },
    { id: "practical", label: "时间地点" },
  ],
  entry: [{ id: "overview", label: "概况" }],
};

export interface CellSource {
  title: string;
  url: string;
  collectedAt: string;
  content: string;
  label: string;
}

export interface CompareCell {
  itemId: string;
  text: string;
  /** Participation-route status (advisor rows). */
  status?: RouteStatus;
  /** Batch timing (entry rows). */
  timing?: OpportunityTiming;
  sources: CellSource[];
  /** The cell states missing or unconfirmed information. */
  unknown: boolean;
}

export interface CompareRow {
  id: string;
  label: string;
  cells: CompareCell[];
  /** Unknowns live here; each cell offers a follow-up lookup. */
  followup?: boolean;
}

function sourceLabel(source: SourceSnapshot): string {
  if (source.kind === "live") return "本次取得的正文";
  if (source.collection?.contentKind === "body") return "已读正文";
  return "整理摘要";
}

function toCellSource(source: SourceSnapshot): CellSource {
  return {
    title: source.title,
    url: source.url,
    collectedAt: source.collectedAt,
    content: source.relevanceEvidence?.length
      ? source.relevanceEvidence.join("\n")
      : source.content,
    label: sourceLabel(source),
  };
}

function bound(item: CatalogItem, claims: (BoundClaim | undefined)[]): CellSource[] {
  const urls = new Set(claims.flatMap((claim) => claim?.urls ?? []));
  const sources = item.candidate?.sources ?? [];
  return [...urls].flatMap((url) => {
    const matches = sources.filter((source) => source.url === url);
    const newest = matches.sort(
      (a, b) => Date.parse(b.collectedAt) - Date.parse(a.collectedAt),
    )[0];
    return newest ? [toCellSource(newest)] : [];
  });
}

const routeStatusText: Record<RouteStatus, string> = {
  evidenced: "有依据",
  historical: "历史参考",
  unknown: "未知",
  "not-stated": "未提及",
};

const levelText = { required: "硬要求", preferred: "优先", suggested: "建议" } as const;

function routeFor(
  profile: CandidateProfile,
  perspective: Perspective,
): ParticipationRoute | undefined {
  return profile.routes.find((route) => route.kind === perspective);
}

function profileRows(items: CatalogItem[], perspective: Perspective): CompareRow[] {
  const row = (
    id: string,
    label: string,
    build: (
      profile: CandidateProfile,
      item: CatalogItem,
    ) => Omit<CompareCell, "itemId">,
    followup = false,
  ): CompareRow => ({
    id,
    label,
    followup,
    cells: items.map((item) => {
      const profile = profileFor(item.id);
      if (!profile) return { itemId: item.id, ...evidenceCell(item, id) };
      return { itemId: item.id, ...build(profile, item) };
    }),
  });

  const rows: CompareRow[] = [
    row("research", "研究什么", (profile, item) => ({
      text: [profile.summary.text, ...profile.themes.map((theme) => theme.text)].join(
        "\n",
      ),
      sources: bound(item, [profile.summary, ...profile.themes]),
      unknown: false,
    })),
  ];

  if (perspective === "research") {
    rows.push(
      row("methods", "怎样研究", (profile, item) =>
        profile.methods
          ? {
              text: profile.methods.text,
              sources: bound(item, [profile.methods]),
              unknown: false,
            }
          : { text: "现有来源没有说明研究方法。", sources: [], unknown: true },
      ),
      row("routes", "参与途径概览", (profile, item) => {
        const listed = profile.routes.filter((route) => route.status !== "not-stated");
        return listed.length
          ? {
              text: listed
                .map((route) => `${route.label}：${routeStatusText[route.status]}`)
                .join("\n"),
              sources: bound(
                item,
                listed.map((route) => route.statusNote),
              ),
              unknown: listed.every((route) => route.status === "unknown"),
            }
          : { text: "现有来源没有提到参与途径。", sources: [], unknown: true };
      }),
    );
  } else {
    rows.push(
      row("route", "怎样参与", (profile, item) => {
        const route = routeFor(profile, perspective);
        if (!route || route.status === "not-stated") {
          return {
            text: "现有来源没有提到这一途径；不能据此认为不接收。",
            status: "not-stated",
            sources: route ? bound(item, [route.statusNote]) : [],
            unknown: true,
          };
        }
        return {
          text: `${route.label}：${route.statusNote.text}`,
          status: route.status,
          sources: bound(item, [route.statusNote]),
          unknown: route.status === "unknown",
        };
      }),
      row("conditions", "条件", (profile, item) => {
        const route = routeFor(profile, perspective);
        const conditions = route?.conditions ?? [];
        const lines = conditions.map(
          (condition) => `${levelText[condition.level]}：${condition.text}`,
        );
        if (route?.prerequisites) lines.push(`前提：${route.prerequisites.text}`);
        return lines.length
          ? {
              text: lines.join("\n"),
              sources: bound(item, [...conditions, route?.prerequisites]),
              unknown: false,
            }
          : { text: "现有来源没有列出这一途径的条件。", sources: [], unknown: true };
      }),
    );
  }

  rows.push(
    row("beyond", "介绍之外", (profile, item) => ({
      text: [
        ...profile.beyond.records.map(
          (record) => `${record.role}（${record.period}）：${record.text}`,
        ),
        profile.beyond.records.length ? "" : profile.beyond.gap,
        ...profile.beyond.paths.map((path) => path.text),
      ]
        .filter(Boolean)
        .join("\n"),
      sources: bound(item, [...profile.beyond.records, ...profile.beyond.paths]),
      unknown: profile.beyond.records.length === 0,
    })),
    row(
      "unknowns",
      "仍需确认",
      (profile, item) => ({
        text: [
          ...profile.unknowns.map((claim) => claim.text),
          ...profile.conflicts.map(
            (conflict) =>
              `${conflict.topic}：${conflict.versions.map((version) => version.text).join(" ／ ")}`,
          ),
        ].join("\n"),
        sources: bound(item, [
          ...profile.unknowns,
          ...profile.conflicts.flatMap((conflict) => conflict.versions),
        ]),
        unknown: true,
      }),
      true,
    ),
  );

  const notes = items.some((item) => profileFor(item.id)?.perspectiveNotes);
  if (notes && perspective !== "overview") {
    rows.push(
      row("next", "可以继续了解", (profile, item) => {
        const note =
          profile.perspectiveNotes?.[
            perspective as "research" | "short-term" | "graduate"
          ];
        return note
          ? { text: note.text, sources: bound(item, [note]), unknown: false }
          : {
              text: "按当前问题核对原文的对象、时期和条件；也可以先保存后暂停。",
              sources: [],
              unknown: false,
            };
      }),
    );
  }
  return rows;
}

/** Quote retained evidence for candidates without a curated profile. */
function evidenceCell(item: CatalogItem, field: string): Omit<CompareCell, "itemId"> {
  const candidate = item.candidate as Advisor | undefined;
  const sources = (candidate?.sources ?? []).map(toCellSource);
  if (!candidate || !sources.length) {
    return {
      text: "没有保留可核对的来源，此项暂不能确认。",
      sources: [],
      unknown: true,
    };
  }
  let text = "";
  if (field === "research" || field === "role") {
    const external = candidate.candidateId.startsWith("external:");
    text = external
      ? [
          candidate.research
            ? `用户填写的说明（未自动核实）：${candidate.research}`
            : "",
          ...sources
            .slice(0, 3)
            .map(
              (source) =>
                `${source.label}（${source.title}）：${source.content.slice(0, 1000)}`,
            ),
        ]
          .filter(Boolean)
          .join("\n\n")
      : candidate.research;
  } else if (field === "methods") {
    text = candidate.approach;
  } else if (field === "route" || field === "routes" || field === "conditions") {
    text = candidate.participation;
  } else if (field === "unknowns") {
    text = [
      candidate.unknowns,
      ...candidate.sources.flatMap((source) => source.unknowns ?? []),
    ]
      .filter((value, index, values) => value && values.indexOf(value) === index)
      .join("\n");
  } else if (field === "beyond") {
    return {
      text: "暂无可核实的经历记录；可从来源页了解公开信息。",
      sources,
      unknown: true,
    };
  } else {
    text =
      "按当前问题核对原文的对象、时期和参与条件；仍有疑问时可补查，也可以保存后暂停。";
  }
  return {
    text: text || "尚未核实此项；可以查看已读依据或继续补查。",
    sources,
    unknown: field === "unknowns" || !text,
  };
}

function internshipRows(items: CatalogItem[], perspective: Perspective): CompareRow[] {
  const fields = [
    { id: "role", label: "职责与课题" },
    { id: "methods", label: "技术要求与方法" },
    ...(perspective === "role"
      ? []
      : [
          {
            id: "route",
            label:
              perspective === "growth" ? "转正与成长途径（待核）" : "时间地点与要求",
          },
        ]),
    { id: "unknowns", label: "仍需确认", followup: true },
    { id: "next", label: "可以继续了解" },
  ];
  return fields.map((field) => ({
    id: field.id,
    label: field.label,
    followup: field.followup,
    cells: items.map((item) => ({ itemId: item.id, ...evidenceCell(item, field.id) })),
  }));
}

const timingText: Record<OpportunityTiming, string> = {
  standing: "常设，无批次截止",
  historical: "已结束的批次，仅作历史参考",
  unknown: "当前状态未确认",
};

function entryRows(items: CatalogItem[]): CompareRow[] {
  const entrySource = (item: CatalogItem): CellSource[] => [
    {
      title: item.entry?.entry.label ?? item.name,
      url: item.entryUrl,
      collectedAt: item.latestAt,
      content: "资料库条目的原站入口；条件以原站为准。",
      label: "原站入口",
    },
  ];
  const field = (
    id: string,
    label: string,
    pick: (item: CatalogItem) => { text?: string; timing?: OpportunityTiming },
    followup = false,
  ): CompareRow => ({
    id,
    label,
    followup,
    cells: items.map((item) => {
      const value = pick(item);
      return {
        itemId: item.id,
        text: value.text || "来源没有说明。",
        timing: value.timing,
        sources: entrySource(item),
        unknown: !value.text || followup,
      };
    }),
  });
  return [
    field("summary", "概况", (item) => ({ text: item.summary })),
    field("conditions", "适用对象与条件", (item) => ({ text: item.entry?.conditions })),
    field("support", "支持与费用", (item) => ({ text: item.entry?.support })),
    field("timing", "时期与状态", (item) => ({
      text: `${item.period}；${timingText[item.timing]}`,
      timing: item.timing,
    })),
    field("caveat", "仍需确认", (item) => ({ text: item.entry?.caveat }), true),
  ];
}

/** null when the items cannot be compared together (none, or mixed kinds). */
export function compareKind(items: CatalogItem[]): ItemKind | null {
  const kinds = new Set(items.map((item) => item.kind));
  return kinds.size === 1 ? items[0].kind : null;
}

export function defaultPerspective(kind: ItemKind): Perspective {
  return perspectives[kind][0].id;
}

export function buildCompareRows(
  items: CatalogItem[],
  perspective: Perspective,
): CompareRow[] {
  const kind = compareKind(items);
  if (!kind) return [];
  if (kind === "advisor") return profileRows(items, perspective);
  if (kind === "internship") return internshipRows(items, perspective);
  return entryRows(items);
}

const followupTerms: Record<Perspective, string> = {
  research: "近期研究 论文",
  graduate: "研究生招生 PhD admission",
  "short-term": "本科科研 RA visiting students",
  role: "实习 岗位职责 requirements",
  growth: "转正 培养 return offer",
  practical: "实习时间 工作地点 招聘要求",
  overview: "申请条件 通知",
};

/** Built from public fields only; private topic notes are never query input. */
export function followupQuery(item: CatalogItem, perspective: Perspective): string {
  return `${item.name} ${item.kind === "entry" ? "" : item.org} ${followupTerms[perspective]}`
    .replace(/\s+/g, " ")
    .trim();
}

/** Sources the user saved for this item in this topic beyond the public ones. */
export function supplementalSources(
  item: CatalogItem,
  topic?: ExplorationTopic,
): SourceSnapshot[] {
  if (item.kind === "entry") {
    return (
      topic?.opportunities?.find((entry) => entry.opportunity.opportunityId === item.id)
        ?.sources ?? []
    );
  }
  const record = topic?.candidates.find(
    (entry) => entry.candidate.candidateId === item.id,
  );
  if (!record) return [];
  const key = (source: SourceSnapshot) =>
    JSON.stringify([source.url, source.collectedAt, source.content, source.query]);
  const original = new Set((item.candidate?.sources ?? []).map(key));
  return record.candidate.sources.filter((source) => !original.has(key(source)));
}
