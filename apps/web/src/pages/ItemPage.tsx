import {
  ArrowLeftIcon,
  BookmarkIcon,
  CheckIcon,
  GitCompareIcon,
  GlobeIcon,
  LinkExternalIcon,
  PlusIcon,
} from "@primer/octicons-react";
import {
  Button,
  Details,
  Dialog,
  Heading,
  Label,
  Link,
  PageLayout,
  Stack,
  Text,
  useDetails,
} from "@primer/react";
import { Blankslate, InlineMessage } from "@primer/react/experimental";
import { type ReactNode, useState } from "react";
import { routeHref } from "../app/router";
import { ItemStatus, itemMeta } from "../components/ItemList";
import { LiveDiscovery } from "../components/LiveDiscovery";
import { PrivateNotes } from "../components/PrivateNotes";
import { SourceList } from "../components/SourceList";
import {
  RouteStatusLabel,
  TimingLabel,
  TypeIcon,
  formatDate,
} from "../components/meta";
import { type CatalogItem, findItem, isSaved } from "../lib/catalog";
import { supplementalSources } from "../lib/compare";
import { type BoundClaim, type CandidateProfile, profileFor } from "../lib/profiles";
import { useAppState } from "../state/app-state";
import { recordFor, useSessionActions } from "../state/session-actions";

const levelText = { required: "硬要求", preferred: "优先", suggested: "建议" } as const;

function ClaimSources({ claim, item }: { claim: BoundClaim; item: CatalogItem }) {
  const sources = item.candidate?.sources ?? [];
  const links = claim.urls.flatMap((url) => {
    const source = sources.find((entry) => entry.url === url);
    return source ? [{ url, title: source.title }] : [];
  });
  if (!links.length) return null;
  return (
    <Text size="small">
      依据：
      {links.map((link, index) => (
        <span key={link.url}>
          {index > 0 && "、"}
          <Link href={link.url} target="_blank" rel="noreferrer">
            {link.title}
          </Link>
        </span>
      ))}
    </Text>
  );
}

function Section({
  id,
  title,
  children,
}: { id: string; title: string; children: ReactNode }) {
  return (
    <Stack as="section" gap="condensed" aria-labelledby={id}>
      <Heading as="h2" variant="medium" id={id}>
        {title}
      </Heading>
      {children}
    </Stack>
  );
}

function Claim({ claim, item }: { claim: BoundClaim; item: CatalogItem }) {
  return (
    <Stack gap="condensed">
      <Text as="p">{claim.text}</Text>
      <ClaimSources claim={claim} item={item} />
    </Stack>
  );
}

