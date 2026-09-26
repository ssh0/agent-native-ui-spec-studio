import {
  AgentSidebar,
  chatModelSelectionStorageKey,
  focusAgentChat,
  navigateWithAgentChatViewTransition,
  useAgentEngineConfigured,
} from "@agent-native/core/client/agent-chat";
import { useT } from "@agent-native/core/client/i18n";
import { type ReactNode } from "react";
import { useNavigate } from "react-router";

import { useScopedChatModels } from "@/components/chat/ScopedComposerModels";
import { TAB_ID } from "@/lib/tab-id";

interface AgentInspectorProps {
  children: ReactNode;
  chatHomeHandoffActive: boolean;
  chatHomeHandoffPending: boolean;
}

/** Legacy inspector sidebar, loaded only outside the primary AgentKit Chat. */
export function AgentInspector({
  children,
  chatHomeHandoffActive,
  chatHomeHandoffPending,
}: AgentInspectorProps) {
  const navigate = useNavigate();
  const t = useT();
  const engineStatus = useAgentEngineConfigured(true);
  const agentReady = engineStatus.state === "configured";
  const models = useScopedChatModels({
    enabled: agentReady,
    storageKey: chatModelSelectionStorageKey("chat"),
  });

  function openAskAgentFullscreen() {
    focusAgentChat();
    navigateWithAgentChatViewTransition(navigate, "/home");
  }

  return (
    <AgentSidebar
      enabled={agentReady}
      availableModels={models.availableModels}
      modelListLoading={models.isLoading}
      position="right"
      chatViewTransition
      chatViewTransitionHandoff={chatHomeHandoffPending}
      storageKey="chat"
      browserTabId={TAB_ID}
      openOnChatRunning={chatHomeHandoffActive}
      onFullscreenRequest={openAskAgentFullscreen}
      emptyStateText={t("chat.inspectEmptyState")}
      agentPageHref="/settings/agent"
      suggestions={[
        t("chat.inspectSuggestionCapabilities"),
        t("chat.inspectSuggestionHello"),
        t("chat.inspectSuggestionAction"),
      ]}
    >
      {children}
    </AgentSidebar>
  );
}
