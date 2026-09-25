import { getAgentEngineEntry } from "@agent-native/core/agent/engine";

export const GEMINI_3_8_FLASH_MODEL_ID = "gemini-3.8-flash";

/** Add Google's current stable Flash model to the Core engine's curated picker. */
export function installGoogleModelOptions(): void {
  const entry = getAgentEngineEntry("ai-sdk:google");
  if (!entry) {
    throw new Error(
      'The built-in Google engine "ai-sdk:google" is not registered.',
    );
  }

  if (!entry.supportedModels.includes(GEMINI_3_8_FLASH_MODEL_ID)) {
    entry.supportedModels = [
      ...entry.supportedModels,
      GEMINI_3_8_FLASH_MODEL_ID,
    ];
  }
}
