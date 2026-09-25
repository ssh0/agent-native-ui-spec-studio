import { ssrfSafeFetch } from "@agent-native/core/extensions/url-safety";
import { z } from "zod";

import {
  compareCatalogModelsNewestFirst,
  type CatalogModel,
  type RemoteCatalogProvider,
} from "../../shared/provider-models.js";

export const catalogEndpoints: Record<RemoteCatalogProvider, string> = {
  anthropic: "https://api.anthropic.com/v1/models",
  openai: "https://api.openai.com/v1/models",
  openrouter: "https://openrouter.ai/api/v1/models",
  google: "https://generativelanguage.googleapis.com/v1beta/models",
  groq: "https://api.groq.com/openai/v1/models",
  mistral: "https://api.mistral.ai/v1/models",
  cohere: "https://api.cohere.com/v1/models",
};
export const catalogKeys: Record<RemoteCatalogProvider, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  groq: "GROQ_API_KEY",
  mistral: "MISTRAL_API_KEY",
  cohere: "COHERE_API_KEY",
};
const rowSchema = z.object({
  id: z.string().max(300).optional(),
  name: z.string().max(300).nullish(),
  display_name: z.string().max(300).nullish(),
  displayName: z.string().max(300).nullish(),
  created: z.number().nullish(),
  created_at: z.string().nullish(),
  model: z.string().max(300).optional(),
  modified_at: z.string().nullish(),
  active: z.boolean().optional(),
  supportedGenerationMethods: z.array(z.string()).optional(),
  capabilities: z
    .object({ completion_chat: z.boolean().optional() })
    .passthrough()
    .nullish(),
  architecture: z
    .object({ output_modalities: z.array(z.string()).optional() })
    .optional(),
});
const ollamaPageSchema = z.object({
  models: z
    .array(
      z.object({
        name: z.string().min(1).max(300),
        model: z.string().max(300).optional(),
        modified_at: z.string().optional(),
      }),
    )
    .max(10000),
});
const pageSchema = z.object({
  data: z.array(rowSchema).max(10000).optional(),
  models: z.array(rowSchema).max(10000).optional(),
  has_more: z.boolean().optional(),
  last_id: z.string().nullish(),
  nextPageToken: z.string().optional(),
  next_page_token: z.string().optional(),
  total_count: z.number().optional(),
});
export function parseCatalogPage(
  provider: RemoteCatalogProvider,
  payload: unknown,
  rankOffset = 0,
) {
  const page = pageSchema.parse(payload);
  const rows =
    provider === "google" || provider === "cohere" ? page.models : page.data;
  if (!rows) throw new Error("Invalid model catalog response.");
  const models: CatalogModel[] = [];
  for (const [index, row] of rows.entries()) {
    const id = (
      provider === "google" || provider === "cohere" ? row.name : row.id
    )?.replace(/^models\//, "");
    if (!id) throw new Error("Invalid model identifier.");
    if (row.active === false || row.capabilities?.completion_chat === false)
      continue;
    if (
      provider === "google" &&
      !row.supportedGenerationMethods?.includes("generateContent")
    )
      continue;
    if (
      row.architecture?.output_modalities &&
      !row.architecture.output_modalities.includes("text")
    )
      continue;
    // These catalogs do not consistently expose chat capabilities. Exclude known
    // non-chat families; absence of metadata is not a promise of tool support.
    if (
      (provider === "openai" || provider === "groq") &&
      /(?:embedding|whisper|tts|dall-e|image|moderation|transcri|realtime|sora)/i.test(
        id,
      )
    )
      continue;
    const timestamp = row.created_at
      ? Date.parse(row.created_at)
      : (row.created ?? 0) * 1000;
    models.push({
      id,
      name:
        row.display_name ??
        row.displayName ??
        row.model ??
        (provider === "google" ? id : (row.name ?? id)),
      ...(provider === "openrouter" && rankOffset + index < 5
        ? { weeklyRank: rankOffset + index + 1 }
        : {}),
      ...(Number.isFinite(timestamp) &&
      timestamp > 0 &&
      timestamp <= 8640000000000000
        ? { createdAt: new Date(timestamp).toISOString() }
        : {}),
    });
  }
  return { models, page, rowCount: rows.length };
}

/** Ollama returns the models installed on the configured local Ollama instance. */
export function isOllamaChatModel(modelId: string): boolean {
  return !/(?:embed(?:ding)?|(?:^|[/:._-])(?:bge-m3|all-minilm)(?=$|[/:._-]))/i.test(
    modelId,
  );
}

export function parseOllamaCatalog(payload: unknown): CatalogModel[] {
  return ollamaPageSchema
    .parse(payload)
    .models.filter((model) => isOllamaChatModel(model.name))
    .map((model) => ({
      id: model.name,
      name:
        model.model && model.model !== model.name ? model.model : model.name,
    }));
}

/** Fixed official origins only; redirects and provider error bodies never escape. */
export async function fetchProviderModels(
  provider: RemoteCatalogProvider,
  key: string,
  fetcher: typeof fetch = fetch,
): Promise<CatalogModel[]> {
  const headers: Record<string, string> =
    provider === "anthropic"
      ? { "x-api-key": key, "anthropic-version": "2023-06-01" }
      : provider === "google"
        ? { "x-goog-api-key": key }
        : { Authorization: `Bearer ${key}` };
  const url = new URL(catalogEndpoints[provider]);
  if (provider === "anthropic") url.searchParams.set("limit", "1000");
  if (provider === "google") url.searchParams.set("pageSize", "1000");
  if (provider === "cohere") {
    url.searchParams.set("page_size", "1000");
    url.searchParams.set("endpoint", "chat");
  }
  // Official server-side ranking by tokens processed in the last week.
  if (provider === "openrouter") url.searchParams.set("sort", "top-weekly");
  const models = new Map<string, CatalogModel>();
  const cursors = new Set<string>();
  const signal = AbortSignal.timeout(20000);
  let offset = 0;
  for (let index = 0; index < 20; index++) {
    const response = await fetcher(url, { headers, redirect: "error", signal });
    if (!response.ok)
      throw new Error(
        `Catalog request failed (HTTP ${response.status}). Check the provider connection and retry.`,
      );
    const {
      models: entries,
      page,
      rowCount,
    } = parseCatalogPage(provider, await response.json(), offset);
    for (const model of entries) models.set(model.id, model);
    if (models.size > 10000)
      throw new Error("Model catalog exceeds the supported size.");
    let cursor: string | undefined;
    let parameter = "";
    if (provider === "anthropic" && page.has_more) {
      cursor = page.last_id ?? undefined;
      parameter = "after_id";
      if (!cursor) throw new Error("Invalid catalog pagination.");
    }
    if (provider === "google") {
      cursor = page.nextPageToken;
      parameter = "pageToken";
    }
    if (provider === "cohere") {
      cursor = page.next_page_token;
      parameter = "page_token";
    }
    offset += rowCount;
    if (
      provider === "openrouter" &&
      page.total_count !== undefined &&
      offset < page.total_count
    ) {
      cursor = String(offset);
      parameter = "offset";
    }
    if (!cursor)
      return [...models.values()].sort(compareCatalogModelsNewestFirst);
    if (cursors.has(cursor)) throw new Error("Invalid catalog pagination.");
    cursors.add(cursor);
    url.searchParams.set(parameter, cursor);
  }
  throw new Error("Catalog pagination limit reached. Try again later.");
}

/** Fetch Ollama's official local tags endpoint with SSRF and redirect protection. */
export async function fetchOllamaModels(
  baseUrl: string,
  fetcher: typeof ssrfSafeFetch = ssrfSafeFetch,
): Promise<CatalogModel[]> {
  const base = new URL(baseUrl);
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  ) {
    throw new Error("Invalid Ollama endpoint.");
  }
  const loopback = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(
    base.hostname.toLowerCase(),
  );
  if (base.protocol !== "https:" && !loopback) {
    throw new Error("Ollama remote endpoints must use HTTPS.");
  }
  const origin = base.origin;
  const url = new URL(`${base.toString().replace(/\/+$/, "")}/api/tags`);
  const response = await fetcher(
    url.toString(),
    {
      method: "GET",
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    },
    {
      followRedirects: false,
      httpsOnly: !loopback,
      ...(loopback ? { allowedPrivateOrigins: [origin] } : {}),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Ollama catalog request failed (HTTP ${response.status}). Check the local Ollama connection and retry.`,
    );
  }
  return parseOllamaCatalog(await response.json());
}
