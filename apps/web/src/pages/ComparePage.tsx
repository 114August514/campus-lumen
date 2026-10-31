import {
  LinkExternalIcon,
  PlusIcon,
  SearchIcon,
  SparkleFillIcon,
  XIcon,
} from "@primer/octicons-react";
import {
  ActionList,
  ActionMenu,
  Button,
  Dialog,
  FormControl,
  Heading,
  Link,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
} from "@primer/react";
import { Blankslate, type Column, DataTable, Hidden } from "@primer/react/experimental";
import { useEffect, useRef, useState } from "react";
import { type Route, go, routeHref } from "../app/router";
import { AnalysisDialog } from "../components/AnalysisDialog";
import { LiveDiscovery } from "../components/LiveDiscovery";
import { PrivateNotes } from "../components/PrivateNotes";
import { RouteStatusLabel, TimingLabel, formatDate } from "../components/meta";
import { evidenceFromRows } from "../lib/analysis";
import {
  type CatalogItem,
  catalog,
  findItem,
  kindText,
  sessionRecords,
} from "../lib/catalog";
import {
  type CellSource,
  type CompareCell,
  type CompareRow,
  type Perspective,
  buildCompareRows,
  compareKind,
  defaultPerspective,
  followupQuery,
  perspectives,
  supplementalSources,
} from "../lib/compare";
import { useAppState } from "../state/app-state";

type CompareRoute = Extract<Route, { name: "compare" }>;

function CellView({
  cell,
  row,
  item,
  supplements,
  onEvidence,
  onFollowup,
}: {
  cell: CompareCell;
  row: CompareRow;
  item: CatalogItem;
  supplements: { title: string; url: string; collectedAt: string }[];
  onEvidence: (cell: CompareCell, row: CompareRow, item: CatalogItem) => void;
  onFollowup: (item: CatalogItem) => void;
}) {
  return (
    <Stack gap="condensed">
      {(cell.status || cell.timing) && (
        <Stack direction="horizontal">
          {cell.status && <RouteStatusLabel status={cell.status} />}
          {cell.timing && <TimingLabel timing={cell.timing} />}
        </Stack>
      )}
      <Text whiteSpace="pre-wrap">{cell.text}</Text>
      {row.followup &&
        supplements.map((source) => (
          <Text size="small" key={`${source.url}-${source.collectedAt}`}>
            补查所得（{formatDate(source.collectedAt)}）：
            <Link href={source.url} target="_blank" rel="noreferrer">
              {source.title}
            </Link>
          </Text>
        ))}
      <Stack direction="horizontal" gap="condensed" wrap="wrap">
        {cell.sources.length > 0 && (
          <Button
            size="small"
            variant="invisible"
            onClick={() => onEvidence(cell, row, item)}
          >
            依据 {cell.sources.length}
          </Button>
        )}
        {row.followup && (
          <Button
            size="small"
            leadingVisual={SearchIcon}
            aria-label={`补查：${item.name} ${row.label}`}
            onClick={() => onFollowup(item)}
          >
            补查
          </Button>
        )}
      </Stack>
    </Stack>
  );
}

function EvidenceDialog({
  sources,
  title,
  onClose,
}: {
  sources: CellSource[];
  title: string;
  onClose: () => void;
}) {
  return (
    <Dialog
      title={title}
      position={{ narrow: "bottom", regular: "right" }}
      width="large"
      onClose={onClose}
    >
      <Stack gap="spacious">
        {sources.map((source) => (
          <Stack key={`${source.url}-${source.collectedAt}`} gap="condensed">
            <Link href={source.url} target="_blank" rel="noreferrer">
              {source.title} <LinkExternalIcon />
            </Link>
            <Text size="small">
              {source.label} · 采集于 {formatDate(source.collectedAt)}
            </Text>
            <Text as="p" whiteSpace="pre-wrap">
              {source.content.length > 1200
                ? `${source.content.slice(0, 1200)}…`
                : source.content}
            </Text>
          </Stack>
        ))}
      </Stack>
    </Dialog>
  );
}

