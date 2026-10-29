import {
  BookmarkIcon,
  HomeIcon,
  LinkIcon,
  MoonIcon,
  PeopleIcon,
  PlusIcon,
  SunIcon,
  TableIcon,
} from "@primer/octicons-react";
import {
  ActionList,
  ActionMenu,
  Banner,
  Button,
  CounterLabel,
  Details,
  FormControl,
  Heading,
  Label,
  Link,
  PageLayout,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
  UnderlineNav,
} from "@primer/react";
import { Hidden } from "@primer/react/experimental";
import { useEffect, useState } from "react";
import brandMark from "../assets/campus-lumen-mark.svg";
import {
  AdvisorComparison,
  type ComparisonNotes,
} from "../components/AdvisorComparison";
import { AdvisorDetail } from "../components/AdvisorDetail";
import { DiscoveryPanel } from "../components/DiscoveryPanel";
import { ExploreHome } from "../components/ExploreHome";
import { OpportunityBrowser } from "../components/OpportunityBrowser";
import { SourceView } from "../components/SourceView";
import { TopicEditor } from "../components/TopicEditor";
import { TopicSessionItem } from "../components/TopicSessionItem";
import {
  type AnyComparisonFocus,
  type AnyComparisonPerspective,
  type ComparisonPerspective,
  type ResearchFocus,
  comparisonSupportedCandidateIds,
  internshipComparisonSupportedCandidateIds,
} from "../lib/advisor-comparison";
import {
  type Advisor,
  advisors,
  allBatches,
  allOpportunities,
  collectedBatches,
  internships,
  sourceDate,
  sourceSummary,
} from "../lib/advisors";
import { getFollowupQuery, getSupplementalSources } from "../lib/comparison-followup";
import {
  type CandidateSnapshot,
  type ExplorationTopic,
  type TopicOpportunity,
  createExplorationStore,
} from "../lib/exploration-store";
import {
  type Opportunity,
  type OpportunityType,
  getScenario,
  opportunityTypeText,
} from "../lib/opportunities";

// Additive resume pointer for the session-style topic organization: the last
// opened exploration topic is remembered separately from the topic records, so
// reopening the app resumes that session. The v1 explorations key and data
// shape are untouched; a missing or unreadable pointer falls back silently.
export const LAST_TOPIC_STORAGE_KEY = "campus-agora:last-topic:v1";

// null = no pointer stored (legacy install) or unreadable; "" = the user
// explicitly chose "暂不保存"; any other value is a topic id to resume.
function readLastTopicId(): string | null {
  try {
    return window.localStorage.getItem(LAST_TOPIC_STORAGE_KEY);
  } catch {
    return null;
  }
}

// An explicit "暂不保存" choice stays topic-less across reloads; only a
// missing, unreadable or stale pointer falls back to the first topic.
export function resolveInitialTopicId(
  topics: ExplorationTopic[],
  lastId: string | null,
): string {
  if (lastId === "") return "";
  if (lastId !== null && topics.some((topic) => topic.id === lastId)) {
    return lastId;
  }
  return topics[0]?.id ?? "";
}

function loadExplorations() {
  try {
    const store = createExplorationStore(window.localStorage);
    const topics = store.listTopics();
    const topicId = resolveInitialTopicId(topics, readLastTopicId());
    return { store, topics, topicId, error: "" };
  } catch (error) {
    return {
      store: null,
      topics: [] as ExplorationTopic[],
      topicId: "",
      error: `本地保存不可用：${error instanceof Error ? error.message : "无法读取浏览器资料"}。仍可以浏览和查找。`,
    };
  }
}

