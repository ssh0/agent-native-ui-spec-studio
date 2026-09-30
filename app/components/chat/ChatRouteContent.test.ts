import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./ChatRouteContent.tsx", import.meta.url),
  "utf8",
);

describe("chat route workspace removal", () => {
  it("does not expose the workspace toggle, panel, slot, or open-state layout", () => {
    expect(source).not.toContain("data-agent-page-workspace-toggle");
    expect(source).not.toContain("data-agent-chat-workspace-panel");
    expect(source).not.toContain("data-agent-chat-workspace-slot");
    expect(source).not.toContain("workspaceOpen");
    expect(source).not.toContain("agent-kit-chat-canvas-body--workspace-open");
  });

  it("retains the shared chat runtime and project navigation", () => {
    expect(source).toContain("<AgentKitRoot");
    expect(source).toContain("<AgentKitChat");
    expect(source).toContain("<CoreComposerRuntimeProvider>");
    expect(source).toContain('className="min-w-0 flex-1 overflow-hidden"');
    expect(source).toContain("projectId && !compact");
    expect(source).toContain("/spec?project=");
    expect(source).toContain("/spec-proposals?project=");
  });
});
