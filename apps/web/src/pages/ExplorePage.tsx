import { PlusIcon } from "@primer/octicons-react";
import {
  Banner,
  Button,
  Checkbox,
  CheckboxGroup,
  CounterLabel,
  FormControl,
  Heading,
  Link,
  NavList,
  PageLayout,
  Stack,
  Text,
  TextInput,
  Textarea,
  Token,
  UnderlineNav,
} from "@primer/react";
import { Blankslate } from "@primer/react/experimental";
import { useEffect, useMemo, useState } from "react";
import { type Route, go, routeHref } from "../app/router";
import { ItemList } from "../components/ItemList";
import { LiveDiscovery, type ReadablePage } from "../components/LiveDiscovery";
import { StageProcess } from "../components/StageProcess";
import {
  type CatalogItem,
  isSaved,
  searchCatalog,
  sessionRecords,
} from "../lib/catalog";
import type { SessionStage } from "../lib/exploration-store";
import {
  type OpportunityType,
  opportunityTypeText,
  opportunityTypes,
} from "../lib/opportunities";
import { byRecency, useAppState } from "../state/app-state";
import { useSessionActions } from "../state/session-actions";

type ExploreRoute = Extract<Route, { name: "explore" }>;

interface Conditions {
  name: string;
  question: string;
  types: OpportunityType[];
  preferences: string;
}

const stageLabels: Record<SessionStage, string> = {
  explore: "① 探索",
  discover: "② 发现",
  process: "③ 处理",
};

function defaultName(question: string): string {
  const text = question.trim().replace(/\s+/g, " ");
  return text ? (text.length > 18 ? `${text.slice(0, 18)}…` : text) : "新的探索";
}

function SessionNav({ currentId }: { currentId: string }) {
  const { topics, selectTopic } = useAppState();
  return (
    <Stack gap="condensed">
      <Heading as="h2" variant="small">
        我的探索
      </Heading>
      <NavList aria-label="探索会话">
        <NavList.Item
          href={routeHref({ name: "explore", stage: "explore" })}
          aria-current={currentId === "" ? "page" : undefined}
          onClick={() => selectTopic("", { remember: false })}
        >
          <NavList.LeadingVisual>
            <PlusIcon />
          </NavList.LeadingVisual>
          新的探索
        </NavList.Item>
        {byRecency(topics).map((topic) => (
          <NavList.Item
            key={topic.id}
            href={routeHref({
              name: "explore",
              sessionId: topic.id,
              stage: topic.stage ?? "explore",
            })}
            aria-current={topic.id === currentId ? "page" : undefined}
          >
            {topic.name}
            <NavList.TrailingVisual>
              {topic.candidates.length + (topic.opportunities?.length ?? 0) ||
                undefined}
            </NavList.TrailingVisual>
          </NavList.Item>
        ))}
      </NavList>
    </Stack>
  );
}

