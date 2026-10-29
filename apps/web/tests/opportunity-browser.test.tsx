import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { OpportunityBrowser } from "../src/components/OpportunityBrowser";

function renderBrowser(type: "competition" | "" = "") {
  return renderToStaticMarkup(
    <OpportunityBrowser
      type={type}
      onTypeChange={() => {}}
      canSave={false}
      onSave={() => {}}
    />,
  );
}

describe("opportunity browsing recovery", () => {
  test("an unfiltered list does not show a redundant reset action", () => {
    const html = renderBrowser();
    expect(html).toContain("机会与入口");
    expect(html).not.toContain("清除筛选");
  });

  test("a selected type offers a clear reset without hiding existing entries", () => {
    const html = renderBrowser("competition");
    expect(html).toContain("清除筛选");
    expect(html).toContain('value="competition"');
    expect(html).toContain("保存到主题");
  });
});
