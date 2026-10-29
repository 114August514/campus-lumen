// Product entry home, continued from the PR #15 layout: one large search
// across the collected material, recent topics and advisor browsing in the
// main column, and type entries in the end pane. States plainly what each
// type supports today.
import {
  ArrowRightIcon,
  LinkExternalIcon,
  SearchIcon,
  XIcon,
} from "@primer/octicons-react";
import {
  ActionList,
  Button,
  CounterLabel,
  FormControl,
  Heading,
  Label,
  Link,
  PageLayout,
  Stack,
  Text,
  TextInput,
} from "@primer/react";
import { Blankslate } from "@primer/react/experimental";
import { useState } from "react";
import type { Advisor } from "../lib/advisors";
import { sourceDate, sourceSummary } from "../lib/advisors";
import {
  type OpportunityType,
  matchesOpportunity,
  opportunities,
  opportunityTypeText,
  opportunityTypes,
} from "../lib/opportunities";

export function matchesAdvisor(advisor: Advisor, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const text = [
    advisor.name,
    advisor.institution,
    advisor.research,
    advisor.approach,
    advisor.participation,
  ]
    .join(" ")
    .toLowerCase();
  return terms.every((term) => text.includes(term));
}

function typeNote(type: OpportunityType): string {
  const ended = opportunities.filter(
    (item) => item.types.includes(type) && item.timing === "historical",
  ).length;
  return ended > 0 ? `入口与条件，含 ${ended} 项已结束批次的历史参考` : "入口与条件";
}

export interface HomeTopicSummary {
  id: string;
  name: string;
  question: string;
  updatedAt: string;
  savedCount: number;
}

// The home advisor section is an entry preview; full browsing lives in 找导师.
const homePreviewCount = 4;

function CandidateRow({
  advisor,
  onOpen,
}: {
  advisor: Advisor;
  onOpen: () => void;
}) {
  return (
    <ActionList.Item onSelect={onOpen}>
      <Stack direction="horizontal" gap="condensed" align="center">
        <Text>{advisor.name}</Text>
        <Label variant={advisor.type === "internship" ? "primary" : "accent"}>
          {advisor.type === "internship" ? "实习岗位" : "导师"}
        </Label>
      </Stack>
      <ActionList.Description variant="block">
        {advisor.institution}。{advisor.research}（{sourceSummary(advisor)}）
      </ActionList.Description>
    </ActionList.Item>
  );
}

