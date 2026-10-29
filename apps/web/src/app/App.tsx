import { Banner, Link, PageLayout, Spinner, Stack, Text } from "@primer/react";
import { Suspense, lazy, useEffect } from "react";
import { AppHeader } from "../components/AppHeader";
import { useAppState } from "../state/app-state";
import { routeHref, useRoute } from "./router";

const HomePage = lazy(() => import("../pages/HomePage"));
const ExplorePage = lazy(() => import("../pages/ExplorePage"));
const LibraryPage = lazy(() => import("../pages/LibraryPage"));
const ItemPage = lazy(() => import("../pages/ItemPage"));
const ComparePage = lazy(() => import("../pages/ComparePage"));
const SessionsPage = lazy(() => import("../pages/SessionsPage"));
const DemoGuidePage = lazy(() => import("../pages/DemoGuidePage"));

export function App({
  colorMode,
  onToggleColorMode,
}: {
  colorMode: "day" | "night";
  onToggleColorMode: () => void;
}) {
  const route = useRoute();
  const { message, setMessage, clearStaleMessage, storageError } = useAppState();

  // Each view starts at the top, like following a link; messages belong to one view.
  // biome-ignore lint/correctness/useExhaustiveDependencies: run on every route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.name]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: run on every route change
  useEffect(() => {
    clearStaleMessage();
  }, [route]);

  return (
    <PageLayout containerWidth="xlarge" padding="none" rowGap="none">
      <PageLayout.Header divider="line" padding="none">
        <AppHeader
          route={route}
          colorMode={colorMode}
          onToggleColorMode={onToggleColorMode}
        />
      </PageLayout.Header>
      <PageLayout.Content as="main" padding="normal" width="full">
        <Stack gap="normal">
          {storageError && (
            <Banner
              variant="warning"
              title="本地保存不可用"
              description={storageError}
            />
          )}
          {message && (
            <Banner
              variant={
                message.tone === "critical"
                  ? "critical"
                  : message.tone === "success"
                    ? "success"
                    : "info"
              }
              title={
                message.tone === "critical"
                  ? "操作未完成"
                  : message.tone === "success"
                    ? "已完成"
                    : "提示"
              }
              description={message.text}
              onDismiss={() => setMessage(null)}
            />
          )}
          <Suspense
            fallback={
              <Stack direction="horizontal" gap="condensed" align="center">
                <Spinner size="small" />
                <Text>正在打开页面</Text>
              </Stack>
            }
          >
            {route.name === "home" && <HomePage />}
            {route.name === "explore" && <ExplorePage route={route} />}
            {route.name === "library" && <LibraryPage route={route} />}
            {route.name === "item" && <ItemPage id={route.id} />}
            {route.name === "compare" && <ComparePage route={route} />}
            {route.name === "sessions" && <SessionsPage />}
            {route.name === "demo" && <DemoGuidePage />}
          </Suspense>
        </Stack>
      </PageLayout.Content>
      <PageLayout.Footer divider="line" padding="normal">
        <Stack
          direction={{ narrow: "vertical", regular: "horizontal" }}
          gap="condensed"
          justify="space-between"
        >
          <Text size="small">
            信息以原站为准；探索记录只保存在本浏览器，不会自动发送给任何服务。
          </Text>
          <Link href={routeHref({ name: "demo" })}>演示路线</Link>
        </Stack>
      </PageLayout.Footer>
    </PageLayout>
  );
}
