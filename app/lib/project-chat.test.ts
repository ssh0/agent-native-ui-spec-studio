import { afterEach, describe, expect, it, vi } from "vitest";

import { createProjectThread, projectThreadExists } from "./project-chat";

afterEach(() => vi.unstubAllGlobals());

describe("project conversation opening", () => {
  it("opens a newly created empty scoped conversation even though history omits it", async () => {
    const project = { id: "new-project", name: "New project" };
    const threadId = "new-thread";
    const fetcher = vi.fn(async (input: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        expect(JSON.parse(String(init.body))).toEqual({
          id: threadId,
          title: "新しい会話",
          scope: {
            type: "ui-spec-project",
            id: project.id,
            label: project.name,
          },
        });
        return new Response(JSON.stringify({ id: threadId }), { status: 201 });
      }
      if (input.endsWith("/threads")) {
        return new Response(JSON.stringify({ threads: [] }));
      }
      return new Response(
        JSON.stringify({
          id: threadId,
          messageCount: 0,
          scope: { type: "ui-spec-project", id: project.id },
        }),
      );
    });
    vi.stubGlobal("fetch", fetcher);

    await createProjectThread(threadId, project);
    const history = await (await fetch("/_agent-native/agent-chat/threads")).json();
    expect(history.threads).toEqual([]);
    expect(await projectThreadExists(threadId, project.id)).toBe(true);
    expect(fetcher.mock.calls[2]?.[0]).toContain(
      `/threads/${threadId}?scopeType=ui-spec-project&scopeId=${project.id}`,
    );
  });

  it("rejects a thread from another project even if detail responds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            id: "thread-a",
            scope: { type: "ui-spec-project", id: "project-b" },
          }),
        ),
      ),
    );
    expect(await projectThreadExists("thread-a", "project-a")).toBe(false);
  });

  it("keeps the legacy unscoped project restricted to unscoped threads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ id: "thread-a", scope: null })),
      ),
    );
    expect(await projectThreadExists("thread-a", "default")).toBe(true);
  });
});
