import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeRoot } from "../components/ui/ThemeRoot";
import { WorkbenchShell } from "./WorkbenchShell";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeRoot>
      <WorkbenchShell />
    </ThemeRoot>
  </React.StrictMode>,
);
