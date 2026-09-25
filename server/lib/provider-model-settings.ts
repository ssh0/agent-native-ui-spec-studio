import {
  getAgentEngineEntry,
  isStoredEngineUsableForRequest,
} from "@agent-native/core/agent/engine";
import { resolveOrgIdForEmail } from "@agent-native/core/org";
import { resolveSecret } from "@agent-native/core/server";
import { getRequestOrgId } from "@agent-native/core/server/request-context";
import { getUserSetting, putUserSetting } from "@agent-native/core/settings";
import { z } from "zod";

import {
  catalogEngine,
  catalogProviders,
  type CatalogProvider,
  type ProviderModels,
} from "../../shared/provider-models.js";
import {
  catalogKeys,
  fetchOllamaModels,
  fetchProviderModels,
  isOllamaChatModel,
} from "./provider-model-catalog.js";
import { currentUserEmail } from "./spec-project.js";

export const CATALOG_TTL_MS = 60 * 60 * 1000;
const cacheSchema = z.object({
  models: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      createdAt: z.string().optional(),
      weeklyRank: z.number().int().min(1).max(5).optional(),
    }),
  ),
  fetchedAt: z.string(),
});
const scopeSchema = z.object({ models: z.array(z.string()).nullable() });
async function context() {
  const email = currentUserEmail();
  const orgId = getRequestOrgId() ?? (await resolveOrgIdForEmail(email));
  return {
    email,
    prefix: `provider-models:${encodeURIComponent(orgId ?? "personal")}:`,
  };
}

export async function readProviderModels(
  provider: CatalogProvider,
): Promise<ProviderModels> {
  const { email, prefix } = await context();
  const [rawCache, rawScope] = await Promise.all([
    getUserSetting(email, `${prefix}catalog:${provider}`),
    getUserSetting(email, `${prefix}scope:${provider}`),
  ]);
  const cache = rawCache ? cacheSchema.parse(rawCache) : null;
  const scope = rawScope ? scopeSchema.parse(rawScope) : null;
  const endpoint =
    provider === "openai" ? await resolveSecret("OPENAI_BASE_URL") : null;
  const customEndpoint =
    endpoint && endpoint.replace(/\/+$/, "") !== "https://api.openai.com/v1";
  if (customEndpoint)
    return {
      provider,
      models: [],
      fetchedAt: null,
      stale: true,
      preserveEngineModels: true,
      scopedModels: scope?.models ?? null,
      error:
        "Automatic discovery is unavailable for custom OpenAI gateways. Existing model IDs are preserved.",
    };
  return {
    provider,
    models: (cache?.models ?? []).filter(
      (model) => provider !== "ollama" || isOllamaChatModel(model.id),
    ),
    fetchedAt: cache?.fetchedAt ?? null,
    stale: !cache || Date.now() - Date.parse(cache.fetchedAt) >= CATALOG_TTL_MS,
    scopedModels: scope?.models ?? null,
  };
}
export async function listModelScopes() {
  currentUserEmail();
  return {
    providers: await Promise.all(
      catalogProviders.map(async (provider) => {
        const result = await readProviderModels(provider);
        const entry = getAgentEngineEntry(catalogEngine(provider));
        const configured = entry
          ? await isStoredEngineUsableForRequest(null, entry).catch(() => false)
          : false;
        return { ...result, configured, label: entry?.label ?? provider };
      }),
    ),
  };
}

export async function loadProviderModels(
  provider: CatalogProvider,
): Promise<ProviderModels> {
  const previous = await readProviderModels(provider);
  try {
    let models: ProviderModels["models"];
    if (provider === "ollama") {
      const endpoint = await resolveSecret("OLLAMA_BASE_URL");
      if (!endpoint)
        return {
          ...previous,
          stale: true,
          error:
            "Configure an Ollama endpoint to discover installed local models.",
        };
      if (!previous.stale) return previous;
      models = await fetchOllamaModels(endpoint);
    } else {
      // Same request-scoped resolver as Core's engine registry; no new connection
      // records, key copies, or per-provider credential transport.
      const keyName = catalogKeys[provider];
      const key = keyName ? await resolveSecret(keyName) : null;
      if (!key)
        return {
          ...previous,
          stale: true,
          error: "Connect this provider to load its model catalog.",
        };
      if (provider === "openai") {
        const endpoint = await resolveSecret("OPENAI_BASE_URL");
        if (
          endpoint &&
          endpoint.replace(/\/+$/, "") !== "https://api.openai.com/v1"
        ) {
          return {
            ...previous,
            models: [],
            fetchedAt: null,
            stale: true,
            preserveEngineModels: true,
            error:
              "Automatic discovery is unavailable for custom OpenAI gateways. Existing model IDs are preserved.",
          };
        }
      }
      if (!previous.stale) return previous;
      models = await fetchProviderModels(provider, key);
    }
    const { email, prefix } = await context();
    await putUserSetting(email, `${prefix}catalog:${provider}`, {
      models,
      fetchedAt: new Date().toISOString(),
    });
    return await readProviderModels(provider);
  } catch {
    // Never expose a provider body, request URL, credential, or resolver error.
    return {
      ...previous,
      stale: true,
      error:
        "Model catalog could not be refreshed. Check the connection and retry; saved selections are unchanged.",
    };
  }
}

export async function saveModelScope(
  provider: CatalogProvider,
  models: string[] | null,
) {
  const { email, prefix } = await context();
  // IDs may be custom, or missing from a newer catalog: never silently discard
  // existing selections. The scope is a personal picker preference, not auth.
  const unique = models === null ? null : [...new Set(models)];
  await putUserSetting(email, `${prefix}scope:${provider}`, { models: unique });
  const saved = await readProviderModels(provider);
  if (JSON.stringify(saved.scopedModels) !== JSON.stringify(unique))
    throw new Error("Model scope could not be verified. Retry.");
  return saved;
}
