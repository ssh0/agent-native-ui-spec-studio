import {
  getAgentEngineEntry,
  type AgentEngineEntry,
} from "@agent-native/core/agent/engine";
import type {
  AgentEngine,
  EngineContentPart,
  EngineEvent,
  EngineMessage,
  EngineTool,
} from "@agent-native/core/agent/engine";

const PROVIDER_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;
const PROVIDER_NAME_MAX_LENGTH = 64;
const PROVIDER_ENGINE_NAMES = ["ai-sdk:openai", "ai-sdk:openrouter"] as const;

type ProviderNameMap = {
  toProvider: Map<string, string>;
  toEngine: Map<string, string>;
};

function hashName(value: string, seed: number): string {
  let hash = seed;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function providerNameAlias(name: string): string {
  return `tool_${hashName(name, 2166136261)}_${hashName(name, 16777619)}`;
}

function isProviderSafeName(name: string): boolean {
  return (
    name.length <= PROVIDER_NAME_MAX_LENGTH && PROVIDER_NAME_PATTERN.test(name)
  );
}

function collectMessageToolNames(messages: readonly EngineMessage[]): string[] {
  return messages.flatMap((message) =>
    message.content.flatMap((part) => {
      if (part.type === "tool-call") return [part.name];
      if (part.type === "tool-result") return [part.toolName];
      return [];
    }),
  );
}

/**
 * OpenAI-compatible providers validate function names in both the tool schema
 * and replayed function-call history. Older threads can therefore retain an
 * action name such as `spec.load` even after the action was renamed. Keep the
 * engine's internal/action name, but use a reversible provider alias on the
 * wire for every invalid or overlong name.
 */
export function createProviderNameMap(
  tools: readonly EngineTool[],
  messages: readonly EngineMessage[],
): ProviderNameMap {
  const names = [
    ...tools.map((tool) => tool.name),
    ...collectMessageToolNames(messages),
  ];
  const uniqueNames = [...new Set(names)];
  const usedProviderNames = new Set(
    uniqueNames.filter((name) => isProviderSafeName(name)),
  );
  const toProvider = new Map<string, string>();
  const toEngine = new Map<string, string>();

  for (const name of uniqueNames) {
    if (isProviderSafeName(name)) {
      toProvider.set(name, name);
      toEngine.set(name, name);
      continue;
    }

    const base = providerNameAlias(name);
    let alias = base;
    let suffix = 1;
    while (usedProviderNames.has(alias)) {
      alias = `${base}_${suffix}`;
      suffix += 1;
    }
    usedProviderNames.add(alias);
    toProvider.set(name, alias);
    toEngine.set(alias, name);
  }

  return { toProvider, toEngine };
}

function toProviderName(name: string, map: ProviderNameMap): string {
  return (
    map.toProvider.get(name) ??
    (isProviderSafeName(name) ? name : providerNameAlias(name))
  );
}

function toEngineName(
  name: string | undefined,
  map: ProviderNameMap,
): string | undefined {
  if (typeof name !== "string") return name;
  return map.toEngine.get(name) ?? name;
}

function mapContentPart(
  part: EngineContentPart,
  map: ProviderNameMap,
): EngineContentPart {
  if (part.type === "tool-call") {
    return { ...part, name: toProviderName(part.name, map) };
  }
  if (part.type === "tool-result") {
    return { ...part, toolName: toProviderName(part.toolName, map) };
  }
  return part;
}

function mapMessage(
  message: EngineMessage,
  map: ProviderNameMap,
): EngineMessage {
  return {
    ...message,
    content: message.content.map((part) => mapContentPart(part, map)),
  } as EngineMessage;
}

function mapTool(tool: EngineTool, map: ProviderNameMap): EngineTool {
  return { ...tool, name: toProviderName(tool.name, map) };
}

function mapEvent(event: EngineEvent, map: ProviderNameMap): EngineEvent {
  switch (event.type) {
    case "tool-input-start":
    case "tool-input-delta":
      return {
        ...event,
        ...(event.name ? { name: toEngineName(event.name, map) } : {}),
      };
    case "tool-call":
    case "tool-call-error":
      return {
        ...event,
        name: toEngineName(event.name, map) ?? event.name,
      };
    case "assistant-content":
      return {
        ...event,
        parts: event.parts.map((part) => {
          if (part.type === "tool-call") {
            return { ...part, name: toEngineName(part.name, map) ?? part.name };
          }
          if (part.type === "tool-result") {
            return {
              ...part,
              toolName: toEngineName(part.toolName, map) ?? part.toolName,
            };
          }
          return part;
        }),
      };
    default:
      return event;
  }
}

/** Wrap an engine so stale tool names are safe for OpenAI-compatible APIs. */
export function createProviderSafeEngine(engine: AgentEngine): AgentEngine {
  return {
    ...engine,
    async *stream(options) {
      const map = createProviderNameMap(options.tools, options.messages);
      const providerOptions = {
        ...options,
        tools: options.tools.map((tool) => mapTool(tool, map)),
        messages: options.messages.map((message) => mapMessage(message, map)),
      };
      for await (const event of engine.stream(providerOptions)) {
        yield mapEvent(event, map);
      }
    },
  };
}

const wrappedFactories = new Map<string, AgentEngineEntry["create"]>();

/**
 * Install the compatibility wrapper without changing engine names or settings.
 * Mutating the public entry in place preserves insertion order for automatic
 * credential detection.
 */
export function installProviderSafeEngines(): void {
  for (const engineName of PROVIDER_ENGINE_NAMES) {
    const entry = getAgentEngineEntry(engineName);
    if (!entry) continue;
    const previous = wrappedFactories.get(engineName);
    if (previous === entry.create) continue;

    const originalCreate = entry.create;
    const wrappedCreate: AgentEngineEntry["create"] = (config) =>
      createProviderSafeEngine(originalCreate(config));
    wrappedFactories.set(engineName, wrappedCreate);
    // The public registry entry is mutable. Updating its factory in place keeps
    // automatic engine-detection priority and avoids replacing a framework
    // entry through private registry internals.
    entry.create = wrappedCreate;
  }
}

/** Useful for focused tests and diagnostics without inspecting provider payloads. */
export function providerNameIsSafe(name: string): boolean {
  return isProviderSafeName(name);
}

/** Return the names this app protects against stale conversation history. */
export function providerSafeEngineNames(): readonly string[] {
  return PROVIDER_ENGINE_NAMES;
}
