import type {
  AnalysisEvidence,
  AnalysisRequest,
  AnalysisSimulation,
} from "@campus-agora/api-client";
import { LinkExternalIcon } from "@primer/octicons-react";
import {
  Banner,
  Button,
  Checkbox,
  CheckboxGroup,
  Dialog,
  FormControl,
  Heading,
  Label,
  Link,
  Spinner,
  Stack,
  Text,
  Textarea,
} from "@primer/react";
import { useEffect, useMemo, useState } from "react";
import {
  type AnalysisRunState,
  type DeliveryState,
  buildAnalysisRequest,
  createAnalysisRun,
  privateFragmentOptions,
  toSavedAnalysis,
} from "../lib/analysis";
import type { CatalogItem } from "../lib/catalog";
import type { SavedAnalysis } from "../lib/exploration-store";
import { type AnalysisOutcome, useAppState } from "../state/app-state";
import { Disclosure } from "./Disclosure";

const outcomeText: Record<AnalysisOutcome, string> = {
  ok: "正常",
  delay: "延迟 3 秒",
  hang: "超时",
  error: "服务错误",
};

const deliveryText: Record<
  DeliveryState,
  [string, "secondary" | "accent" | "success" | "danger" | "attention"]
> = {
  not_sent: ["尚未发送", "secondary"],
  waiting: ["已发出，等待结果", "accent"],
  returned: ["已返回", "success"],
  service_error: ["服务返回错误", "danger"],
  unknown: ["发送状态未确认，可能已发送", "attention"],
};

function simulationFor(outcome: AnalysisOutcome): AnalysisSimulation | undefined {
  if (outcome === "delay") return { outcome: "ok", delayMs: 3000 };
  if (outcome === "hang") return { outcome: "hang" };
  if (outcome === "error") return { outcome: "error" };
  return undefined;
}

/** Saved or freshly returned result; citations link back to the public evidence. */
export function AnalysisResult({
  analysis,
  fragmentLabels,
}: { analysis: SavedAnalysis; fragmentLabels?: Record<string, string> }) {
  const evidence = new Map(analysis.evidence.map((item) => [item.ref, item]));
  const subjects = new Map(analysis.subjects.map((item) => [item.id, item.name]));
  return (
    <Stack gap="normal">
      <Stack direction="horizontal" gap="condensed" align="center" wrap="wrap">
        <Label variant="done">
          {analysis.simulated ? "模拟服务输出" : analysis.providerLabel}
        </Label>
        <Text size="small">请对照来源核实 · 问题：“{analysis.question}”</Text>
      </Stack>
      {analysis.sections.map((section) => (
        <Stack
          as="section"
          gap="condensed"
          key={section.kind}
          aria-label={section.title}
        >
          <Heading as="h4" variant="small">
            {section.title}
          </Heading>
          <Stack as="ol" gap="condensed">
            {section.points.map((point, index) => (
              <Stack as="li" gap="condensed" key={`${section.kind}-${index}`}>
                <Text>{point.text}</Text>
                <Stack direction="horizontal" gap="condensed" wrap="wrap">
                  {point.evidenceRefs.map((ref) => {
                    const item = evidence.get(ref);
                    if (!item) return null;
                    const label = `[${ref}] ${subjects.get(item.subjectId) ?? ""} · ${item.aspect === "unknowns" ? "仍需确认" : item.aspect}`;
                    return item.sourceUrl ? (
                      <Link
                        key={ref}
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Text size="small">
                          {label} <LinkExternalIcon />
                        </Text>
                      </Link>
                    ) : (
                      <Text key={ref} size="small">
                        {label}
                      </Text>
                    );
                  })}
                  {point.privateFragmentIds.map((id) => (
                    <Label key={id} variant="secondary">
                      回应你的{fragmentLabels?.[id] ?? "记录"}
                    </Label>
                  ))}
                </Stack>
              </Stack>
            ))}
          </Stack>
        </Stack>
      ))}
      {analysis.caveats.map((caveat) => (
        <Text key={caveat} size="small">
          {caveat}
        </Text>
      ))}
    </Stack>
  );
}

/**
 * Confirm-before-send for AI organization. Public evidence is listed for review;
 * personal notes come only from the current topic and are all unticked by default.
 */
