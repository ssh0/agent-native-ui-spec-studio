import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { saveModelScope } from "../server/lib/provider-model-settings.js";
import { catalogProviders } from "../shared/provider-models.js";

export default defineAction({
  description:
    "Set personal scoped models for one provider's chat picker. null restores all models; [] hides all except the current selection. Does not change the conversation model or shared default.",
  schema: z.object({
    provider: z
      .enum(catalogProviders)
      .describe("Provider whose personal model scope to update."),
    models: z
      .array(z.string().trim().min(1).max(300))
      .max(10000)
      .nullable()
      .describe(
        "Allowed model IDs, including custom IDs. null = unrestricted; [] = none except current selection.",
      ),
  }),
  run: ({ provider, models }) => saveModelScope(provider, models),
});
