import { PlusIcon, TrashIcon } from "@primer/octicons-react";
import { ActionList, Button, Dialog, Heading, Stack, Text } from "@primer/react";
import { Blankslate } from "@primer/react/experimental";
import { useState } from "react";
import { go, routeHref } from "../app/router";
import { formatDateTime } from "../components/meta";
import type { ExplorationTopic } from "../lib/exploration-store";
import { opportunityTypeText } from "../lib/opportunities";
import { byRecency, useAppState } from "../state/app-state";

const stageText = {
  explore: "停在探索",
  discover: "停在发现",
  process: "停在处理",
} as const;

function summary(topic: ExplorationTopic): string {
  const records = [...topic.candidates, ...(topic.opportunities ?? [])];
  const kept = records.filter((record) => record.decision === "keep").length;
  const maybe = records.filter((record) => record.decision === "maybe").length;
  const excluded = records.filter((record) => record.decision === "exclude").length;
  const decisions = [
    kept && `保留 ${kept}`,
    maybe && `待定 ${maybe}`,
    excluded && `排除 ${excluded}`,
  ].filter(Boolean);
  const types = topic.types?.length
    ? topic.types
        .map(
          (type) =>
            opportunityTypeText[type as keyof typeof opportunityTypeText] ?? type,
        )
        .join("、")
    : "全部类型";
  return [
    types,
    `${records.length} 个对象`,
    ...decisions,
    stageText[topic.stage ?? "explore"],
    topic.pausedNote ? "已暂停" : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

export default function SessionsPage() {
  const { topics, selectTopic, mutate, topicId } = useAppState();
  const [deleting, setDeleting] = useState<ExplorationTopic | null>(null);
  const sorted = byRecency(topics);

  return (
    <Stack gap="normal">
      <Stack direction="horizontal" justify="space-between" align="center" wrap="wrap">
        <Heading as="h1">我的探索</Heading>
        <Button
          leadingVisual={PlusIcon}
          onClick={() => {
            selectTopic("", { remember: false });
            go({ name: "explore", stage: "explore" });
          }}
        >
          新的探索
        </Button>
      </Stack>
      <Text as="p">
        每个探索像一个可以回来接着做的会话：问题、加入的对象、你的决定和理由都只属于它，只保存在这个浏览器里。
      </Text>
      {sorted.length === 0 ? (
        <Blankslate>
          <Blankslate.Heading>还没有保存的探索</Blankslate.Heading>
          <Blankslate.Description>
            从一个问题开始；想留下记录时再保存为探索主题。
          </Blankslate.Description>
          <Blankslate.PrimaryAction
            href={routeHref({ name: "explore", stage: "explore" })}
          >
            开始探索
          </Blankslate.PrimaryAction>
        </Blankslate>
      ) : (
        <ActionList showDividers aria-label="探索会话，按最近活动排序">
          {sorted.map((topic) => (
            <ActionList.LinkItem
              key={topic.id}
              href={routeHref({
                name: "explore",
                sessionId: topic.id,
                stage: topic.stage ?? "explore",
              })}
              active={topic.id === topicId}
              onClick={() => selectTopic(topic.id)}
            >
              {topic.name}
              <ActionList.Description variant="block">
                <Stack gap="condensed">
                  <Text>{topic.question || "尚未填写问题"}</Text>
                  <Text size="small">
                    {summary(topic)} · 最近活动 {formatDateTime(topic.updatedAt)} ·
                    创建于 {formatDateTime(topic.createdAt)}
                  </Text>
                </Stack>
              </ActionList.Description>
              <ActionList.TrailingAction
                icon={TrashIcon}
                label={`删除探索“${topic.name}”`}
                onClick={(event: {
                  preventDefault: () => void;
                  stopPropagation: () => void;
                }) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setDeleting(topic);
                }}
              />
            </ActionList.LinkItem>
          ))}
        </ActionList>
      )}
      {deleting && (
        <Dialog
          title={`删除“${deleting.name}”？`}
          onClose={() => setDeleting(null)}
          footerButtons={[
            { content: "取消", onClick: () => setDeleting(null) },
            {
              content: "删除这个探索",
              buttonType: "danger",
              onClick: () => {
                const id = deleting.id;
                if (
                  mutate(
                    (store) => store.deleteTopic(id),
                    "已删除这个探索及其中的私人记录；其他探索和公开资料不受影响。",
                  ) &&
                  topicId === id
                ) {
                  selectTopic("");
                }
                setDeleting(null);
              },
            },
          ]}
        >
          <Text as="p">
            会删除其中的{" "}
            {deleting.candidates.length + (deleting.opportunities?.length ?? 0)}{" "}
            个对象记录、理由、待问和整理记录，无法撤销。其他探索不受影响。
          </Text>
        </Dialog>
      )}
    </Stack>
  );
}
