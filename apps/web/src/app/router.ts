// Hash routes: every view has a URL, so back/forward, reload and deep links work
// without a routing dependency or server configuration.
import { useEffect, useState } from "react";
import type { SessionStage } from "../lib/exploration-store";

export type Route =
  | { name: "home" }
  | { name: "explore"; sessionId?: string; stage: SessionStage; q?: string }
  | { name: "library"; q?: string; type?: string }
  | { name: "item"; id: string }
  | { name: "compare"; ids: string[]; perspective?: string }
  | { name: "sessions" }
  | { name: "demo" };

const stages: SessionStage[] = ["explore", "discover", "process"];

export function parseRoute(hash: string): Route {
  const raw = hash.replace(/^#/, "");
  const [pathPart, queryPart = ""] = raw.split("?");
  const segments = pathPart.split("/").filter(Boolean).map(decodeURIComponent);
  const params = new URLSearchParams(queryPart);
  const text = (key: string) => params.get(key)?.trim() || undefined;
  switch (segments[0]) {
    case "explore": {
      const stage = params.get("stage") as SessionStage | null;
      return {
        name: "explore",
        sessionId: segments[1],
        stage: stage && stages.includes(stage) ? stage : "explore",
        q: text("q"),
      };
    }
    case "library":
      return { name: "library", q: text("q"), type: text("type") };
    case "item":
      return segments[1] ? { name: "item", id: segments[1] } : { name: "library" };
    case "compare":
      return {
        name: "compare",
        ids: (params.get("ids") ?? "")
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean),
        perspective: text("p"),
      };
    case "sessions":
      return { name: "sessions" };
    case "demo":
      return { name: "demo" };
    default:
      return { name: "home" };
  }
}

export function routeHref(route: Route): string {
  const query = (entries: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(entries))
      if (value) params.set(key, value);
    const encoded = params.toString();
    return encoded ? `?${encoded}` : "";
  };
  switch (route.name) {
    case "home":
      return "#/";
    case "explore":
      return `#/explore${route.sessionId ? `/${encodeURIComponent(route.sessionId)}` : ""}${query(
        {
          stage: route.stage === "explore" ? undefined : route.stage,
          q: route.q,
        },
      )}`;
    case "library":
      return `#/library${query({ q: route.q, type: route.type })}`;
    case "item":
      return `#/item/${encodeURIComponent(route.id)}`;
    case "compare":
      return `#/compare${query({ ids: route.ids.join(","), p: route.perspective })}`;
    case "sessions":
      return "#/sessions";
    case "demo":
      return "#/demo";
  }
}

export function go(route: Route, options: { replace?: boolean } = {}) {
  const href = routeHref(route);
  if (options.replace) {
    window.history.replaceState(null, "", href);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = href;
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const update = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return route;
}
