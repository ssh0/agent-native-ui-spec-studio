import {
  getAgentEngineEntry,
  normalizeModelForEngine,
  registerBuiltinEngines,
} from "@agent-native/core/agent/engine";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GEMINI_3_8_FLASH_MODEL_ID,
  installGoogleModelOptions,
} from "./google-model-options";

describe("Google Gemini model options", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("offers Gemini 3.8 Flash and preserves its ID through model validation", () => {
    registerBuiltinEngines();
    installGoogleModelOptions();

    const entry = getAgentEngineEntry("ai-sdk:google");
    expect(entry?.supportedModels).toContain(GEMINI_3_8_FLASH_MODEL_ID);
    expect(normalizeModelForEngine(entry!, GEMINI_3_8_FLASH_MODEL_ID)).toBe(
      GEMINI_3_8_FLASH_MODEL_ID,
    );

    installGoogleModelOptions();
    expect(entry?.supportedModels.filter((model) => model === GEMINI_3_8_FLASH_MODEL_ID)).toHaveLength(1);
  });

  it("maps Gemini 3.8 Flash to the Google API request unchanged", async () => {
    registerBuiltinEngines();
    installGoogleModelOptions();

    const entry = getAgentEngineEntry("ai-sdk:google");
    const engine = entry!.create({ apiKey: "test-key", allowEnvFallback: false });
    const requests: Array<{ url: string; body: unknown }> = [];
    const mockedFetch = vi.fn<typeof fetch>(async (input, init) => {
      requests.push({ url: String(input), body: init?.body });
      return new Response(JSON.stringify({ error: { code: 404, message: "test capture" } }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", mockedFetch);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const events = [];
    for await (const event of engine.stream({
      model: GEMINI_3_8_FLASH_MODEL_ID,
      systemPrompt: "test system",
      messages: [{ role: "user", content: [{ type: "text", text: "hello" }] }],
      tools: [],
      abortSignal: new AbortController().signal,
      reasoningEffort: "medium",
    })) {
      events.push(event);
    }

    expect(events.some((event) => event.type === "stop" && event.reason === "error")).toBe(true);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:streamGenerateContent?alt=sse",
    );
    const body = JSON.parse(String(requests[0]?.body));
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: "medium" });
  });
});
