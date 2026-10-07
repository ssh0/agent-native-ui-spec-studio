import {
  fetchAgentLoopSettings,
  saveAgentLoopMaxIterations,
  type AgentLoopSettingsStatus,
} from "@agent-native/core/client/agent-loop-settings";
import { callAction } from "@agent-native/core/client/hooks";

export function validAgentLimit(
  value: string,
  status: AgentLoopSettingsStatus,
): boolean {
  const number = Number(value);
  return (
    value.trim() !== "" &&
    Number.isInteger(number) &&
    number >= status.minMaxIterations &&
    number <= status.maxMaxIterations
  );
}

/** Re-read the authoritative value; an accepted write is not proof it persisted. */
export async function updateAgentLimit(
  value: number | "reset",
  deps = {
    read: fetchAgentLoopSettings,
    save: saveAgentLoopMaxIterations,
    reset: async () => {
      const raw = await callAction<unknown>("manage-agent-loop-settings", {
        action: "reset",
      });
      const result = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!result || typeof result !== "object" || "error" in result)
        throw new Error("Agent limit reset failed.");
    },
  },
): Promise<AgentLoopSettingsStatus> {
  const before = await deps.read();
  if (!before.canUpdate) throw new Error("Agent limit is read-only.");
  if (value !== "reset" && !validAgentLimit(String(value), before))
    throw new Error("Agent limit is outside the allowed range.");
  if (value === "reset") await deps.reset();
  else await deps.save(value);
  const after = await deps.read();
  if (
    value === "reset"
      ? after.source === "org" || after.source === "user"
      : after.maxIterations !== value
  )
    throw new Error("Agent limit could not be verified.");
  return after;
}
