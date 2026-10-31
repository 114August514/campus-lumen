import { GitCompareIcon, SparkleFillIcon, TrashIcon } from "@primer/octicons-react";
import {
  ActionList,
  ActionMenu,
  Button,
  FormControl,
  Heading,
  IconButton,
  Link,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
} from "@primer/react";
import {
  Blankslate,
  type Column,
  DataTable,
  Hidden,
  InlineMessage,
} from "@primer/react/experimental";
import { useState } from "react";
import { go, routeHref } from "../app/router";
import { allOpportunities } from "../lib/advisors";
import { evidenceFromItems } from "../lib/analysis";
import { type SessionRecord, findItem, sessionRecords } from "../lib/catalog";
import { supplementalSources } from "../lib/compare";
import type { Decision, ExplorationTopic } from "../lib/exploration-store";
import { profileFor } from "../lib/profiles";
import { useAppState } from "../state/app-state";
import { useSessionActions } from "../state/session-actions";
import { AnalysisDialog, AnalysisResult } from "./AnalysisDialog";
import { AssociationNotice } from "./AssociationNotice";
import { Disclosure } from "./Disclosure";
import { ItemStatus, itemMeta } from "./ItemList";
import { DecisionLabel, TypeIcon, decisionText, formatDateTime } from "./meta";

type View = "all" | Decision | "undecided";

const viewText: Record<View, string> = {
  all: "全部",
  keep: "保留",
  maybe: "待定",
  exclude: "排除",
  undecided: "未决定",
};

const views: View[] = ["all", "keep", "maybe", "exclude", "undecided"];

function inView(record: SessionRecord, view: View): boolean {
  if (view === "all") return true;
  if (view === "undecided") return !record.decision;
  return record.decision === view;
}

function DecisionMenu({ record }: { record: SessionRecord }) {
  const { setDecision } = useSessionActions();
  return (
    <ActionMenu>
      <ActionMenu.Button size="small" aria-label={`${record.item.name}的决定`}>
        <DecisionLabel decision={record.decision} />
      </ActionMenu.Button>
      <ActionMenu.Overlay>
        <ActionList selectionVariant="single" aria-label="决定">
          {(Object.keys(decisionText) as Decision[]).map((decision) => (
            <ActionList.Item
              key={decision}
              selected={record.decision === decision}
              onSelect={() => setDecision(record.item, decision)}
            >
              {decisionText[decision][0]}
            </ActionList.Item>
          ))}
          <ActionList.Item
            selected={!record.decision}
            onSelect={() => setDecision(record.item, null)}
          >
            未决定
          </ActionList.Item>
        </ActionList>
      </ActionMenu.Overlay>
    </ActionMenu>
  );
}

function RecordActions({ record }: { record: SessionRecord }) {
  const { tray, toggleCompare } = useAppState();
  const { removeItem } = useSessionActions();
  const comparing = tray.ids.includes(record.item.id);
  return (
    <Stack direction="horizontal" gap="condensed">
      <IconButton
        size="small"
        icon={GitCompareIcon}
        disabled={record.pendingAssociation}
        aria-pressed={comparing}
        aria-label={
          comparing
            ? `从比较栏移除${record.item.name}`
            : `把${record.item.name}加入比较栏`
        }
        onClick={() => toggleCompare(record.item)}
      />
      <IconButton
        size="small"
        icon={TrashIcon}
        aria-label={`从本主题移除${record.item.name}`}
        onClick={() => removeItem(record.item)}
      />
    </Stack>
  );
}

function evidenceText(record: SessionRecord, topic: ExplorationTopic): string {
  const extra = supplementalSources(record.item, topic).length;
  return `${record.item.sourceCount} 条来源${extra ? ` · 补查 ${extra} 条` : ""}`;
}

