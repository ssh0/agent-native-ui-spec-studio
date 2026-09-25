import { ssrfSafeFetch } from "@agent-native/core/extensions/url-safety";
import { describe, expect, it, vi } from "vitest";

import {
  catalogProviders,
  type RemoteCatalogProvider,
} from "../../shared/provider-models";
import {
  catalogEndpoints,
  fetchOllamaModels,
  fetchProviderModels,
  parseCatalogPage,
  parseOllamaCatalog,
} from "./provider-model-catalog";

const response = (value: unknown) => new Response(JSON.stringify(value));
describe("official model catalogs", () => {
  it.each(
    catalogProviders.filter(
      (provider): provider is RemoteCatalogProvider => provider !== "ollama",
    ),
  )(
    "uses the official %s origin and never follows redirects",
    async (provider) => {
      const payload =
        provider === "google"
          ? {
              models: [
                {
                  name: "models/example-chat",
                  supportedGenerationMethods: ["generateContent"],
                },
              ],
            }
          : provider === "cohere"
            ? { models: [{ name: "example-chat" }] }
            : { data: [{ id: "example-chat" }] };
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(response(payload));
      const models = await fetchProviderModels(
        provider,
        "example-not-a-real-credential",
        fetcher,
      );
      expect(models[0].id).toBe("example-chat");
      const [url, init] = fetcher.mock.calls[0];
      expect(new URL(String(url)).origin).toBe(
        new URL(catalogEndpoints[provider]).origin,
      );
      expect(init?.redirect).toBe("error");
      expect(String(url)).not.toContain("example-not-a-real-credential");
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    },
  );
  it("paginates Anthropic without losing models and orders by provider dates", async () => {
    const urls: string[] = [];
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      urls.push(String(url));
      return response(
        urls.length === 1
          ? {
              data: [{ id: "example-new", created_at: "2026-09-01T00:00:00Z" }],
              has_more: true,
              last_id: "example-new",
            }
          : {
              data: [{ id: "example-old", created_at: "2025-09-01T00:00:00Z" }],
              has_more: false,
            },
      );
    });
    expect(
      (await fetchProviderModels("anthropic", "example", fetcher)).map(
        (m) => m.id,
      ),
    ).toEqual(["example-new", "example-old"]);
    expect(new URL(urls[1]).searchParams.get("after_id")).toBe("example-new");
  });
  it.each(["google", "cohere"] as const)(
    "follows %s page tokens",
    async (provider) => {
      const urls: string[] = [];
      const tokenKey =
        provider === "google" ? "nextPageToken" : "next_page_token";
      const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) => {
        urls.push(String(url));
        return response({
          models: [
            {
              name: `models/example-${urls.length}`,
              supportedGenerationMethods: ["generateContent"],
            },
          ],
          ...(urls.length === 1 ? { [tokenKey]: "next-example" } : {}),
        });
      });
      expect(
        await fetchProviderModels(provider, "example", fetcher),
      ).toHaveLength(2);
      expect(
        new URL(urls[1]).searchParams.get(
          provider === "google" ? "pageToken" : "page_token",
        ),
      ).toBe("next-example");
    },
  );
  it("rejects repeated pagination instead of caching a partial result", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () =>
      response({
        data: [{ id: "example" }],
        has_more: true,
        last_id: "example",
      }),
    );
    await expect(
      fetchProviderModels("anthropic", "example", fetcher),
    ).rejects.toThrow("pagination");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("does not return provider error bodies", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response("private-provider-debug", { status: 401 }),
      );
    await expect(
      fetchProviderModels("openai", "example", fetcher),
    ).rejects.toThrow("HTTP 401");
    await expect(
      fetchProviderModels(
        "openai",
        "example",
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(
            new Response("private-provider-debug", { status: 429 }),
          ),
      ),
    ).rejects.not.toThrow("private-provider-debug");
  });
  it("filters non-chat capabilities without fabricating dates or rankings", () => {
    expect(
      parseCatalogPage("google", {
        models: [
          {
            name: "models/example-embedding",
            supportedGenerationMethods: ["embedContent"],
          },
          {
            name: "models/example-chat",
            displayName: "Example chat",
            supportedGenerationMethods: ["generateContent"],
          },
        ],
      }).models,
    ).toEqual([{ id: "example-chat", name: "Example chat" }]);
    expect(
      parseCatalogPage("mistral", {
        data: [
          { id: "example-embedding", capabilities: { completion_chat: false } },
        ],
      }).models,
    ).toEqual([]);
    expect(
      parseCatalogPage("groq", {
        data: [
          { id: "whisper-example" },
          { id: "example-inactive", active: false },
        ],
      }).models,
    ).toEqual([]);
    expect(
      parseCatalogPage("openrouter", {
        data: [
          {
            id: "example-image",
            architecture: { output_modalities: ["image"] },
          },
        ],
      }).models,
    ).toEqual([]);
  });
  it("preserves OpenRouter API positions before filtering chat-incompatible models", () => {
    const parsed = parseCatalogPage("openrouter", {
      data: [
        { id: "example-image", architecture: { output_modalities: ["image"] } },
        { id: "example-chat", architecture: { output_modalities: ["text"] } },
      ],
    });
    expect(parsed.models).toEqual([
      { id: "example-chat", name: "example-chat", weeklyRank: 2 },
    ]);
  });
  it("shows only authoritative OpenRouter weekly top-five ranks", async () => {
    let requested = "";
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      requested = String(url);
      return response({
        data: Array.from({ length: 6 }, (_, i) => ({
          id: `example-${i}`,
          created: i + 1,
        })),
      });
    });
    const result = await fetchProviderModels("openrouter", "example", fetcher);
    expect(new URL(requested).searchParams.get("sort")).toBe("top-weekly");
    expect(result.find((item) => item.id === "example-0")?.weeklyRank).toBe(1);
    expect(result.find((item) => item.id === "example-4")?.weeklyRank).toBe(5);
    expect(
      result.find((item) => item.id === "example-5")?.weeklyRank,
    ).toBeUndefined();
  });
  it("parses installed Ollama models without inventing release dates or ranks", () => {
    expect(
      parseOllamaCatalog({
        models: [
          {
            name: "gemma4:latest",
            model: "gemma4:latest",
            modified_at: "2026-09-01T00:00:00Z",
          },
          {
            name: "llama3:8b",
            model: "llama3:8b",
            modified_at: "2026-08-01T00:00:00Z",
          },
        ],
      }),
    ).toEqual([
      { id: "gemma4:latest", name: "gemma4:latest" },
      { id: "llama3:8b", name: "llama3:8b" },
    ]);
  });
  it("calls the official Ollama tags endpoint only at safe configured origins", async () => {
    const fetcher = vi
      .fn<typeof ssrfSafeFetch>()
      .mockResolvedValue(response({ models: [{ name: "example-chat" }] }));
    expect(await fetchOllamaModels("http://localhost:11434", fetcher)).toEqual([
      { id: "example-chat", name: "example-chat" },
    ]);
    const [url, init, options] = fetcher.mock.calls[0];
    expect(url).toBe("http://localhost:11434/api/tags");
    expect(init?.method).toBe("GET");
    expect(init?.headers).toEqual({ Accept: "application/json" });
    expect(options?.allowedPrivateOrigins).toEqual(["http://localhost:11434"]);
    expect(options?.followRedirects).toBe(false);
    expect(options?.httpsOnly).toBe(false);
    await expect(
      fetchOllamaModels("http://127.0.0.2:11434", fetcher),
    ).rejects.toThrow("HTTPS");
    await expect(
      fetchOllamaModels("http://192.0.2.10:11434", fetcher),
    ).rejects.toThrow("HTTPS");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects malformed responses but accepts a truly empty catalog", () => {
    expect(() => parseCatalogPage("openai", {})).toThrow();
    expect(parseCatalogPage("openai", { data: [] }).models).toEqual([]);
  });
});