/** Most recently active explorations first, like a session list. */
export function byRecency(topics: ExplorationTopic[]): ExplorationTopic[] {
  return [...topics].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export function App({
  colorMode,
  onToggleColorMode,
}: {
  colorMode: "day" | "night";
  onToggleColorMode: () => void;
}) {
  const [initial] = useState(loadExplorations);
  const [topics, setTopics] = useState(initial.topics);
  const [topicId, setTopicIdState] = useState(initial.topicId);
  const [view, setView] = useState<
    "home" | "explore" | "opportunities" | "saved" | "compare" | "followup"
  >("home");
  const [opportunityType, setOpportunityType] = useState<OpportunityType | "">("");
  const [followupCandidate, setFollowupCandidate] = useState<Advisor>();
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [perspective, setPerspective] = useState<AnyComparisonPerspective>("research");
  const [focus, setFocus] = useState<AnyComparisonFocus>("open");
  const [comparisonDrafts, setComparisonDrafts] = useState<
    Record<string, ComparisonNotes>
  >({});
  const [query, setQuery] = useState("AI systems compiler Tianqi Chen");
  const [selectedAdvisor, setSelectedAdvisor] = useState("tianqi-chen");
  const [topicName, setTopicName] = useState("");
  const [creatingTopic, setCreatingTopic] = useState(false);
  const [error, setError] = useState(initial.error);
  const [message, setMessage] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [candidateScenario, setCandidateScenario] = useState<
    "all" | "advisor" | "internship"
  >("all");

  function navigate(next: typeof view) {
    setView(next);
    setMessage("");
    setDeleteConfirm(false);
  }

  // Switching the active exploration session: state plus the resume pointer.
  function selectTopic(id: string) {
    setTopicIdState(id);
    try {
      window.localStorage.setItem(LAST_TOPIC_STORAGE_KEY, id);
    } catch {
      // Resume is best-effort; switching sessions still works in-page.
    }
  }

  // Switching views starts each page from the top, like following a link.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to top whenever the view changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);
  const activeTopic = topics.find((topic) => topic.id === topicId);
  const activeScenario = getScenario(
    candidateScenario === "all" ? "advisor" : candidateScenario,
  );
  const visibleCandidates =
    candidateScenario === "advisor"
      ? advisors
      : candidateScenario === "internship"
        ? internships
        : allOpportunities;
  const advisor = visibleCandidates.some((item) => item.candidateId === selectedAdvisor)
    ? visibleCandidates.find((item) => item.candidateId === selectedAdvisor)
    : visibleCandidates[0];

  function changeScenario(next: "all" | "advisor" | "internship") {
    setCandidateScenario(next);
    const nextList =
      next === "advisor"
        ? advisors
        : next === "internship"
          ? internships
          : allOpportunities;
    if (!nextList.some((item) => item.candidateId === selectedAdvisor)) {
      setSelectedAdvisor(nextList[0]?.candidateId ?? "");
    }
  }
  const comparisonCandidates = comparisonIds.flatMap((id) => {
    const candidate = allOpportunities.find((item) => item.candidateId === id);
    return candidate ? [candidate] : [];
  });
  const comparisonNotes = Object.fromEntries(
    comparisonCandidates.map((candidate) => {
      const saved = activeTopic?.candidates.find(
        (item) => item.candidate.candidateId === candidate.candidateId,
      );
      return [
        candidate.candidateId,
        comparisonDrafts[`${topicId}:${candidate.candidateId}`] ?? {
          reason: saved?.reason ?? "",
          questions: saved?.questions.join("\n") ?? "",
        },
      ];
    }),
  );
  const latestCollection = allBatches.reduce((latest, batch) =>
    Date.parse(batch.completedAt) > Date.parse(latest.completedAt) ? batch : latest,
  );

  function mutate(action: () => void) {
    setError("");
    setMessage("");
    try {
      if (!initial.store)
        throw new Error("浏览器保存不可用，无法保存；当前浏览结果仍保留。");
      action();
      setTopics(initial.store.listTopics());
    } catch (failure) {
      setMessage("");
      setError(failure instanceof Error ? failure.message : "未能保存，请重试。");
    }
  }

  function clearComparisonDrafts(id: string, candidateId?: string) {
    setComparisonDrafts((drafts) => {
      const updated = { ...drafts };
      if (candidateId !== undefined) {
        delete updated[`${id}:${candidateId}`];
      } else {
        for (const key of Object.keys(updated)) {
          if (key.startsWith(`${id}:`)) delete updated[key];
        }
      }
      return updated;
    });
  }

  function save(candidate: CandidateSnapshot, reason = "", questions: string[] = []) {
    mutate(() => {
      if (!activeTopic)
        throw new Error("先选择或创建一个探索主题；浏览不要求创建主题。");
      initial.store?.saveCandidate(activeTopic.id, candidate, { reason, questions });
      clearComparisonDrafts(activeTopic.id, candidate.candidateId);
      setMessage(`已保存到“${activeTopic.name}”。已有的私人理由和疑问会保留。`);
    });
  }

  function saveComparison(candidate: Advisor, notes: ComparisonNotes) {
    mutate(() => {
      if (!activeTopic) throw new Error("先选择或创建一个主题，再保存比较记录。");
      const questions = notes.questions
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      initial.store?.saveCandidate(activeTopic.id, candidate, {
        reason: notes.reason,
        questions,
      });
      if (
        activeTopic.candidates.some(
          (record) => record.candidate.candidateId === candidate.candidateId,
        )
      ) {
        initial.store?.updateCandidate(activeTopic.id, candidate.candidateId, {
          reason: notes.reason,
          questions,
        });
      }
      clearComparisonDrafts(activeTopic.id, candidate.candidateId);
      setMessage(`已保存${candidate.name}的比较记录到“${activeTopic.name}”。`);
    });
  }

  function saveOpportunity(opportunity: Opportunity) {
    mutate(() => {
      if (!activeTopic)
        throw new Error("先选择或创建一个探索主题；浏览不要求创建主题。");
      initial.store?.saveOpportunity(activeTopic.id, {
        opportunityId: opportunity.id,
        name: opportunity.name,
        types: opportunity.types.map((type) => opportunityTypeText[type]),
        period: opportunity.period,
        summary: opportunity.summary,
        entryUrl: opportunity.entry.url,
        checkedAt: opportunity.entry.checkedAt,
      });
      setMessage(
        `已保存${opportunity.name}到“${activeTopic.name}”。已有的私人理由和疑问会保留。`,
      );
    });
  }

  function startFollowup(candidate: Advisor) {
    setFollowupCandidate(candidate);
    setQuery(getFollowupQuery(candidate, perspective));
    setError("");
    setMessage("");
    navigate("followup");
  }

  function saveSupplemental(candidate: CandidateSnapshot) {
    mutate(() => {
      if (!activeTopic) throw new Error("先选择或创建主题，再保存补充依据。");
      initial.store?.saveCandidate(activeTopic.id, candidate);
      // Adding evidence does not save or discard the comparison's private drafts.
      setMessage(
        `已把${candidate.name}的补充依据保存到“${activeTopic.name}”，可返回比较继续查看。`,
      );
    });
  }

  const navSection = view === "followup" ? "compare" : view;
  const navItems: {
    id: "home" | "explore" | "opportunities" | "compare" | "saved";
    label: string;
    icon: typeof PeopleIcon;
    counter?: number;
  }[] = [
    { id: "home", label: "首页", icon: HomeIcon },
    { id: "explore", label: "找导师", icon: PeopleIcon },
    { id: "opportunities", label: "机会与入口", icon: LinkIcon },
    {
      id: "compare",
      label: "比较",
      icon: TableIcon,
      counter: comparisonIds.length || undefined,
    },
    {
      id: "saved",
      label: "我的探索",
      icon: BookmarkIcon,
      counter: topics.length || undefined,
    },
  ];
  const currentItem = navItems.find((item) => item.id === navSection) ?? navItems[0];

  return (
    <PageLayout containerWidth="large" padding="normal" rowGap="normal">
      <PageLayout.Header>
        <Stack gap="normal">
          <Stack
            direction="horizontal"
            align="center"
            justify="space-between"
            gap="normal"
          >
            <Button
              variant="invisible"
              onClick={() => navigate("home")}
              aria-label="Campus Lumen 首页"
            >
              <Stack as="span" direction="horizontal" align="center" gap="condensed">
                <img src={brandMark} width={28} height={28} alt="" />
                <Text size="large" weight="semibold">
                  Campus Lumen
                </Text>
              </Stack>
            </Button>
            <Button
              variant="invisible"
              size="small"
              leadingVisual={colorMode === "day" ? MoonIcon : SunIcon}
              onClick={onToggleColorMode}
              aria-label={`切换到${colorMode === "day" ? "深色" : "浅色"}模式`}
            >
              {colorMode === "day" ? "深色模式" : "浅色模式"}
            </Button>
          </Stack>
          <Hidden when="narrow">
            <UnderlineNav aria-label="主导航" variant="flush">
              {navItems.map((item) => (
                <UnderlineNav.Item
                  key={item.id}
                  icon={item.icon}
                  counter={item.counter}
                  aria-current={navSection === item.id ? "page" : undefined}
                  onSelect={(event) => {
                    event.preventDefault();
                    navigate(item.id);
                  }}
                >
                  {item.label}
                </UnderlineNav.Item>
              ))}
            </UnderlineNav>
          </Hidden>
          <Hidden when={["regular", "wide"]}>
            <ActionMenu>
              <ActionMenu.Button aria-label={`页面导航：${currentItem.label}`}>
                {currentItem.label}{" "}
                {currentItem.counter && (
                  <CounterLabel>{currentItem.counter}</CounterLabel>
                )}
              </ActionMenu.Button>
              <ActionMenu.Overlay>
                <ActionList aria-label="主导航">
                  {navItems.map((item) => (
                    <ActionList.Item
                      key={item.id}
                      active={navSection === item.id}
                      aria-current={navSection === item.id ? "page" : undefined}
                      onSelect={() => navigate(item.id)}
                    >
                      <ActionList.LeadingVisual>
                        <item.icon />
                      </ActionList.LeadingVisual>
                      {item.label}
                      {item.counter && (
                        <ActionList.TrailingVisual>
                          <CounterLabel>{item.counter}</CounterLabel>
                        </ActionList.TrailingVisual>
                      )}
                    </ActionList.Item>
                  ))}
                </ActionList>
              </ActionMenu.Overlay>
            </ActionMenu>
          </Hidden>
        </Stack>
      </PageLayout.Header>
      <PageLayout.Content width="large">
        <Stack gap="normal">
          <div aria-live="polite">
            {message && <Banner variant="success" layout="compact" title={message} />}
            {error && <Banner variant="critical" layout="compact" title={error} />}
          </div>
          {view !== "home" && (
            <Stack
              direction={{ narrow: "vertical", regular: "horizontal" }}
              gap="normal"
              align={{ narrow: "start", regular: "end" }}
            >
              <FormControl>
                <FormControl.Label>当前探索主题</FormControl.Label>
                <Select
                  value={topicId}
                  onChange={(event) => {
                    selectTopic(event.target.value);
                    setDeleteConfirm(false);
                    setMessage("");
                  }}
                >
                  <Select.Option value="">暂不保存</Select.Option>
                  {topics.map((topic) => (
                    <Select.Option key={topic.id} value={topic.id}>
                      {topic.name}
                    </Select.Option>
                  ))}
                </Select>
              </FormControl>
              {activeTopic && initial.store && (
                <TopicEditor
                  key={activeTopic.id}
                  topic={activeTopic}
                  onSave={(patch) => {
                    if (!initial.store)
                      throw new Error("浏览器保存不可用，编辑内容已保留。");
                    initial.store.updateTopic(activeTopic.id, patch);
                    setTopics(initial.store.listTopics());
                    setError("");
                    setMessage(
                      "主题条件已保存。已有候选、依据和私人记录保持原样；查找内容需另行修改并提交。",
                    );
                  }}
                />
              )}
              {creatingTopic ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    mutate(() => {
                      const created = initial.store?.createTopic({
                        name: topicName,
                        question:
                          view === "opportunities" || view === "saved"
                            ? ""
                            : view === "compare"
                              ? `了解${comparisonCandidates.map((item) => item.name).join("、") || "候选"}的${perspective === "research" ? "研究内容" : perspective === "graduate" ? "读研参与途径" : perspective === "role" ? "业务职责" : perspective === "growth" ? "转正与成长途径" : "时间要求或参与途径"}`
                              : query,
                      });
                      if (created) {
                        selectTopic(created.id);
                        setTopicName("");
                        setCreatingTopic(false);
                        setMessage(`已创建“${created.name}”。`);
                      }
                    });
                  }}
                >
                  <Stack
                    direction={{ narrow: "vertical", regular: "horizontal" }}
                    align="end"
                    gap="condensed"
                  >
                    <FormControl>
                      <FormControl.Label>新主题名称</FormControl.Label>
                      <TextInput
                        value={topicName}
                        onChange={(event) => setTopicName(event.target.value)}
                        placeholder="例如 暑期科研、长期导师"
                        maxLength={100}
                        autoFocus
                      />
                    </FormControl>
                    <Stack direction="horizontal" gap="condensed">
                      <Button
                        type="submit"
                        disabled={!topicName.trim() || !initial.store}
                      >
                        创建主题
                      </Button>
                      <Button
                        type="button"
                        variant="invisible"
                        onClick={() => {
                          setCreatingTopic(false);
                          setTopicName("");
                        }}
                      >
                        取消
                      </Button>
                    </Stack>
                  </Stack>
                </form>
              ) : (
                <Button
                  leadingVisual={PlusIcon}
                  disabled={!initial.store}
                  onClick={() => setCreatingTopic(true)}
                >
                  新建主题
                </Button>
              )}
            </Stack>
          )}
          {view === "home" ? (
            <ExploreHome
              advisors={allOpportunities}
              topics={byRecency(topics)
                .slice(0, 3)
                .map((topic) => ({
                  id: topic.id,
                  name: topic.name,
                  question: topic.question,
                  updatedAt: topic.updatedAt,
                  savedCount:
                    topic.candidates.length + (topic.opportunities?.length ?? 0),
                }))}
              onOpenAdvisors={() => {
                // The home entries promise the full candidate list; reset any
                // scenario filter left over from an earlier explore session.
                changeScenario("all");
                navigate("explore");
              }}
              onOpenAdvisor={(candidateId) => {
                const opened = allOpportunities.find(
                  (item) => item.candidateId === candidateId,
                );
                setCandidateScenario(
                  opened?.type === "internship" ? "internship" : "advisor",
                );
                setSelectedAdvisor(candidateId);
                navigate("explore");
              }}
              onOpenType={(type) => {
                setOpportunityType(type);
                navigate("opportunities");
              }}
              onOpenTopic={(id) => {
                selectTopic(id);
                navigate("saved");
              }}
              onOpenTopics={() => navigate("saved")}
              onCarryAdvisorQuery={(value) => setQuery(value)}
            />
          ) : view === "opportunities" ? (
            <OpportunityBrowser
              type={opportunityType}
              onTypeChange={setOpportunityType}
              canSave={Boolean(activeTopic && initial.store)}
              onSave={saveOpportunity}
            />
          ) : view === "explore" ? (
            <>
              <Heading as="h1">找导师</Heading>
              <Stack
                direction="horizontal"
                justify="space-between"
                align="center"
                wrap="wrap"
              >
                <SegmentedControl
                  aria-label="候选场景类型"
                  variant={{ narrow: "dropdown", regular: "default" }}
                >
                  <SegmentedControl.Button
                    selected={candidateScenario === "all"}
                    onClick={() => changeScenario("all")}
                  >
                    {`全部（${allOpportunities.length}）`}
                  </SegmentedControl.Button>
                  <SegmentedControl.Button
                    selected={candidateScenario === "advisor"}
                    onClick={() => changeScenario("advisor")}
                  >
                    {`选导师（${advisors.length}）`}
                  </SegmentedControl.Button>
                  <SegmentedControl.Button
                    selected={candidateScenario === "internship"}
                    onClick={() => changeScenario("internship")}
                  >
                    {`找实习（${internships.length}）`}
                  </SegmentedControl.Button>
                </SegmentedControl>
              </Stack>
              <DiscoveryPanel
                key={`discover:${topicId}:${candidateScenario}`}
                query={query}
                onQueryChange={setQuery}
                canSave={Boolean(activeTopic && initial.store)}
                onSave={save}
                scenario={activeScenario}
                candidateList={visibleCandidates}
              />
              <Stack as="section" gap="normal" aria-labelledby="candidates-heading">
                <Heading as="h2" variant="medium" id="candidates-heading">
                  已有候选资料
                </Heading>
                <Text as="p">
                  共{visibleCandidates.length}项候选，包含研究样稿、岗位与
                  {allBatches.length}
                  次预采集资料；最近整理于{sourceDate(latestCollection.completedAt)}。
                  这里复用已保存的资料，不会实时重查。资料范围和仍待确认的信息见候选详情。
                </Text>
                <Stack direction="horizontal" wrap="wrap" align="center">
                  <Button
                    onClick={() => {
                      setComparisonIds([...comparisonSupportedCandidateIds]);
                      setPerspective("research");
                      setFocus("open");
                      navigate("compare");
                    }}
                  >
                    比较两名导师候选
                  </Button>
                  <Button
                    onClick={() => {
                      setComparisonIds([...internshipComparisonSupportedCandidateIds]);
                      setPerspective("role");
                      setFocus("open");
                      navigate("compare");
                    }}
                  >
                    比较两项实习岗位
                  </Button>
                  {comparisonIds.length > 0 && (
                    <Button onClick={() => navigate("compare")}>
                      查看当前比较（{comparisonIds.length}）
                    </Button>
                  )}
                  {advisor &&
                    (comparisonSupportedCandidateIds.includes(
                      advisor.candidateId as (typeof comparisonSupportedCandidateIds)[number],
                    ) ||
                      internshipComparisonSupportedCandidateIds.includes(
                        advisor.candidateId as (typeof internshipComparisonSupportedCandidateIds)[number],
                      )) && (
                      <Button
                        aria-pressed={comparisonIds.includes(advisor.candidateId)}
                        onClick={() =>
                          setComparisonIds((ids) =>
                            ids.includes(advisor.candidateId)
                              ? ids.filter((id) => id !== advisor.candidateId)
                              : [...ids, advisor.candidateId],
                          )
                        }
                      >
                        {comparisonIds.includes(advisor.candidateId)
                          ? `取消比较${advisor.name}`
                          : `加入比较${advisor.name}`}
                      </Button>
                    )}
                </Stack>
                <PageLayout padding="none" columnGap="normal">
                  <PageLayout.Pane
                    position="start"
                    width="medium"
                    divider="line"
                    sticky
                    aria-label="候选列表"
                  >
                    <ActionList showDividers selectionVariant="single">
                      {visibleCandidates.map((item) => (
                        <ActionList.Item
                          key={item.candidateId}
                          selected={selectedAdvisor === item.candidateId}
                          onSelect={() => setSelectedAdvisor(item.candidateId)}
                        >
                          <Stack direction="horizontal" gap="condensed" align="center">
                            <Text>{item.name}</Text>
                            <Label
                              variant={
                                item.type === "internship" ? "primary" : "accent"
                              }
                            >
                              {item.type === "internship" ? "实习岗位" : "导师"}
                            </Label>
                          </Stack>
                          <ActionList.Description variant="block">
                            {item.institution}。{item.research}（{sourceSummary(item)}）
                          </ActionList.Description>
                        </ActionList.Item>
                      ))}
                    </ActionList>
                  </PageLayout.Pane>
                  <PageLayout.Content as="div" aria-label="候选详情">
                    {advisor && (
                      <AdvisorDetail
                        key={`${advisor.candidateId}-${topicId}`}
                        advisor={advisor}
                        topic={activeTopic}
                        onSave={save}
                      />
                    )}
                  </PageLayout.Content>
                </PageLayout>
              </Stack>
            </>
          ) : view === "followup" && followupCandidate ? (
            <Stack as="section" gap="normal">
              <Stack
                direction="horizontal"
                justify="space-between"
                align="center"
                wrap="wrap"
              >
                <Heading as="h1">补查{followupCandidate.name}</Heading>
                <Button onClick={() => navigate("compare")}>返回比较</Button>
              </Stack>
              <Text as="p">
                按当前比较视角预填了公开检索词，可以修改问题后查找，也可以选择已收录的官网页面读取正文。
              </Text>
              <DiscoveryPanel
                key={`followup:${topicId}:${followupCandidate.candidateId}`}
                query={query}
                onQueryChange={setQuery}
                canSave={Boolean(activeTopic && initial.store)}
                onSave={saveSupplemental}
                targetCandidate={followupCandidate}
                saveTargetName={activeTopic?.name}
              />
            </Stack>
          ) : view === "compare" ? (
            <Stack as="section" gap="normal">
              <AdvisorComparison
                candidates={comparisonCandidates}
                perspective={perspective}
                focus={focus}
                topicName={initial.store ? activeTopic?.name : undefined}
                notes={comparisonNotes}
                supplementalSources={Object.fromEntries(
                  comparisonCandidates.map((candidate) => [
                    candidate.candidateId,
                    getSupplementalSources(candidate, activeTopic),
                  ]),
                )}
                headerActions={
                  <>
                    <Button
                      onClick={() => {
                        setComparisonIds([...comparisonSupportedCandidateIds]);
                        setPerspective("research");
                        setFocus("open");
                      }}
                    >
                      比较导师候选（江祖铭 / 宋卓然）
                    </Button>
                    <Button
                      onClick={() => {
                        setComparisonIds([
                          ...internshipComparisonSupportedCandidateIds,
                        ]);
                        setPerspective("role");
                        setFocus("open");
                      }}
                    >
                      比较实习岗位（上海 AI 实验室 / MSRA）
                    </Button>
                  </>
                }
                onFollowup={startFollowup}
                onPerspectiveChange={setPerspective}
                onFocusChange={setFocus}
                onRemove={(id) =>
                  setComparisonIds((ids) => ids.filter((item) => item !== id))
                }
                onReturn={() => navigate("explore")}
                onNotesChange={(id, notes) =>
                  setComparisonDrafts((drafts) => ({
                    ...drafts,
                    [`${topicId}:${id}`]: notes,
                  }))
                }
                onSave={saveComparison}
              />
            </Stack>
          ) : (
            <Stack as="section" gap="normal">
              <Stack
                direction="horizontal"
                justify="space-between"
                align="center"
                wrap="wrap"
              >
                <Heading as="h1">{activeTopic?.name ?? "我的探索"}</Heading>
                {activeTopic && (
                  <Button
                    size="small"
                    variant="invisible"
                    onClick={() => selectTopic("")}
                  >
                    返回全部探索
                  </Button>
                )}
              </Stack>
              <Text as="p">
                每个探索主题是一次独立的探索：各自保留自己的问题、条件、候选、私人理由与待问项，可以随时离开、改天回来继续。记录保存在此浏览器，不跨设备同步；清除网站数据会移除记录。浏览和保存都不代表决定申请。
              </Text>
              {!activeTopic &&
                (topics.length > 0 ? (
                  <ActionList showDividers aria-label="全部探索主题，按最近活跃排序">
                    {byRecency(topics).map((topic) => (
                      <TopicSessionItem
                        key={topic.id}
                        topic={topic}
                        onOpen={() => selectTopic(topic.id)}
                      />
                    ))}
                  </ActionList>
                ) : (
                  <Text as="p">
                    还没有探索主题。浏览和查找不要求创建主题；想保留内容时，可以在上方创建一个。
                  </Text>
                ))}
              {activeTopic && (
                <>
                  <Text as="p">
                    {`创建于 ${sourceDate(activeTopic.createdAt)} · 最近活跃 ${sourceDate(activeTopic.updatedAt)}。这里的私人理由与待问项只属于“${activeTopic.name}”，不会带入其他探索；公共候选与来源资料可在其他主题中复用。`}
                  </Text>
                  <Text as="p">
                    <Text weight="semibold">当前问题：</Text>
                    {activeTopic.question || "未填写"}
                  </Text>
                  <Text as="p">
                    <Text weight="semibold">偏好与条件：</Text>
                    {activeTopic.preferences || "未填写"}
                  </Text>
                  {activeTopic.candidates.length === 0 &&
                    (activeTopic.opportunities ?? []).length === 0 && (
                      <Stack gap="normal" align="start">
                        <Text as="p">
                          还没有保存内容。浏览不要求保存；看见值得保留的导师或机会时再保存即可。
                        </Text>
                        <Stack direction="horizontal" wrap="wrap" gap="condensed">
                          <Button onClick={() => navigate("explore")}>
                            浏览导师与岗位
                          </Button>
                          <Button onClick={() => navigate("opportunities")}>
                            浏览机会与入口
                          </Button>
                        </Stack>
                      </Stack>
                    )}
                  <Stack as="section" gap="spacious" aria-label="已保存的候选与机会">
                    {activeTopic.candidates.length > 0 &&
                      (activeTopic.opportunities ?? []).length > 0 && (
                        <Heading as="h3" variant="small">
                          候选
                        </Heading>
                      )}
                    {activeTopic.candidates.map((record) => (
                      <SavedCandidate
                        key={`${activeTopic.id}-${record.candidate.candidateId}`}
                        record={record}
                        onOpen={
                          allOpportunities.some(
                            (item) => item.candidateId === record.candidate.candidateId,
                          )
                            ? () => {
                                setSelectedAdvisor(record.candidate.candidateId);
                                setCandidateScenario(
                                  record.candidate.type === "internship"
                                    ? "internship"
                                    : "advisor",
                                );
                                navigate("explore");
                              }
                            : undefined
                        }
                        onUpdate={(reason, questions) =>
                          mutate(() => {
                            initial.store?.updateCandidate(
                              activeTopic.id,
                              record.candidate.candidateId,
                              { reason, questions },
                            );
                            clearComparisonDrafts(
                              activeTopic.id,
                              record.candidate.candidateId,
                            );
                            setMessage("私人理由和疑问已保存。");
                          })
                        }
                        onRemove={() =>
                          mutate(() => {
                            initial.store?.removeCandidate(
                              activeTopic.id,
                              record.candidate.candidateId,
                            );
                            clearComparisonDrafts(
                              activeTopic.id,
                              record.candidate.candidateId,
                            );
                            setMessage("已从这个主题移除，其他主题不受影响。");
                          })
                        }
                      />
                    ))}
                    {activeTopic.candidates.length > 0 &&
                      (activeTopic.opportunities ?? []).length > 0 && (
                        <Heading as="h3" variant="small">
                          机会与入口
                        </Heading>
                      )}
                    {(activeTopic.opportunities ?? []).map((record) => (
                      <SavedOpportunity
                        key={`${activeTopic.id}-${record.opportunity.opportunityId}`}
                        record={record}
                        onUpdate={(reason, questions) =>
                          mutate(() => {
                            initial.store?.updateOpportunity(
                              activeTopic.id,
                              record.opportunity.opportunityId,
                              { reason, questions },
                            );
                            setMessage("私人理由和疑问已保存。");
                          })
                        }
                        onRemove={() =>
                          mutate(() => {
                            initial.store?.removeOpportunity(
                              activeTopic.id,
                              record.opportunity.opportunityId,
                            );
                            setMessage("已从这个主题移除，其他主题不受影响。");
                          })
                        }
                      />
                    ))}
                  </Stack>
                  <Stack gap="condensed">
                    {deleteConfirm ? (
                      <>
                        <Text as="p">
                          删除“{activeTopic.name}”及其中的私人记录？其他主题不受影响。
                        </Text>
                        <Stack direction="horizontal" wrap="wrap">
                          <Button
                            variant="danger"
                            onClick={() =>
                              mutate(() => {
                                initial.store?.deleteTopic(activeTopic.id);
                                clearComparisonDrafts(activeTopic.id);
                                selectTopic("");
                                setDeleteConfirm(false);
                                setMessage("这个主题已删除。");
                              })
                            }
                          >
                            确认删除此主题
                          </Button>
                          <Button onClick={() => setDeleteConfirm(false)}>取消</Button>
                        </Stack>
                      </>
                    ) : (
                      <Button
                        variant="invisible"
                        onClick={() => setDeleteConfirm(true)}
                      >
                        删除这个主题
                      </Button>
                    )}
                  </Stack>
                </>
              )}
            </Stack>
          )}
        </Stack>
      </PageLayout.Content>
      <PageLayout.Footer divider="line">
        <Stack gap="normal" paddingBlock="normal">
          <Text size="small">名额、截止日期与申请条件以原站为准。</Text>
          <Details>
            <Details.Summary>资料与保存说明</Details.Summary>
            <Stack gap="condensed" paddingBlock="normal">
              <Text size="small">
                资料来自公开页面，附来源与查看日期；已结束的批次仅作历史参考，不代表当前开放。补查外部来源只按你提交的查找内容发起，主题条件与私人理由不会随查找发送。
              </Text>
              <Text size="small">
                探索主题、私人理由与外观选择保存在本浏览器，不同步到其他设备；清除网站数据会移除记录。浏览和保存都不代表决定申请。
              </Text>
            </Stack>
          </Details>
        </Stack>
      </PageLayout.Footer>
    </PageLayout>
  );
}

