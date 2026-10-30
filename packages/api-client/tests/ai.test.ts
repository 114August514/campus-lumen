import { describe, expect, test } from "bun:test";
import { createAiCompletion, getAiProviders } from "../src/ai";

describe("AI client", () => {
  test("provider status contains no credential field", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          school: {
            id: "school",
            name: "学校词元计划",
            configured: true,
            model: "deepseek-v4-pro",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    const result = await getAiProviders({ fetchImpl });
    expect(result.school.model).toBe("deepseek-v4-pro");
    expect(JSON.stringify(result)).not.toContain("apiKey");
  });

  test("completion sends only the supplied one-shot payload and abort signal", async () => {
    const controller = new AbortController();
    let captured: Request | undefined;
    const fetchImpl: typeof fetch = async (input, init) => {
      captured = new Request(input, init);
      return new Response(
        JSON.stringify({ provider: "school", content: "依据回答", model: "test" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const result = await createAiCompletion(
      { provider: "school", task: "本次问题", personalContext: "仅这一条" },
      { baseUrl: "http://localhost", fetchImpl, signal: controller.signal },
    );
    expect(result.content).toBe("依据回答");
    expect(captured?.signal).toBe(controller.signal);
    const body = (await captured?.json()) as Record<string, unknown>;
    expect(body).toEqual({
      provider: "school",
      task: "本次问题",
      personalContext: "仅这一条",
    });
  });
});