function StageExplore({
  conditions,
  saved,
  onChange,
  onSaveConditions,
  onCreate,
  onContinue,
}: {
  conditions: Conditions;
  saved: boolean;
  onChange: (next: Conditions) => void;
  onSaveConditions: () => void;
  onCreate: (name: string) => void;
  onContinue: () => void;
}) {
  const [name, setName] = useState("");
  const matches = searchCatalog({ text: conditions.question, types: conditions.types });
  return (
    <Stack gap="spacious">
      <Stack gap="normal">
        {saved && (
          <FormControl required>
            <FormControl.Label>探索主题名称</FormControl.Label>
            <TextInput
              value={conditions.name}
              maxLength={60}
              onChange={(event) =>
                onChange({ ...conditions, name: event.target.value })
              }
            />
          </FormControl>
        )}
        <FormControl>
          <FormControl.Label>你想弄清楚的问题</FormControl.Label>
          <Textarea
            block
            rows={3}
            value={conditions.question}
            placeholder="例如：想找本科阶段能参与的 AI 系统方向短期科研"
            onChange={(event) =>
              onChange({ ...conditions, question: event.target.value })
            }
          />
          <FormControl.Caption>
            问题不确定也可以先写个方向；之后随时修改，已保存的对象和记录不会丢。
          </FormControl.Caption>
        </FormControl>
        <CheckboxGroup>
          <CheckboxGroup.Label>机会类型（不选即全部）</CheckboxGroup.Label>
          <Stack direction="horizontal" gap="normal" wrap="wrap">
            {opportunityTypes.map((type) => (
              <FormControl key={type}>
                <Checkbox
                  checked={conditions.types.includes(type)}
                  onChange={() =>
                    onChange({
                      ...conditions,
                      types: conditions.types.includes(type)
                        ? conditions.types.filter((item) => item !== type)
                        : [...conditions.types, type],
                    })
                  }
                />
                <FormControl.Label>{opportunityTypeText[type]}</FormControl.Label>
              </FormControl>
            ))}
          </Stack>
        </CheckboxGroup>
        <FormControl>
          <FormControl.Label>条件与偏好（可不填）</FormControl.Label>
          <Textarea
            block
            rows={2}
            value={conditions.preferences}
            placeholder="时间、地点、已有基础、暂不考虑的方向……"
            onChange={(event) =>
              onChange({ ...conditions, preferences: event.target.value })
            }
          />
          <FormControl.Caption>条件是你的私人记录，不会自动发送。</FormControl.Caption>
        </FormControl>
      </Stack>

      <Stack as="section" gap="condensed" aria-labelledby="plan-heading">
        <Heading as="h2" variant="small" id="plan-heading">
          发现时会做什么
        </Heading>
        <Text as="p">
          先在已有资料（
          {conditions.types.length
            ? conditions.types.map((type) => opportunityTypeText[type]).join("、")
            : "全部类型"}
          ）中按问题匹配，目前有 {matches.length} 条。
        </Text>
        <Text as="p">
          需要更多信息时，你可以联网查找或直读官方页；只会发送你在那里输入的关键词或网址，不会附带问题之外的私人记录。
        </Text>
      </Stack>

      <Stack direction="horizontal" gap="condensed" wrap="wrap" align="end">
        <Button variant="primary" onClick={onContinue}>
          开始发现
        </Button>
        {saved ? (
          <Button onClick={onSaveConditions}>保存条件</Button>
        ) : (
          <>
            <FormControl>
              <FormControl.Label>探索主题名称</FormControl.Label>
              <TextInput
                value={name}
                placeholder={defaultName(conditions.question)}
                onChange={(event) => setName(event.target.value)}
                maxLength={60}
              />
            </FormControl>
            <Button
              onClick={() => onCreate(name.trim() || defaultName(conditions.question))}
            >
              保存为探索主题
            </Button>
          </>
        )}
      </Stack>
      {!saved && (
        <Text size="small">
          保存后，问题、找到的对象和你的记录都留在这个浏览器里，下次可以接着做。
        </Text>
      )}
    </Stack>
  );
}