function SavedCandidate({
  record,
  onUpdate,
  onRemove,
  onOpen,
}: {
  record: ExplorationTopic["candidates"][number];
  onUpdate: (reason: string, questions: string[]) => void;
  onRemove: () => void;
  onOpen?: () => void;
}) {
  const [reason, setReason] = useState(record.reason);
  const [question, setQuestion] = useState(record.questions.join("\n"));
  return (
    <Stack as="section" gap="normal">
      <Stack direction="horizontal" gap="condensed" align="center" wrap="wrap">
        <Heading as="h2" variant="medium">
          {record.candidate.name} · {record.candidate.institution}
        </Heading>
        <Label variant={record.candidate.type === "internship" ? "primary" : "accent"}>
          {record.candidate.type === "internship" ? "实习岗位" : "导师"}
        </Label>
        {onOpen && (
          <Button size="small" variant="invisible" onClick={onOpen}>
            在找导师中查看
          </Button>
        )}
      </Stack>
      <Text as="p">{record.candidate.research}</Text>
      {record.candidate.sources.map((source, index) => (
        <SourceView
          key={`${source.url}-${source.collectedAt}-${index}`}
          source={source}
          saved
        />
      ))}
      <FormControl>
        <FormControl.Label>私人理由</FormControl.Label>
        <Textarea
          block
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
        />
      </FormControl>
      <FormControl>
        <FormControl.Label>待问问题（一行一个）</FormControl.Label>
        <Textarea
          block
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={2}
        />
      </FormControl>
      <Stack direction="horizontal" wrap="wrap">
        <Button
          onClick={() =>
            onUpdate(
              reason,
              question
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean),
            )
          }
        >
          保存记录
        </Button>
        <Button variant="invisible" onClick={onRemove}>
          从此主题移除候选
        </Button>
      </Stack>
    </Stack>
  );
}

