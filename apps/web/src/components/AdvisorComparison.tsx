import {
  Button,
  Details,
  FormControl,
  Heading,
  Select,
  Stack,
  Text,
  Textarea,
} from "@primer/react";
import { type Column, DataTable, Hidden } from "@primer/react/experimental";
import type { ReactNode } from "react";
import {
  type AnyComparisonFocus,
  type AnyComparisonPerspective,
  type ComparisonPerspective,
  type ComparisonRow,
  type InternshipFocus,
  type InternshipPerspective,
  type ResearchFocus,
  buildComparisonRows,
  buildInternshipComparisonRows,
  buildInternshipFocusHints,
  buildResearchFocusHints,
  isInternshipComparison,
} from "../lib/advisor-comparison";
import type { Advisor } from "../lib/advisors";
import type { SourceSnapshot } from "../lib/exploration-store";
import { SourceView } from "./SourceView";

export interface ComparisonNotes {
  reason: string;
  questions: string;
}

// One candidate's answer to one comparison question, with its evidence and
// follow-up entry. Shared by the wide side-by-side table and the narrow
// stacked layout so both present identical content.
function CandidateAnswer({
  rowId,
  criterion,
  advisor,
  text,
  sources,
  onFollowup,
}: {
  rowId: string;
  criterion: string;
  advisor: Advisor;
  text: string;
  sources: SourceSnapshot[];
  onFollowup: (advisor: Advisor) => void;
}) {
  return (
    <Stack gap="condensed">
      <Text as="p">{text}</Text>
      {rowId === "unknowns" && (
        <Button onClick={() => onFollowup(advisor)}>补查{advisor.name}</Button>
      )}
      {sources.length > 0 && (
        <Details>
          <Details.Summary aria-label={`查看${advisor.name}「${criterion}」的依据`}>
            查看依据（{sources.length}）
          </Details.Summary>
          <Stack gap="normal">
            {sources.map((source) => (
              <SourceView key={`${source.url}-${source.collectedAt}`} source={source} />
            ))}
          </Stack>
        </Details>
      )}
    </Stack>
  );
}

