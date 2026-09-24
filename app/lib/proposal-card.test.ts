import type { AgentEvent, AgentToolCall } from "@agent-native/agentkit";
import { describe, expect, it } from "vitest";

import { proposalForMessage } from "./proposal-card";

const id = "550e8400-e29b-41d4-a716-446655440000";
const base = {
  id: "event",
  threadId: "thread-a",
  runId: "run-a",
  sequence: 1,
  occurredAt: "2026-01-01T00:00:00Z",
};
const call: AgentToolCall = {
  id: "tool-a",
  name: "spec-bootstrap",
  input: { projectId: "project-a" },
  output: JSON.stringify({ id, status: "proposed" }),
  status: "completed",
};
const events: AgentEvent[] = [
  {
    ...base,
    type: "tool.started",
    toolCall: {
      id: call.id,
      name: call.name,
      input: call.input,
      status: "running",
    },
  },
  {
    ...base,
    id: "tool-done",
    sequence: 2,
    type: "tool.updated",
    toolCall: {
      id: call.id,
      name: call.name,
      output: call.output,
      status: "completed",
    },
  },
  {
    ...base,
    id: "answer",
    sequence: 3,
    type: "message.completed",
    message: {
      id: "answer",
      role: "assistant",
      parts: [{ type: "text", text: "案を作りました" }],
    },
  },
];

describe("proposal conversation card", () => {
  it("uses a completed action result in the same assistant turn and project", () => {
    expect(proposalForMessage(events, "answer", "project-a")).toBe(id);
    expect(proposalForMessage(events, "answer", "project-b")).toBeNull();
  });
  it("does not invent a link for prose, failed writes, or another message", () => {
    expect(
      proposalForMessage(events.slice(2), "answer", "project-a"),
    ).toBeNull();
    const failed = events.map((event) =>
      event.type === "tool.updated"
        ? {
            ...event,
            toolCall: { ...event.toolCall, status: "failed" as const },
          }
        : event,
    );
    expect(proposalForMessage(failed, "answer", "project-a")).toBeNull();
    expect(proposalForMessage(events, "other", "project-a")).toBeNull();
  });
});