function SavedOpportunity({
  record,
  onUpdate,
  onRemove,
}: {
  record: TopicOpportunity;
  onUpdate: (reason: string, questions: string[]) => void;
  onRemove: () => void;
}) {
  const [reason, setReason] = useState(record.reason);
  const [question, setQuestion] = useState(record.questions.join("\n"));
  const { opportunity } = record;
  return (
    <Stack as="section" gap="normal">
      <Heading as="h2" variant="medium">
        {opportunity.name}
      </Heading>
      <Text as="p" size="small">
        {opportunity.types.join("、")} · {opportunity.period} · 保存时信息于{" "}
        {opportunity.checkedAt} 查看
      </Text>
      <Text as="p">{opportunity.summary}</Text>
      <Link href={opportunity.entryUrl} target="_blank" rel="noreferrer">
        打开原站入口
      </Link>
      <FormControl>
        <FormControl.Label>私人理由</FormControl.Label>
        <Textarea
          block
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
        />
      </FormControl>
      <FormControl>
        <FormControl.Label>待问问题（一行一个）</FormControl.Label>
        <Textarea
          block
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={2}
        />
      </FormControl>
      <Stack direction="horizontal" wrap="wrap">
        <Button
          onClick={() =>
            onUpdate(
              reason,
              question
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean),
            )
          }
        >
          保存记录
        </Button>
        <Button variant="invisible" onClick={onRemove}>
          从此主题移除
        </Button>
      </Stack>
    </Stack>
  );
}
