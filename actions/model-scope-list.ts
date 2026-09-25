import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { listModelScopes } from "../server/lib/provider-model-settings.js";

export default defineAction({
  description:
    "Read the current user's per-provider scoped models and cached catalogs without provider network requests.",
  schema: z.object({}),
  http: { method: "GET" },
  run: listModelScopes,
});
