import { describe, expect, test } from "bun:test";
import { catalog, findItem } from "../src/lib/catalog";
import {
  buildCompareRows,
  compareKind,
  defaultPerspective,
  followupQuery,
  perspectives,
  supplementalSources,
} from "../src/lib/compare";
import type { SourceSnapshot } from "../src/lib/exploration-store";

function item(id: string) {
  const found = findItem(id);
  expect(found).toBeDefined();
  if (!found) throw new Error(`missing catalog item ${id}`);
  return found;
}

describe("compare", () => {
  test("compareKind is null for mixed kinds and for an empty list", () => {
    expect(compareKind([])).toBeNull();
    expect(compareKind([item("zhuoran-song"), item("ustc-research-plan")])).toBeNull();
    expect(
      compareKind([
        item("zhuoran-song"),
        item("wang-xiang"),
        item("ustc-research-plan"),
      ]),
    ).toBeNull();
  });

  test("compareKind keeps one kind for homogeneous lists", () => {
    expect(compareKind([item("zhuoran-song"), item("wang-xiang")])).toBe("advisor");
    expect(compareKind([item("ustc-research-plan")])).toBe("entry");
  });

  test("advisor cells only cite sources attached to that candidate", () => {
    const rows = buildCompareRows(
      [item("zhuoran-song"), item("wang-xiang")],
      "research",
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      for (const cell of row.cells) {
        const candidate = catalog.find((entry) => entry.id === cell.itemId)?.candidate;
        expect(candidate).toBeDefined();
        if (!candidate) continue;
        const candidateUrls = new Set(candidate.sources.map((s) => s.url));
        for (const source of cell.sources) {
          expect(candidateUrls.has(source.url)).toBe(true);
        }
      }
    }
  });

  test("a not-stated route is marked unknown and never claims non-acceptance", () => {
    // 宋卓然's short-term route is not-stated in the curated profile.
    const rows = buildCompareRows([item("zhuoran-song")], "short-term");
    const routeRow = rows.find((row) => row.id === "route");
    expect(routeRow).toBeDefined();
    if (!routeRow) return;
    const cell = routeRow.cells[0];
    expect(cell.status).toBe("not-stated");
    expect(cell.unknown).toBe(true);
    expect(cell.text).toContain("不能据此认为不接收");
    // The only occurrence must be inside the explicit non-claim sentence.
    expect(cell.text.split("不能据此认为不接收")).toHaveLength(2);
  });

  test("entry rows carry historical timing on the timing field", () => {
    // 大学生研究计划（2025–2026）is a historical batch.
    const rows = buildCompareRows([item("ustc-research-plan")], "overview");
    const timingRow = rows.find((row) => row.id === "timing");
    expect(timingRow).toBeDefined();
    if (!timingRow) return;
    expect(timingRow.cells[0].timing).toBe("historical");
    expect(timingRow.cells[0].text).toContain("已结束");
    // Timing lives on `timing`, not on the route-status field.
    expect(timingRow.cells[0].status).toBeUndefined();
  });

  test("followupQuery uses public fields only, never private topic notes", () => {
    const advisorItem = item("zhuoran-song");
    if (!advisorItem.candidate) throw new Error("advisor item lacks candidate");
    const privateReason = "这是不能外发的私人理由";
    const topic = {
      id: "topic-1",
      name: "私人主题",
      question: "私人问题",
      preferences: "私人偏好",
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
      candidates: [
        {
          candidate: advisorItem.candidate,
          reason: privateReason,
          questions: ["私人问题一"],
          savedAt: "2026-10-01T00:00:00.000Z",
        },
      ],
      opportunities: [],
    };
    for (const perspective of Object.keys(perspectives.advisor) as (
      | "research"
      | "short-term"
      | "graduate"
    )[]) {
      const query = followupQuery(advisorItem, perspective);
      expect(query).toContain(advisorItem.name);
      expect(query).toContain(advisorItem.org);
      expect(query).not.toContain(privateReason);
      expect(query).not.toContain("私人");
    }
    const entryQuery = followupQuery(item("ustc-research-plan"), "overview");
    expect(entryQuery).toContain("大学生研究计划");
    // Entry queries carry no org segment.
    expect(entryQuery).not.toContain("teach.ustc.edu.cn");
  });

  test("supplementalSources excludes public sources already on the candidate", () => {
    const advisorItem = item("zhuoran-song");
    const candidate = advisorItem.candidate;
    if (!candidate) throw new Error("advisor item lacks candidate");
    const extraSource: SourceSnapshot = {
      url: "https://example.org/extra-reading",
      title: "补充阅读",
      content: "用户另存的页面内容。",
      collectedAt: "2026-10-10T10:00:00.000Z",
      kind: "live",
    };
    const topic = {
      id: "topic-1",
      name: "探索",
      question: "",
      preferences: "",
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
      candidates: [
        {
          candidate: {
            ...candidate,
            sources: [...candidate.sources, extraSource],
          },
          reason: "",
          questions: [],
          savedAt: "2026-10-01T00:00:00.000Z",
        },
      ],
      opportunities: [],
    };
    const extra = supplementalSources(advisorItem, topic);
    expect(extra).toHaveLength(1);
    expect(extra[0].url).toBe("https://example.org/extra-reading");

    // Without the extra save there is nothing beyond the public sources.
    expect(supplementalSources(advisorItem)).toHaveLength(0);
  });

  test("supplementalSources returns the topic record's sources for entries", () => {
    const entryItem = item("ustc-research-plan");
    const savedSource: SourceSnapshot = {
      url: "https://example.org/entry-note",
      title: "条目笔记",
      content: "用户为这个条目另存的页面。",
      collectedAt: "2026-10-11T10:00:00.000Z",
      kind: "live",
    };
    const topic = {
      id: "topic-1",
      name: "探索",
      question: "",
      preferences: "",
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
      candidates: [],
      opportunities: [
        {
          opportunity: {
            opportunityId: entryItem.id,
            name: entryItem.name,
            types: entryItem.types,
            period: entryItem.period,
            summary: entryItem.summary,
            entryUrl: entryItem.entryUrl,
            checkedAt: entryItem.latestAt,
          },
          reason: "",
          questions: [],
          savedAt: "2026-10-01T00:00:00.000Z",
          sources: [savedSource],
        },
      ],
    };
    const extra = supplementalSources(entryItem, topic);
    expect(extra).toHaveLength(1);
    expect(extra[0].url).toBe("https://example.org/entry-note");
  });

  test("defaultPerspective is the first listed perspective per kind", () => {
    expect(defaultPerspective("advisor")).toBe("research");
    expect(defaultPerspective("internship")).toBe("role");
    expect(defaultPerspective("entry")).toBe("overview");
  });
});
