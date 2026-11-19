import { LinkExternalIcon } from "@primer/octicons-react";
import { Label, Link, Stack, Text } from "@primer/react";
import type { SourceSnapshot } from "../lib/exploration-store";
import { Disclosure } from "./Disclosure";
import { formatDate } from "./meta";

function sourceKind(source: SourceSnapshot): [string, "accent" | "secondary"] {
  if (source.kind === "live") return ["本次取得的正文", "accent"];
  if (source.collection?.contentKind === "body") return ["已读正文", "secondary"];
  if (source.collection) return ["整理摘要", "secondary"];
  return ["既有样稿", "secondary"];
}

function SourceDetails({ source }: { source: SourceSnapshot }) {
  return (
    <Disclosure summary="查看依据与读取范围" openSummary="收起依据">
      {source.relevanceEvidence?.length ? (
        <Text as="p" whiteSpace="pre-wrap">
          <Text weight="semibold">与查找相关的段落：</Text>
          {source.relevanceEvidence.join("\n")}
        </Text>
      ) : null}
      <Text as="p" whiteSpace="pre-wrap">
        {source.content.length > 1600
          ? `${source.content.slice(0, 1600)}…`
          : source.content}
      </Text>
      {source.collection && (
        <Text as="p" size="small">
          {source.collection.method === "browser_dom" ? "浏览器读取" : "网页读取"}；
          {source.collection.readStatus === "partial"
            ? "只读取了部分内容"
            : "已完成本次范围内的读取"}
          ；范围：{source.collection.scope}
        </Text>
      )}
      {source.query && <Text size="small">当时的查询：{source.query}</Text>}
      {source.accessNote && <Text size="small">{source.accessNote}</Text>}
      {source.unknowns?.map((unknown) => (
        <Text key={unknown} size="small">
          未确认：{unknown}
        </Text>
      ))}
    </Disclosure>
  );
}

/** Compact source rows; each expands to the retained text and its reading scope. */
export function SourceList({
  sources,
  label = "来源",
}: { sources: SourceSnapshot[]; label?: string }) {
  if (!sources.length) return <Text as="p">没有保留可核对的来源。</Text>;
  return (
    <Stack as="ul" gap="normal" aria-label={label}>
      {sources.map((source, index) => {
        const [kind, variant] = sourceKind(source);
        return (
          <Stack
            as="li"
            gap="condensed"
            key={`${source.url}-${source.collectedAt}-${index}`}
          >
            <Stack direction="horizontal" gap="condensed" align="center" wrap="wrap">
              <Link
                href={source.lookupUrl ?? source.url}
                target="_blank"
                rel="noreferrer"
              >
                {source.title} <LinkExternalIcon />
              </Link>
              <Label variant={variant}>{kind}</Label>
            </Stack>
            <Text size="small">
              采集于 {formatDate(source.collectedAt)}
              {source.publishedAt
                ? ` · 原页显示：${source.publishedAt}`
                : " · 原页发布时间未确认"}
            </Text>
            <SourceDetails source={source} />
          </Stack>
        );
      })}
    </Stack>
  );
}
