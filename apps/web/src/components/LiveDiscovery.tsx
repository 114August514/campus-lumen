import type { DiscoveryResponse, DiscoverySource } from "@campus-agora/api-client";
import {
  AlertIcon,
  CheckIcon,
  CircleSlashIcon,
  GlobeIcon,
  LinkExternalIcon,
  SearchIcon,
  StopIcon,
  XIcon,
} from "@primer/octicons-react";
import {
  Banner,
  Button,
  Details,
  FormControl,
  Heading,
  Label,
  Link,
  Select,
  Spinner,
  Stack,
  Text,
  TextInput,
  Timeline,
  useDetails,
} from "@primer/react";
import { useEffect, useId, useMemo, useState } from "react";
import { type CatalogItem, kindText, toSaveTarget } from "../lib/catalog";
import { REPLAY_LABEL, classifyWarning, replayRunner } from "../lib/demo-replay";
import { type DiscoveryRunState, createDiscoveryRun } from "../lib/discovery-run";
import type { CandidateSnapshot, SourceSnapshot } from "../lib/exploration-store";
import { useAppState } from "../state/app-state";
import { formatDateTime } from "./meta";

export interface ReadablePage {
  url: string;
  title: string;
  itemName: string;
}

const phaseText: Record<
  DiscoveryRunState["phase"],
  [string, "accent" | "success" | "attention" | "danger" | "secondary"]
> = {
  idle: ["未开始", "secondary"],
  running: ["进行中", "accent"],
  complete: ["已完成", "success"],
  cancelled: ["已中止", "attention"],
  limit_reached: ["达到上限", "attention"],
  failed: ["失败", "danger"],
};

const warningKindText = {
  no_results: "无结果",
  search_failed: "搜索失败",
  read_failed: "正文读取失败",
  limit: "达到上限",
} as const;

interface PastRun {
  query: string;
  phase: DiscoveryRunState["phase"];
  sources: number;
  failures: number;
  at: string;
  replay: boolean;
}

function toSnapshot(source: DiscoverySource, query: string): SourceSnapshot {
  return {
    url: source.url,
    title: source.title,
    content: source.content,
    collectedAt: source.collectedAt,
    kind: "live",
    ...(source.publishedAt ? { publishedAt: source.publishedAt } : {}),
    query,
    relevanceEvidence: source.relevanceEvidence,
    unknowns: source.unknowns,
  };
}

