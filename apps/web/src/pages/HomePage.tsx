import { BookIcon, CommentDiscussionIcon, SearchIcon } from "@primer/octicons-react";
import {
  ActionList,
  Button,
  FormControl,
  Heading,
  PageLayout,
  Stack,
  Text,
  TextInput,
} from "@primer/react";
import { useState } from "react";
import { go, routeHref } from "../app/router";
import { typeIcons } from "../components/meta";
import { catalog, typeCounts } from "../lib/catalog";
import {
  type OpportunityType,
  opportunityTypeText,
  opportunityTypes,
} from "../lib/opportunities";
import { byRecency, useAppState } from "../state/app-state";

const examples = [
  "想找本科阶段能参与的 AI 系统方向短期科研",
  "暑期想去外校或海外交流，有哪些项目和条件",
  "做 GPU 相关实验时，学校有哪些算力资源可以申请",
];

function relativeDay(value: string): string {
  const days = Math.floor((Date.now() - Date.parse(value)) / 86_400_000);
  if (days <= 0) return "今天";
  if (days === 1) return "昨天";
  return `${days} 天前`;
}

export default function HomePage() {
  const { topics, selectTopic } = useAppState();
  const [question, setQuestion] = useState("");
  const counts = typeCounts(catalog);
  const recent = byRecency(topics).slice(0, 3);

  function startExploring(text: string) {
    selectTopic("", { remember: false });
    go({ name: "explore", stage: "explore", q: text.trim() || undefined });
  }

  return (
    <PageLayout padding="none" containerWidth="large" columnGap="normal">
      <PageLayout.Content as="div">
        <Stack gap="spacious">
          <Stack gap="normal">
            <Heading as="h1">从一个问题开始探索</Heading>
            <Text as="p">
              跨学校与机构发现科研、实习、竞赛、交流和支持资源，看清实际要做什么、需要什么条件，再自己决定下一步。
            </Text>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                startExploring(question);
              }}
            >
              <Stack gap="condensed">
                <FormControl>
                  <FormControl.Label>你想了解什么？</FormControl.Label>
                  <TextInput
                    block
                    size="large"
                    leadingVisual={SearchIcon}
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    placeholder="写下方向、人名、项目或想解决的问题"
                  />
                  <FormControl.Caption>
                    开始探索不会联网，也不需要先建主题；联网查找要你在“发现”里单独点击。
                  </FormControl.Caption>
                </FormControl>
                <Stack direction="horizontal" gap="condensed" wrap="wrap">
                  <Button type="submit" variant="primary">
                    开始探索
                  </Button>
                  {examples.map((example) => (
                    <Button
                      key={example}
                      variant="invisible"
                      size="small"
                      onClick={() => startExploring(example)}
                    >
                      {example}
                    </Button>
                  ))}
                </Stack>
              </Stack>
            </form>
          </Stack>

          <Stack as="section" gap="normal" aria-labelledby="home-paths">
            <Heading as="h2" variant="medium" id="home-paths">
              三种开始方式
            </Heading>
            <ActionList showDividers aria-labelledby="home-paths">
              <ActionList.LinkItem
                href={routeHref({ name: "explore", stage: "explore" })}
                onClick={() => selectTopic("", { remember: false })}
              >
                <ActionList.LeadingVisual>
                  <SearchIcon />
                </ActionList.LeadingVisual>
                按问题探索
                <ActionList.Description variant="block">
                  探索 → 发现 →
                  处理：先写问题和条件，再查已有资料、联网补查，最后整理、比较和决定。
                </ActionList.Description>
              </ActionList.LinkItem>
              <ActionList.LinkItem href={routeHref({ name: "library" })}>
                <ActionList.LeadingVisual>
                  <BookIcon />
                </ActionList.LeadingVisual>
                直接查资源与入口
                <ActionList.Description variant="block">
                  只想找到原站入口时，搜到就可以离开，不用建主题。
                </ActionList.Description>
              </ActionList.LinkItem>
              <ActionList.LinkItem href={routeHref({ name: "sessions" })}>
                <ActionList.LeadingVisual>
                  <CommentDiscussionIcon />
                </ActionList.LeadingVisual>
                继续我的探索
                <ActionList.Description variant="block">
                  {topics.length
                    ? `你有 ${topics.length} 个保存的探索，记录只在这个浏览器里。`
                    : "保存过的探索会出现在这里。"}
                </ActionList.Description>
              </ActionList.LinkItem>
            </ActionList>
          </Stack>

          {recent.length > 0 && (
            <Stack as="section" gap="normal" aria-labelledby="home-recent">
              <Heading as="h2" variant="medium" id="home-recent">
                继续上次的探索
              </Heading>
              <ActionList showDividers aria-labelledby="home-recent">
                {recent.map((topic) => (
                  <ActionList.LinkItem
                    key={topic.id}
                    href={routeHref({
                      name: "explore",
                      sessionId: topic.id,
                      stage: topic.stage ?? "explore",
                    })}
                    onClick={() => selectTopic(topic.id)}
                  >
                    {topic.name}
                    <ActionList.Description variant="block">
                      {topic.question || "尚未填写问题"} ·{" "}
                      {relativeDay(topic.updatedAt)}活动 ·{" "}
                      {topic.candidates.length + (topic.opportunities?.length ?? 0)}{" "}
                      个对象
                    </ActionList.Description>
                  </ActionList.LinkItem>
                ))}
              </ActionList>
            </Stack>
          )}
        </Stack>
      </PageLayout.Content>
      <PageLayout.Pane
        position="end"
        width="small"
        divider="none"
        aria-label="按类型浏览"
      >
        <Stack as="section" gap="normal" aria-labelledby="home-types">
          <Heading as="h2" variant="small" id="home-types">
            按类型浏览资料库
          </Heading>
          <ActionList variant="full" aria-labelledby="home-types">
            {opportunityTypes.map((type: OpportunityType) => {
              const Icon = typeIcons[type];
              return (
                <ActionList.LinkItem
                  key={type}
                  href={routeHref({ name: "library", type })}
                >
                  <ActionList.LeadingVisual>
                    <Icon />
                  </ActionList.LeadingVisual>
                  {opportunityTypeText[type]}
                  <ActionList.TrailingVisual>{counts[type]}</ActionList.TrailingVisual>
                </ActionList.LinkItem>
              );
            })}
          </ActionList>
          <Text size="small">
            所有类型走同一条探索流程。导师资料整理得最深；其他类型目前是已整理的入口与条件，可以直读官方页补查。
          </Text>
        </Stack>
      </PageLayout.Pane>
    </PageLayout>
  );
}
