import { describe, expect, test } from "bun:test";
import correctionFile from "../src/data/association-corrections.json";
import type { Advisor } from "../src/lib/advisors";
import {
  type AssociationCorrection,
  applyAssociationCorrections,
  parseAssociationCorrections,
  planAssociationRepairs,
} from "../src/lib/association-repair";
import { findItem, sessionRecords } from "../src/lib/catalog";
import { createExplorationStore } from "../src/lib/exploration-store";

// Synthetic objects only: two different people mistakenly merged under one id.
const A = "https://example.edu/lab-a";
const B = "https://example.org/people/b";

function merged(): Advisor {
  return {
    candidateId: "example:same-name",
    name: "张三",
    institution: "示例大学",
    research: "程序分析",
    approach: "合并时混入了两人的信息",
    participation: "本科科研说明来自 A 页",
    unknowns: "名额未知",
    sources: [A, B].map((url) => ({
      url,
      title: `来源 ${url}`,
      content: `来自 ${url} 的公开内容`,
      collectedAt: "2026-10-20T00:00:00.000Z",
      kind: "snapshot" as const,
    })),
  };
}

function split(overrides: Partial<AssociationCorrection> = {}): AssociationCorrection {
  return {
    correctionId: "split-zhang-san",
    decidedAt: "2026-10-27T00:00:00.000Z",
    reason: "两个来源分别属于不同学院的同名人物",
    fromCandidateId: "example:same-name",
    into: [
      {
        candidateId: "example:same-name",
        name: "张三",
        institution: "示例大学计算机学院",
        sourceUrls: [A],
      },
      {
        candidateId: "example:same-name-2",
        name: "张三",
        institution: "示例大学物理学院",
        research: "凝聚态物理",
        sourceUrls: [B],
      },
    ],
    ...overrides,
  };
}

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

function sourcesOnly(urls: string[]) {
  return merged().sources.filter((source) => urls.includes(source.url));
}

describe("public split", () => {
  test("assigns each source to exactly one object and records the correction", () => {
    const [a, b] = applyAssociationCorrections([merged()], [split()]);
    expect(a.sources.map((s) => s.url)).toEqual([A]);
    expect(a.approach).toBe("合并时混入了两人的信息");
    expect(b.sources.map((s) => s.url)).toEqual([B]);
    expect(b).toMatchObject({
      research: "凝聚态物理",
      approach: "",
      participation: "",
    });
    expect(b.correctionNote?.reason).toContain("同名人物");
  });

  test("rejects unassigned, duplicated, unknown or colliding sources", () => {
    const one = split();
    one.into[1].sourceUrls = ["https://example.org/elsewhere"];
    expect(() => applyAssociationCorrections([merged()], [one])).toThrow(
      "原对象中没有",
    );
    const twice = split();
    twice.into[1].sourceUrls = [A, B];
    expect(() => applyAssociationCorrections([merged()], [twice])).toThrow("多个对象");
    const missing = split();
    missing.into[1].sourceUrls = [];
    missing.into[0].sourceUrls = [A];
    expect(() => applyAssociationCorrections([merged()], [missing])).toThrow(
      "没有分配",
    );
    const other = { ...merged(), candidateId: "example:same-name-2", sources: [] };
    expect(() => applyAssociationCorrections([merged(), other], [split()])).toThrow(
      "已有对象重复",
    );
  });

  test("the correction file cannot carry private fields and the committed file parses", () => {
    expect(() =>
      parseAssociationCorrections({
        version: 1,
        corrections: [{ ...split(), reasonFromUser: "私人理由" }],
      }),
    ).toThrow("不能包含私人记录");
    expect(parseAssociationCorrections(correctionFile)).toEqual(expect.any(Array));
  });
});