function RunTimeline({
  state,
  history,
  replay,
}: {
  state: DiscoveryRunState;
  history: PastRun[];
  replay: boolean;
}) {
  const result = state.result?.query === state.query ? state.result : null;
  const reading = /^https?:\/\//i.test(state.query);
  const [phase, variant] = phaseText[state.phase];
  return (
    <Timeline aria-label="本次探索的查找记录">
      {history.map((run, index) => (
        <Timeline.Item condensed key={`${run.at}-${index}`}>
          <Timeline.Badge>
            {run.phase === "complete" ? (
              <CheckIcon />
            ) : run.phase === "failed" ? (
              <XIcon />
            ) : (
              <StopIcon />
            )}
          </Timeline.Badge>
          <Timeline.Body>
            {formatDateTime(run.at)} · “{run.query}” · {phaseText[run.phase][0]} · 取得{" "}
            {run.sources} 条正文
            {run.failures ? ` · ${run.failures} 处失败` : ""}
            {run.replay ? " · 演示回放" : ""}
          </Timeline.Body>
        </Timeline.Item>
      ))}
      {state.phase !== "idle" && (
        <>
          <Timeline.Item condensed>
            <Timeline.Badge>{reading ? <GlobeIcon /> : <SearchIcon />}</Timeline.Badge>
            <Timeline.Body>
              {reading ? "直读官方页" : "检索公开来源"}：“{state.query}”
              {result
                ? ` · 已完成 ${result.completedReads}／${result.startedReads} 次读取`
                : ""}
            </Timeline.Body>
          </Timeline.Item>
          {result?.sources.map((source) => (
            <Timeline.Item condensed key={source.url}>
              <Timeline.Badge>
                <CheckIcon />
              </Timeline.Badge>
              <Timeline.Body>
                已读取：{source.title}（{source.content.length} 字）
              </Timeline.Body>
            </Timeline.Item>
          ))}
          {result?.warnings.map((warning, index) => (
            <Timeline.Item condensed key={`${warning.code}-${index}`}>
              <Timeline.Badge>
                {classifyWarning(warning) === "limit" ? <StopIcon /> : <AlertIcon />}
              </Timeline.Badge>
              <Timeline.Body>
                {warningKindText[classifyWarning(warning)]}：{warning.message}
                {warning.url ? `（${warning.url}）` : ""}
              </Timeline.Body>
            </Timeline.Item>
          ))}
          <Timeline.Item condensed>
            <Timeline.Badge>
              {state.phase === "running" ? (
                <Spinner size="small" />
              ) : state.phase === "complete" ? (
                <CheckIcon />
              ) : state.phase === "failed" ? (
                <CircleSlashIcon />
              ) : (
                <StopIcon />
              )}
            </Timeline.Badge>
            <Timeline.Body>
              <Stack direction="horizontal" gap="condensed" align="center" wrap="wrap">
                <Label variant={variant}>{phase}</Label>
                {replay && <Label variant="done">{REPLAY_LABEL}</Label>}
                <Text>
                  {state.phase === "running" &&
                    "正在等待服务返回，收到的正文会逐条出现。"}
                  {state.phase === "complete" &&
                    `本轮结束，取得 ${result?.sources.length ?? 0} 条正文。`}
                  {state.phase === "cancelled" &&
                    `你中止了本轮查找；已收到的 ${result?.sources.length ?? 0} 条正文保留，之后迟到的结果不会写入。已发出的公开查询不能撤回。`}
                  {state.phase === "limit_reached" &&
                    `本轮在${result?.stopReason === "source_limit" ? "来源数量" : "时间"}上限处停止，已取得 ${result?.sources.length ?? 0} 条正文，未读部分不算完成。`}
                  {state.phase === "failed" &&
                    `${state.error} 已有资料和已保存的记录仍可使用，可以调整后主动重试。`}
                </Text>
              </Stack>
            </Timeline.Body>
          </Timeline.Item>
        </>
      )}
    </Timeline>
  );
}

