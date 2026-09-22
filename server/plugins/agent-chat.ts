import { getOrgContext } from "@agent-native/core/org";
import {
  createAgentChatPlugin,
  loadActionsFromStaticRegistry,
} from "@agent-native/core/server";

import actionsRegistry from "../../.generated/actions-registry.js";
import { installProviderSafeEngines } from "../agent/provider-safe-engine.js";

const INITIAL_TOOL_NAMES = [
  "view-screen",
  "navigate",
  "hello",
  "provider-api-request",
  "spec-load",
  "spec-update",
  "spec-validate",
  "spec-render-wireframe",
  "spec-render-flow",
  "spec-review",
];

const agentChatPlugin = createAgentChatPlugin({
  appId: "ui-spec-studio",
  actions: loadActionsFromStaticRegistry(actionsRegistry),
  initialToolNames: INITIAL_TOOL_NAMES,
  mcp: { externalAgents: { writes: "allowlisted" } },
  resolveOrgId: async (event) => (await getOrgContext(event)).orgId,
  systemPrompt: `You are the Chat app agent.

This is a chat-first UI specification workspace. The chat and UI share the same actions and database. For UI specification work, use spec-load to inspect the current YAML, spec-validate before saving or reviewing, spec-update to persist edits, spec-render-wireframe and spec-render-flow for human-readable previews, and spec-review for approval or change requests. Actions are the contract shared by chat, UI, HTTP, MCP, A2A, and CLI.

Use actions as the source of truth. Start by inspecting the current screen when context matters. When the user asks to extend this app, keep the change small and agent-native: add or update actions, expose useful UI, and keep application state/navigation visible to the agent.`,
});

export default (nitroApp: Parameters<typeof agentChatPlugin>[0]) => {
  installProviderSafeEngines();
  agentChatPlugin(nitroApp);
};
