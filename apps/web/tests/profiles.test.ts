import { describe, expect, test } from "bun:test";
import { advisors } from "../src/lib/advisors";
import { opportunities } from "../src/lib/opportunities";
import {
  type BoundClaim,
  type CandidateProfile,
  candidateProfiles,
  profileFor,
} from "../src/lib/profiles";

function boundClaims(profile: CandidateProfile): BoundClaim[] {
  return [
    profile.summary,
    ...profile.themes,
    ...(profile.methods ? [profile.methods] : []),
    ...profile.routes.flatMap((route) => [
      route.statusNote,
      ...route.conditions,
      ...(route.prerequisites ? [route.prerequisites] : []),
    ]),
    ...profile.beyond.records,
    ...profile.beyond.paths,
    ...profile.unknowns,
    ...profile.conflicts.flatMap((conflict) => conflict.versions),
    ...Object.values(profile.perspectiveNotes ?? {}).filter(
      (claim): claim is BoundClaim => claim !== undefined,
    ),
  ];
}

function textValues(profile: CandidateProfile): string[] {
  return [
    profile.candidateId,
    ...boundClaims(profile).map((claim) => claim.text),
    ...profile.routes.flatMap((route) => [route.kind, route.label, route.status]),
    profile.beyond.gap,
    ...profile.beyond.records.flatMap((record) => [record.role, record.period]),
    ...profile.beyond.askList,
    ...profile.preparation.flatMap((item) => [item.text, item.reason, item.origin]),
    ...profile.conflicts.map((conflict) => conflict.topic),
  ];
}

describe("source-bound candidate profiles", () => {
  test("every advisor has exactly one profile", () => {
    const advisorIds = advisors.map((advisor) => advisor.candidateId).sort();
    expect(Object.keys(candidateProfiles).sort()).toEqual(advisorIds);

    for (const advisor of advisors) {
      const profile = profileFor(advisor.candidateId);
      expect(profile?.candidateId).toBe(advisor.candidateId);
    }
    expect(profileFor("missing-candidate")).toBeUndefined();
  });

  test("every claim and preparation link belongs to that candidate's sources", () => {
    for (const advisor of advisors) {
      const profile = candidateProfiles[advisor.candidateId];
      const allowedUrls = new Set(advisor.sources.map((source) => source.url));
      const usedUrls = [
        ...boundClaims(profile).flatMap((claim) => claim.urls),
        ...profile.preparation.flatMap((item) => item.urls),
      ];

      expect(allowedUrls.size).toBeGreaterThan(0);
      expect(usedUrls.length).toBeGreaterThan(0);
      for (const url of usedUrls) {
        expect(allowedUrls.has(url)).toBe(true);
      }
    }
  });

  test("every linked preparation resource exists", () => {
    const opportunityIds = new Set(opportunities.map((item) => item.id));

    for (const profile of Object.values(candidateProfiles)) {
      for (const item of profile.preparation) {
        for (const resourceId of item.resourceIds ?? []) {
          expect(opportunityIds.has(resourceId)).toBe(true);
        }
      }
    }
  });

  test("all authored text is non-empty", () => {
    for (const profile of Object.values(candidateProfiles)) {
      for (const value of textValues(profile)) {
        expect(value.trim().length).toBeGreaterThan(0);
      }
    }
  });

  test("evidenced routes and required conditions carry source URLs", () => {
    for (const profile of Object.values(candidateProfiles)) {
      for (const route of profile.routes) {
        if (route.status === "evidenced") {
          expect(route.statusNote.urls.length).toBeGreaterThan(0);
        }
        for (const condition of route.conditions) {
          if (condition.level === "required") {
            expect(condition.urls.length).toBeGreaterThan(0);
          }
        }
      }
    }
  });
});
