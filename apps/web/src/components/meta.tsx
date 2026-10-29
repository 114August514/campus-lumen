// Shared status vocabulary: one wording and one colour per state across pages.
// Colour only reinforces the text; every label carries its meaning in words.
import {
  BeakerIcon,
  BriefcaseIcon,
  CalendarIcon,
  GlobeIcon,
  type Icon,
  LawIcon,
  MortarBoardIcon,
  ToolsIcon,
  TrophyIcon,
} from "@primer/octicons-react";
import { Label } from "@primer/react";
import type { CatalogItem, ItemOrigin } from "../lib/catalog";
import type { Decision } from "../lib/exploration-store";
import type { OpportunityTiming, OpportunityType } from "../lib/opportunities";
import type { RouteStatus } from "../lib/profiles";

export const typeIcons: Record<OpportunityType, Icon> = {
  research: BeakerIcon,
  internship: BriefcaseIcon,
  competition: TrophyIcon,
  exchange: GlobeIcon,
  activity: CalendarIcon,
  graduate: MortarBoardIcon,
  support: ToolsIcon,
  rules: LawIcon,
};

export function TypeIcon({ item }: { item: Pick<CatalogItem, "types" | "kind"> }) {
  const type =
    item.kind === "internship" ? "internship" : (item.types[0] ?? "research");
  const TypeGlyph = typeIcons[type];
  return <TypeGlyph aria-hidden />;
}

type LabelVariant =
  | "default"
  | "primary"
  | "secondary"
  | "accent"
  | "success"
  | "attention"
  | "severe"
  | "danger"
  | "done";

const originText: Record<
  ItemOrigin | "live" | "lead" | "simulated",
  [string, LabelVariant]
> = {
  catalog: ["已有资料", "secondary"],
  "saved-live": ["本次取得", "accent"],
  "saved-snapshot": ["已保存的快照", "secondary"],
  live: ["本次取得", "accent"],
  lead: ["待查线索", "attention"],
  simulated: ["模拟", "done"],
};

export function OriginLabel({ origin }: { origin: keyof typeof originText }) {
  const [text, variant] = originText[origin];
  return <Label variant={variant}>{text}</Label>;
}

const timingText: Record<OpportunityTiming, [string, LabelVariant]> = {
  standing: ["常设", "success"],
  historical: ["历史参考", "secondary"],
  unknown: ["状态待核", "attention"],
};

export function TimingLabel({ timing }: { timing: OpportunityTiming }) {
  const [text, variant] = timingText[timing];
  return <Label variant={variant}>{text}</Label>;
}

export const routeStatusText: Record<RouteStatus, [string, LabelVariant]> = {
  evidenced: ["有依据", "success"],
  historical: ["历史参考", "secondary"],
  unknown: ["未知", "attention"],
  "not-stated": ["未提及", "secondary"],
};

export function RouteStatusLabel({
  status,
  prefix,
}: { status: RouteStatus; prefix?: string }) {
  const [text, variant] = routeStatusText[status];
  return <Label variant={variant}>{prefix ? `${prefix}：${text}` : text}</Label>;
}

export const decisionText: Record<Decision, [string, LabelVariant]> = {
  keep: ["保留", "success"],
  maybe: ["待定", "attention"],
  exclude: ["排除", "secondary"],
};

export function DecisionLabel({ decision }: { decision?: Decision }) {
  if (!decision) return <Label variant="default">未决定</Label>;
  const [text, variant] = decisionText[decision];
  return <Label variant={variant}>{text}</Label>;
}

/** Date part only; collection/check times are shown as dates, never as freshness claims. */
export function formatDate(value: string): string {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toLocaleDateString("zh-CN") : value;
}

export function formatDateTime(value: string): string {
  const time = Date.parse(value);
  return Number.isFinite(time)
    ? new Date(time).toLocaleString("zh-CN", { dateStyle: "short", timeStyle: "short" })
    : value;
}