function ReadSource({
  source,
  query,
  replay,
  target,
  linkOptions,
}: {
  source: DiscoverySource;
  query: string;
  replay: boolean;
  target?: CatalogItem;
  linkOptions: CatalogItem[];
}) {
  const { topic, mutate, setMessage } = useAppState();
  const { getDetailsProps, open } = useDetails({ closeOnOutsideClick: false });
  const [choice, setChoice] = useState(target?.id ?? "");
  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [summary, setSummary] = useState("");
  const [saved, setSaved] = useState(false);
  const selectId = useId();
  const snapshot = toSnapshot(source, query);
  const isNew = choice === "new-advisor" || choice === "new-internship";
  const ready = isNew ? Boolean(name.trim() && org.trim()) : Boolean(choice);

  function save() {
    if (!topic) {
      setMessage({
        tone: "info",
        text: "先保存为探索主题，再把读到的正文保留为依据。",
      });
      return;
    }
    const item = target ?? linkOptions.find((option) => option.id === choice);
    let ok = false;
    if (item?.kind === "entry") {
      const entry = toSaveTarget(item);
      if (entry.kind === "opportunity") {
        ok = mutate((store) =>
          store.saveOpportunityEvidence(topic.id, entry.snapshot, [snapshot]),
        );
      }
    } else {
      const candidate: CandidateSnapshot | undefined = item?.candidate
        ? { ...item.candidate, sources: [...item.candidate.sources, snapshot] }
        : isNew
          ? {
              candidateId: `external:${org.trim()}:${name.trim()}`,
              name: name.trim(),
              institution: org.trim(),
              research: summary.trim(),
              type: choice === "new-internship" ? "internship" : "advisor",
              sources: [snapshot],
            }
          : undefined;
      if (candidate) ok = mutate((store) => store.saveCandidate(topic.id, candidate));
    }
    if (ok) {
      setSaved(true);
      setMessage({
        tone: "success",
        text: `已把这条正文保存到“${topic.name}”，作为${item?.name ?? name.trim()}的依据；重复保存不会新增重复记录。`,
      });
    }
  }

  return (
    <Stack as="article" gap="condensed" aria-label={source.title}>
      <Stack direction="horizontal" gap="condensed" align="center" wrap="wrap">
        <Link href={source.url} target="_blank" rel="noreferrer">
          {source.title} <LinkExternalIcon />
        </Link>
        <Label variant={replay ? "done" : "accent"}>
          {replay ? "演示回放" : "本次取得"}
        </Label>
        <Text size="small">取得于 {formatDateTime(source.collectedAt)}</Text>
      </Stack>
      {source.relevanceEvidence.length > 0 && (
        <Text as="p" whiteSpace="pre-wrap">
          <Text weight="semibold">与“{query}”相关的段落：</Text>
          {source.relevanceEvidence.join("\n")}
        </Text>
      )}
      <Details {...getDetailsProps()}>
        <Details.Summary>
          {open ? "收起正文" : `查看读到的正文（${source.content.length} 字）`}
        </Details.Summary>
        <Text as="p" whiteSpace="pre-wrap">
          {source.content}
        </Text>
      </Details>
      {source.unknowns.map((unknown) => (
        <Text key={unknown} size="small">
          未确认：{unknown}
        </Text>
      ))}
      {replay ? (
        <Text size="small">演示回放的内容不能保存为依据。</Text>
      ) : saved ? (
        <Text size="small">已保存到当前探索。</Text>
      ) : (
        <Stack gap="condensed">
          {!target && (
            <FormControl>
              <FormControl.Label htmlFor={selectId}>
                这条正文是关于谁或哪一项的？
              </FormControl.Label>
              <Select
                id={selectId}
                value={choice}
                onChange={(event) => setChoice(event.target.value)}
              >
                <Select.Option value="">由你判断后选择</Select.Option>
                {linkOptions.map((option) => (
                  <Select.Option key={option.id} value={option.id}>
                    {option.name}（{kindText[option.kind]}）
                  </Select.Option>
                ))}
                <Select.Option value="new-advisor">新的导师（自行填写）</Select.Option>
                <Select.Option value="new-internship">
                  新的实习岗位（自行填写）
                </Select.Option>
              </Select>
              <FormControl.Caption>
                页面提到某人或某项目，不等于就是它；同名也不会自动合并。
              </FormControl.Caption>
            </FormControl>
          )}
          {isNew && (
            <Stack
              direction={{ narrow: "vertical", regular: "horizontal" }}
              gap="condensed"
            >
              <FormControl required>
                <FormControl.Label>名称</FormControl.Label>
                <TextInput
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={100}
                />
              </FormControl>
              <FormControl required>
                <FormControl.Label>机构</FormControl.Label>
                <TextInput
                  value={org}
                  onChange={(event) => setOrg(event.target.value)}
                  maxLength={200}
                />
              </FormControl>
              <FormControl>
                <FormControl.Label>一句说明（可不填）</FormControl.Label>
                <TextInput
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                  maxLength={500}
                />
                <FormControl.Caption>
                  按读到的内容填写，会标为“未自动核实”。
                </FormControl.Caption>
              </FormControl>
            </Stack>
          )}
          <Stack direction="horizontal" gap="condensed" align="center">
            <Button disabled={!ready} onClick={save}>
              {target ? `确认与${target.name}相关并保存` : "保存为依据"}
            </Button>
            {!topic && <Text size="small">保存需要先保存为探索主题。</Text>}
          </Stack>
        </Stack>
      )}
    </Stack>
  );
}

/**
 * Live discovery against the public API: a keyword search or a direct official-page
 * read. Only the query text is sent; private notes are never attached.
 */
