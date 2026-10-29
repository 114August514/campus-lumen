import { describe, expect, test } from "bun:test";
import {
  type CatalogItem,
  type SessionRecord,
  catalog,
  findItem,
  isSaved,
  searchCatalog,
  sessionRecords,
  toSaveTarget,
  typeCounts,
} from "../src/lib/catalog";
import type {
  CandidateSnapshot,
  ExplorationTopic,
  TopicOpportunity,
} from "../src/lib/exploration-store";

function candidateSnapshot(candidateId: string, name: string): CandidateSnapshot {
  return {
    candidateId,
    name,
    institution: "Example University",
    research: "Example research direction",
    sources: [
      {
        url: `https://example.org/${candidateId}`,
        title: `${name} overview`,
        content: "Collected summary of the candidate's public page.",
        collectedAt: "2026-10-01T10:00:00.000Z",
        kind: "snapshot",
      },
    ],
  };
}

function topicWithCandidate(
  candidate: CandidateSnapshot,
  extra: Partial<ExplorationTopic> = {},
): ExplorationTopic {
  return {
    id: "topic-1",
    name: "探索",
    question: "",
    preferences: "",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    candidates: [
      {
        candidate,
        reason: "私人理由",
        questions: [],
        savedAt: "2026-10-01T00:00:00.000Z",
      },
    ],
    opportunities: [],
    ...extra,
  };
}