function ProfileSections({
  profile,
  item,
}: { profile: CandidateProfile; item: CatalogItem }) {
  const { topic } = useAppState();
  const { addItem, updateNotes } = useSessionActions();
  const prep = useDetails({ closeOnOutsideClick: false });
  const record = recordFor(topic, item);

  function addQuestion(question: string) {
    if (record) {
      if (!record.questions.includes(question))
        updateNotes(item, record.reason, [...record.questions, question]);
    } else {
      addItem(item, { questions: [question] });
    }
  }

  return (
    <>
      <Section id="what" title="研究什么">
        <Claim claim={profile.summary} item={item} />
        {profile.themes.map((theme) => (
          <Claim key={theme.text} claim={theme} item={item} />
        ))}
        {profile.methods && <Claim claim={profile.methods} item={item} />}
      </Section>

      <Section id="routes" title="怎样参与">
        <Text as="p" size="small">
          按途径分开看；“未提及”只表示现有来源没写，不等于不接收。招生意向以采集时的公开表述为准，不代表名额已确认。
        </Text>
        {profile.routes.map((route) => (
          <Stack as="section" gap="condensed" key={route.kind} aria-label={route.label}>
            <Stack direction="horizontal" gap="condensed" align="center" wrap="wrap">
              <Heading as="h3" variant="small">
                {route.label}
              </Heading>
              <RouteStatusLabel status={route.status} />
            </Stack>
            <Claim claim={route.statusNote} item={item} />
            {route.conditions.length > 0 && (
              <Stack as="ul" gap="condensed">
                {route.conditions.map((condition) => (
                  <Stack
                    as="li"
                    key={condition.text}
                    direction="horizontal"
                    gap="condensed"
                    align="start"
                  >
                    <Label
                      variant={
                        condition.level === "required"
                          ? "danger"
                          : condition.level === "preferred"
                            ? "attention"
                            : "secondary"
                      }
                    >
                      {levelText[condition.level]}
                    </Label>
                    <Text>{condition.text}</Text>
                  </Stack>
                ))}
              </Stack>
            )}
            {route.prerequisites && (
              <InlineMessage variant="warning">
                前提：{route.prerequisites.text}
              </InlineMessage>
            )}
          </Stack>
        ))}
      </Section>

      <Section id="beyond" title="介绍之外">
        {profile.beyond.records.length ? (
          profile.beyond.records.map((entry) => (
            <Stack key={entry.text} gap="condensed">
              <Text as="p">
                {entry.role}（{entry.period}）：{entry.text}
              </Text>
              <ClaimSources claim={entry} item={item} />
            </Stack>
          ))
        ) : (
          <Text as="p">{profile.beyond.gap}</Text>
        )}
        {profile.beyond.paths.map((path) => (
          <Claim key={path.text} claim={path} item={item} />
        ))}
        <Text as="p" size="small">
          本产品不收录私人联系方式，也不评价导师品质。
        </Text>
        <Heading as="h3" variant="small">
          可以去确认的问题
        </Heading>
        <Stack as="ul" gap="condensed">
          {profile.beyond.askList.map((question) => {
            const added = record?.questions.includes(question);
            return (
              <Stack
                as="li"
                key={question}
                direction="horizontal"
                gap="condensed"
                align="center"
                wrap="wrap"
              >
                <Text>{question}</Text>
                <Button
                  size="small"
                  variant="invisible"
                  leadingVisual={added ? CheckIcon : PlusIcon}
                  disabled={added || !topic}
                  onClick={() => addQuestion(question)}
                >
                  {added ? "已在我的待问" : "加入我的待问"}
                </Button>
              </Stack>
            );
          })}
        </Stack>
      </Section>

      {profile.preparation.length > 0 && (
        <Details {...prep.getDetailsProps()}>
          <Details.Summary>
            <Heading as="h2" variant="medium">
              {prep.open ? "准备重点（按需）" : "需要时展开：准备重点"}
            </Heading>
          </Details.Summary>
          <Stack gap="normal" padding="condensed">
            <Text as="p" size="small">
              已经有基础，或者暂时不打算继续，都可以跳过。
            </Text>
            {profile.preparation.map((step) => (
              <Stack key={step.text} gap="condensed">
                <Stack
                  direction="horizontal"
                  gap="condensed"
                  align="center"
                  wrap="wrap"
                >
                  <Text weight="semibold">{step.text}</Text>
                  <Label variant="secondary">
                    {step.origin === "source" ? "来源建议" : "整理建议"}
                  </Label>
                </Stack>
                <Text as="p">为什么：{step.reason}</Text>
                {step.resourceIds?.map((id) => {
                  const resource = findItem(id);
                  return resource ? (
                    <Link key={id} href={routeHref({ name: "item", id })}>
                      相关资源：{resource.name}
                    </Link>
                  ) : null;
                })}
              </Stack>
            ))}
          </Stack>
        </Details>
      )}

      <Section id="unknowns" title="仍需确认">
        {profile.unknowns.map((claim) => (
          <Claim key={claim.text} claim={claim} item={item} />
        ))}
        {profile.conflicts.map((conflict) => (
          <Stack key={conflict.topic} gap="condensed">
            <Text weight="semibold">{conflict.topic}：来源说法不一致，保留待核</Text>
            {conflict.versions.map((version) => (
              <Claim key={version.text} claim={version} item={item} />
            ))}
          </Stack>
        ))}
      </Section>
    </>
  );
}

function GenericSections({ item }: { item: CatalogItem }) {
  const candidate = item.candidate;
  const entry = item.entry;
  return (
    <>
      <Section id="what" title="是什么">
        <Text as="p">{candidate?.research || entry?.summary || item.summary}</Text>
        {candidate?.approach && <Text as="p">{candidate.approach}</Text>}
      </Section>
      <Section id="routes" title={entry ? "适用对象与条件" : "怎样参与"}>
        <Text as="p">
          {candidate?.participation || entry?.conditions || "来源没有说明。"}
        </Text>
      </Section>
      {entry?.support && (
        <Section id="support" title="支持与费用">
          <Text as="p">{entry.support}</Text>
          <Text size="small">可申请不等于获批，条件以原站为准。</Text>
        </Section>
      )}
      <Section id="timing" title="时效">
        <Stack direction="horizontal" gap="condensed" align="center" wrap="wrap">
          <TimingLabel timing={item.timing} />
          <Text>{item.period}</Text>
        </Stack>
        <Text size="small">
          {entry
            ? `入口查看于 ${formatDate(item.latestAt)}`
            : `最近采集于 ${formatDate(item.latestAt)}`}
          ；不代表现在仍然开放。
        </Text>
      </Section>
      {!entry && (
        <Section id="beyond" title="介绍之外">
          <Text as="p">
            暂无可核实的经历记录。可以从下面的来源页了解公开信息；本产品不收录私人联系方式。
          </Text>
        </Section>
      )}
      <Section id="unknowns" title="仍需确认">
        <Text as="p">{candidate?.unknowns || entry?.caveat || "来源没有列出。"}</Text>
      </Section>
    </>
  );
}

