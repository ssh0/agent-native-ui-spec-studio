import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { saveModelScope } from "../server/lib/provider-model-settings.js";
import { catalogProviders } from "../shared/provider-models.js";

export default defineAction({
  agentTool: false,
  description:
    "Save the Settings UI user's scoped model IDs for one provider. null allows all discovered models; [] allows none. This UI-only operation does not change the conversation model or shared default.",
  schema: z.object({
    provider: z
      .enum(catalogProviders)
      .describe("Provider whose personal model scope to update."),
    models: z
      .array(z.string().trim().min(1).max(300))
      .max(10000)
      .refine((models) => new Set(models).size === models.length, {
        message: "Model IDs must be unique.",
      })
      .nullable()
      .describe(
        "Allowed model IDs, including custom IDs. null = unrestricted; [] = none.",
      ),
  }),
  run: ({ provider, models }) => saveModelScope(provider, models),
});