export default function ComparePage({ route }: { route: CompareRoute }) {
  const { topic, setCompareIds, mutate } = useAppState();
  const items = route.ids.flatMap((id) => {
    const item = findItem(id, topic);
    return item ? [item] : [];
  });
  const kind = compareKind(items);
  const allowed = kind ? perspectives[kind] : [];
  const perspective: Perspective =
    kind && allowed.some((option) => option.id === route.perspective)
      ? (route.perspective as Perspective)
      : kind
        ? defaultPerspective(kind)
        : "research";
  const [question, setQuestion] = useState(
    topic?.lastComparison?.question || topic?.question || "",
  );
  const [evidence, setEvidence] = useState<{
    title: string;
    sources: CellSource[];
  } | null>(null);
  const [followup, setFollowup] = useState<CatalogItem | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  // Dialogs here open from many cell buttons; return focus to the one that opened it.
  const trigger = useRef<HTMLElement | null>(null);
  const rememberTrigger = () => {
    trigger.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
  };
  const restoreFocus = () => requestAnimationFrame(() => trigger.current?.focus());
  const openEvidence = (
    target: CompareCell,
    targetRow: CompareRow,
    owner: CatalogItem,
  ) => {
    rememberTrigger();
    setEvidence({
      title: `${owner.name} · ${targetRow.label}的依据`,
      sources: target.sources,
    });
  };
  const openFollowup = (item: CatalogItem) => {
    rememberTrigger();
    setFollowup(item);
  };
  const rows = kind ? buildCompareRows(items, perspective) : [];

  // The URL is the source of truth; keep the tray in step with what is shown.
  const idsKey = items.map((item) => item.id).join(",");
  useEffect(() => {
    setCompareIds(kind, idsKey ? idsKey.split(",") : []);
  }, [idsKey, kind, setCompareIds]);

  function setIds(ids: string[], nextPerspective = perspective) {
    go({ name: "compare", ids, perspective: nextPerspective }, { replace: true });
  }

  const sameKind = kind
    ? [...sessionRecords(topic).map((record) => record.item), ...catalog].filter(
        (item, index, list) =>
          item.kind === kind &&
          !route.ids.includes(item.id) &&
          list.findIndex((other) => other.id === item.id) === index,
      )
    : [];

  const missing = route.ids.length - items.length;

  if (items.length < 2 || !kind) {
    return (
      <Stack gap="normal">
        <Heading as="h1">比较</Heading>
        {items.length > 0 && !kind && (
          <Text as="p">
            比较栏里有不同类型的对象；不同类型要用不同的比较问题，请只保留同一类。
          </Text>
        )}
        <Blankslate>
          <Blankslate.Heading>选 2–4 个同类对象来比较</Blankslate.Heading>
          <Blankslate.Description>
            在资料库、发现结果或详情页点“加入比较”。比较不需要先保存探索主题。
            {missing > 0 ? ` 有 ${missing} 个对象在当前主题下找不到，已跳过。` : ""}
          </Blankslate.Description>
          <Blankslate.PrimaryAction
            href={routeHref({ name: "compare", ids: ["zuming-jiang", "zhuoran-song"] })}
          >
            看一个示例：江祖铭与宋卓然
          </Blankslate.PrimaryAction>
          <Blankslate.SecondaryAction href={routeHref({ name: "library" })}>
            去资料库挑选
          </Blankslate.SecondaryAction>
        </Blankslate>
        {items.length === 1 && (
          <Text as="p">
            当前只有“{items[0].name}”。
            <Link href={routeHref({ name: "library", type: items[0].types[0] })}>
              再挑一个同类对象
            </Link>
          </Text>
        )}
      </Stack>
    );
  }

  const columns: Column<CompareRow & { id: string }>[] = [
    {
      id: "criterion",
      header: "比较项",
      rowHeader: true,
      width: 120,
      renderCell: (row) => <Text weight="semibold">{row.label}</Text>,
    },
    ...items.map(
      (item): Column<CompareRow & { id: string }> => ({
        id: item.id,
        header: () => (
          <Stack gap="none">
            <Link href={routeHref({ name: "item", id: item.id })}>{item.name}</Link>
            <Text size="small">{item.org}</Text>
          </Stack>
        ),
        width: "growCollapse",
        renderCell: (row) => {
          const cell = row.cells.find((entry) => entry.itemId === item.id);
          return cell ? (
            <CellView
              cell={cell}
              row={row}
              item={item}
              supplements={supplementalSources(item, topic)}
              onEvidence={openEvidence}
              onFollowup={openFollowup}
            />
          ) : (
            <Text size="small">依据不足</Text>
          );
        },
      }),
    ),
  ];

  return (
    <Stack gap="spacious">
      <Stack gap="normal">
        <Heading as="h1" id="compare-heading">
          比较{kindText[kind]}
        </Heading>
        <FormControl>
          <FormControl.Label>当前问题</FormControl.Label>
          <TextInput
            block
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="例如：如果先尝试短期参与，哪一个的途径更清楚？"
          />
          <FormControl.Caption>
            问题用于补查和整理的预填，修改它不会自动发出任何请求。比较不打分、不排名。
          </FormControl.Caption>
        </FormControl>
        <Stack
          direction={{ narrow: "vertical", regular: "horizontal" }}
          gap="normal"
          align="center"
          justify="space-between"
        >
          <Stack direction="horizontal" gap="condensed" wrap="wrap" align="center">
            {items.map((item) => (
              <Button
                key={item.id}
                size="small"
                trailingVisual={XIcon}
                aria-label={`从比较中移除${item.name}`}
                onClick={() => setIds(route.ids.filter((id) => id !== item.id))}
              >
                {item.name}
              </Button>
            ))}
            {items.length < 4 && sameKind.length > 0 && (
              <ActionMenu>
                <ActionMenu.Button size="small" leadingVisual={PlusIcon}>
                  添加同类对象
                </ActionMenu.Button>
                <ActionMenu.Overlay width="medium">
                  <ActionList>
                    {sameKind.slice(0, 20).map((item) => (
                      <ActionList.Item
                        key={item.id}
                        onSelect={() => setIds([...route.ids, item.id])}
                      >
                        {item.name}
                        <ActionList.Description>{item.org}</ActionList.Description>
                      </ActionList.Item>
                    ))}
                  </ActionList>
                </ActionMenu.Overlay>
              </ActionMenu>
            )}
          </Stack>
          {allowed.length > 1 && (
            <SegmentedControl aria-label="比较视角">
              {allowed.map((option) => (
                <SegmentedControl.Button
                  key={option.id}
                  selected={option.id === perspective}
                  onClick={() => setIds(route.ids, option.id)}
                >
                  {option.label}
                </SegmentedControl.Button>
              ))}
            </SegmentedControl>
          )}
        </Stack>
      </Stack>

      <Hidden when="narrow">
        <DataTable
          aria-labelledby="compare-heading"
          columns={columns}
          data={rows.map((row) => ({ ...row, id: row.id }))}
        />
      </Hidden>
      <Hidden when={["regular", "wide"]}>
        <Stack gap="spacious">
          {rows.map((row) => (
            <Stack
              as="section"
              key={row.id}
              gap="normal"
              aria-labelledby={`row-${row.id}`}
            >
              <Heading as="h2" variant="small" id={`row-${row.id}`}>
                {row.label}
              </Heading>
              {row.cells.map((cell) => {
                const item = items.find((entry) => entry.id === cell.itemId);
                return item ? (
                  <Stack key={cell.itemId} gap="condensed">
                    <Text weight="semibold">
                      {item.name} · {item.org}
                    </Text>
                    <CellView
                      cell={cell}
                      row={row}
                      item={item}
                      supplements={supplementalSources(item, topic)}
                      onEvidence={openEvidence}
                      onFollowup={openFollowup}
                    />
                  </Stack>
                ) : null;
              })}
            </Stack>
          ))}
        </Stack>
      </Hidden>

      <Stack direction="horizontal" gap="condensed" wrap="wrap">
        <Button
          variant="primary"
          leadingVisual={SparkleFillIcon}
          onClick={() => {
            rememberTrigger();
            setAnalysisOpen(true);
          }}
        >
          按问题整理差异（AI）
        </Button>
        <Button
          disabled={!topic}
          onClick={() =>
            topic &&
            mutate(
              (store) =>
                store.saveComparison(topic.id, {
                  question,
                  ids: route.ids,
                  perspective,
                }),
              `已保存到“${topic.name}”，之后可以从处理阶段继续这次比较。`,
            )
          }
        >
          保存这次比较
        </Button>
        {!topic && (
          <Text size="small">保存比较需要一个探索主题；不保存也可以继续看。</Text>
        )}
      </Stack>

      <Stack as="section" gap="normal" aria-labelledby="judgement-heading">
        <Heading as="h2" variant="medium" id="judgement-heading">
          我的判断
        </Heading>
        <Stack
          direction={{ narrow: "vertical", regular: "horizontal" }}
          gap="spacious"
          wrap="wrap"
        >
          {items.map((item) => (
            <PrivateNotes
              key={`${topic?.id ?? "none"}-${item.id}`}
              item={item}
              heading={`关于${item.name}`}
            />
          ))}
        </Stack>
      </Stack>

      {evidence && (
        <EvidenceDialog
          title={evidence.title}
          sources={evidence.sources}
          onClose={() => {
            setEvidence(null);
            restoreFocus();
          }}
        />
      )}
      {followup && (
        <Dialog
          title={`补查：${followup.name}`}
          width="xlarge"
          onClose={() => {
            setFollowup(null);
            restoreFocus();
          }}
        >
          <LiveDiscovery
            initialQuery={(question.trim()
              ? `${followup.name} ${question.trim()}`
              : followupQuery(followup, perspective)
            ).slice(0, 200)}
            target={followup}
            pages={followup.readableUrls.map((page) => ({
              ...page,
              itemName: followup.name,
            }))}
            headingLevel="h3"
          />
        </Dialog>
      )}
      {analysisOpen && (
        <AnalysisDialog
          operation="compare"
          initialQuestion={
            question || `比较${items.map((item) => item.name).join("和")}`
          }
          items={items}
          evidence={evidenceFromRows(rows)}
          onClose={() => {
            setAnalysisOpen(false);
            restoreFocus();
          }}
        />
      )}
    </Stack>
  );
}