describe("catalog", () => {
  test("findItem never returns another topic's saved object", () => {
    const privateCandidate = candidateSnapshot(
      "external:only-in-other-topic",
      "只在另一主题保存的人",
    );
    const otherTopic = topicWithCandidate(privateCandidate);
    const mine: ExplorationTopic = {
      ...topicWithCandidate(candidateSnapshot("mine-1", "我的人")),
      id: "topic-2",
    };

    // The other topic can resolve its own saved object…
    expect(findItem(privateCandidate.candidateId, otherTopic)?.name).toBe(
      "只在另一主题保存的人",
    );
    // …but this topic cannot, and neither can the public catalog on its own.
    expect(findItem(privateCandidate.candidateId, mine)).toBeUndefined();
    expect(findItem(privateCandidate.candidateId)).toBeUndefined();
  });

  test("findItem does not resolve a pending-association record", () => {
    const pending = candidateSnapshot("pending-split", "待确认的人");
    const topic = topicWithCandidate(pending, {
      candidates: [
        {
          candidate: pending,
          reason: "",
          questions: [],
          savedAt: "2026-10-01T00:00:00.000Z",
          association: {
            correctionId: "corr-1",
            status: "pending",
            previous: {
              candidateId: "pending-split",
              name: "拆分前的人",
              institution: "Example University",
            },
            options: [
              {
                candidateId: "split-a",
                name: "拆分后甲",
                institution: "Example University",
              },
            ],
            updatedAt: "2026-10-02T00:00:00.000Z",
          },
        },
      ],
    });

    expect(findItem("pending-split", topic)).toBeUndefined();
    const records: SessionRecord[] = sessionRecords(topic);
    expect(records).toHaveLength(1);
    expect(records[0].pendingAssociation).toBe(true);
  });

  test("catalog data wins over a saved snapshot with the same id", () => {
    const catalogItem = catalog.find((item) => item.kind === "advisor");
    expect(catalogItem).toBeDefined();
    if (!catalogItem) return;
    // A stale snapshot with the same id but different public fields.
    const stale = candidateSnapshot(catalogItem.id, "旧快照名字");
    const topic = topicWithCandidate(stale);

    const resolved = findItem(catalogItem.id, topic);
    expect(resolved?.origin).toBe("catalog");
    expect(resolved?.name).toBe(catalogItem.name);
    expect(resolved?.name).not.toBe("旧快照名字");
  });

  test("searchCatalog filters by type", () => {
    const all = searchCatalog({});
    expect(all.length).toBe(catalog.length);

    const internships = searchCatalog({ types: ["internship"] });
    expect(internships.length).toBeGreaterThan(0);
    expect(internships.every((item) => item.types.includes("internship"))).toBe(true);
    // Advisors without an internship type must be excluded.
    expect(
      internships.some(
        (item) => item.kind === "advisor" && !item.types.includes("internship"),
      ),
    ).toBe(false);

    const competitions = searchCatalog({ types: ["competition"] });
    expect(competitions.every((item) => item.types.includes("competition"))).toBe(true);
    expect(competitions.some((item) => item.types.includes("competition"))).toBe(true);
  });

  test("searchCatalog hideHistorical drops ended batches only", () => {
    const visible = searchCatalog({ hideHistorical: true });
    expect(visible.every((item) => item.timing !== "historical")).toBe(true);
    const historical = catalog.filter((item) => item.timing === "historical");
    expect(historical.length).toBeGreaterThan(0);
    expect(visible.length).toBe(catalog.length - historical.length);
  });

  test("mixed-language query ranks a matching advisor; unrelated query returns nothing", () => {
    const results = searchCatalog({ text: "GPU 加速" });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe("宋卓然");
    expect(results[0].id).toBe("zhuoran-song");

    const unrelated = searchCatalog({ text: "古典文学考古" });
    expect(unrelated).toHaveLength(0);
  });

  test("toSaveTarget keeps candidate snapshots and maps entries to opportunity snapshots", () => {
    const advisor = catalog.find((item) => item.kind === "advisor");
    const entry = catalog.find((item) => item.kind === "entry");
    expect(advisor?.candidate).toBeDefined();
    expect(entry?.entry).toBeDefined();
    if (!advisor || !entry) return;

    const advisorTarget = toSaveTarget(advisor);
    expect(advisorTarget.kind).toBe("candidate");
    if (advisorTarget.kind !== "candidate") return;
    expect(advisorTarget.snapshot.candidateId).toBe(advisor.id);
    expect(advisorTarget.snapshot.name).toBe(advisor.name);

    const entryTarget = toSaveTarget(entry);
    expect(entryTarget.kind).toBe("opportunity");
    if (entryTarget.kind !== "opportunity") return;
    expect(entryTarget.snapshot.opportunityId).toBe(entry.id);
    expect(entryTarget.snapshot.entryUrl).toBe(entry.entryUrl);
    expect(entryTarget.snapshot.types).toEqual(entry.types);
  });

  test("isSaved only checks the given topic's records", () => {
    const item = catalog.find((entry) => entry.kind === "advisor");
    if (!item) return;
    const mine = topicWithCandidate(candidateSnapshot(item.id, item.name));
    const other: ExplorationTopic = {
      ...topicWithCandidate(candidateSnapshot(item.id, item.name)),
      id: "topic-other",
    };
    expect(isSaved(mine, item)).toBe(true);
    expect(isSaved(other, item)).toBe(true);
    const empty: ExplorationTopic = {
      ...mine,
      id: "topic-empty",
      candidates: [],
      opportunities: [],
    };
    expect(isSaved(empty, item)).toBe(false);
    expect(isSaved(undefined, item)).toBe(false);
  });

  test("typeCounts totals each item under every type it carries", () => {
    const counts = typeCounts();
    const expected = catalog.reduce((sum, item) => sum + item.types.length, 0);
    expect(Object.values(counts).reduce((sum, n) => sum + n, 0)).toBe(expected);
    const internshipCount = catalog.filter((item) =>
      item.types.includes("internship"),
    ).length;
    expect(counts.internship).toBe(internshipCount);
  });

  test("sessionRecords resolves saved entries through the catalog when present", () => {
    const entryItem = catalog.find((item) => item.kind === "entry");
    if (!entryItem) return;
    const record: TopicOpportunity = {
      opportunity: {
        opportunityId: entryItem.id,
        name: "旧名字",
        types: entryItem.types,
        period: entryItem.period,
        summary: "旧摘要",
        entryUrl: entryItem.entryUrl,
        checkedAt: entryItem.latestAt,
      },
      reason: "保存的理由",
      questions: ["保存的问题"],
      savedAt: "2026-10-03T00:00:00.000Z",
    };
    const topic: ExplorationTopic = {
      id: "topic-entries",
      name: "机会",
      question: "",
      preferences: "",
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
      candidates: [],
      opportunities: [record],
    };
    const records = sessionRecords(topic);
    expect(records).toHaveLength(1);
    expect(records[0].item.origin).toBe("catalog");
    expect(records[0].item.name).toBe(entryItem.name);
    expect(records[0].reason).toBe("保存的理由");
    expect(records[0].recordKind).toBe("opportunity");
  });

  test("a saved entry missing from the catalog is rebuilt from its snapshot", () => {
    const record: TopicOpportunity = {
      opportunity: {
        opportunityId: "gone-entry",
        name: "已下架的机会",
        types: ["activity"],
        period: "2025 年",
        summary: "摘要",
        entryUrl: "https://example.org/gone",
        checkedAt: "2026-09-01",
      },
      reason: "",
      questions: [],
      savedAt: "2026-10-01T00:00:00.000Z",
    };
    const topic: ExplorationTopic = {
      id: "topic-gone",
      name: "机会",
      question: "",
      preferences: "",
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
      candidates: [],
      opportunities: [record],
    };
    const resolved = findItem("gone-entry", topic);
    expect(resolved?.kind).toBe("entry");
    expect(resolved?.origin).toBe("saved-snapshot");
    expect(resolved?.name).toBe("已下架的机会");
    const items: CatalogItem[] = sessionRecords(topic).map((r) => r.item);
    expect(items[0].id).toBe("gone-entry");
  });
});