export function ExploreHome({
  advisors,
  onOpenAdvisors,
  onOpenAdvisor,
  onOpenType,
  topics = [],
  onOpenTopic,
  onOpenTopics,
  onCarryAdvisorQuery,
}: {
  advisors: Advisor[];
  onOpenAdvisors: () => void;
  onOpenAdvisor: (candidateId: string) => void;
  onOpenType: (type: OpportunityType) => void;
  topics?: HomeTopicSummary[];
  onOpenTopic?: (topicId: string) => void;
  onOpenTopics?: () => void;
  onCarryAdvisorQuery?: (query: string) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim();
  const searching = q.length > 0;
  const foundAdvisors = searching ? advisors.filter((a) => matchesAdvisor(a, q)) : [];
  const foundOpportunities = searching
    ? opportunities.filter((item) => matchesOpportunity(item, q))
    : [];
  const totalFound = foundAdvisors.length + foundOpportunities.length;

  return (
    <PageLayout padding="none" columnGap="normal" rowGap="normal">
      <PageLayout.Header>
        <Stack gap="normal" paddingBlock="normal">
          <Heading as="h1">探索机会</Heading>
          <FormControl>
            <FormControl.Label>搜索导师、机会、资源或规则</FormControl.Label>
            <TextInput
              leadingVisual={SearchIcon}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="导师、研究问题、竞赛、暑校、算力……"
              size="large"
              block
            />
            <FormControl.Caption>
              搜索当前收录的资料；找导师时可以进一步补查外部来源。
            </FormControl.Caption>
          </FormControl>
        </Stack>
      </PageLayout.Header>

      <PageLayout.Content
        as="section"
        aria-label={searching ? "搜索结果" : "导师与探索主题"}
      >
        <Stack gap="spacious">
          {searching ? (
            <Stack as="section" gap="normal" aria-labelledby="home-results">
              <Stack
                direction="horizontal"
                justify="space-between"
                align="center"
                gap="normal"
              >
                <Stack direction="horizontal" align="center" gap="condensed">
                  <Heading as="h2" variant="medium" id="home-results">
                    搜索结果
                  </Heading>
                  <CounterLabel>{totalFound}</CounterLabel>
                </Stack>
                <Button
                  size="small"
                  variant="invisible"
                  leadingVisual={XIcon}
                  onClick={() => setQuery("")}
                >
                  清除搜索
                </Button>
              </Stack>
              <Text as="output" size="small">
                当前收录中找到 {totalFound} 项与“{q}”相关的资料。
              </Text>
              {totalFound === 0 ? (
                <Blankslate>
                  <Blankslate.Heading>当前收录中未找到</Blankslate.Heading>
                  <Blankslate.Description>
                    可以换个关键词；导师信息还可以补查外部来源。
                  </Blankslate.Description>
                  <Blankslate.PrimaryAction
                    onClick={() => {
                      onCarryAdvisorQuery?.(q);
                      onOpenAdvisors();
                    }}
                  >
                    去找导师补查
                  </Blankslate.PrimaryAction>
                </Blankslate>
              ) : (
                <>
                  {foundAdvisors.length > 0 && (
                    <Stack gap="condensed">
                      <Heading as="h3" variant="small">
                        导师与岗位候选
                      </Heading>
                      <ActionList showDividers aria-label="导师与岗位候选">
                        {foundAdvisors.map((advisor) => (
                          <CandidateRow
                            key={advisor.candidateId}
                            advisor={advisor}
                            onOpen={() => onOpenAdvisor(advisor.candidateId)}
                          />
                        ))}
                      </ActionList>
                    </Stack>
                  )}
                  {foundOpportunities.length > 0 && (
                    <Stack gap="condensed">
                      <Heading as="h3" variant="small">
                        机会与入口
                      </Heading>
                      {foundOpportunities.map((item) => (
                        <Stack key={item.id} gap="tight">
                          <Link href={item.entry.url} target="_blank" rel="noreferrer">
                            {item.name}{" "}
                            <LinkExternalIcon aria-label="在新窗口打开原站" />
                          </Link>
                          <Text size="small">
                            {item.types
                              .map((type) => opportunityTypeText[type])
                              .join("、")}{" "}
                            · {item.period}
                          </Text>
                        </Stack>
                      ))}
                    </Stack>
                  )}
                </>
              )}
            </Stack>
          ) : (
            <>
              {topics.length > 0 && onOpenTopic && (
                <Stack as="section" gap="normal" aria-labelledby="home-topics">
                  <Stack
                    direction="horizontal"
                    justify="space-between"
                    align="center"
                    gap="normal"
                  >
                    <Heading as="h2" variant="medium" id="home-topics">
                      继续上次的探索
                    </Heading>
                    {onOpenTopics && (
                      <Button size="small" variant="invisible" onClick={onOpenTopics}>
                        全部主题
                      </Button>
                    )}
                  </Stack>
                  <ActionList variant="full" aria-label="最近活跃的探索主题">
                    {topics.map((topic) => (
                      <ActionList.Item
                        key={topic.id}
                        onSelect={() => onOpenTopic(topic.id)}
                      >
                        {topic.name}
                        <ActionList.Description variant="block">
                          {`${topic.question || "还没有填写当前问题"} · 最近活跃 ${sourceDate(topic.updatedAt)}`}
                        </ActionList.Description>
                        <ActionList.TrailingVisual>
                          <CounterLabel aria-label={`${topic.savedCount} 项已保存内容`}>
                            {topic.savedCount}
                          </CounterLabel>
                        </ActionList.TrailingVisual>
                      </ActionList.Item>
                    ))}
                  </ActionList>
                </Stack>
              )}
              <Stack as="section" gap="normal" aria-labelledby="home-advisors">
                <Stack
                  direction="horizontal"
                  justify="space-between"
                  align="center"
                  gap="normal"
                >
                  <Heading as="h2" variant="medium" id="home-advisors">
                    导师探索
                  </Heading>
                  <Button
                    size="small"
                    variant="invisible"
                    trailingVisual={ArrowRightIcon}
                    onClick={onOpenAdvisors}
                  >
                    查找与比较
                  </Button>
                </Stack>
                <Text size="small">
                  已有 {advisors.length} 项导师与岗位候选资料，附来源与查看日期
                </Text>
                <ActionList variant="full" aria-label="导师与岗位候选">
                  {advisors.slice(0, homePreviewCount).map((advisor) => (
                    <CandidateRow
                      key={advisor.candidateId}
                      advisor={advisor}
                      onOpen={() => onOpenAdvisor(advisor.candidateId)}
                    />
                  ))}
                  {advisors.length > homePreviewCount && (
                    <ActionList.Item onSelect={onOpenAdvisors}>
                      查看全部 {advisors.length} 项候选
                      <ActionList.TrailingVisual>
                        <ArrowRightIcon />
                      </ActionList.TrailingVisual>
                    </ActionList.Item>
                  )}
                </ActionList>
              </Stack>
            </>
          )}
        </Stack>
      </PageLayout.Content>

      <PageLayout.Pane
        position="end"
        width="small"
        divider="none"
        aria-label="分类入口"
      >
        <Stack as="section" gap="normal" aria-labelledby="home-types">
          <Heading as="h2" variant="medium" id="home-types">
            按类型浏览
          </Heading>
          <ActionList variant="full" aria-label="机会与资源类型">
            {opportunityTypes.map((type) => (
              <ActionList.Item key={type} onSelect={() => onOpenType(type)}>
                {opportunityTypeText[type]}
                <ActionList.TrailingVisual>
                  <CounterLabel>
                    {opportunities.filter((item) => item.types.includes(type)).length}
                  </CounterLabel>
                </ActionList.TrailingVisual>
                <ActionList.Description variant="block">
                  {typeNote(type)}
                </ActionList.Description>
              </ActionList.Item>
            ))}
          </ActionList>
          <Text size="small">
            找导师是目前最完整的场景。其他类型目前提供入口与条件查询，比较和公开补查尚未覆盖。
          </Text>
        </Stack>
      </PageLayout.Pane>
    </PageLayout>
  );
}
