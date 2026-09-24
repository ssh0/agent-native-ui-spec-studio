import type { AgentEvent } from "@agent-native/agentkit";

const proposalActions = new Set(["spec-bootstrap", "spec-proposal-create"]);

function record(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      return record(JSON.parse(value));
    } catch {
      return null;
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** A card is grounded in a completed write belonging to this project's message. */
export function proposalForMessage(
  events: AgentEvent[],
  messageId: string,
  projectId: string,
): string | null {
  const messageIndex = events.findIndex(
    (event) =>
      event.type === "message.completed" && event.message.id === messageId,
  );
  if (messageIndex < 0) return null;
  const runId = events[messageIndex]?.runId;
  for (let index = messageIndex - 1; index >= 0; index--) {
    const event = events[index];
    if (event?.runId !== runId) continue;
    if (
      event.type === "message.completed" &&
      event.message.role === "assistant"
    )
      break;
    if (event.type !== "tool.updated" || event.toolCall.status !== "completed")
      continue;
    if (!proposalActions.has(event.toolCall.name)) continue;
    const started = events
      .slice(0, index)
      .reverse()
      .find(
        (candidate) =>
          candidate.runId === runId &&
          candidate.type === "tool.started" &&
          candidate.toolCall.id === event.toolCall.id,
      );
    const input =
      started?.type === "tool.started" ? record(started.toolCall.input) : null;
    const output = record(event.toolCall.output);
    if (input?.projectId !== projectId || typeof output?.id !== "string")
      continue;
    if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(output.id)) return output.id;
  }
  return null;
}
