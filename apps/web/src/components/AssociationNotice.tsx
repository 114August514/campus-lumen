import { Banner, Button, FormControl, Select, Stack } from "@primer/react";
import { useState } from "react";
import type { AssociationNote } from "../lib/exploration-store";

/** A split corrected this record; pending ones ask the user which object it meant. */
export function AssociationNotice({
  note,
  current,
  onResolve,
}: {
  note: AssociationNote;
  current: { name: string; institution: string };
  onResolve: (choice: AssociationNote["options"][number]) => void;
}) {
  const [choice, setChoice] = useState("");
  const before = `${note.previous.name}（${note.previous.institution}）`;
  if (note.status !== "pending") {
    return (
      <Banner
        variant="info"
        layout="compact"
        title="公开资料已更正"
        description={
          note.status === "relinked"
            ? `原“${before}”是误合并的记录，已拆分为不同对象。根据这条记录保存的来源，它现在指向“${current.name}（${current.institution}）”。你的理由和待问没有改动。`
            : `原“${before}”已拆分；已按你的选择指向“${current.name}（${current.institution}）”。你的理由和待问没有改动。`
        }
      />
    );
  }
  const selected = note.options.find((item) => item.candidateId === choice);
  return (
    <Stack gap="condensed">
      <Banner
        variant="warning"
        title="关联待确认"
        description={`原“${before}”是误合并的记录，已拆分为${note.options.length}个不同对象。这条记录保存的来源无法确定指向哪一个，请你选择。理由和待问只跟随这条记录，不会复制给其他对象。`}
      />
      <Stack
        direction={{ narrow: "vertical", regular: "horizontal" }}
        gap="condensed"
        align="end"
      >
        <FormControl>
          <FormControl.Label>这条记录指的是</FormControl.Label>
          <Select value={choice} onChange={(event) => setChoice(event.target.value)}>
            <Select.Option value="">暂不确定</Select.Option>
            {note.options.map((item) => (
              <Select.Option key={item.candidateId} value={item.candidateId}>
                {item.name}（{item.institution}）
              </Select.Option>
            ))}
          </Select>
        </FormControl>
        <Button disabled={!selected} onClick={() => selected && onResolve(selected)}>
          确认关联
        </Button>
      </Stack>
    </Stack>
  );
}
