import { readFile, readdir } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import ts from "typescript";

const violations: string[] = [];

// The single declarative document theme mapping allowed by
// docs/product/ui-system.md: only :root rules mapping color-scheme and the
// library tokens, no component styles.
const THEME_FILE = join("src", "app", "theme.css");

async function checkThemeFile(path: string) {
  const content = await readFile(path, "utf8");
  const withoutComments = content.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const rule of withoutComments.split("}")) {
    const selector = rule.split("{")[0]?.trim();
    if (!selector) continue;
    if (!/^:root(\[[^\]]+\])?$/.test(selector)) {
      violations.push(`${path}: only declarative :root theme rules are allowed`);
    }
  }
}

async function inspect(directory: string) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await inspect(path);
      continue;
    }
    if (/\.(css|scss|less)$/.test(path)) {
      if (path === THEME_FILE) {
        await checkThemeFile(path);
      } else {
        violations.push(`${path}: application styles are not allowed`);
      }
      continue;
    }
    if (!/\.tsx?$/.test(path)) continue;
    const source = ts.createSourceFile(
      path,
      await readFile(path, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    function visit(node: ts.Node) {
      if (
        ts.isJsxAttribute(node) &&
        ["style", "sx", "className"].includes(node.name.getText(source))
      ) {
        violations.push(`${path}: ${node.name.getText(source)} bypasses the UI system`);
      }
      if (
        (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
        node.tagName.getText(source) === "style"
      ) {
        violations.push(`${path}: inline stylesheet is not allowed`);
      }
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        const module = node.moduleSpecifier.text;
        if (
          /\.(css|scss|less)$/.test(module) &&
          !module.startsWith("@primer/") &&
          !(
            module.startsWith(".") &&
            normalize(join(dirname(path), module)) === THEME_FILE
          )
        ) {
          violations.push(`${path}: only Primer distribution styles may be imported`);
        }
        if (
          /^(tailwindcss|styled-components|@emotion\/|@mui\/|antd|lucide-react)/.test(
            module,
          )
        ) {
          violations.push(`${path}: ${module} is outside the selected UI system`);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
}

await inspect("src");
if (violations.length) {
  console.error(violations.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    "UI source checks passed. Visual and keyboard checks still require the browser.",
  );
}