export function StageProcess({
  topic,
  question,
}: { topic: ExplorationTopic; question: string }) {
  const { tray, mutate } = useAppState();
  const [view, setView] = useState<View>("all");
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [pauseNote, setPauseNote] = useState(topic.pausedNote ?? "");
  const records = sessionRecords(topic);
  const visible = records.filter((record) => inView(record, view));
  const pending = topic.candidates.filter(
    (record) => record.association?.status === "pending",
  );
  const corrected = topic.candidates.filter(
    (record) => record.association && record.association.status !== "pending",
  );
  const conflicts = records.flatMap((record) =>
    (profileFor(record.item.id)?.conflicts ?? []).map((conflict) => ({
      item: record.item,
      conflict,
    })),
  );
  const kept = records.filter((record) => record.decision === "keep");
  const analysable = visible
    .filter((record) => !record.pendingAssociation)
    .map((record) => record.item)
    .slice(0, 8);

  const columns: Column<SessionRecord & { id: string }>[] = [
    {
      id: "item",
      header: "对象",
      rowHeader: true,
      width: "grow",
      minWidth: 280,
      renderCell: (record) => (
        <Stack gap="condensed">
          <Stack direction="horizontal" gap="condensed" align="center">
            <TypeIcon item={record.item} />
            <Link href={routeHref({ name: "item", id: record.item.id })}>
              {record.item.name}
            </Link>
          </Stack>
          <Text size="small">{itemMeta(record.item)}</Text>
          {record.reason && <Text size="small">我的理由：{record.reason}</Text>}
        </Stack>
      ),
    },
    {
      id: "status",
      header: "状态",
      width: "growCollapse",
      renderCell: (record) => <ItemStatus item={record.item} />,
    },
    {
      id: "evidence",
      header: "依据",
      width: "auto",
      renderCell: (record) => <Text size="small">{evidenceText(record, topic)}</Text>,
    },
    {
      id: "decision",
      header: "我的决定",
      width: "auto",
      renderCell: (record) => <DecisionMenu record={record} />,
    },
    {
      id: "actions",
      header: "操作",
      width: "auto",
      renderCell: (record) => <RecordActions record={record} />,
    },
  ];

  if (!records.length) {
    return (
      <Blankslate>
        <Blankslate.Heading>这个探索还没有对象</Blankslate.Heading>
        <Blankslate.Description>
          在“② 发现”里把感兴趣的导师、岗位或资源加入进来，再回来整理和决定。
        </Blankslate.Description>
        <Blankslate.PrimaryAction
          href={routeHref({ name: "explore", sessionId: topic.id, stage: "discover" })}
        >
          去发现
        </Blankslate.PrimaryAction>
      </Blankslate>
    );
  }

  return (
    <Stack gap="spacious">
      {(pending.length > 0 || corrected.length > 0 || conflicts.length > 0) && (
        <Stack as="section" gap="normal" aria-labelledby="attention-heading">
          <Heading as="h2" variant="small" id="attention-heading">
            需要你留意
          </Heading>
          {[...pending, ...corrected].map((record) =>
            record.association ? (
              <AssociationNotice
                key={record.candidate.candidateId}
                note={record.association}
                current={record.candidate}
                onResolve={(choice) => {
                  const target = allOpportunities.find(
                    (item) => item.candidateId === choice.candidateId,
                  );
                  mutate(
                    (store) =>
                      store.resolveAssociation(topic.id, record.candidate.candidateId, {
                        ...choice,
                        research: target?.research ?? record.candidate.research,
                      }),
                    `已把这条记录关联到“${choice.name}（${choice.institution}）”。理由和待问未改动。`,
                  );
                }}
              />
            ) : null,
          )}
          {conflicts.map(({ item, conflict }) => (
            <InlineMessage variant="warning" key={`${item.id}-${conflict.topic}`}>
              {item.name} · {conflict.topic}存在不同说法：
              {conflict.versions
                .map((version) => version.text.replace(/。$/, ""))
                .join(" ／ ")}
              。保留待核，不自行判定。
            </InlineMessage>
          ))}
        </Stack>
      )}

      <Stack as="section" gap="normal" aria-labelledby="records-heading">
        <Stack
          direction={{ narrow: "vertical", regular: "horizontal" }}
          gap="condensed"
          justify="space-between"
          align="center"
        >
          <Heading as="h2" variant="medium" id="records-heading">
            整理与决定
          </Heading>
          <SegmentedControl aria-label="按决定查看" size="small">
            {views.map((item) => (
              <SegmentedControl.Button
                key={item}
                selected={view === item}
                onClick={() => setView(item)}
              >
                {`${viewText[item]} ${records.filter((record) => inView(record, item)).length}`}
              </SegmentedControl.Button>
            ))}
          </SegmentedControl>
        </Stack>
        <Text as="p" size="small">
          决定只是你的整理，不发送、不影响公开资料；排除的对象随时可以改回。
        </Text>
        {visible.length === 0 ? (
          <Text as="p">这个视图里还没有对象。</Text>
        ) : (
          <>
            <Hidden when="narrow">
              <DataTable
                aria-labelledby="records-heading"
                columns={columns}
                data={visible.map((record) => ({ ...record, id: record.item.id }))}
              />
            </Hidden>
            <Hidden when={["regular", "wide"]}>
              <Stack as="ul" gap="spacious" aria-label="本主题的对象">
                {visible.map((record) => (
                  <Stack as="li" key={record.item.id} gap="condensed">
                    <Link href={routeHref({ name: "item", id: record.item.id })}>
                      {record.item.name}
                    </Link>
                    <Text size="small">{itemMeta(record.item)}</Text>
                    <ItemStatus item={record.item} />
                    <Text size="small">{evidenceText(record, topic)}</Text>
                    <Stack direction="horizontal" gap="condensed" align="center">
                      <DecisionMenu record={record} />
                      <RecordActions record={record} />
                    </Stack>
                  </Stack>
                ))}
              </Stack>
            </Hidden>
          </>
        )}
        <Stack direction="horizontal" gap="condensed" wrap="wrap">
          <Button
            leadingVisual={GitCompareIcon}
            disabled={tray.ids.length < 2}
            onClick={() => go({ name: "compare", ids: tray.ids })}
          >
            比较比较栏中的 {tray.ids.length} 个对象
          </Button>
          <Button
            leadingVisual={SparkleFillIcon}
            disabled={!analysable.length}
            onClick={() => setAnalysisOpen(true)}
          >
            按问题整理当前视图（AI）
          </Button>
          {topic.lastComparison && (
            <Button
              variant="invisible"
              onClick={() =>
                go({
                  name: "compare",
                  ids: topic.lastComparison?.ids ?? [],
                  perspective: topic.lastComparison?.perspective,
                })
              }
            >
              继续上次比较（{formatDateTime(topic.lastComparison.at)}）
            </Button>
          )}
        </Stack>
        {tray.ids.length < 2 && (
          <Text size="small">
            用每行的比较按钮把 2–4 个同类对象加入比较栏，就可以并排比较。
          </Text>
        )}
      </Stack>

      {analysisOpen && (
        <AnalysisDialog
          operation="shortlist"
          initialQuestion={question || topic.question || topic.name}
          items={analysable}
          evidence={evidenceFromItems(analysable)}
          onClose={() => setAnalysisOpen(false)}
        />
      )}

      {kept.length > 0 && (
        <Stack as="section" gap="normal" aria-labelledby="next-heading">
          <Heading as="h2" variant="medium" id="next-heading">
            保留之后可以做什么
          </Heading>
          <Text as="p" size="small">
            这些是按需的建议，可以跳过；不做也完全可以。
          </Text>
          {kept.map((record) => {
            const prep = profileFor(record.item.id)?.preparation ?? [];
            return (
              <Stack key={record.item.id} gap="condensed">
                <Text weight="semibold">{record.item.name}</Text>
                {prep.length ? (
                  <Stack as="ul" gap="condensed">
                    {prep.map((step) => (
                      <Text as="li" key={step.text}>
                        {step.text}
                        <Text size="small">
                          （{step.origin === "source" ? "来源建议" : "整理建议"}：
                          {step.reason}）
                        </Text>
                        {step.resourceIds?.map((id) => {
                          const resource = findItem(id);
                          return resource ? (
                            <Link key={id} href={routeHref({ name: "item", id })}>
                              {" "}
                              相关资源：{resource.name}
                            </Link>
                          ) : null;
                        })}
                      </Text>
                    ))}
                  </Stack>
                ) : (
                  <Text as="p">
                    打开
                    <Link href={record.item.entryUrl} target="_blank" rel="noreferrer">
                      原站入口
                    </Link>
                    核对条件与时间；
                    {record.questions.length
                      ? `你记下的待问：${record.questions.join("；")}`
                      : "也可以在详情里记下待问。"}
                  </Text>
                )}
              </Stack>
            );
          })}
        </Stack>
      )}

      {(topic.analyses?.length ?? 0) > 0 && (
        <Stack as="section" gap="normal" aria-labelledby="analyses-heading">
          <Heading as="h2" variant="medium" id="analyses-heading">
            整理记录（{topic.analyses?.length}）
          </Heading>
          <Text as="p" size="small">
            只保存在本主题；每条记录注明当时发送了哪些个人内容。
          </Text>
          {topic.analyses?.map((analysis) => (
            <Disclosure
              key={analysis.id}
              summary={`${formatDateTime(analysis.createdAt)} · ${analysis.subjects.map((subject) => subject.name).join("、")} · 发送个人内容 ${analysis.sentFragmentIds.length} 条`}
            >
              <Stack gap="normal">
                <AnalysisResult analysis={analysis} />
                <Button
                  size="small"
                  variant="danger"
                  onClick={() =>
                    mutate(
                      (store) => store.removeAnalysis(topic.id, analysis.id),
                      "已删除这条整理记录。",
                    )
                  }
                >
                  删除这条记录
                </Button>
              </Stack>
            </Disclosure>
          ))}
        </Stack>
      )}

      <Disclosure
        summary={topic.pausedNote ? "这个探索已暂停（查看备注）" : "暂停这个探索"}
      >
        <Stack gap="condensed">
          <Text as="p" size="small">
            暂停只是留个备注，不会提醒或推送；什么时候回来都可以。
          </Text>
          <FormControl>
            <FormControl.Label>暂停备注（可不填）</FormControl.Label>
            <Textarea
              block
              rows={2}
              value={pauseNote}
              onChange={(event) => setPauseNote(event.target.value)}
            />
          </FormControl>
          <Stack direction="horizontal" gap="condensed">
            <Button
              onClick={() =>
                mutate(
                  (store) =>
                    store.updateTopic(topic.id, {
                      pausedNote: pauseNote.trim() || "已暂停",
                    }),
                  "已暂停这个探索；记录都保留着。",
                )
              }
            >
              保存并暂停
            </Button>
            {topic.pausedNote && (
              <Button
                variant="invisible"
                onClick={() =>
                  mutate(
                    (store) => store.updateTopic(topic.id, { pausedNote: "" }),
                    "已恢复这个探索。",
                  )
                }
              >
                取消暂停
              </Button>
            )}
          </Stack>
        </Stack>
      </Disclosure>
    </Stack>
  );
}
