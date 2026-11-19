import { CheckIcon, GitCompareIcon, PlusIcon } from "@primer/octicons-react";
import { ActionList, Stack, Text } from "@primer/react";
import type { ReactNode } from "react";
import { routeHref } from "../app/router";
import { type CatalogItem, kindText } from "../lib/catalog";
import { opportunityTypeText } from "../lib/opportunities";
import {
  OriginLabel,
  RouteStatusLabel,
  TimingLabel,
  TypeIcon,
  formatDate,
} from "./meta";

/** Status line for one item: route chips for candidates, timing for entries. */
export function ItemStatus({ item }: { item: CatalogItem }) {
  return (
    <Stack direction="horizontal" gap="condensed" wrap="wrap" align="center">
      <OriginLabel origin={item.origin} />
      {item.kind === "entry" ? (
        <TimingLabel timing={item.timing} />
      ) : item.routeChips.length ? (
        item.routeChips
          .slice(0, 3)
          .map((chip) => (
            <RouteStatusLabel
              key={chip.label}
              status={chip.status}
              prefix={chip.label}
            />
          ))
      ) : (
        <TimingLabel timing="unknown" />
      )}
    </Stack>
  );
}

export function itemMeta(item: CatalogItem): string {
  const types = item.types.map((type) => opportunityTypeText[type]).join("、");
  const sources =
    item.kind === "entry"
      ? `入口查看于 ${formatDate(item.latestAt)}`
      : `${item.sourceCount} 条来源 · 最近采集 ${formatDate(item.latestAt)}`;
  return `${kindText[item.kind]} · ${types} · ${item.org} · ${sources}`;
}

export type RowAction = "compare" | "add";

/**
 * Item rows link to the detail view; one trailing action per list context keeps
 * rows scannable (compare in the library, add-to-session while discovering).
 */
export function ItemList({
  items,
  label,
  action,
  isActive,
  onAction,
  footer,
}: {
  items: CatalogItem[];
  label: string;
  action?: RowAction;
  isActive?: (item: CatalogItem) => boolean;
  onAction?: (item: CatalogItem) => void;
  footer?: ReactNode;
}) {
  return (
    <ActionList showDividers aria-label={label}>
      {items.map((item) => {
        const active = isActive?.(item) ?? false;
        return (
          <ActionList.LinkItem
            key={item.id}
            href={routeHref({ name: "item", id: item.id })}
          >
            <ActionList.LeadingVisual>
              <TypeIcon item={item} />
            </ActionList.LeadingVisual>
            {item.name}
            <ActionList.Description variant="block">
              <Stack gap="condensed">
                <Text>{item.summary}</Text>
                <Text size="small">{itemMeta(item)}</Text>
                <ItemStatus item={item} />
              </Stack>
            </ActionList.Description>
            {action && onAction && (
              <ActionList.TrailingAction
                icon={
                  action === "compare" ? GitCompareIcon : active ? CheckIcon : PlusIcon
                }
                label={
                  action === "compare"
                    ? active
                      ? `从比较栏移除${item.name}`
                      : `把${item.name}加入比较栏`
                    : active
                      ? `${item.name}已在本次探索中`
                      : `把${item.name}加入本次探索`
                }
                onClick={(event: {
                  preventDefault: () => void;
                  stopPropagation: () => void;
                }) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onAction(item);
                }}
              />
            )}
          </ActionList.LinkItem>
        );
      })}
      {footer}
    </ActionList>
  );
}