function StageDiscover({
  conditions,
  onNext,
}: { conditions: Conditions; onNext: () => void }) {
  const { tray } = useAppState();
  const { topic, addItem } = useSessionActions();
  const [showAll, setShowAll] = useState(false);
  const matches = useMemo(
    () => searchCatalog({ text: conditions.question, types: conditions.types }),
    [conditions.question, conditions.types],
  );
  const visible = showAll ? matches : matches.slice(0, 8);
  const sessionItems = sessionRecords(topic).map((record) => record.item);
  const linkOptions: CatalogItem[] = [
    ...sessionItems,
    ...matches
      .slice(0, 12)
      .filter((item) => !sessionItems.some((saved) => saved.id === item.id)),
  ];
  const pages: ReadablePage[] = matches
    .slice(0, 8)
    .flatMap((item) =>
      item.readableUrls.slice(0, 2).map((page) => ({ ...page, itemName: item.name })),
    );

  return (
    <Stack gap="spacious">
      <Stack as="section" gap="normal" aria-labelledby="existing-heading">
        <Stack direction="horizontal" gap="condensed" align="center">
          <Heading as="h2" variant="medium" id="existing-heading">
            在已有资料中
          </Heading>
          <CounterLabel>{matches.length}</CounterLabel>
        </Stack>
        <Text as="p" size="small">
          按问题中的词匹配已整理资料，不联网。标“已有资料”的内容来自过去的采集，日期是采集时间，不代表现在仍然开放。
        </Text>
        {matches.length === 0 ? (
          <Blankslate>
            <Blankslate.Heading>已有资料里没有匹配</Blankslate.Heading>
            <Blankslate.Description>
              换个说法、放宽类型，或者在下面联网查找。
            </Blankslate.Description>
          </Blankslate>
        ) : (
          <ItemList
            items={visible}
            label="已有资料中的匹配"
            action="add"
            isActive={(item) => isSaved(topic, item)}
            onAction={(item) => {
              if (!isSaved(topic, item)) addItem(item);
            }}
          />
        )}
        {matches.length > 8 && (
          <Button variant="invisible" onClick={() => setShowAll(!showAll)}>
            {showAll ? "只看前 8 条" : `显示全部 ${matches.length} 条`}
          </Button>
        )}
      </Stack>

      <LiveDiscovery
        initialQuery={conditions.question}
        pages={pages}
        linkOptions={linkOptions}
      />

      <Stack direction="horizontal" gap="condensed" align="center" wrap="wrap">
        <Button variant="primary" onClick={onNext}>
          下一步：处理{topic ? `（本次探索已有 ${sessionItems.length} 个对象）` : ""}
        </Button>
        {tray.ids.length > 0 && (
          <Link href={routeHref({ name: "compare", ids: tray.ids })}>
            比较比较栏中的 {tray.ids.length} 个对象
          </Link>
        )}
      </Stack>
    </Stack>
  );
}

