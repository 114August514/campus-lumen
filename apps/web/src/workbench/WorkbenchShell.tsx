// Dev-only workbench shell: screen/content selection, viewport switching and
// the canvas hosting the real product components. Served by Vite in local
// development only; it is not part of the product build or navigation.
import { BrowserIcon } from "@primer/octicons-react";
import {
  Banner,
  Button,
  FormControl,
  Heading,
  PageLayout,
  SegmentedControl,
  Select,
  Stack,
  Text,
} from "@primer/react";
import { useEffect, useRef, useState } from "react";
import { allOpportunities } from "../lib/advisors";
import { WorkbenchPreview } from "./WorkbenchPreview";
import {
  DEFAULT_WORKBENCH_SELECTION,
  type WorkbenchPair,
  type WorkbenchScreen,
  type WorkbenchSelection,
  parseWorkbenchMessage,
  searchFromSelection,
  workbenchSelectionMessage,
} from "./workbench-config";

type CanvasViewport = "desktop" | "narrow";

const screens: { id: WorkbenchScreen; label: string }[] = [
  { id: "home", label: "探索首页" },
  { id: "detail", label: "候选详情" },
  { id: "compare", label: "比较" },
];

export function WorkbenchShell() {
  const [selection, setSelection] = useState<WorkbenchSelection>(
    DEFAULT_WORKBENCH_SELECTION,
  );
  const [viewport, setViewport] = useState<CanvasViewport>("desktop");
  // The iframe keeps the document it mounted with; later selection changes go
  // through postMessage instead of navigating the frame. Re-entering narrow
  // mode remounts the canvas with the then-current selection, while the
  // new-window deep link always carries the live selection.
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const previewUrl = `workbench-preview.html?${searchFromSelection(selection)}`;

  function postSelection() {
    frameRef.current?.contentWindow?.postMessage(
      workbenchSelectionMessage(selection),
      window.location.origin,
    );
  }

  // The narrow canvas lives in an iframe (a real 390px viewport); selection
  // changes are pushed into it without reloading, preserving in-canvas state.
  // biome-ignore lint/correctness/useExhaustiveDependencies: postSelection reads current refs/state
  useEffect(() => {
    if (viewport === "narrow") postSelection();
  }, [selection, viewport]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const message = parseWorkbenchMessage(event.data);
      if (message?.type === "navigate") setSelection(message.selection);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <PageLayout containerWidth="large" padding="normal">
      <PageLayout.Header>
        <Stack gap="condensed">
          <Heading as="h1" variant="medium">
            界面开发工作台
          </Heading>
          <Banner
            variant="warning"
            layout="compact"
            title="本地开发工具：不随生产构建发布。画布复用正式页面的真实组件与仓库内置公开样例；保存只写入内存，不读取或修改浏览器中的探索记录，也不发起外部查找。修改 src 源码会经 Vite HMR 即时刷新画布。"
          />
        </Stack>
      </PageLayout.Header>
      <PageLayout.Content width="large">
        <Stack gap="spacious">
          <Stack as="section" gap="normal">
            <Heading as="h2" variant="small">
              预览内容
            </Heading>
            <Stack
              direction={{ narrow: "vertical", regular: "horizontal" }}
              gap="normal"
              align="end"
              wrap="wrap"
            >
              <SegmentedControl aria-label="选择预览界面">
                {screens.map((screen) => (
                  <SegmentedControl.Button
                    key={screen.id}
                    selected={selection.screen === screen.id}
                    onClick={() => setSelection({ ...selection, screen: screen.id })}
                  >
                    {screen.label}
                  </SegmentedControl.Button>
                ))}
              </SegmentedControl>
              {selection.screen === "detail" && (
                <FormControl>
                  <FormControl.Label>预览候选</FormControl.Label>
                  <Select
                    value={selection.candidateId}
                    onChange={(event) =>
                      setSelection({
                        ...selection,
                        candidateId: event.target.value,
                      })
                    }
                  >
                    {allOpportunities.map((item) => (
                      <Select.Option key={item.candidateId} value={item.candidateId}>
                        {item.name}（{item.institution}）
                      </Select.Option>
                    ))}
                  </Select>
                </FormControl>
              )}
              {selection.screen === "compare" && (
                <FormControl>
                  <FormControl.Label>比较组合</FormControl.Label>
                  <Select
                    value={selection.pair}
                    onChange={(event) =>
                      setSelection({
                        ...selection,
                        pair: event.target.value as WorkbenchPair,
                      })
                    }
                  >
                    <Select.Option value="advisors">
                      导师候选（江祖铭 / 宋卓然）
                    </Select.Option>
                    <Select.Option value="internships">
                      实习岗位（上海 AI 实验室 / MSRA）
                    </Select.Option>
                  </Select>
                </FormControl>
              )}
            </Stack>
          </Stack>
          <Stack as="section" gap="normal">
            <Heading as="h2" variant="small">
              画布
            </Heading>
            <Stack direction="horizontal" gap="normal" align="center" wrap="wrap">
              <SegmentedControl aria-label="预览视口宽度">
                <SegmentedControl.Button
                  selected={viewport === "desktop"}
                  onClick={() => setViewport("desktop")}
                >
                  桌面（当前窗口）
                </SegmentedControl.Button>
                <SegmentedControl.Button
                  selected={viewport === "narrow"}
                  onClick={() => {
                    setFrameUrl(previewUrl);
                    setViewport("narrow");
                  }}
                >
                  窄屏 390px
                </SegmentedControl.Button>
              </SegmentedControl>
              <Button
                leadingVisual={BrowserIcon}
                onClick={() =>
                  window.open(
                    previewUrl,
                    "campus-lumen-workbench-preview",
                    "width=390,height=844",
                  )
                }
              >
                在新窗口打开窄屏预览
              </Button>
            </Stack>
            <Text as="p" size="small">
              窄屏画布把预览渲染在 390px 宽的 iframe
              中，媒体查询与响应式组件属性按该视口生效；也可以用新窗口或浏览器实际窗口尺寸核对。桌面模式直接以当前窗口宽度渲染。
            </Text>
            {viewport === "desktop" ? (
              <WorkbenchPreview selection={selection} onNavigate={setSelection} />
            ) : frameUrl ? (
              <Stack align="center">
                <iframe
                  ref={frameRef}
                  src={frameUrl}
                  width={390}
                  height={844}
                  frameBorder={0}
                  onLoad={postSelection}
                  title="窄屏预览画布（390px 视口）"
                />
              </Stack>
            ) : null}
          </Stack>
        </Stack>
      </PageLayout.Content>
      <PageLayout.Footer>
        <Text as="p" size="small">
          访问方式：bun run dev:web 后打开 http://127.0.0.1:5173/workbench.html
          。正式入口不包含此工具。
        </Text>
      </PageLayout.Footer>
    </PageLayout>
  );
}