export function LiveDiscovery({
  initialQuery,
  pages = [],
  target,
  linkOptions = [],
  headingLevel = "h2",
}: {
  initialQuery: string;
  pages?: ReadablePage[];
  target?: CatalogItem;
  linkOptions?: CatalogItem[];
  headingLevel?: "h2" | "h3";
}) {
  const { demo } = useAppState();
  const replay = demo.replay;
  const headingId = useId();
  const [query, setQuery] = useState(initialQuery);
  const [page, setPage] = useState(pages[0]?.url ?? "");
  const [runState, setRunState] = useState<DiscoveryRunState>({
    query: "",
    phase: "idle",
    result: null,
    error: "",
  });
  const [history, setHistory] = useState<PastRun[]>([]);
  const run = useMemo(
    () => createDiscoveryRun(setRunState, replay ? { run: replayRunner(replay) } : {}),
    [replay],
  );
  useEffect(() => () => run.dispose(), [run]);
  const result: DiscoveryResponse | null =
    runState.result?.query === runState.query ? runState.result : null;

  function start(input: string) {
    if (!input.trim()) return;
    if (runState.phase !== "idle") {
      const previous =
        runState.result?.query === runState.query ? runState.result : null;
      setHistory((runs) => [
        ...runs,
        {
          query: runState.query,
          phase: runState.phase,
          sources: previous?.sources.length ?? 0,
          failures:
            previous?.warnings.filter((warning) => classifyWarning(warning) !== "limit")
              .length ?? 0,
          at: new Date().toISOString(),
          replay: Boolean(replay),
        },
      ]);
    }
    void run.start(input);
  }

  return (
    <Stack as="section" gap="normal" aria-labelledby={headingId}>
      <Heading as={headingLevel} variant="small" id={headingId}>
        {target ? `联网补查：${target.name}` : "联网查找"}
      </Heading>
      {replay && (
        <Banner
          variant="info"
          layout="compact"
          title={`${REPLAY_LABEL}已开启`}
          description="查找使用预先编写的回放，不访问网络，结果不能保存。可在演示路线中关闭。"
        />
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          start(query);
        }}
      >
        <Stack gap="condensed">
          <FormControl>
            <FormControl.Label>关键词，或一个公开网页地址</FormControl.Label>
            <TextInput
              block
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <FormControl.Caption>
              只发送这里的文字：关键词交给 DuckDuckGo
              检索限定的学术与招聘站点，网址直接读取原站。私人记录不会附带。
            </FormControl.Caption>
          </FormControl>
          <Stack direction="horizontal" gap="condensed" wrap="wrap" align="center">
            <Button
              type="submit"
              variant="primary"
              leadingVisual={SearchIcon}
              disabled={!query.trim()}
            >
              {runState.phase === "running" ? "按当前内容重新查找" : "查找"}
            </Button>
            {runState.phase === "running" && (
              <Button leadingVisual={StopIcon} onClick={() => run.stop()}>
                中止
              </Button>
            )}
          </Stack>
        </Stack>
      </form>
      {pages.length > 0 && (
        <Stack
          direction={{ narrow: "vertical", regular: "horizontal" }}
          gap="condensed"
          align="end"
        >
          <FormControl>
            <FormControl.Label>或直读一个已知的官方页</FormControl.Label>
            <Select value={page} onChange={(event) => setPage(event.target.value)}>
              {pages.map((option) => (
                <Select.Option key={option.url} value={option.url}>
                  {option.itemName}：{option.title}
                </Select.Option>
              ))}
            </Select>
          </FormControl>
          <Button
            leadingVisual={GlobeIcon}
            disabled={!page}
            onClick={() => start(page)}
          >
            读取当前正文
          </Button>
        </Stack>
      )}
      <Details>
        <Details.Summary>本轮上限与停止说明</Details.Summary>
        <Text as="p" size="small">
          每轮服务端最多 30 秒、5 条正文、6 次读取（含检索），每次读取最多 14 秒、1
          MB；连同传输最多等待 35 秒。 外部请求最多 48
          次。停止后保留已收到的正文，不自动重试；不调用收费模型或搜索 API。 只读取静态
          HTML；需要登录、动态加载或 PDF 的页面会明确失败，可以打开原站查看。
        </Text>
      </Details>
      <div aria-live="polite">
        {(runState.phase !== "idle" || history.length > 0) && (
          <RunTimeline state={runState} history={history} replay={Boolean(replay)} />
        )}
      </div>
      {result && result.sources.length > 0 && (
        <Stack gap="spacious">
          <Heading as={headingLevel === "h2" ? "h3" : "h4"} variant="small">
            本次取得（{result.sources.length}）
          </Heading>
          {result.sources.map((source) => (
            <ReadSource
              key={`${result.query}-${source.url}`}
              source={source}
              query={result.query}
              replay={Boolean(replay)}
              target={target}
              linkOptions={linkOptions}
            />
          ))}
        </Stack>
      )}
      {result && result.sources.length === 0 && runState.phase !== "running" && (
        <Text as="p">
          这一轮没有取得可展示的正文。这不代表没有相关机会；可以换关键词、直读官方页，或继续使用已有资料。
        </Text>
      )}
    </Stack>
  );
}