export default function ExplorePage({ route }: { route: ExploreRoute }) {
  const { topics, topic, topicId, selectTopic, mutate, createTopic } = useAppState();
  const sessionId = route.sessionId ?? "";
  const target = sessionId ? topics.find((item) => item.id === sessionId) : undefined;
  const [draft, setDraft] = useState<Conditions>({
    name: "",
    question: route.q ?? "",
    types: [],
    preferences: "",
  });

  // The URL decides the session: an id opens that topic, no id is a temporary one.
  useEffect(() => {
    if (sessionId && target && topicId !== sessionId) selectTopic(sessionId);
    if (!sessionId && topicId !== "") selectTopic("", { remember: false });
  }, [sessionId, target, topicId, selectTopic]);

  // Opening a saved session loads its conditions into the editable draft.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reload only when another session opens
  useEffect(() => {
    if (target) {
      setDraft({
        name: target.name,
        question: target.question,
        types: (target.types ?? []) as OpportunityType[],
        preferences: target.preferences,
      });
    }
  }, [target?.id]);

  // Remember where the user is in a saved session (not counted as activity).
  useEffect(() => {
    if (target && target.stage !== route.stage) {
      mutate((store) => store.setStage(target.id, route.stage));
    }
  }, [target, route.stage, mutate]);

  if (sessionId && !target) {
    return (
      <Blankslate>
        <Blankslate.Heading>没有找到这个探索</Blankslate.Heading>
        <Blankslate.Description>
          它可能已被删除，或保存在另一个浏览器里。
        </Blankslate.Description>
        <Blankslate.PrimaryAction href={routeHref({ name: "sessions" })}>
          查看我的探索
        </Blankslate.PrimaryAction>
      </Blankslate>
    );
  }

  const saved = Boolean(target && topic?.id === target.id);
  const records = sessionRecords(saved ? topic : undefined);
  const conditions = draft;
  const stageHref = (stage: SessionStage) =>
    routeHref({
      name: "explore",
      sessionId: sessionId || undefined,
      stage,
      q: sessionId ? undefined : draft.question || undefined,
    });
  const dirty =
    saved &&
    target &&
    (draft.name.trim() !== target.name ||
      draft.question !== target.question ||
      draft.preferences !== target.preferences ||
      draft.types.join() !== (target.types ?? []).join());

  function saveConditions() {
    if (!target) return true;
    return mutate(
      (store) =>
        store.updateTopic(target.id, {
          name: draft.name.trim() || target.name,
          question: draft.question,
          preferences: draft.preferences,
          types: draft.types,
        }),
      "条件已保存；已保存的对象和私人记录没有改动，也没有发出任何查询。",
    );
  }

  function goStage(stage: SessionStage) {
    if (dirty && !saveConditions()) return;
    go({
      name: "explore",
      sessionId: sessionId || undefined,
      stage,
      q: sessionId ? undefined : draft.question || undefined,
    });
  }

  function create(name: string) {
    const id = createTopic({
      name,
      question: draft.question,
      preferences: draft.preferences,
      types: draft.types,
    });
    if (id) go({ name: "explore", sessionId: id, stage: route.stage });
  }

  return (
    <PageLayout padding="none" containerWidth="full" columnGap="normal">
      <PageLayout.Pane
        position="start"
        width="small"
        divider="line"
        hidden={{ narrow: true }}
        aria-label="探索会话列表"
      >
        <SessionNav currentId={saved ? sessionId : ""} />
      </PageLayout.Pane>
      <PageLayout.Content as="div">
        <Stack gap="normal">
          <Stack gap="condensed">
            <Heading as="h1">
              {saved && target ? target.name : "新的探索（未保存）"}
            </Heading>
            <Text as="p">
              {conditions.question ||
                "还没有写问题。可以先写个方向，也可以直接浏览资料。"}
            </Text>
            <Stack direction="horizontal" gap="condensed" wrap="wrap">
              {(conditions.types.length ? conditions.types : opportunityTypes)
                .length === opportunityTypes.length ? (
                <Token text="全部类型" />
              ) : (
                conditions.types.map((type) => (
                  <Token key={type} text={opportunityTypeText[type]} />
                ))
              )}
              {saved && target?.pausedNote && <Token text="已暂停" />}
            </Stack>
          </Stack>
          {!saved && route.stage !== "explore" && (
            <Banner
              variant="info"
              layout="compact"
              title="这是临时探索"
              description="可以浏览、查找和比较；要加入对象、留下记录或回头继续，先在“① 探索”中保存为探索主题。"
            />
          )}
          <UnderlineNav aria-label="探索阶段">
            {(["explore", "discover", "process"] as SessionStage[]).map((stage) => (
              <UnderlineNav.Item
                key={stage}
                href={stageHref(stage)}
                aria-current={route.stage === stage ? "page" : undefined}
                counter={stage === "process" && saved ? records.length : undefined}
                onSelect={(event) => {
                  event.preventDefault();
                  goStage(stage);
                }}
              >
                {stageLabels[stage]}
              </UnderlineNav.Item>
            ))}
          </UnderlineNav>
          {route.stage === "explore" && (
            <StageExplore
              conditions={conditions}
              saved={saved}
              onChange={setDraft}
              onSaveConditions={saveConditions}
              onCreate={create}
              onContinue={() => goStage("discover")}
            />
          )}
          {route.stage === "discover" && (
            <StageDiscover conditions={conditions} onNext={() => goStage("process")} />
          )}
          {route.stage === "process" &&
            (saved && topic ? (
              <StageProcess topic={topic} question={conditions.question} />
            ) : (
              <Blankslate>
                <Blankslate.Heading>处理需要一个保存的探索主题</Blankslate.Heading>
                <Blankslate.Description>
                  保存后，加入的对象、你的决定和理由都只属于这个主题。比较可以不保存直接做。
                </Blankslate.Description>
                <Blankslate.PrimaryAction href={stageHref("explore")}>
                  去保存为探索主题
                </Blankslate.PrimaryAction>
              </Blankslate>
            ))}
        </Stack>
      </PageLayout.Content>
    </PageLayout>
  );
}