export default function ItemPage({ id }: { id: string }) {
  const { topic, tray, toggleCompare } = useAppState();
  const { addItem } = useSessionActions();
  const [lookupOpen, setLookupOpen] = useState(false);
  const item = findItem(id, topic);

  if (!item) {
    return (
      <Blankslate>
        <Blankslate.Heading>没有找到这个对象</Blankslate.Heading>
        <Blankslate.Description>
          它可能只保存在另一个探索主题里，或已经被更正拆分。
        </Blankslate.Description>
        <Blankslate.PrimaryAction href={routeHref({ name: "library" })}>
          去资料库
        </Blankslate.PrimaryAction>
      </Blankslate>
    );
  }

  const profile = profileFor(item.id);
  const supplemental = supplementalSources(item, topic);
  const comparing = tray.ids.includes(item.id);
  const saved = isSaved(topic, item);

  return (
    <PageLayout padding="none" containerWidth="full" columnGap="normal">
      <PageLayout.Content as="article" aria-labelledby="item-title">
        <Stack gap="spacious">
          <Stack gap="condensed">
            <Stack direction="horizontal">
              <Button
                variant="invisible"
                size="small"
                leadingVisual={ArrowLeftIcon}
                onClick={() => window.history.back()}
              >
                返回
              </Button>
            </Stack>
            <Stack direction="horizontal" gap="condensed" align="center">
              <TypeIcon item={item} />
              <Heading as="h1" id="item-title">
                {item.name}
              </Heading>
            </Stack>
            <Text size="small">{itemMeta(item)}</Text>
            <ItemStatus item={item} />
            {item.candidate?.correctionNote && (
              <InlineMessage variant="warning">
                资料更正（{formatDate(item.candidate.correctionNote.decidedAt)}）：
                {item.candidate.correctionNote.reason}
                。此对象由原先误合并的记录拆分而来。
              </InlineMessage>
            )}
            <Stack direction="horizontal" gap="condensed" wrap="wrap">
              <Button
                as="a"
                href={item.entryUrl}
                target="_blank"
                rel="noreferrer"
                variant="primary"
                leadingVisual={LinkExternalIcon}
              >
                打开原站
              </Button>
              <Button leadingVisual={GlobeIcon} onClick={() => setLookupOpen(true)}>
                联网补查
              </Button>
              <Button
                leadingVisual={GitCompareIcon}
                aria-pressed={comparing}
                onClick={() => toggleCompare(item)}
              >
                {comparing ? "已在比较栏" : "加入比较"}
              </Button>
              <Button
                leadingVisual={saved ? CheckIcon : BookmarkIcon}
                disabled={saved}
                onClick={() => addItem(item)}
              >
                {saved ? `已在“${topic?.name}”中` : "加入本次探索"}
              </Button>
            </Stack>
          </Stack>

          {profile ? (
            <ProfileSections profile={profile} item={item} />
          ) : (
            <GenericSections item={item} />
          )}

          <Section id="sources" title="来源">
            {item.candidate ? (
              <SourceList sources={item.candidate.sources} />
            ) : (
              <Text as="p">
                <Link href={item.entryUrl} target="_blank" rel="noreferrer">
                  {item.entry?.entry.label ?? item.name} <LinkExternalIcon />
                </Link>{" "}
                · 查看于 {formatDate(item.latestAt)}
                。资料库条目只整理入口与条件，详细内容以原站为准。
              </Text>
            )}
            {supplemental.length > 0 && (
              <>
                <Heading as="h3" variant="small">
                  本主题补查所得（{supplemental.length}）
                </Heading>
                <SourceList sources={supplemental} label="补查所得" />
              </>
            )}
          </Section>
        </Stack>
      </PageLayout.Content>
      <PageLayout.Pane
        position="end"
        width="medium"
        divider="line"
        sticky
        aria-label="我的记录"
      >
        <PrivateNotes item={item} />
      </PageLayout.Pane>
      {lookupOpen && (
        <Dialog
          title={`联网补查：${item.name}`}
          width="xlarge"
          onClose={() => setLookupOpen(false)}
        >
          <LiveDiscovery
            initialQuery={item.readableUrls[0]?.url ?? item.name}
            target={item}
            pages={item.readableUrls.map((page) => ({ ...page, itemName: item.name }))}
            headingLevel="h3"
          />
        </Dialog>
      )}
    </PageLayout>
  );
}
