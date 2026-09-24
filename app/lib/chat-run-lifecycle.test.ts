import {
  createAgentKitClient,
  type AgentTransport,
  type AgentEvent,
} from "@agent-native/agentkit";
import { describe, expect, it, vi } from "vitest";

import { chatPresentation } from "./chat-presentation";

function harness() {
  const listeners = new Map<string, (event: AgentEvent) => void>();
  const cancelRun = vi.fn(async () => {});
  const subscriptions: string[] = [];
  const completed = new Map<string, AgentEvent[]>();
  const transport: AgentTransport = {
    capabilities: { resumableRuns: true },
    getThread: async ({ threadId }) => ({
      id: threadId,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    }),
    getThreadSnapshot: async ({ threadId }) => ({
      id: threadId,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      messages: [],
      events: completed.get(threadId) ?? [],
    }),
    startRun: async ({ threadId }) => ({ runId: `run-${threadId}` }),
    subscribeToRun: ({ threadId, signal }) => {
      subscriptions.push(threadId);
      return {
        async *[Symbol.asyncIterator]() {
          const event = await new Promise<AgentEvent | null>((resolve) => {
            listeners.set(threadId, resolve);
            signal?.addEventListener("abort", () => resolve(null), {
              once: true,
            });
          });
          if (event) yield event;
        },
      };
    },
    cancelRun,
  };
  const complete = (threadId: string) => {
    const event: AgentEvent = {
      id: `done-${threadId}`,
      threadId,
      runId: `run-${threadId}`,
      sequence: 1,
      occurredAt: "2026-01-01T00:00:01Z",
      type: "run.completed",
    };
    completed.set(threadId, [event]);
    listeners.get(threadId)?.(event);
  };
  return { transport, complete, cancelRun, subscriptions };
}

describe("route presentation and durable run ownership", () => {
  it("toggles the editor pane and navigates without replacing the chat owner", () => {
    expect(chatPresentation("/spec", false)).toBe("hidden");
    expect(chatPresentation("/spec", true)).toBe("pane");
    expect(chatPresentation("/spec", false)).toBe("hidden");
    expect(chatPresentation("/spec-proposals", false)).toBe("hidden");
    expect(chatPresentation("/chat/thread-a", false)).toBe("full");
  });
  it("keeps stationary and navigated runs alive, then resumes their output by thread", async () => {
    const mock = harness();
    const client = createAgentKitClient({
      transport: mock.transport,
      retainActiveRunsOnThreadRelease: true,
    });
    const first = await client.openThread("project-a-thread");
    const runA = await client.sendMessage({
      threadId: "project-a-thread",
      text: "draft",
    });
    first.release(); // route unmount, pane close
    const second = await client.openThread("project-b-thread");
    const runB = await client.sendMessage({
      threadId: "project-b-thread",
      text: "other project",
    });
    await vi.waitFor(() => expect(mock.subscriptions).toHaveLength(2));
    mock.complete("project-a-thread");
    mock.complete("project-b-thread");
    await Promise.all([runA.completed, runB.completed]);
    expect(client.getThread("project-a-thread").runs[runA.runId]?.status).toBe(
      "completed",
    );
    const returned = await client.openThread("project-a-thread");
    expect(returned.getSnapshot().runs[runA.runId]?.status).toBe("completed");
    expect(mock.subscriptions).toEqual([
      "project-a-thread",
      "project-b-thread",
    ]);
    expect(mock.cancelRun).not.toHaveBeenCalled();
    returned.release();
    second.release();
    await client.shutdown();
  });

  it("disposal on navigation breaks the owner; releasing a view does not call Stop", async () => {
    const mock = harness();
    const client = createAgentKitClient({
      transport: mock.transport,
      retainActiveRunsOnThreadRelease: true,
    });
    const lease = await client.openThread("project-a-thread");
    const run = await client.sendMessage({
      threadId: "project-a-thread",
      text: "draft",
    });
    lease.release();
    expect(mock.cancelRun).not.toHaveBeenCalled();
    await client.shutdown(); // old route-local AgentKitRoot cleanup
    expect(mock.cancelRun).not.toHaveBeenCalled();
    await run.completed;
    expect(
      client.getThread("project-a-thread").runs[run.runId]?.status,
    ).not.toBe("completed");
  });

  it("explicit Stop targets only the selected run", async () => {
    const mock = harness();
    const client = createAgentKitClient({
      transport: mock.transport,
      retainActiveRunsOnThreadRelease: true,
    });
    const a = await client.openThread("project-a-thread");
    const b = await client.openThread("project-b-thread");
    const runA = await client.sendMessage({
      threadId: "project-a-thread",
      text: "a",
    });
    const runB = await client.sendMessage({
      threadId: "project-b-thread",
      text: "b",
    });
    await runB.cancel();
    expect(mock.cancelRun).toHaveBeenCalledWith(
      { threadId: "project-b-thread", runId: runB.runId },
      expect.anything(),
    );
    mock.complete("project-a-thread");
    await runA.completed;
    a.release();
    b.release();
    await client.shutdown();
  });
});
