import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { allOpportunities } from "../src/lib/advisors";
import { WorkbenchPreview } from "../src/workbench/WorkbenchPreview";
import {
  DEFAULT_WORKBENCH_SELECTION,
  type WorkbenchSelection,
} from "../src/workbench/workbench-config";

const realCandidate = allOpportunities[0];
if (!realCandidate) throw new Error("built-in sample candidates are missing");

function selection(patch: Partial<WorkbenchSelection>): WorkbenchSelection {
  return { ...DEFAULT_WORKBENCH_SELECTION, ...patch };
}

describe("workbench preview canvas", () => {
  test("explore home renders the real home screen with search and type browsing", () => {
    const html = renderToStaticMarkup(
      <WorkbenchPreview selection={selection({ screen: "home" })} />,
    );
    expect(html).toContain("探索机会");
    expect(html).toContain("搜索导师、机会、资源或规则");
    expect(html).toContain("按类型浏览");
    expect(html).toContain("保存只写入内存");
  });

  test("candidate detail renders the selected built-in candidate with saving enabled", () => {
    const html = renderToStaticMarkup(
      <WorkbenchPreview
        selection={selection({
          screen: "detail",
          candidateId: realCandidate.candidateId,
        })}
      />,
    );
    expect(html).toContain(realCandidate.name);
    expect(html).toContain(realCandidate.institution);
    expect(html).toContain("仍待了解");
    // The in-memory preview topic keeps the real save path usable.
    expect(html).toContain(`保存${realCandidate.name}到主题`);
    expect(html).not.toContain("想保留时，再选择或创建主题");
  });

  test("comparison renders the real comparison without any discovery entry point", () => {
    const html = renderToStaticMarkup(
      <WorkbenchPreview selection={selection({ screen: "compare" })} />,
    );
    expect(html).toContain("候选比较");
    expect(html).toContain("自己的记录");
    expect(html).toContain("预览主题（仅内存）");
    // The canvas must not offer live external discovery.
    expect(html).not.toContain("查找外部资料");
    expect(html).not.toContain("读取原站正文");
  });

  test("a fresh canvas shows no leftover feedback banner", () => {
    // Feedback is cleared whenever the previewed screen/candidate/pair
    // changes; a canvas must never open with a stale save message.
    for (const screen of ["home", "detail", "compare"] as const) {
      const html = renderToStaticMarkup(
        <WorkbenchPreview selection={selection({ screen })} />,
      );
      expect(html).not.toContain("已把");
      expect(html).not.toContain("已保存");
    }
  });
});
