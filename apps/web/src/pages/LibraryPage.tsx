import { SearchIcon } from "@primer/octicons-react";
import {
  Checkbox,
  CounterLabel,
  FormControl,
  Heading,
  NavList,
  PageLayout,
  Select,
  Stack,
  Text,
  TextInput,
} from "@primer/react";
import { Blankslate } from "@primer/react/experimental";
import { useState } from "react";
import { type Route, go, routeHref } from "../app/router";
import { ItemList } from "../components/ItemList";
import { typeIcons } from "../components/meta";
import { catalog, searchCatalog, typeCounts } from "../lib/catalog";
import {
  type OpportunityType,
  opportunityTypeText,
  opportunityTypes,
} from "../lib/opportunities";
import { useAppState } from "../state/app-state";

type LibraryRoute = Extract<Route, { name: "library" }>;

export default function LibraryPage({ route }: { route: LibraryRoute }) {
  const { tray, toggleCompare } = useAppState();
  const [text, setText] = useState(route.q ?? "");
  const [hideHistorical, setHideHistorical] = useState(false);
  const type =
    route.type && route.type in opportunityTypeText
      ? (route.type as OpportunityType)
      : undefined;
  const counts = typeCounts(catalog);
  const results = searchCatalog({
    text,
    types: type ? [type] : undefined,
    hideHistorical,
  });

  function setType(next: OpportunityType | undefined) {
    go({ name: "library", q: text || undefined, type: next }, { replace: true });
  }

  return (
    <PageLayout padding="none" containerWidth="full" columnGap="normal">
      <PageLayout.Pane
        position="start"
        width="small"
        divider="line"
        hidden={{ narrow: true }}
        aria-label="按类型筛选"
      >
        <NavList aria-label="机会类型">
          <NavList.Item
            href={routeHref({ name: "library", q: text || undefined })}
            aria-current={!type ? "page" : undefined}
          >
            全部类型
            <NavList.TrailingVisual>{catalog.length}</NavList.TrailingVisual>
          </NavList.Item>
          {opportunityTypes.map((option) => {
            const Icon = typeIcons[option];
            return (
              <NavList.Item
                key={option}
                href={routeHref({
                  name: "library",
                  q: text || undefined,
                  type: option,
                })}
                aria-current={type === option ? "page" : undefined}
              >
                <NavList.LeadingVisual>
                  <Icon />
                </NavList.LeadingVisual>
                {opportunityTypeText[option]}
                <NavList.TrailingVisual>{counts[option]}</NavList.TrailingVisual>
              </NavList.Item>
            );
          })}
        </NavList>
      </PageLayout.Pane>
      <PageLayout.Content as="div">
        <Stack gap="normal">
          <Heading as="h1">资料库</Heading>
          <Text as="p">
            已整理的导师、实习岗位，以及科研、竞赛、交流、活动、升学、支持资源和规则入口。只想找到入口时，打开原站即可，不用建主题。
          </Text>
          <Stack
            direction={{ narrow: "vertical", regular: "horizontal" }}
            gap="normal"
            align="end"
          >
            <FormControl>
              <FormControl.Label>按用途或名称搜索</FormControl.Label>
              <TextInput
                leadingVisual={SearchIcon}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="例如：GPU、暑期、竞赛、文献"
              />
              <FormControl.Caption>会同时匹配条件和注意事项。</FormControl.Caption>
            </FormControl>
            <FormControl>
              <FormControl.Label>类型</FormControl.Label>
              <Select
                value={type ?? ""}
                onChange={(event) =>
                  setType(
                    (event.target.value || undefined) as OpportunityType | undefined,
                  )
                }
              >
                <Select.Option value="">全部类型</Select.Option>
                {opportunityTypes.map((option) => (
                  <Select.Option key={option} value={option}>
                    {opportunityTypeText[option]}（{counts[option]}）
                  </Select.Option>
                ))}
              </Select>
            </FormControl>
            <FormControl>
              <Checkbox
                checked={hideHistorical}
                onChange={(event) => setHideHistorical(event.target.checked)}
              />
              <FormControl.Label>隐藏已结束的批次</FormControl.Label>
            </FormControl>
          </Stack>
          <Stack direction="horizontal" gap="condensed" align="center">
            <Heading as="h2" variant="small">
              {type ? opportunityTypeText[type] : "全部类型"}
            </Heading>
            <CounterLabel>{results.length}</CounterLabel>
          </Stack>
          <Text size="small">
            可申请不等于获批，条件以原站为准；标“历史参考”的批次已经结束，只帮助了解有什么、怎么运作。
          </Text>
          {results.length ? (
            <ItemList
              items={results}
              label="资料库结果"
              action="compare"
              isActive={(item) => tray.ids.includes(item.id)}
              onAction={toggleCompare}
            />
          ) : (
            <Blankslate>
              <Blankslate.Heading>没有匹配的条目</Blankslate.Heading>
              <Blankslate.Description>
                换个用途描述，或者从“探索”开始联网查找。
              </Blankslate.Description>
              <Blankslate.PrimaryAction
                href={routeHref({
                  name: "explore",
                  stage: "discover",
                  q: text || undefined,
                })}
              >
                带着这个问题去探索
              </Blankslate.PrimaryAction>
            </Blankslate>
          )}
        </Stack>
      </PageLayout.Content>
    </PageLayout>
  );
}
