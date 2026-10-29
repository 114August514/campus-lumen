import { describe, expect, test } from "bun:test";
import { parseRoute, routeHref } from "../src/app/router";
import type { Route } from "../src/app/router";

const routes: Route[] = [
  { name: "home" },
  { name: "explore", stage: "explore" },
  { name: "explore", sessionId: "session-42", stage: "discover" },
  { name: "explore", sessionId: "session-42", stage: "process", q: "GPU 加速" },
  { name: "explore", stage: "explore", q: "量子 计算" },
  { name: "library" },
  { name: "library", q: "暑期研究" },
  { name: "library", q: "暑期研究", type: "research" },
  { name: "item", id: "zhuoran-song" },
  { name: "item", id: "ustc-research-plan" },
  { name: "compare", ids: ["zhuoran-song", "wang-xiang"] },
  { name: "compare", ids: ["zhuoran-song"], perspective: "research" },
  { name: "sessions" },
  { name: "demo" },
];

describe("router", () => {
  test.each(routes.map((route) => [routeHref(route), route] as const))(
    "parseRoute round-trips %s",
    (href, route) => {
      expect(parseRoute(href)).toEqual(route);
    },
  );

  test("parseRoute(routeHref(r)) round-trips a Chinese query", () => {
    const route: Route = { name: "explore", stage: "discover", q: "GPU 加速 科研" };
    expect(parseRoute(routeHref(route))).toEqual(route);
  });

  test("compare ids round-trip as a comma-separated list", () => {
    const route: Route = {
      name: "compare",
      ids: ["zhuoran-song", "wang-xiang", "xiong-yingfei"],
      perspective: "graduate",
    };
    const parsed = parseRoute(routeHref(route));
    expect(parsed).toEqual(route);
    if (parsed.name === "compare") {
      expect(parsed.ids).toEqual(["zhuoran-song", "wang-xiang", "xiong-yingfei"]);
    }
    expect(routeHref(route)).toContain("ids=zhuoran-song%2Cwang-xiang%2Cxiong-yingfei");
  });

  test.each(["", "#", "#/unknown", "#/nope/deeper", "#/?q=x"])(
    "unknown hash %s routes home",
    (hash) => {
      expect(parseRoute(hash)).toEqual({ name: "home" });
    },
  );

  test.each(["#/explore?stage=bogus", "#/explore?stage="])(
    "invalid stage in %s falls back to explore",
    (hash) => {
      const parsed = parseRoute(hash);
      expect(parsed).toEqual({
        name: "explore",
        sessionId: undefined,
        stage: "explore",
        q: undefined,
      });
    },
  );

  test("invalid stage keeps the session id", () => {
    expect(parseRoute("#/explore/s1?stage=nope")).toEqual({
      name: "explore",
      sessionId: "s1",
      stage: "explore",
      q: undefined,
    });
  });

  test("explore stage is omitted from the href for the default stage", () => {
    expect(routeHref({ name: "explore", stage: "explore" })).toBe("#/explore");
    expect(routeHref({ name: "explore", stage: "discover" })).toBe(
      "#/explore?stage=discover",
    );
  });

  test("item without an id falls back to the library", () => {
    expect(parseRoute("#/item")).toEqual({ name: "library" });
    expect(parseRoute("#/item/")).toEqual({ name: "library" });
  });

  test("compare with an empty ids param parses as an empty list", () => {
    const parsed = parseRoute("#/compare");
    expect(parsed).toEqual({ name: "compare", ids: [], perspective: undefined });
  });
});