export function AnalysisDialog({
  operation,
  initialQuestion,
  items,
  evidence,
  onClose,
}: {
  operation: AnalysisRequest["operation"];
  initialQuestion: string;
  items: CatalogItem[];
  evidence: AnalysisEvidence[];
  onClose: () => void;
}) {
  const { topic, mutate, demo } = useAppState();
  const [question, setQuestion] = useState(initialQuestion);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [state, setState] = useState<AnalysisRunState>({
    delivery: "not_sent",
    detail: "",
    stoppedByUser: false,
  });
  const [savedId, setSavedId] = useState("");
  const run = useMemo(() => createAnalysisRun(setState), []);
  useEffect(() => () => run.dispose(), [run]);
  const fragments = useMemo(() => privateFragmentOptions(topic, items), [topic, items]);
  const fragmentLabels = Object.fromEntries(
    fragments.map((fragment) => [
      fragment.id,
      `${fragment.subjectName}的${fragment.kind === "reason" ? "理由" : "待问"}`,
    ]),
  );
  const request = buildAnalysisRequest({
    operation,
    question,
    items,
    evidence,
    fragments,
    selected,
    simulation: simulationFor(demo.analysisOutcome),
  });
  const sentAtLeastOnce = state.delivery !== "not_sent" || Boolean(state.request);
  const busy = state.delivery === "waiting";
  const canSend =
    request.question.length > 0 &&
    request.subjects.length >= (operation === "compare" ? 2 : 1);
  const result =
    state.response && state.request
      ? toSavedAnalysis(state.request, state.response)
      : null;
  const [deliveryLabel, deliveryVariant] = deliveryText[state.delivery];

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Dialog title="按问题整理（模拟服务）" width="xlarge" onClose={onClose}>
      <Stack gap="normal">
        <Banner
          variant="info"
          layout="compact"
          title="接收服务：模拟整理服务（本地，不调用外部模型，不保存内容）"
          description="用途：按你的问题整理差异与待确认事项。发送前可以查看全部内容；真实模型接入后，这一步的确认方式不变。"
        />
        <FormControl disabled={busy}>
          <FormControl.Label>本次问题</FormControl.Label>
          <Textarea
            block
            rows={2}
            value={question}
            maxLength={300}
            onChange={(event) => setQuestion(event.target.value)}
          />
        </FormControl>

        <Disclosure
          summary={`查看将发送的公开依据 ${request.evidence.length} 条（${items.map((item) => item.name).join("、")}）`}
        >
          <Stack as="ul" gap="condensed" padding="condensed">
            {request.evidence.map((item) => (
              <Text as="li" size="small" key={item.ref}>
                [{item.ref}]{" "}
                {items.find((subject) => subject.id === item.subjectId)?.name} ·{" "}
                {item.aspect === "unknowns" ? "仍需确认" : item.aspect}：
                {item.text.slice(0, 120)}
                {item.text.length > 120 ? "…" : ""}
                {item.sourceTitle ? `（来源：${item.sourceTitle}）` : ""}
              </Text>
            ))}
          </Stack>
        </Disclosure>

        <CheckboxGroup disabled={busy}>
          <CheckboxGroup.Label>
            选择要一并发送的个人内容（默认不发送）
          </CheckboxGroup.Label>
          <CheckboxGroup.Caption>
            {topic
              ? `只列出“${topic.name}”里关于这些对象的理由和待问；其他主题的内容不会出现在这里。`
              : "当前是临时探索，没有可选的个人内容。"}
          </CheckboxGroup.Caption>
          {fragments.map((fragment) => (
            <FormControl key={fragment.id}>
              <Checkbox
                checked={selected.has(fragment.id)}
                onChange={() => toggle(fragment.id)}
              />
              <FormControl.Label>
                {fragment.subjectName}的{fragment.kind === "reason" ? "理由" : "待问"}：
                {fragment.text}
              </FormControl.Label>
            </FormControl>
          ))}
        </CheckboxGroup>
        {topic && fragments.length === 0 && (
          <Text size="small">这些对象在本主题中还没有理由或待问。</Text>
        )}

        <Stack direction="horizontal" gap="condensed" align="center" wrap="wrap">
          <Text weight="semibold">
            将发送：公开依据 {request.evidence.length} 条，个人内容{" "}
            {request.selectedPrivateFragments.length} 条
          </Text>
          {demo.analysisOutcome !== "ok" && (
            <Label variant="attention">演示设置：{outcomeText[demo.analysisOutcome]}</Label>
          )}
        </Stack>

        <Stack
          direction="horizontal"
          gap="condensed"
          wrap="wrap"
          align="center"
          aria-live="polite"
        >
          <Label variant={deliveryVariant}>{deliveryLabel}</Label>
          {busy && <Spinner size="small" />}
          {state.detail && <Text size="small">{state.detail}</Text>}
        </Stack>

        {state.delivery === "returned" && state.response && (
          <Text size="small">
            服务回显：收到公开依据 {state.response.received.evidenceRefs.length}{" "}
            条、个人内容 {state.response.received.privateFragmentIds.length} 条
            {state.response.received.privateFragmentIds.length
              ? `（${state.response.received.privateFragmentIds.map((id) => fragmentLabels[id] ?? id).join("、")}）`
              : ""}
            。
          </Text>
        )}

        {sentAtLeastOnce && state.delivery !== "waiting" && state.request && (
          <Text size="small">
            上次发送：个人内容 {state.request.selectedPrivateFragments.length}{" "}
            条。重新发送会使用上面当前勾选的内容，不会自动扩大范围。
          </Text>
        )}

        <Stack direction="horizontal" gap="condensed" wrap="wrap">
          {busy ? (
            <Button onClick={() => run.stop()}>停止等待</Button>
          ) : (
            <Button
              variant="primary"
              disabled={!canSend}
              onClick={() => void run.start(request)}
            >
              {sentAtLeastOnce ? "按当前选择重新发送" : "发送"}
            </Button>
          )}
          <Button onClick={onClose}>
            {state.delivery === "not_sent" ? "不发送" : "关闭"}
          </Button>
        </Stack>

        {result && (
          <Stack as="section" gap="normal" aria-label="整理结果">
            <Heading as="h3" variant="small">
              整理结果
            </Heading>
            <AnalysisResult analysis={result} fragmentLabels={fragmentLabels} />
            {topic ? (
              <Button
                disabled={savedId === result.id}
                onClick={() => {
                  if (
                    mutate(
                      (store) => store.saveAnalysis(topic.id, result),
                      `已保存到“${topic.name}”的整理记录，只在这个主题中可见。`,
                    )
                  ) {
                    setSavedId(result.id);
                  }
                }}
              >
                {savedId === result.id ? "已保存到本主题" : "保存到本主题的整理记录"}
              </Button>
            ) : (
              <Text size="small">临时探索不保存整理结果；关闭后即丢弃。</Text>
            )}
          </Stack>
        )}
      </Stack>
    </Dialog>
  );
}
