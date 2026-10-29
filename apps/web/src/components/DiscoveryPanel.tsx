import { SearchIcon } from "@primer/octicons-react";
import {
  Banner,
  Button,
  Details,
  FormControl,
  Heading,
  Select,
  Stack,
  Text,
  TextInput,
} from "@primer/react";
import { useEffect, useId, useState } from "react";
import { type Advisor, allOpportunities } from "../lib/advisors";
import { type DiscoveryRunState, createDiscoveryRun } from "../lib/discovery-run";
import type { CandidateSnapshot, SourceSnapshot } from "../lib/exploration-store";
import { type ScenarioDefinition, getScenario } from "../lib/opportunities";
import { SourceView } from "./SourceView";

interface Props {
  query: string;
  onQueryChange: (value: string) => void;
  onSave: (candidate: CandidateSnapshot) => void;
  canSave: boolean;
  targetCandidate?: Advisor;
  saveTargetName?: string;
  scenario?: ScenarioDefinition;
  candidateList?: Advisor[];
}

export function DiscoveryPanel({
  query,
  onQueryChange,
  onSave,
  canSave,
  targetCandidate,
  saveTargetName,
  scenario,
  candidateList = allOpportunities,
}: Props) {
  const activeScenario = scenario ?? getScenario("advisor");
  const headingId = useId();
  const [runState, setRunState] = useState<DiscoveryRunState>({
    query: "",
    phase: "idle",
    result: null,
    error: "",
  });
  const [run] = useState(() => createDiscoveryRun(setRunState));
  useEffect(() => () => run.dispose(), [run]);
  const { result, error } = runState;
  const runningQuery = runState.phase === "running" ? runState.query : "";
  const currentResult = result?.query === runState.query ? result : null;
  const [candidateId, setCandidateId] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [institution, setInstitution] = useState("");
  const [research, setResearch] = useState("");
  const readingUrl = /^https?:\/\//i.test(query.trim());
  const knownPages = targetCandidate?.sources.filter(
    (source) => source.collection?.method === "web_read" || source.kind === "live",
  );
  const hasCandidate = targetCandidate
    ? true
    : candidateId === "new"
      ? Boolean(candidateName.trim() && institution.trim())
      : Boolean(candidateId);

  function search() {
    void run.start(query);
  }

  return (
    <Stack gap="normal" as="section" aria-labelledby={headingId}>
      <Heading as="h2" variant="medium" id={headingId}>
        补查外部资料
      </Heading>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        <Stack gap="condensed">
          <FormControl>
            <FormControl.Label>
              {targetCandidate
                ? `围绕${targetCandidate.name}补查`
                : activeScenario.searchPlaceholder
                  ? `想了解什么${activeScenario.shortLabel}？`
                  : "想了解什么研究或哪位导师？"}
            </FormControl.Label>
            <TextInput
              block
              autoFocus={Boolean(targetCandidate)}
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={
                targetCandidate
                  ? "输入公开关键词、学术或已支持的招聘网页链接"
                  : activeScenario.searchPlaceholder
              }
            />
            <FormControl.Caption>
              关键词会发送到DuckDuckGo；公开链接直接从原站读取。私人笔记不会自动附带，请只输入公开信息。
            </FormControl.Caption>
          </FormControl>
          {knownPages && knownPages.length > 0 && (
            <FormControl>
              <FormControl.Label>也可以选择已收录的官网页面</FormControl.Label>
              <Select
                value={
                  knownPages.some(
                    (source) => (source.lookupUrl ?? source.url) === query,
                  )
                    ? query
                    : ""
                }
                onChange={(event) => {
                  if (event.target.value) onQueryChange(event.target.value);
                }}
              >
                <Select.Option value="">选择一个页面，再点击读取</Select.Option>
                {knownPages.map((source) => (
                  <Select.Option
                    key={`${source.url}:${source.collectedAt}`}
                    value={source.lookupUrl ?? source.url}
                  >
                    {source.title}
                  </Select.Option>
                ))}
              </Select>
            </FormControl>
          )}
          <Text as="p" size="small">
            支持学术网站及微软研究招聘、上海AI实验室招聘、字节校园职位页和OpenCompass仓库的公开HTML。
            需要登录、动态加载或PDF的内容可能无法读取，请转原站查看。
          </Text>
          <Details>
            <Details.Summary>本轮查找的上限与停止说明</Details.Summary>
            <Stack gap="condensed" paddingBlock="normal">
              <Text as="p" size="small">
                本轮服务端最多30秒、5个正文、6次读取（含检索）；每次读取最多14秒、1
                MB。连同传输等待最多35秒。停止后保留已收到的正文，不自动重试；不调用收费模型或搜索API。
              </Text>
              <Text as="p" size="small">
                外部HTTP请求最多48次，包含重定向与地址解析备用请求。
              </Text>
            </Stack>
          </Details>
          <Stack direction="horizontal" align="center" wrap="wrap">
            <Button type="submit" leadingVisual={SearchIcon} disabled={!query.trim()}>
              {runningQuery
                ? "按当前内容重新查找"
                : readingUrl
                  ? "读取原站正文"
                  : "查找外部资料"}
            </Button>
            {runningQuery && <Button onClick={() => run.stop()}>中止本轮查找</Button>}
            <Text size="small">已有资料也可以直接阅读。</Text>
          </Stack>
        </Stack>
      </form>
      <div aria-live="polite">
        {runningQuery && (
          <Banner
            variant="info"
            layout="compact"
            title={`${/^https?:\/\//i.test(runningQuery) ? "正在读取公开页面" : "正在检索并读取公开来源"}：${runningQuery}`}
          />
        )}
        {(runState.phase === "cancelled" || runState.phase === "limit_reached") && (
          <Banner
            variant="warning"
            layout="compact"
            title={`${runState.phase === "cancelled" ? "已中止本轮查找" : currentResult?.stopReason === "source_limit" ? "已达到本轮来源上限" : "已达到本轮时间上限"}：“${runState.query}”。已收到${currentResult?.sources.length ?? 0}条正文，仍可阅读或保存；已发出的公开查询不能撤回。`}
          />
        )}
        {error && (
          <Banner
            variant="critical"
            layout="compact"
            title={`${error} 已有资料和已保存主题仍可查看。`}
          />
        )}
      </div>
      {result && (
        <Stack gap="normal">
          <Heading as="h2" variant="medium">
            本次外部资料
          </Heading>
          <Text as="p">
            这组结果对应“{result.query}”。{result.scope}
            已完成{result.completedReads}／{result.startedReads}次读取，取得
            {result.sources.length}条正文。
            {!result.finished && "这组结果尚未完整结束。"}
          </Text>
          {query.trim() !== result.query && (
            <Text as="p">查找内容已修改；下面仍是上次条件的结果，可重新查找。</Text>
          )}
          {result.sources.length === 0 && !runningQuery && (
            <Text as="p">
              没有取得可展示的相关正文。可以换关键词，或先查看已有资料；这不代表没有相关候选。
            </Text>
          )}
          {result.warnings.map((warning, index) => (
            <Banner
              key={`${warning.code}-${index}`}
              variant="warning"
              layout="compact"
              title={warning.message}
            />
          ))}
          {result.sources.length > 0 && targetCandidate && (
            <Text as="p">
              请核对来源是否与{targetCandidate.name}（{targetCandidate.institution}）
              有关，再确认保存。
              {saveTargetName
                ? `将保存到“${saveTargetName}”。`
                : "如需保存，可先选择或创建主题。"}
            </Text>
          )}
          {result.sources.length > 0 && !targetCandidate && (
            <FormControl>
              <FormControl.Label>
                需要保存时，将依据关联到哪位{activeScenario.candidateEntityName}？
              </FormControl.Label>
              <Select
                value={candidateId}
                onChange={(event) => setCandidateId(event.target.value)}
              >
                <Select.Option value="">
                  选择{activeScenario.candidateEntityName}
                </Select.Option>
                <Select.Option value="new">
                  新{activeScenario.candidateEntityName}（自行填写）
                </Select.Option>
                {candidateList.map((item) => (
                  <Select.Option key={item.candidateId} value={item.candidateId}>
                    {item.name}（{item.institution}）
                  </Select.Option>
                ))}
              </Select>
              <FormControl.Caption>
                由你判断关系；公开目录或网页提及不自动认作确定选项。
              </FormControl.Caption>
            </FormControl>
          )}
          {result.sources.length > 0 && !targetCandidate && candidateId === "new" && (
            <Stack gap="condensed">
              <FormControl required>
                <FormControl.Label>{activeScenario.nameLabel}</FormControl.Label>
                <TextInput
                  block
                  value={candidateName}
                  onChange={(event) => setCandidateName(event.target.value)}
                  maxLength={100}
                />
              </FormControl>
              <FormControl required>
                <FormControl.Label>{activeScenario.institutionLabel}</FormControl.Label>
                <TextInput
                  block
                  value={institution}
                  onChange={(event) => setInstitution(event.target.value)}
                  maxLength={200}
                />
              </FormControl>
              <FormControl>
                <FormControl.Label>
                  {activeScenario.researchLabel}（可不填）
                </FormControl.Label>
                <TextInput
                  block
                  value={research}
                  onChange={(event) => setResearch(event.target.value)}
                  maxLength={500}
                />
                <FormControl.Caption>
                  按已读依据填写；公开信息未提及的内容保留为未知。
                </FormControl.Caption>
              </FormControl>
            </Stack>
          )}
          {result.sources.length > 0 && !canSave && !targetCandidate && (
            <Text as="p">
              想保存这些依据时，先在页面顶部选择或创建主题；现在可以直接阅读。
            </Text>
          )}
          {result.sources.length > 0 &&
            canSave &&
            !targetCandidate &&
            !hasCandidate && (
              <Text as="p">
                保存前，先在上方选择这条依据关联的
                {activeScenario.candidateEntityName}
                （或自行填写新{activeScenario.candidateEntityName}）。
              </Text>
            )}
          {result.sources.map((source) => {
            const snapshot: SourceSnapshot = {
              url: source.url,
              title: source.title,
              content: source.content,
              collectedAt: source.collectedAt,
              kind: "live",
              publishedAt: source.publishedAt,
              query: result.query,
              relevanceEvidence: source.relevanceEvidence,
              unknowns: source.unknowns,
            };
            return (
              <Stack key={source.url} gap="condensed" as="section">
                <SourceView source={snapshot} />
                <Button
                  disabled={!canSave || !hasCandidate}
                  onClick={() => {
                    const candidate =
                      targetCandidate ??
                      (candidateId === "new"
                        ? {
                            candidateId: `external:${institution.trim()}:${candidateName.trim()}`,
                            name: candidateName.trim(),
                            institution: institution.trim(),
                            research: research.trim(),
                            type: activeScenario.type,
                            sources: [],
                          }
                        : candidateList.find(
                            (item) => item.candidateId === candidateId,
                          ));
                    if (candidate) onSave({ ...candidate, sources: [snapshot] });
                  }}
                >
                  {targetCandidate
                    ? `确认与${targetCandidate.name}相关并保存${saveTargetName ? `到“${saveTargetName}”` : ""}`
                    : "保存这条依据到当前主题"}
                </Button>
              </Stack>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