describe("private records after a split", () => {
  function setup() {
    const storage = new MemoryStorage();
    const store = createExplorationStore(storage);
    const a = store.createTopic({ name: "主题A" });
    const b = store.createTopic({ name: "主题B" });
    const c = store.createTopic({ name: "主题C" });
    // A saved only page B; B saved both pages; C saved only page A.
    store.saveCandidate(
      a.id,
      { ...merged(), sources: sourcesOnly([B]) },
      {
        reason: "A的私人理由",
        questions: ["A的待问"],
      },
    );
    store.saveCandidate(b.id, merged(), { reason: "B的私人理由" });
    store.saveCandidate(
      c.id,
      { ...merged(), sources: sourcesOnly([A]) },
      {
        reason: "C的私人理由",
      },
    );
    return { storage, store, a, b, c };
  }

  test("re-points records whose sources identify one object; others wait for the user", () => {
    const { store, a, b, c } = setup();
    const plans = planAssociationRepairs(store.listTopics(), [split()]);
    expect(plans.map((p) => [p.topicId, p.kind])).toEqual([
      [a.id, "relink"],
      [b.id, "pending"],
    ]);
    expect(store.repairAssociations(plans)).toBe(2);

    const relinked = store.getTopic(a.id)?.candidates[0];
    expect(relinked).toMatchObject({
      candidate: {
        candidateId: "example:same-name-2",
        institution: "示例大学物理学院",
      },
      reason: "A的私人理由",
      questions: ["A的待问"],
      association: { status: "relinked", previous: { institution: "示例大学" } },
    });
    expect(relinked?.candidate.sources.map((s) => s.url)).toEqual([B]);

    const pending = store.getTopic(b.id)?.candidates[0];
    expect(pending?.association?.status).toBe("pending");
    expect(pending?.association?.options).toHaveLength(2);
    expect(pending?.candidate.sources).toHaveLength(2);
    // C already points at the object that kept the original id: untouched.
    expect(store.getTopic(c.id)?.candidates[0].association).toBeUndefined();
    // Running again changes nothing.
    expect(planAssociationRepairs(store.listTopics(), [split()])).toEqual([]);
  });

  test("the user resolves a pending record without copying the reason to the other object", () => {
    const { store, b } = setup();
    store.repairAssociations(planAssociationRepairs(store.listTopics(), [split()]));
    store.resolveAssociation(b.id, "example:same-name", {
      candidateId: "example:same-name-2",
      name: "张三",
      institution: "示例大学物理学院",
      research: "凝聚态物理",
    });
    const records = store.getTopic(b.id)?.candidates ?? [];
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      candidate: { candidateId: "example:same-name-2" },
      reason: "B的私人理由",
      association: { status: "chosen" },
    });
    expect(() =>
      store.resolveAssociation(b.id, "example:same-name-2", {
        candidateId: "example:same-name",
        name: "张三",
        institution: "示例大学计算机学院",
        research: "",
      }),
    ).toThrow("没有待确认");
  });

  test("a target already saved in the topic waits for the user instead of merging reasons", () => {
    const { store, a } = setup();
    store.saveCandidate(a.id, {
      candidateId: "example:same-name-2",
      name: "张三",
      institution: "示例大学物理学院",
      research: "",
      sources: [],
    });
    const plans = planAssociationRepairs(store.listTopics(), [split()]);
    expect(plans.find((p) => p.topicId === a.id)?.kind).toBe("pending");
    store.repairAssociations(plans);
    expect(() =>
      store.resolveAssociation(a.id, "example:same-name", {
        candidateId: "example:same-name-2",
        name: "张三",
        institution: "示例大学物理学院",
        research: "",
      }),
    ).toThrow("不会自动合并");
    expect(store.getTopic(a.id)?.candidates).toHaveLength(2);
  });

  test("a pending record does not enter comparison under its old merged identity", () => {
    const { store, b } = setup();
    store.repairAssociations(planAssociationRepairs(store.listTopics(), [split()]));
    const topic = store.getTopic(b.id);
    expect(findItem("example:same-name", topic)).toBeUndefined();
    const record = sessionRecords(topic).find(
      (entry) => entry.item.id === "example:same-name",
    );
    expect(record?.pendingAssociation).toBe(true);
  });
});
