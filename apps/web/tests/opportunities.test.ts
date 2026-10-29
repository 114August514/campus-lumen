import { describe, expect, test } from "bun:test";
import {
  opportunities,
  opportunityTypeText,
  opportunityTypes,
} from "../src/lib/opportunities";

describe("opportunity data", () => {
  test("every item has a unique id, a type, an https entry and a check date", () => {
    expect(new Set(opportunities.map((item) => item.id)).size).toBe(
      opportunities.length,
    );
    for (const item of opportunities) {
      expect(item.types.length).toBeGreaterThan(0);
      expect(item.types.every((type) => type in opportunityTypeText)).toBe(true);
      expect(new URL(item.entry.url).protocol).toBe("https:");
      expect(item.entry.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test("ended batches say what must not be inferred", () => {
    const ended = opportunities.filter((item) => item.timing === "historical");
    expect(ended.length).toBeGreaterThan(0);
    for (const item of ended) expect(item.caveat.trim().length).toBeGreaterThan(0);
  });

  test("every type has at least one entry", () => {
    for (const type of opportunityTypes) {
      expect(opportunities.some((item) => item.types.includes(type))).toBe(true);
    }
  });
});
