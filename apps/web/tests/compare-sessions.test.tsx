import { describe, expect, test } from "bun:test";
import { ActionList } from "@primer/react";
import { renderToStaticMarkup } from "react-dom/server";
import { byRecency, resolveInitialTopicId } from "../src/app/App";
import { AdvisorComparison } from "../src/components/AdvisorComparison";
import { ExploreHome } from "../src/components/ExploreHome";
import { TopicSessionItem } from "../src/components/TopicSessionItem";
import {
  buildComparisonRows,
  comparisonSupportedCandidateIds,
} from "../src/lib/advisor-comparison";
import { advisors } from "../src/lib/advisors";
import type { ExplorationTopic } from "../src/lib/exploration-store";

const candidates = comparisonSupportedCandidateIds.map((id) => {
  const advisor = advisors.find((item) => item.candidateId === id);
  if (!advisor) throw new Error(`Missing collected advisor: ${id}`);
  return advisor;
});

const rows = buildComparisonRows(candidates, "research");

function renderComparison() {
  return renderToStaticMarkup(
    <AdvisorComparison
      candidates={candidates}
      perspective="research"
      focus="open"
      notes={{}}
      supplementalSources={{}}
      onFollowup={() => {}}
      onPerspectiveChange={() => {}}
      onFocusChange={() => {}}
      onRemove={() => {}}
      onReturn={() => {}}
      onNotesChange={() => {}}
      onSave={() => {}}
    />,
  );
}

describe("paired side-by-side comparison", () => {
  test("both candidates answer the same question side by side in one table", () => {
    const html = renderComparison();
    // One comparison table per render branch, questions as row headers.
    expect(html).toContain("比较项");
    for (const row of rows) {
      expect(html).toContain(row.label);
    }
    // Each candidate keeps its own identity in the column header.
    for (const candidate of candidates) {
      expect(html).toContain(candidate.name);
      expect(html).toContain(candidate.institution);
    }
  });

  test("narrow layout keeps each answer next to the candidate name", () => {
    const html = renderComparison();
    // The stacked branch repeats name + institution above each answer.
    for (const candidate of candidates) {
      expect(html).toContain(`${candidate.name} · ${candidate.institution}`);
    }
    // Follow-up entries stay attached to the unknowns answers.
    expect(html).toContain(`补查${candidates[0].name}`);
    expect(html).toContain(`补查${candidates[1].name}`);
  });
  test("the paired table keeps an accessible name via its heading", () => {
    const html = renderComparison();
    expect(html).toContain('id="comparison-heading"');
    expect(html).toContain('aria-labelledby="comparison-heading"');
  });
});

describe("session resume pointer resolution", () => {
  const topics: ExplorationTopic[] = [
    {
      id: "a",
      name: "主题A",
      question: "",
      preferences: "",
      createdAt: "2026-10-01T00:00:00Z",
      updatedAt: "2026-10-02T00:00:00Z",
      candidates: [],
      opportunities: [],
    },
    {
      id: "b",
      name: "主题B",
      question: "",
      preferences: "",
      createdAt: "2026-10-03T00:00:00Z",
      updatedAt: "2026-10-04T00:00:00Z",
      candidates: [],
      opportunities: [],
    },
  ];

  test("a stored topic id resumes that session", () => {
    expect(resolveInitialTopicId(topics, "b")).toBe("b");
  });

  test("an explicit no-save choice stays topic-less instead of selecting an unrelated topic", () => {
    expect(resolveInitialTopicId(topics, "")).toBe("");
  });

  test("a missing, stale or unreadable pointer falls back to the first topic", () => {
    expect(resolveInitialTopicId(topics, null)).toBe("a");
    expect(resolveInitialTopicId(topics, "deleted-topic")).toBe("a");
    expect(resolveInitialTopicId([], null)).toBe("");
  });
});

describe("session-style topic ordering", () => {
  test("topics sort by most recent activity without mutating the input", () => {
    const base = {
      question: "",
      preferences: "",
      candidates: [],
      opportunities: [],
    };
    const topics: ExplorationTopic[] = [
      {
        ...base,
        id: "old",
        name: "旧主题",
        createdAt: "2026-10-01T00:00:00Z",
        updatedAt: "2026-10-02T00:00:00Z",
      },
      {
        ...base,
        id: "new",
        name: "新主题",
        createdAt: "2026-09-01T00:00:00Z",
        updatedAt: "2026-10-23T00:00:00Z",
      },
      {
        ...base,
        id: "mid",
        name: "中间主题",
        createdAt: "2026-10-10T00:00:00Z",
        updatedAt: "2026-10-10T00:00:00Z",
      },
    ];
    const sorted = byRecency(topics);
    expect(sorted.map((topic) => topic.id)).toEqual(["new", "mid", "old"]);
    expect(topics.map((topic) => topic.id)).toEqual(["old", "new", "mid"]);
  });
});

describe("session list metadata actually renders", () => {
  const topic: ExplorationTopic = {
    id: "t1",
    name: "暑期科研",
    question: "AI 系统方向有哪些途径",
    preferences: "",
    createdAt: "2026-10-01T08:00:00.000Z",
    updatedAt: "2026-10-20T08:00:00.000Z",
    candidates: [],
    opportunities: [],
  };

  test("topic session row keeps question and both dates in the rendered output", () => {
    const html = renderToStaticMarkup(
      <ActionList>
        <TopicSessionItem topic={topic} onOpen={() => {}} />
      </ActionList>,
    );
    expect(html).toContain("暑期科研");
    expect(html).toContain("AI 系统方向有哪些途径");
    expect(html).toContain("最近活跃");
    expect(html).toContain("创建于");
  });

  test("home recent-session rows render the activity date, not only the question", () => {
    const html = renderToStaticMarkup(
      <ExploreHome
        advisors={[]}
        onOpenAdvisors={() => {}}
        onOpenAdvisor={() => {}}
        onOpenType={() => {}}
        topics={[
          {
            id: "t1",
            name: "暑期科研",
            question: "AI 系统方向有哪些途径",
            updatedAt: "2026-10-20T08:00:00.000Z",
            savedCount: 2,
          },
        ]}
        onOpenTopic={() => {}}
        onOpenTopics={() => {}}
      />,
    );
    expect(html).toContain("继续上次的探索");
    expect(html).toContain("最近活跃");
  });
});
