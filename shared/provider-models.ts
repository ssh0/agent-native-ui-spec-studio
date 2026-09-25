export const catalogProviders = [
  "anthropic",
  "openai",
  "openrouter",
  "google",
  "groq",
  "mistral",
  "cohere",
  "ollama",
] as const;
export type CatalogProvider = (typeof catalogProviders)[number];
export type RemoteCatalogProvider = Exclude<CatalogProvider, "ollama">;
export type CatalogModel = {
  id: string;
  name: string;
  createdAt?: string;
  weeklyRank?: number;
};
export type ProviderModels = {
  provider: CatalogProvider;
  configured?: boolean;
  label?: string;
  models: CatalogModel[];
  fetchedAt: string | null;
  stale: boolean;
  error?: string;
  preserveEngineModels?: boolean;
  // null = unrestricted; [] = hide this provider's models.
  scopedModels: string[] | null;
};
export type ModelScopeList = { providers: ProviderModels[] };
export function catalogEngine(provider: CatalogProvider): string {
  return provider === "anthropic" ? "anthropic" : `ai-sdk:${provider}`;
}

function matchesProvider(provider: CatalogProvider, engine: string) {
  return (
    catalogEngine(provider) === engine ||
    (provider === "anthropic" && engine === "ai-sdk:anthropic")
  );
}

function isCustomOpenAIGateway(catalog: ProviderModels) {
  return (
    catalog.provider === "openai" &&
    catalog.preserveEngineModels === true &&
    catalog.fetchedAt === null
  );
}

export function isScopedCustomOpenAIModel(
  catalogs: readonly ProviderModels[],
  model: string,
  engine: string,
) {
  return (
    matchesProvider("openai", engine) &&
    catalogs.some(
      (catalog) =>
        isCustomOpenAIGateway(catalog) &&
        catalog.scopedModels?.includes(model) === true,
    )
  );
}

/** Never switch a conversation's model as a side effect of filtering. */
export function scopedModelGroups(
  groups: {
    engine: string;
    models: string[];
    label: string;
    configured: boolean;
  }[],
  catalogs: ProviderModels[],
) {
  const combined = [...groups];
  for (const catalog of catalogs) {
    const engine = catalogEngine(catalog.provider);
    const hasScopedCustomOpenAIModels =
      isCustomOpenAIGateway(catalog) &&
      (catalog.scopedModels?.length ?? 0) > 0;
    if (
      catalog.configured &&
      (catalog.fetchedAt || hasScopedCustomOpenAIModels) &&
      !combined.some((group) => matchesProvider(catalog.provider, group.engine))
    ) {
      combined.push({
        engine,
        models: [],
        label: catalog.label ?? catalog.provider,
        configured: true,
      });
    }
  }
  return combined
    .filter((group) => group.engine !== "builder")
    .map((group) => {
      const catalog = catalogs.find((item) =>
        matchesProvider(item.provider, group.engine),
      );
      if (!catalog) return group;
      const available = catalog.fetchedAt
        ? catalog.models.map((item) => item.id)
        : catalog.preserveEngineModels
          ? isCustomOpenAIGateway(catalog) && catalog.scopedModels !== null
            ? [...new Set([...group.models, ...catalog.scopedModels])]
            : group.models
          : [];
      const models =
        catalog.scopedModels === null
          ? [...available]
          : available.filter((id) => catalog.scopedModels!.includes(id));
      return { ...group, models };
    });
}
