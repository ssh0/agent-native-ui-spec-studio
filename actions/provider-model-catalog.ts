import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { loadProviderModels } from "../server/lib/provider-model-settings.js";
import { catalogProviders } from "../shared/provider-models.js";

export default defineAction({
  description:
    "Load one provider's official model catalog using its existing connection; successful results are cached for one hour and scopes are unchanged.",
  schema: z.object({
    provider: z
      .enum(catalogProviders)
      .describe("Provider whose official model catalog to load."),
  }),
  run: ({ provider }) => loadProviderModels(provider),
});
