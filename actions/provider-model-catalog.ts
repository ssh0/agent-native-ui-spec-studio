import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { loadProviderModels } from "../server/lib/provider-model-settings.js";
import { catalogProviders } from "../shared/provider-models.js";

export default defineAction({
  description:
    "Discover one provider's chat model catalog using its existing connection; cached for one hour. Refresh keeps saved scopes and current selections.",
  schema: z.object({
    provider: z
      .enum(catalogProviders)
      .describe("Provider whose official model catalog to load."),
    refresh: z
      .boolean()
      .default(false)
      .describe(
        "Force a provider refresh instead of using the one-hour cache; defaults to false.",
      ),
  }),
  run: ({ provider, refresh }) => loadProviderModels(provider, refresh),
});
