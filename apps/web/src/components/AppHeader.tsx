import {
  BookIcon,
  CommentDiscussionIcon,
  GitCompareIcon,
  HomeIcon,
  MoonIcon,
  PlusIcon,
  SearchIcon,
  SunIcon,
  ThreeBarsIcon,
} from "@primer/octicons-react";
import {
  ActionList,
  ActionMenu,
  Button,
  CounterLabel,
  IconButton,
  Link,
  Stack,
  Text,
  UnderlineNav,
} from "@primer/react";
import { Hidden } from "@primer/react/experimental";
import { type Route, go, routeHref } from "../app/router";
import brandMark from "../assets/campus-lumen-mark.svg";
import { byRecency, useAppState } from "../state/app-state";

const navItems = [
  { id: "home", label: "首页", icon: HomeIcon, route: { name: "home" } as Route },
  {
    id: "explore",
    label: "探索",
    icon: SearchIcon,
    route: { name: "explore", stage: "explore" } as Route,
  },
  {
    id: "library",
    label: "资料库",
    icon: BookIcon,
    route: { name: "library" } as Route,
  },
  {
    id: "sessions",
    label: "我的探索",
    icon: CommentDiscussionIcon,
    route: { name: "sessions" } as Route,
  },
] as const;

function sectionOf(route: Route): (typeof navItems)[number]["id"] | null {
  if (route.name === "home") return "home";
  if (route.name === "explore") return "explore";
  if (route.name === "library" || route.name === "item") return "library";
  if (route.name === "sessions") return "sessions";
  return null;
}

export function AppHeader({
  route,
  colorMode,
  onToggleColorMode,
}: {
  route: Route;
  colorMode: "day" | "night";
  onToggleColorMode: () => void;
}) {
  const { topics, topic, selectTopic, tray } = useAppState();
  const active = sectionOf(route);
  const exploreRoute = (id: string): Route => ({
    name: "explore",
    sessionId: id || undefined,
    stage: "explore",
  });
  const recent = byRecency(topics).slice(0, 6);

  return (
    <Stack as="header" gap="condensed" padding="normal">
      <Stack
        direction="horizontal"
        align="center"
        justify="space-between"
        wrap="nowrap"
      >
        <Link href={routeHref({ name: "home" })} muted aria-label="Campus Lumen 首页">
          <Stack direction="horizontal" gap="condensed" align="center">
            <img src={brandMark} alt="" width={28} height={28} />
            <Text weight="semibold" size="large">
              Campus Lumen
            </Text>
          </Stack>
        </Link>
        <Stack direction="horizontal" gap="condensed" align="center">
          <Button
            leadingVisual={GitCompareIcon}
            trailingVisual={
              tray.ids.length
                ? () => <CounterLabel>{tray.ids.length}</CounterLabel>
                : undefined
            }
            onClick={() => go({ name: "compare", ids: tray.ids })}
            aria-label={`比较，已选 ${tray.ids.length} 个`}
          >
            <Hidden when="narrow">比较</Hidden>
          </Button>
          <ActionMenu>
            <ActionMenu.Button aria-label="切换当前探索">
              <Hidden when="narrow">
                {topic ? `当前：${topic.name}` : "未保存的探索"}
              </Hidden>
              <Hidden when={["regular", "wide"]}>探索</Hidden>
            </ActionMenu.Button>
            <ActionMenu.Overlay width="medium">
              <ActionList selectionVariant="single" aria-label="探索会话">
                <ActionList.Group>
                  <ActionList.GroupHeading>最近的探索</ActionList.GroupHeading>
                  {recent.map((item) => (
                    <ActionList.Item
                      key={item.id}
                      selected={item.id === topic?.id}
                      onSelect={() => {
                        selectTopic(item.id);
                        go(exploreRoute(item.id));
                      }}
                    >
                      {item.name}
                      <ActionList.Description variant="block">
                        {item.question || "尚未填写问题"}
                      </ActionList.Description>
                    </ActionList.Item>
                  ))}
                  <ActionList.Item
                    selected={!topic}
                    onSelect={() => {
                      selectTopic("");
                      go(exploreRoute(""));
                    }}
                  >
                    暂不保存（临时探索）
                  </ActionList.Item>
                </ActionList.Group>
                <ActionList.Divider />
                <ActionList.Item
                  onSelect={() => {
                    selectTopic("");
                    go({ name: "explore", stage: "explore" });
                  }}
                >
                  <ActionList.LeadingVisual>
                    <PlusIcon />
                  </ActionList.LeadingVisual>
                  新的探索
                </ActionList.Item>
                <ActionList.LinkItem href={routeHref({ name: "sessions" })}>
                  全部探索
                </ActionList.LinkItem>
              </ActionList>
            </ActionMenu.Overlay>
          </ActionMenu>
          <IconButton
            icon={colorMode === "day" ? MoonIcon : SunIcon}
            aria-label={colorMode === "day" ? "切换到深色模式" : "切换到浅色模式"}
            onClick={onToggleColorMode}
          />
          <Hidden when={["regular", "wide"]}>
            <ActionMenu>
              <ActionMenu.Anchor>
                <IconButton icon={ThreeBarsIcon} aria-label="打开导航" />
              </ActionMenu.Anchor>
              <ActionMenu.Overlay>
                <ActionList aria-label="主要导航">
                  {navItems.map((item) => (
                    <ActionList.LinkItem
                      key={item.id}
                      href={routeHref(item.route)}
                      active={active === item.id}
                    >
                      <ActionList.LeadingVisual>
                        <item.icon />
                      </ActionList.LeadingVisual>
                      {item.label}
                    </ActionList.LinkItem>
                  ))}
                </ActionList>
              </ActionMenu.Overlay>
            </ActionMenu>
          </Hidden>
        </Stack>
      </Stack>
      <Hidden when="narrow">
        <UnderlineNav aria-label="主要导航">
          {navItems.map((item) => (
            <UnderlineNav.Item
              key={item.id}
              href={routeHref(
                item.id === "explore" ? exploreRoute(topic?.id ?? "") : item.route,
              )}
              icon={item.icon}
              aria-current={active === item.id ? "page" : undefined}
              counter={item.id === "sessions" ? topics.length || undefined : undefined}
            >
              {item.label}
            </UnderlineNav.Item>
          ))}
        </UnderlineNav>
      </Hidden>
    </Stack>
  );
}
