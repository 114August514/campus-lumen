// Candidate detail view: shared by the product explore view (App) and the
// dev-only workbench canvas, so both render the same real implementation.
import { BookmarkIcon } from "@primer/octicons-react";
import {
  Button,
  FormControl,
  Heading,
  Label,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@primer/react";
import { useState } from "react";
import type { Advisor } from "../lib/advisors";
import type { CandidateSnapshot, ExplorationTopic } from "../lib/exploration-store";
import { SourceView } from "./SourceView";

export function AdvisorDetail({
  advisor,
  topic,
  onSave,
}: {
  advisor: Advisor;
  topic?: ExplorationTopic;
  onSave: (candidate: CandidateSnapshot, reason: string, questions: string[]) => void;
}) {
  const [reason, setReason] = useState("");
  const [question, setQuestion] = useState("");
  return (
    <Stack as="section" gap="normal">
      <Stack direction="horizontal" gap="condensed" align="center">
        <Heading as="h2" variant="medium">
          {advisor.name}
        </Heading>
        <Label variant={advisor.type === "internship" ? "primary" : "accent"}>
          {advisor.type === "internship" ? "实习岗位" : "导师"}
        </Label>
      </Stack>
      <Text as="p">{advisor.institution}</Text>
      <Text as="p">
        <Text weight="semibold">
          {advisor.type === "internship" ? "岗位方向与课题：" : "研究问题："}
        </Text>
        {advisor.research}
      </Text>
      <Text as="p">{advisor.approach}</Text>
      <Text as="p">
        <Text weight="semibold">
          {advisor.type === "internship" ? "入职与出勤要求：" : "参与途径："}
        </Text>
        {advisor.participation}
      </Text>
      <Text as="p">
        <Text weight="semibold">仍待了解：</Text>
        {advisor.unknowns}
      </Text>
      {advisor.sources.map((source, index) => (
        <SourceView
          key={`${source.url}-${source.collectedAt}-${index}`}
          source={source}
        />
      ))}
      <FormControl>
        <FormControl.Label>自己的理由（可不填）</FormControl.Label>
        <Textarea
          block
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
        />
      </FormControl>
      <FormControl>
        <FormControl.Label>想进一步了解什么（可不填）</FormControl.Label>
        <TextInput
          block
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
        />
      </FormControl>
      <Stack direction="horizontal" align="center" wrap="wrap">
        <Button
          leadingVisual={BookmarkIcon}
          disabled={!topic}
          onClick={() =>
            onSave(advisor, reason, question.trim() ? [question.trim()] : [])
          }
        >
          保存{advisor.name}到主题
        </Button>
        {!topic && <Text size="small">想保留时，再选择或创建主题。</Text>}
      </Stack>
    </Stack>
  );
}
