import {
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

import {
  compareCatalogModelsNewestFirst,
  type CatalogModel,
  type CatalogProvider,
  type ModelScopeList,
  type ProviderModels,
} from "../../../shared/provider-models";

type Props = {
  provider: CatalogProvider;
  currentModel?: string;
  ready: boolean;
};

export function normalizeCustomModelId(value: string, existingIds: string[]) {
  const id = value.trim();
  return id && !existingIds.includes(id) ? id : null;
}

export function addCustomModelId(
  value: string,
  existingIds: string[],
  selected: string[] | null,
) {
  const id = normalizeCustomModelId(value, existingIds);
  if (!id) return null;
  return {
    id,
    scope: selected === null ? null : [...new Set([...selected, id])],
  };
}

export function toggleModelScope(
  selected: string[] | null,
  rowIds: string[],
  modelId: string,
  checked: boolean,
) {
  const before = selected ?? rowIds;
  return checked
    ? [...new Set([...before, modelId])]
    : before.filter((id) => id !== modelId);
}

/** Remount by provider so an in-flight response cannot overwrite another tab. */
export function ProviderModelScope({ provider, currentModel, ready }: Props) {
  const scopes = useActionQuery<ModelScopeList>("model-scope-list", {});
  const discovery = useActionMutation<
    ProviderModels,
    { provider: CatalogProvider }
  >("provider-model-catalog");
  const save = useActionMutation<
    ProviderModels,
    { provider: CatalogProvider; models: string[] | null }
  >("model-scope-update");
  const started = useRef(false);
  const [draft, setDraft] = useState<string[] | null | undefined>(undefined);
  const [customModelIds, setCustomModelIds] = useState<string[]>([]);
  const [customModelId, setCustomModelId] = useState("");
  const [notice, setNotice] = useState("");
  const cached = scopes.data?.providers.find(
    (item) => item.provider === provider,
  );
  const catalog =
    cached?.fetchedAt &&
    discovery.data?.fetchedAt &&
    cached.fetchedAt > discovery.data.fetchedAt
      ? cached
      : (discovery.data ?? cached);
  const selected = draft === undefined ? (cached?.scopedModels ?? null) : draft;
  const dirty = draft !== undefined;
  const catalogModels: CatalogModel[] = catalog?.fetchedAt
    ? catalog.models
    : [];
  const rows = useMemo(() => {
    const models = [...catalogModels].map((item) => ({
      ...item,
      missing: false,
    }));
    for (const id of [
      ...(selected ?? []),
      ...((catalog?.fetchedAt || catalog?.preserveEngineModels) && currentModel
        ? [currentModel]
        : []),
    ]) {
      if (!models.some((item) => item.id === id))
        models.push({ id, name: id, missing: true });
    }
    for (const id of customModelIds) {
      if (!models.some((item) => item.id === id))
        models.push({ id, name: id, missing: true });
    }
    return models;
  }, [
    catalogModels,
    selected,
    currentModel,
    catalog?.fetchedAt,
    catalog?.preserveEngineModels,
    customModelIds,
  ]);
  const newest = catalog?.fetchedAt
    ? catalog.models.reduce(
        (value, item) =>
          item.createdAt && item.createdAt > value ? item.createdAt : value,
        "",
      )
    : "";
  const visible = [...rows].sort(compareCatalogModelsNewestFirst);

  useEffect(() => {
    if (ready && !started.current) {
      started.current = true;
      discovery.mutate({ provider });
    }
  }, [ready, provider, discovery.mutate]);

  async function persist(models: string[] | null) {
    setNotice("");
    try {
      await save.mutateAsync({ provider, models });
      const verified = await scopes.refetch();
      if (verified.isError) return; // Keep the draft until the visible read recovers.
      setDraft(undefined);
      setNotice("Chat model scope saved.");
    } catch {
      /* Mutation exposes the failure below; preserve the draft. */
    }
  }

  function addCustomModel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const addition = addCustomModelId(
      customModelId,
      rows.map((item) => item.id),
      selected,
    );
    if (!addition) return;
    setCustomModelIds((existing) => [...existing, addition.id]);
    if (addition.scope !== null) setDraft(addition.scope);
    setCustomModelId("");
    setNotice("");
  }

  return (
    <section
      className="space-y-3 border-t border-border pt-4"
      aria-label="Chat model scope"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Models in your chat picker</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Personal selection for chat. A model outside this scope is not offered
        in the picker.
      </p>
      {catalog?.fetchedAt && (
        <p className="text-xs text-muted-foreground">
          {catalog.stale ? "Saved catalog" : "Updated"}:{" "}
          {new Date(catalog.fetchedAt).toLocaleString()} · refreshes after one
          hour when opened
        </p>
      )}
      {discovery.isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          Loading the provider’s model catalog…
        </p>
      )}
      {!ready && (
        <p className="text-sm text-muted-foreground">
          {provider === "ollama"
            ? "Configure the Ollama endpoint to discover installed local models."
            : "Connect this provider to discover available models."}
        </p>
      )}
      {(catalog?.error || discovery.error) && (
        <p role="alert" className="text-sm text-destructive">
          {catalog?.error ??
            "Catalog request failed. Reopen settings to retry."}
        </p>
      )}
      {!catalog?.fetchedAt &&
        !discovery.isPending &&
        ready &&
        !catalog?.error &&
        !discovery.error && (
          <p role="status" className="text-xs text-muted-foreground">
            Model catalog has not been loaded yet.
          </p>
        )}
      {provider === "openai" && catalog?.preserveEngineModels && (
        <form
          onSubmit={addCustomModel}
          className="flex flex-wrap items-end gap-2"
        >
          <label className="min-w-0 flex-1 space-y-1 text-sm font-medium">
            <span>Custom OpenAI model ID</span>
            <Input
              aria-label="Custom OpenAI model ID"
              value={customModelId}
              onChange={(event) => setCustomModelId(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              disabled={scopes.isLoading || scopes.isError || save.isPending}
            />
          </label>
          <Button
            type="submit"
            disabled={
              !normalizeCustomModelId(
                customModelId,
                rows.map((item) => item.id),
              ) ||
              scopes.isLoading ||
              scopes.isError ||
              save.isPending
            }
          >
            Add model ID
          </Button>
        </form>
      )}
      <div
        className="max-h-72 overflow-y-auto rounded-md border border-border"
        aria-busy={discovery.isPending}
      >
        {visible.map((item) => (
          <label
            key={item.id}
            className="flex cursor-pointer items-start gap-3 border-b border-border px-3 py-2 last:border-0 hover:bg-muted/50"
          >
            <Checkbox
              className="mt-1"
              checked={selected === null || selected.includes(item.id)}
              disabled={scopes.isLoading || scopes.isError || save.isPending}
              onCheckedChange={(checked) => {
                setDraft(
                  toggleModelScope(
                    selected,
                    rows.map((row) => row.id),
                    item.id,
                    checked === true,
                  ),
                );
                setNotice("");
              }}
            />
            <span className="min-w-0 flex-1 text-sm">
              <span className="block break-words font-medium">{item.name}</span>
              {item.name !== item.id && (
                <span className="block break-all text-xs text-muted-foreground">
                  {item.id}
                </span>
              )}
              <span className="block text-xs text-muted-foreground">
                {item.weeklyRank
                  ? `OpenRouter weekly #${item.weeklyRank} · `
                  : ""}
                {item.id === currentModel
                  ? selected === null || selected.includes(item.id)
                    ? "Current selection · "
                    : "Current selection · Outside scope · "
                  : ""}
                {item.missing
                  ? "Not in the catalog — selection retained"
                  : item.createdAt
                    ? `Catalog date: ${item.createdAt.slice(0, 10)}${item.createdAt === newest ? " · Newest catalog entry" : ""}`
                    : ""}
              </span>
            </span>
          </label>
        ))}
        {!visible.length && catalog?.fetchedAt && (
          <p className="p-3 text-sm text-muted-foreground">
            No chat models returned by this provider.
          </p>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Catalog dates are provider metadata, not quality scores. OpenRouter
        weekly ranks use provider-reported token traffic; other providers do not
        supply popularity rankings.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={selected === null || save.isPending || scopes.isError}
          onClick={() => {
            setDraft(null);
            setNotice("");
          }}
        >
          Allow all models
        </Button>
        <Button
          type="button"
          disabled={!dirty || save.isPending || scopes.isError}
          onClick={() => void persist(selected)}
        >
          {save.isPending ? "Saving…" : "Save model scope"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {selected === null ? "All models" : `${selected.length} selected`}
          {dirty ? " · Unsaved" : ""}
        </span>
      </div>
      {scopes.isError && (
        <div role="alert" className="text-sm text-destructive">
          Saved scope could not be loaded.{" "}
          <Button
            type="button"
            variant="outline"
            onClick={() => void scopes.refetch()}
          >
            Retry
          </Button>
        </div>
      )}
      {save.isError && (
        <p role="alert" className="text-sm text-destructive">
          Model scope could not be saved. Your edits are preserved; retry
          saving.
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}
    </section>
  );
}
