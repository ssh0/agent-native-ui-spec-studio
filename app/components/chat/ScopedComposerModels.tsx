import { useChatModels } from "@agent-native/core/client/agent-chat";
import { useActionQuery } from "@agent-native/core/client/hooks";
import {
  ComposerRuntimeAdaptersProvider,
  useComposerRuntimeAdapters,
} from "@agent-native/toolkit/composer/runtime-adapters";
import { useMemo, type ReactNode } from "react";

import {
  scopedModelGroups,
  type ModelScopeList,
} from "../../../shared/provider-models";

export function useScopedChatModels({
  enabled,
  storageKey,
}: {
  enabled: boolean;
  storageKey?: string;
}) {
  const base = useChatModels({ enabled, storageKey });
  const scopes = useActionQuery<ModelScopeList>(
    "model-scope-list",
    {},
    { enabled, staleTime: 30000 },
  );
  const groups = scopes.data
    ? scopedModelGroups(base.availableModels, scopes.data.providers)
    : base.availableModels.map((group) => ({ ...group, models: [] }));
  return {
    ...base,
    availableModels: groups,
    isLoading: base.isLoading || scopes.isLoading,
    onModelChange: (model: string, engine: string) => {
      if (
        groups.some(
          (group) => group.engine === engine && group.models.includes(model),
        )
      )
        base.onModelChange(model, engine);
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
