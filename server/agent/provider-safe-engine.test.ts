import type {
  AgentEngine,
  EngineEvent,
  EngineMessage,
  EngineTool,
} from "@agent-native/core/agent/engine";
import { describe, expect, it } from "vitest";

import {
  createProviderNameMap,
  createProviderSafeEngine,
  providerNameIsSafe,
} from "./provider-safe-engine";

const staleName = "spec.load";

function tool(name: string): EngineTool {
  return {
    name,
    description: "test tool",
    inputSchema: { type: "object" },
  };
}

function history(): EngineMessage[] {
  return [
    {
      role: "assistant",
      content: [
        { type: "tool-call", id: "call-1", name: staleName, input: {} },
      ],
    },
    {
      role: "user",
      content: [
        {
          type: "tool-result",
          toolCallId: "call-1",
          toolName: staleName,
          toolInput: "{}",
          content: "loaded",
        },
      ],
    },
  ];
}

describe("provider-safe engine adapter", () => {
  it("aliases invalid names in tools and replayed history", () => {
    const map = createProviderNameMap([tool(staleName)], history());
    const providerName = map.toProvider.get(staleName);

    expect(providerName).toBeDefined();
    expect(providerName).not.toBe(staleName);
    expect(providerNameIsSafe(providerName!)).toBe(true);
    expect(providerName).toMatch(/^[a-zA-Z0-9_-]+$/);
  });

  it("maps provider events back to the original action name", async () => {
    let sent: { tools: EngineTool[]; messages: EngineMessage[] } | undefined;
    const providerEvent: EngineEvent = {
      type: "tool-call",
      id: "call-1",
      name: staleName,
      input: {},
    };
    const provider: AgentEngine = {
      name: "test",
      label: "Test",
      defaultModel: "test-model",
      supportedModels: ["test-model"],
      capabilities: {
        thinking: false,
        promptCaching: false,
        vision: false,
        computerUse: false,
        parallelToolCalls: false,
      },
      async *stream(options) {
        sent = { tools: options.tools, messages: options.messages };
        // A real provider returns the name it was given in its safe tool schema.
        yield {
          ...providerEvent,
          name: options.tools[0]?.name ?? staleName,
        };
      },
    };

    const events = [];
    for await (const event of createProviderSafeEngine(provider).stream({
      model: "test-model",
      systemPrompt: "",
      tools: [tool(staleName)],
      messages: history(),
      abortSignal: new AbortController().signal,
    })) {
      events.push(event);
    }

    expect(sent).toBeDefined();
    expect(sent!.tools[0]!.name).not.toBe(staleName);
    expect(providerNameIsSafe(sent!.tools[0]!.name)).toBe(true);
    expect((sent!.messages[0]!.content[0] as { name: string }).name).toBe(
      sent!.tools[0]!.name,
    );
    expect(events[0]).toEqual(providerEvent);
  });
});