export function AdvisorComparison({
  candidates,
  perspective,
  focus,
  topicName,
  notes,
  supplementalSources,
  headerActions,
  onFollowup,
  onPerspectiveChange,
  onFocusChange,
  onRemove,
  onReturn,
  onNotesChange,
  onSave,
}: {
  candidates: Advisor[];
  perspective: AnyComparisonPerspective;
  focus: AnyComparisonFocus;
  topicName?: string;
  notes: Record<string, ComparisonNotes>;
  supplementalSources: Record<string, SourceSnapshot[]>;
  headerActions?: ReactNode;
  onFollowup: (advisor: Advisor) => void;
  onPerspectiveChange: (value: AnyComparisonPerspective) => void;
  onFocusChange: (value: AnyComparisonFocus) => void;
  onRemove: (candidateId: string) => void;
  onReturn: () => void;
  onNotesChange: (candidateId: string, value: ComparisonNotes) => void;
  onSave: (advisor: Advisor, notes: ComparisonNotes) => void;
}) {
  const isInternship = isInternshipComparison(candidates);
  const rows = isInternship
    ? buildInternshipComparisonRows(candidates, perspective as InternshipPerspective)
    : buildComparisonRows(candidates, perspective as ComparisonPerspective);
  const hints = isInternship
    ? buildInternshipFocusHints(candidates, focus as InternshipFocus)
    : buildResearchFocusHints(candidates, focus as ResearchFocus);
  // Wide layout: one row per comparison question, one column per candidate,
  // so both answers to the same question sit side by side at the same reading
  // position (the paired-output comparison pattern). Each column keeps the
  // candidate's own identity, evidence and follow-up entry.
  const sideBySideColumns: Column<ComparisonRow>[] = [
    {
      id: "criterion",
      header: "比较项",
      rowHeader: true,
      width: 112,
      renderCell: (row) => <Text weight="semibold">{row.label}</Text>,
    },
    ...candidates.map((candidate): Column<ComparisonRow> => {
      const answerFor = (row: ComparisonRow) =>
        row.cells.find((cell) => cell.candidateId === candidate.candidateId);
      return {
        id: candidate.candidateId,
        header: () => (
          <Stack gap="condensed">
            <Text weight="semibold">{candidate.name}</Text>
            <Text size="small">{candidate.institution}</Text>
          </Stack>
        ),
        width: "growCollapse",
        renderCell: (row) => {
          const cell = answerFor(row);
          if (!cell) {
            return <Text size="small">此项暂未整理。</Text>;
          }
          return (
            <CandidateAnswer
              rowId={row.id}
              criterion={row.label}
              advisor={candidate}
              text={cell.text}
              sources={cell.sources}
              onFollowup={onFollowup}
            />
          );
        },
      };
    }),
  ];

  return (
    <Stack as="section" gap="spacious">
      <Stack gap="normal">
        <Heading as="h1" id="comparison-heading">
          {isInternship ? "实习岗位比较" : "候选比较"}
        </Heading>
        <Text as="p">
          {isInternship
            ? "这次比较复用2026年10月16日采集整理的实习岗位信息。岗位招聘要求与入职途径按来源分别说明，当期剩余HC与转正指标仍需面试确认。"
            : "这次比较复用2026年10月5日采集的整理摘要。招生年份和途径按来源分别说明，当前名额与实际指导体验仍待了解。"}
        </Text>
        <Stack direction="horizontal" wrap="wrap" align="center">
          <Button onClick={onReturn}>返回候选资料</Button>
          {headerActions}
          {candidates.map((candidate) => (
            <Button
              key={candidate.candidateId}
              variant="invisible"
              onClick={() => onRemove(candidate.candidateId)}
            >
              移除{candidate.name}的比较
            </Button>
          ))}
        </Stack>
      </Stack>

      {candidates.length === 0 ? (
        <Text as="p">还没有选择比较对象。返回候选资料，可以选一名或两名阅读。</Text>
      ) : (
        <>
          <Stack direction={{ narrow: "vertical", regular: "horizontal" }} gap="normal">
            <FormControl>
              <FormControl.Label>现在想了解什么</FormControl.Label>
              {isInternship ? (
                <Select
                  value={perspective}
                  onChange={(event) =>
                    onPerspectiveChange(event.target.value as InternshipPerspective)
                  }
                >
                  <Select.Option value="role">业务职责与课题</Select.Option>
                  <Select.Option value="growth">转正与成长途径</Select.Option>
                  <Select.Option value="practical">时间地点与要求</Select.Option>
                </Select>
              ) : (
                <Select
                  value={perspective}
                  onChange={(event) =>
                    onPerspectiveChange(event.target.value as ComparisonPerspective)
                  }
                >
                  <Select.Option value="research">研究内容</Select.Option>
                  <Select.Option value="graduate">读研参与途径</Select.Option>
                  <Select.Option value="short-term">本科科研、RA 或短访</Select.Option>
                </Select>
              )}
            </FormControl>
            <FormControl>
              <FormControl.Label>
                {isInternship ? "技术侧重点（可不选）" : "研究关注点（可不选）"}
              </FormControl.Label>
              {isInternship ? (
                <Select
                  value={focus}
                  onChange={(event) =>
                    onFocusChange(event.target.value as InternshipFocus)
                  }
                >
                  <Select.Option value="open">暂未明确</Select.Option>
                  <Select.Option value="systems">大规模分布式系统</Select.Option>
                  <Select.Option value="evaluation">大模型评测与对齐</Select.Option>
                </Select>
              ) : (
                <Select
                  value={focus}
                  onChange={(event) =>
                    onFocusChange(event.target.value as ResearchFocus)
                  }
                >
                  <Select.Option value="open">暂未明确</Select.Option>
                  <Select.Option value="software">软件可靠性与安全</Select.Option>
                  <Select.Option value="ai-systems">AI 系统与 GPU 优化</Select.Option>
                </Select>
              )}
            </FormControl>
          </Stack>
          {candidates.length === 1 && (
            <Text as="p">当前只看一名候选；也可以返回资料加入另一名。</Text>
          )}
          <Hidden when="narrow">
            <DataTable
              aria-labelledby="comparison-heading"
              columns={sideBySideColumns}
              data={rows}
            />
          </Hidden>
          <Hidden when={["regular", "wide"]}>
            <Stack gap="spacious">
              {rows.map((row) => (
                <Stack
                  as="section"
                  key={row.id}
                  gap="normal"
                  aria-labelledby={`comparison-${row.id}`}
                >
                  <Heading as="h2" variant="medium" id={`comparison-${row.id}`}>
                    {row.label}
                  </Heading>
                  {row.cells.map((cell) => {
                    const candidate = candidates.find(
                      (item) => item.candidateId === cell.candidateId,
                    );
                    if (!candidate) return null;
                    return (
                      <Stack key={cell.candidateId} gap="condensed">
                        <Text weight="semibold">
                          {candidate.name} · {candidate.institution}
                        </Text>
                        <CandidateAnswer
                          rowId={row.id}
                          criterion={row.label}
                          advisor={candidate}
                          text={cell.text}
                          sources={cell.sources}
                          onFollowup={onFollowup}
                        />
                      </Stack>
                    );
                  })}
                </Stack>
              ))}
            </Stack>
          </Hidden>
          {hints.length > 0 && (
            <Stack as="section" gap="normal">
              <Heading as="h2" variant="medium">
                按关注点继续了解
              </Heading>
              <Text as="p">
                以下是按已整理资料给出的阅读建议，可以更换关注点，也可以到此结束。
              </Text>
              {hints.map((hint) => {
                const candidate = candidates.find(
                  (item) => item.candidateId === hint.candidateId,
                );
                return (
                  <Stack key={hint.candidateId} gap="condensed">
                    <Text as="p">
                      <Text weight="semibold">{candidate?.name}：</Text>
                      {hint.text}
                    </Text>
                    <Details>
                      <Details.Summary>阅读建议的依据</Details.Summary>
                      <Stack gap="normal">
                        {hint.sources.map((source) => (
                          <SourceView
                            key={`${source.url}-${source.collectedAt}`}
                            source={source}
                          />
                        ))}
                      </Stack>
                    </Details>
                  </Stack>
                );
              })}
            </Stack>
          )}
          <Stack as="section" gap="normal">
            <Heading as="h2" variant="medium">
              补充依据
            </Heading>
            <Text as="p">
              {topicName
                ? `以下是你关联到“${topicName}”的新增来源，可结合原有摘要继续判断；保存来源不代表待问项已确认。`
                : "补查后可以把来源保存到一个主题，再回到这里继续比较。"}
            </Text>
            {candidates.map((candidate) => {
              const sources = supplementalSources[candidate.candidateId] ?? [];
              return (
                <Stack key={candidate.candidateId} gap="condensed">
                  <Text weight="semibold">{candidate.name}</Text>
                  {sources.length ? (
                    <Details>
                      <Details.Summary>
                        查看{candidate.name}的补充依据（{sources.length}）
                      </Details.Summary>
                      <Stack gap="normal">
                        {sources.map((source, index) => (
                          <SourceView
                            key={`${source.url}-${source.collectedAt}-${index}`}
                            source={source}
                            saved
                          />
                        ))}
                      </Stack>
                    </Details>
                  ) : (
                    <Text as="p">当前主题还没有这位候选的补充依据。</Text>
                  )}
                  <Button onClick={() => onFollowup(candidate)}>
                    继续补查{candidate.name}
                  </Button>
                </Stack>
              );
            })}
          </Stack>
          <Stack as="section" gap="normal">
            <Heading as="h2" variant="medium">
              自己的记录
            </Heading>
            <Text as="p">
              {topicName
                ? `主动保存后，记录留在“${topicName}”中；不同主题各自记录，移除比较对象不会删除收藏。未保存的编辑刷新后会丢失。`
                : "如需记录理由或疑问，先选择或创建主题。比较本身不需要主题。"}
            </Text>
            {candidates.map((candidate) => {
              const draft = notes[candidate.candidateId] ?? {
                reason: "",
                questions: "",
              };
              return (
                <Stack key={candidate.candidateId} gap="normal">
                  <FormControl>
                    <FormControl.Label>
                      {candidate.name}：自己的理由（可不填）
                    </FormControl.Label>
                    <Textarea
                      block
                      disabled={!topicName}
                      value={draft.reason}
                      rows={2}
                      onChange={(event) =>
                        onNotesChange(candidate.candidateId, {
                          ...draft,
                          reason: event.target.value,
                        })
                      }
                    />
                  </FormControl>
                  <FormControl>
                    <FormControl.Label>
                      {candidate.name}：待问问题（一行一个，可不填）
                    </FormControl.Label>
                    <Textarea
                      block
                      disabled={!topicName}
                      value={draft.questions}
                      rows={2}
                      onChange={(event) =>
                        onNotesChange(candidate.candidateId, {
                          ...draft,
                          questions: event.target.value,
                        })
                      }
                    />
                  </FormControl>
                  <Button
                    disabled={!topicName}
                    onClick={() => onSave(candidate, draft)}
                  >
                    保存{candidate.name}比较记录
                  </Button>
                </Stack>
              );
            })}
          </Stack>
        </>
      )}
    </Stack>
  );
}
