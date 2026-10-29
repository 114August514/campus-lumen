import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import { type ColorMode, ThemeRoot } from "./components/ui/ThemeRoot";
import "./app/theme.css";

// Kept from the PR #15 frontend: the reader's appearance choice persists in
// this browser only. Historical key name retained for compatibility.
const THEME_KEY = "campus-agora.color-mode.v1";

function readColorMode(): ColorMode {
  try {
    return window.localStorage.getItem(THEME_KEY) === "night" ? "night" : "day";
  } catch {
    return "day";
  }
}

function AppRoot() {
  const [colorMode, setColorMode] = useState<ColorMode>(readColorMode);

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_KEY, colorMode);
    } catch {
      // Switching still works for this visit when browser storage is unavailable.
    }
  }, [colorMode]);

  return (
    <ThemeRoot colorMode={colorMode}>
      <App
        colorMode={colorMode}
        onToggleColorMode={() =>
          setColorMode((mode) => (mode === "day" ? "night" : "day"))
        }
      />
    </ThemeRoot>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>,
);
