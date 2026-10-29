import { Heading, PageLayout, Stack } from "@primer/react";
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { ThemeRoot } from "../components/ui/ThemeRoot";
import { WorkbenchPreview } from "./WorkbenchPreview";
import {
  type WorkbenchSelection,
  parseWorkbenchMessage,
  selectionFromSearch,
  workbenchNavigateMessage,
} from "./workbench-config";

function sameSelection(a: WorkbenchSelection, b: WorkbenchSelection): boolean {
  return a.screen === b.screen && a.candidateId === b.candidateId && a.pair === b.pair;
}

// Standalone canvas document used by the narrow-screen iframe and by
// "open in new window". Selection arrives via the URL on load and via
// postMessage afterwards; internal navigation is reported back to the shell.
function StandalonePreview() {
  const [selection, setSelection] = useState(() =>
    selectionFromSearch(window.location.search),
  );

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const message = parseWorkbenchMessage(event.data);
      if (message?.type === "selection") {
        setSelection((current) =>
          sameSelection(current, message.selection) ? current : message.selection,
        );
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <PageLayout containerWidth="large" padding="normal">
      <PageLayout.Header>
        <Stack gap="condensed">
          <Heading as="h1" variant="medium">
            界面预览画布
          </Heading>
        </Stack>
      </PageLayout.Header>
      <PageLayout.Content width="large">
        <WorkbenchPreview
          selection={selection}
          onNavigate={(next) => {
            setSelection(next);
            if (window.parent !== window) {
              window.parent.postMessage(
                workbenchNavigateMessage(next),
                window.location.origin,
              );
            }
          }}
        />
      </PageLayout.Content>
    </PageLayout>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeRoot>
      <StandalonePreview />
    </ThemeRoot>
  </React.StrictMode>,
);
