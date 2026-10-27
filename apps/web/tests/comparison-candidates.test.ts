import { describe, expect, test } from "bun:test";
import {
  buildComparisonRows,
  buildInternshipComparisonRows,
} from "../src/lib/advisor-comparison";
import { advisors } from "../src/lib/advisors";
import { comparisonCandidatesForTopic } from "../src/lib/comparison-candidates";
import { createExplorationStore } from "../src/lib/exploration-store";

function store() {
  let data: string | null = null;
  return createExplorationStore({
    getItem: () => data,
    setItem: (_, value) => {
      data = value;
    },
  });
}

describe("discovered candidates in comparison", () => {
  test("missing retained evidence does not turn supplied fields into verified facts", () => {
    const candidate = { ...advisors[0], candidateId: "external:missing", sources: [] };
    for (const row of buildComparisonRows([candidate], "graduate")) {
      expect(row.cells[0].text).toContain("暂不能确认");
      expect(row.cells[0].sources).toEqual([]);
    }
  });
  test("saved external evidence can be compared after reopening without crossing topics", () => {
    const saved = store();
    const a = saved.createTopic({ name: "A" });
    const b = saved.createTopic({ name: "B" });
    const candidate = {
      candidateId: "external:Example University:Ada",
      name: "Ada",
      institution: "Example University",
      research: "my supplied description",
      sources: [
        {
          url: "https://example.edu/lab",
          title: "Lab",
          content:
            "Our lab studies database reliability. Participation conditions depend on the current project.",
          collectedAt: "2026-10-27T00:00:00Z",
          kind: "live" as const,
        },
      ],
    };
    saved.saveCandidate(a.id, candidate, {
      reason: "private A",
      questions: ["private question"],
    });
    const before = saved.getTopic(a.id);
    const available = comparisonCandidatesForTopic(advisors, saved.getTopic(a.id));
    const external = available.find(
      (item) => item.candidateId === candidate.candidateId,
    );
    if (!external) throw new Error("Saved external candidate unavailable");
    const rows = buildComparisonRows([external], "graduate");
    expect(rows.find((row) => row.id === "research")?.cells[0].text).toContain(
      "database reliability",
    );
    expect(rows.find((row) => row.id === "research")?.cells[0].text).toContain(
      "未自动核实",
    );
    expect(rows.find((row) => row.id === "route")?.cells[0].text).toContain(
      "尚未结构化核实",
    );
    expect(JSON.stringify(rows)).not.toContain("private A");
    expect(JSON.stringify(rows)).not.toContain("private question");
    expect(
      comparisonCandidatesForTopic(advisors, saved.getTopic(b.id)).some(
        (item) => item.candidateId === candidate.candidateId,
      ),
    ).toBe(false);
    expect(saved.getTopic(a.id)).toEqual(before);
  });

  test("repeat evidence saving keeps one candidate and updates the comparison evidence", () => {
    const saved = store();
    const topic = saved.createTopic({ name: "internships" });
    const source = {
      url: "https://www.microsoft.com/en-us/research/opportunity/example",
      title: "Role",
      content: "A dated systems research internship description.",
      collectedAt: "2026-10-27T00:00:00Z",
      kind: "live" as const,
    };
    const candidate = {
      candidateId: "external:Lab:Intern",
      name: "Intern",
      institution: "Lab",
      research: "",
      type: "internship",
      sources: [source],
    };
    saved.saveCandidate(topic.id, candidate, { reason: "keep this private" });
    saved.saveCandidate(topic.id, candidate);
    const later = {
      ...source,
      content: "A later capture explicitly says at least three months.",
      collectedAt: "2026-10-27T01:00:00Z",
    };
    saved.saveCandidate(topic.id, { ...candidate, sources: [later] });
    const available = comparisonCandidatesForTopic([], saved.getTopic(topic.id));
    expect(available).toHaveLength(1);
    const cell = buildInternshipComparisonRows(available, "role")[0].cells[0];
    expect(cell.sources).toHaveLength(2);
    expect(cell.text).toContain("later capture");
    expect(saved.getTopic(topic.id)?.candidates[0].reason).toBe("keep this private");
  });
});
