import { BookmarkIcon } from "@primer/octicons-react";
import { Button, FormControl, Stack, Text, Textarea } from "@primer/react";
import { useEffect, useState } from "react";
import type { CatalogItem } from "../lib/catalog";
import { recordFor, useSessionActions } from "../state/session-actions";

/**
 * The current topic's private reason and open questions for one item. Text stays in
 * this browser and this topic; it is never attached to lookups automatically.
 */
export function PrivateNotes({
  item,
  heading = "我的记录",
}: { item: CatalogItem; heading?: string }) {
  const { topic, addItem, updateNotes } = useSessionActions();
  const record = recordFor(topic, item);
  const [reason, setReason] = useState(record?.reason ?? "");
  const [questions, setQuestions] = useState(record?.questions.join("\n") ?? "");

  // Reset drafts when the item or the topic changes; drafts never cross topics.
  useEffect(() => {
    setReason(record?.reason ?? "");
    setQuestions(record?.questions.join("\n") ?? "");
  }, [record?.reason, record?.questions]);

  const lines = questions
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const dirty =
    reason !== (record?.reason ?? "") ||
    lines.join("\n") !== (record?.questions ?? []).join("\n");

  return (
    <Stack as="section" gap="condensed" aria-label={heading}>
      <Text weight="semibold">{heading}</Text>
      <Text size="small">
        {topic
          ? `只保存在本浏览器的“${topic.name}”中，不会自动发送。`
          : "当前是临时探索；先保存为探索主题才能留下记录。"}
      </Text>
      <FormControl disabled={!topic}>
        <FormControl.Label>为什么值得关注（可不填）</FormControl.Label>
        <Textarea
          block
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </FormControl>
      <FormControl disabled={!topic}>
        <FormControl.Label>还想确认什么（一行一个）</FormControl.Label>
        <Textarea
          block
          rows={2}
          value={questions}
          onChange={(event) => setQuestions(event.target.value)}
        />
      </FormControl>
      {record ? (
        <Button disabled={!dirty} onClick={() => updateNotes(item, reason, lines)}>
          保存记录
        </Button>
      ) : (
        <Button
          leadingVisual={BookmarkIcon}
          disabled={!topic}
          onClick={() => addItem(item, { reason, questions: lines })}
        >
          加入本次探索并保存记录
        </Button>
      )}
    </Stack>
  );
}
