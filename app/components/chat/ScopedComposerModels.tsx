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

const CHAT_MODEL_SELECTION_CHANGED_EVENT =
  "agent-native:chat-model-selection-changed";

type ReasoningEffort = ReturnType<typeof useChatModels>["selectedEffort"];
type PersistedSelection = {
  model: string;
  engine: string;
  effort?: ReasoningEffort;
};
type RetainedSelection = {
  storageKey: string | null;
  selection: PersistedSelection | null;
  lastCore: {
    model: string;
    engine: string;
    effort: ReasoningEffort;
    isLoading: boolean;
  };
  fallbackReady: boolean;
  recovering: boolean;
  externalSelection: boolean;
};
const reasoningEfforts: readonly ReasoningEffort[] = [
  "auto",
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
];

function readPersistedSelection(storageKey: string | null) {
  if (!storageKey || typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey) ?? "null");
    const effort = reasoningEfforts.find((option) => option === value?.effort);
    return typeof value?.model === "string" &&
      typeof value?.engine === "string"
      ? {
          model: value.model,
          engine: value.engine,
          ...(effort ? { effort } : {}),
        }
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
  const retainedSelection = useRef<RetainedSelection | null>(null);
  if (
    retainedSelection.current === null ||
    retainedSelection.current.storageKey !== selectionStorageKey
  ) {
    const selection = readPersistedSelection(selectionStorageKey);
    retainedSelection.current = {
      storageKey: selectionStorageKey,
      selection,
      lastCore: {
        model: base.selectedModel,
        engine: base.selectedEngine,
        effort: base.selectedEffort,
        isLoading: base.isLoading,
      },
      fallbackReady: false,
      recovering: false,
      externalSelection: false,
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
    const previous = retained.lastCore;
    const externalSelectionPending = retained.externalSelection;
    const coreSelectionChanged =
      previous.model !== base.selectedModel ||
      previous.engine !== base.selectedEngine ||
      previous.effort !== base.selectedEffort;
    if (externalSelectionPending) {
      const selection = readPersistedSelection(selectionStorageKey);
      const coreMatchesSelection =
        selection &&
        base.selectedModel === selection.model &&
        base.selectedEngine === selection.engine &&
        (!selection.effort || base.selectedEffort === selection.effort);
      if (!coreMatchesSelection) {
        retained.fallbackReady = false;
        retained.recovering = false;
        return;
      }
      retained.externalSelection = false;
    }
    if (
      !externalSelectionPending &&
      previous.isLoading &&
      !base.isLoading &&
      coreSelectionChanged
    ) {
      retained.fallbackReady = true;
    }
    retained.lastCore = {
      model: base.selectedModel,
      engine: base.selectedEngine,
      effort: base.selectedEffort,
      isLoading: base.isLoading,
    };
    if (!scopes.data) return;
    const selection = retained.selection;
    if (!selection) {
      retained.recovering = false;
      retained.fallbackReady = false;
      return;
    }
    if (
      !isScopedCustomOpenAIModel(
        scopes.data.providers,
        selection.model,
        selection.engine,
      ) ||
      !groups.some(
        (group) =>
          group.engine === selection.engine &&
          group.models.includes(selection.model),
      )
    ) {
      retained.selection = null;
      retained.fallbackReady = false;
      retained.recovering = false;
      return;
    }

    const selectedByCore =
      base.selectedModel === selection.model &&
      base.selectedEngine === selection.engine;
    if (retained.recovering && selectedByCore) {
      if (selection.effort && base.selectedEffort !== selection.effort) {
        base.onEffortChange(selection.effort);
        return;
      }
      retained.recovering = false;
      retained.fallbackReady = false;
      return;
    }
    retained.recovering = false;
    if (!selectedByCore) {
      if (retained.fallbackReady && !base.isLoading) {
        retained.fallbackReady = false;
        retained.recovering = true;
        base.onModelChange(selection.model, selection.engine);
        return;
      }
      retained.selection =
        isScopedCustomOpenAIModel(
          scopes.data.providers,
          base.selectedModel,
          base.selectedEngine,
        ) &&
        groups.some(
          (group) =>
            group.engine === base.selectedEngine &&
            group.models.includes(base.selectedModel),
        )
          ? {
              model: base.selectedModel,
              engine: base.selectedEngine,
              effort: base.selectedEffort,
            }
          : null;
    } else if (base.selectedEffort !== selection.effort) {
      retained.selection = { ...selection, effort: base.selectedEffort };
      retained.fallbackReady = false;
    }
  }, [
    base.onModelChange,
    base.onEffortChange,
    base.isLoading,
    base.selectedEngine,
    base.selectedEffort,
    base.selectedModel,
    groups,
    retained,
    scopes.data,
  ]);
  useEffect(() => {
    if (!selectionStorageKey || typeof window === "undefined") return;
    const acceptExternalSelection = () => {
      const selection = readPersistedSelection(selectionStorageKey);
      retained.selection =
        selection &&
        (!scopes.data ||
          isScopedCustomOpenAIModel(
            scopes.data.providers,
            selection.model,
            selection.engine,
          ))
          ? selection
          : null;
      retained.fallbackReady = false;
      retained.recovering = false;
      retained.externalSelection = selection !== null;
    };
    const syncSameTabSelection = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string }>).detail;
      if (detail?.key && detail.key !== selectionStorageKey) return;
      const selection = readPersistedSelection(selectionStorageKey);
      if (
        base.isLoading &&
        retained.selection &&
        base.selectedModel === retained.selection.model &&
        base.selectedEngine === retained.selection.engine &&
        selection &&
        (selection.model !== base.selectedModel ||
          selection.engine !== base.selectedEngine) &&
        !groups.some(
          (group) =>
            group.engine === selection.engine &&
            group.models.includes(selection.model),
        )
      ) {
        return;
      }
      acceptExternalSelection();
    };
    const syncCrossTabSelection = (event: StorageEvent) => {
      if (event.key !== selectionStorageKey) return;
      acceptExternalSelection();
    };
    window.addEventListener(
      CHAT_MODEL_SELECTION_CHANGED_EVENT,
      syncSameTabSelection,
    );
    window.addEventListener("storage", syncCrossTabSelection);
    return () => {
      window.removeEventListener(
        CHAT_MODEL_SELECTION_CHANGED_EVENT,
        syncSameTabSelection,
      );
      window.removeEventListener("storage", syncCrossTabSelection);
    };
  }, [
    base.isLoading,
    base.selectedEngine,
    base.selectedModel,
    groups,
    retained,
    scopes.data,
    selectionStorageKey,
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
    ) &&
    (retained.fallbackReady ||
      retained.recovering ||
      (base.selectedModel === selection.model &&
        base.selectedEngine === selection.engine))
      ? selection
      : null;
  return {
    ...base,
    selectedModel: recoveredSelection?.model ?? base.selectedModel,
    selectedEngine: recoveredSelection?.engine ?? base.selectedEngine,
    selectedEffort:
      recoveredSelection && (retained.fallbackReady || retained.recovering)
        ? (recoveredSelection.effort ?? base.selectedEffort)
        : base.selectedEffort,
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
            ? { model, engine, effort: base.selectedEffort }
            : null;
        retained.fallbackReady = false;
        retained.recovering = false;
        retained.externalSelection = false;
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
