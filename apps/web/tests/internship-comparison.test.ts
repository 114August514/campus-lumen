import { describe, expect, test } from "bun:test";
import {
  buildInternshipComparisonRows,
  buildInternshipFocusHints,
  internshipComparisonSupportedCandidateIds,
  isInternshipComparison,
} from "../src/lib/advisor-comparison";
import { internships } from "../src/lib/advisors";
import { opportunities } from "../src/lib/opportunities";

const candidates = internshipComparisonSupportedCandidateIds.map((id) => {
  const item = internships.find((entry) => entry.candidateId === id);
  if (!item) throw new Error(`Missing collected internship: ${id}`);
  return item;
});

describe("internship evidence and unresolved conditions", () => {
  test("classifies internship comparison without requiring a curated profile", () => {
    expect(isInternshipComparison(candidates)).toBe(true);
    expect(isInternshipComparison([])).toBe(false);
    expect(
      isInternshipComparison([{ ...candidates[0], candidateId: "external:other" }]),
    ).toBe(true);
  });

  test("conflicting MSRA conditions remain unresolved consistently across detail, entry and comparison", () => {
    const msra = candidates.find((item) => item.candidateId === "msra-systems-intern");
    if (!msra) throw new Error("Missing MSRA candidate");
    const entry = opportunities.find((item) => item.id === msra.candidateId);
    if (!entry) throw new Error("Missing MSRA entry");
    const routes = buildInternshipComparisonRows([msra], "practical").find(
      (row) => row.id === "route",
    )?.cells[0];
    if (!routes) throw new Error("Missing route comparison");
    expect(routes.text).toBe(msra.participation);
    expect(entry.conditions).toBe(msra.participation);
    expect(entry.timing).toBe("unknown");
    expect(routes.text).toContain("说法冲突");
    expect(routes.text).not.toContain("要求每周现场至少 4 天");
    expect(routes.text).not.toContain("地点在北京");
    const growth = buildInternshipComparisonRows([msra], "growth");
    expect(JSON.stringify(growth)).not.toContain("通常通过校招实习生绿色通道");
    expect(JSON.stringify(growth)).not.toContain("一对一 Mentor");
  });

  test("all internship views bind only their own retained sources and do not claim current openings", () => {
    for (const candidate of internships) {
      for (const row of buildInternshipComparisonRows([candidate], "practical")) {
        expect(row.cells[0].sources).toEqual(candidate.sources);
      }
      expect(candidate.metadata?.verificationStatus).toBe("needs-review");
      const entryId =
        candidate.candidateId === "bytedance-ai-systems-intern"
          ? "bytedance-ai-lab-intern"
          : candidate.candidateId;
      expect(opportunities.find((item) => item.id === entryId)?.timing).toBe("unknown");
    }
  });

  test("focus advice is optional and does not add quality endorsements", () => {
    expect(buildInternshipFocusHints(candidates, "open")).toEqual([]);
    const before = structuredClone(candidates);
    for (const cell of buildInternshipFocusHints(candidates, "systems")) {
      expect(cell.text).toContain("核对已读材料");
      expect(cell.text).not.toContain("顶尖");
    }
    expect(candidates).toEqual(before);
  });
});
