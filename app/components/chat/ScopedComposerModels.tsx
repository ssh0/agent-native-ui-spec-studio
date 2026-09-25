import {
  chatModelSelectionStorageKey,
  useChatModels,
} from "@agent-native/core/client/agent-chat";
import { useActionQuery } from "@agent-native/core/client/hooks";
import {
  ComposerRuntimeAdaptersProvider,
  useComposerRuntimeAdapters,
} from "@agent-native/toolkit/composer/runtime-adapters";
import { useEffect, useMemo, useRef, type ReactNode } from "react";

import {
  isScopedCustomOpenAIModel,
  scopedModelGroups,
  type ModelScopeList,
} from "../../../shared/provider-models";

type PersistedSelection = { model: string; engine: string };

function readPersistedSelection(storageKey: string | null) {
  if (!storageKey || typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey) ?? "null");
    return typeof value?.model === "string" &&
      typeof value?.engine === "string"
      ? { model: value.model, engine: value.engine }
      : null;
  } catch {
    return null;
  }
}

export function useScopedChatModels({
  enabled,
  storageKey,
}: {
  enabled: boolean;
  storageKey?: string | null;
}) {
  const base = useChatModels({ enabled, storageKey });
  const selectionStorageKey =
    storageKey === undefined ? chatModelSelectionStorageKey() : storageKey;
  const retainedSelection = useRef<{
    storageKey: string | null;
    selection: PersistedSelection | null;
  } | null>(null);
  if (
    retainedSelection.current === null ||
    retainedSelection.current.storageKey !== selectionStorageKey
  ) {
    retainedSelection.current = {
      storageKey: selectionStorageKey,
      selection: readPersistedSelection(selectionStorageKey),
    };
  }
  const retained = retainedSelection.current!;
  const scopes = useActionQuery<ModelScopeList>(
    "model-scope-list",
    {},
    { enabled, staleTime: 30000 },
  );
  const groups = useMemo(
    () =>
      scopes.data
        ? scopedModelGroups(base.availableModels, scopes.data.providers)
        : base.availableModels.map((group) => ({ ...group, models: [] })),
    [base.availableModels, scopes.data],
  );
  useEffect(() => {
    const selection = retained.selection;
    if (!selection || !scopes.data) return;
    if (
      !isScopedCustomOpenAIModel(
        scopes.data.providers,
        selection.model,
        selection.engine,
      )
    ) {
      retained.selection = null;
      return;
    }
    if (
      groups.some(
        (group) =>
          group.engine === selection.engine &&
          group.models.includes(selection.model),
      ) &&
      (base.selectedModel !== selection.model ||
        base.selectedEngine !== selection.engine)
    ) {
      base.onModelChange(selection.model, selection.engine);
    }
  }, [
    base.onModelChange,
    base.selectedEngine,
    base.selectedModel,
    groups,
    retained,
    scopes.data,
  ]);
  const selection = retained.selection;
  const recoveredSelection =
    selection &&
    scopes.data &&
    isScopedCustomOpenAIModel(
      scopes.data.providers,
      selection.model,
      selection.engine,
    ) &&
    groups.some(
      (group) =>
        group.engine === selection.engine &&
        group.models.includes(selection.model),
    )
      ? selection
      : null;
  return {
    ...base,
    selectedModel: recoveredSelection?.model ?? base.selectedModel,
    selectedEngine: recoveredSelection?.engine ?? base.selectedEngine,
    availableModels: groups,
    isLoading: base.isLoading || scopes.isLoading,
    onModelChange: (model: string, engine: string) => {
      if (
        groups.some(
          (group) => group.engine === engine && group.models.includes(model),
        )
      ) {
        retained.selection =
          scopes.data &&
          isScopedCustomOpenAIModel(scopes.data.providers, model, engine)
            ? { model, engine }
            : null;
        base.onModelChange(model, engine);
      }
    },
  };
}

/** Override only the public model adapter; retain Core uploads, voice and chat. */
export function ScopedComposerModels({ children }: { children: ReactNode }) {
  const core = useComposerRuntimeAdapters();
  const adapters = useMemo(
    () => ({
      ...core,
      models: { ...core.models, useChatModels: useScopedChatModels },
    }),
    [core],
  );
  return (
    <ComposerRuntimeAdaptersProvider adapters={adapters}>
      {children}
    </ComposerRuntimeAdaptersProvider>
  );
}
