// One row in the session-style topic list. ActionList's slot extraction keeps
// only one Description child, so the question and activity dates share a single
// block description — verified against the rendered DOM.
import { ActionList, CounterLabel } from "@primer/react";
import { sourceDate } from "../lib/advisors";
import type { ExplorationTopic } from "../lib/exploration-store";

export function TopicSessionItem({
  topic,
  onOpen,
}: {
  topic: ExplorationTopic;
  onOpen: () => void;
}) {
  const savedCount = topic.candidates.length + (topic.opportunities?.length ?? 0);
  return (
    <ActionList.Item onSelect={onOpen}>
      {topic.name}
      <ActionList.Description variant="block">
        {`${topic.question || "还没有填写当前问题"} · 最近活跃 ${sourceDate(topic.updatedAt)} · 创建于 ${sourceDate(topic.createdAt)}`}
      </ActionList.Description>
      <ActionList.TrailingVisual>
        <CounterLabel aria-label={`${savedCount} 项已保存内容`}>
          {savedCount}
        </CounterLabel>
      </ActionList.TrailingVisual>
    </ActionList.Item>
  );
}
