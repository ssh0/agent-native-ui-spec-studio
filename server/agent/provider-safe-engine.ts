import {
  getAgentEngineEntry,
  type AgentEngineEntry,
} from "@agent-native/core/agent/engine";
import {
  createProviderSafeEngine,
  providerSafeEngineNames,
} from "./provider-safe-adapter";

// Preserve the existing public entry point while pure consumers avoid registry bootstrap.
export {
  createProviderNameMap,
  createProviderSafeEngine,
  providerNameIsSafe,
  providerSafeEngineNames,
} from "./provider-safe-adapter";

const wrappedFactories = new Map<string, AgentEngineEntry["create"]>();

/**
 * Install the compatibility wrapper without changing engine names or settings.
 * Mutating the public entry in place preserves insertion order for automatic
 * credential detection.
 */
export function installProviderSafeEngines(): void {
  for (const engineName of providerSafeEngineNames()) {
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
