// The single declarative theme configuration required by
// docs/product/ui-system.md, shared by the product entry and the dev
// workbench entries so all of them mount the exact same Primer setup.
// Light is the default; the product entry restores the PR #15 day/night
// toggle, which only switches between the two locked Primer schemes.
import { BaseStyles, ThemeProvider } from "@primer/react";
import { type ReactNode, useEffect } from "react";
import "@primer/primitives/dist/css/functional/themes/light.css";
import "@primer/primitives/dist/css/functional/themes/dark.css";

export type ColorMode = "day" | "night";

export function ThemeRoot({
  children,
  colorMode = "day",
}: {
  children: ReactNode;
  colorMode?: ColorMode;
}) {
  useEffect(() => {
    // Apply library tokens to the document as well, so dialogs and native
    // controls follow the active scheme (see src/app/theme.css).
    document.documentElement.dataset.colorMode = colorMode === "day" ? "light" : "dark";
    document.documentElement.dataset.lightTheme = "light";
    document.documentElement.dataset.darkTheme = "dark";
  }, [colorMode]);

  return (
    <ThemeProvider colorMode={colorMode} dayScheme="light" nightScheme="dark">
      <BaseStyles>{children}</BaseStyles>
    </ThemeProvider>
  );
}
