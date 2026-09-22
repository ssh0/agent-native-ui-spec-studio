import { defineAction } from "@agent-native/core/action";
import { DEFAULT_SPEC_YAML } from "@shared/default-spec";
import { parseSpecYaml } from "@shared/spec-utils";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "../server/db/index.js";
import * as schema from "../server/db/schema.js";

const SPEC_ID = "default";

export default defineAction({
  description:
    "Validate UI specification YAML, scoped IDs and references across domain, flows, use cases, screens, states and component actions.",
  schema: z.object({
    yaml: z
      .string()
      .optional()
      .describe("YAML to validate; loads the shared document when omitted"),
  }),
  run: async ({ yaml }) => {
    let source = yaml;
    if (source === undefined) {
      const [row] = await getDb()
        .select()
        .from(schema.uiSpecs)
        .where(eq(schema.uiSpecs.id, SPEC_ID));
      source = row?.yaml ?? DEFAULT_SPEC_YAML;
    }
    const result = parseSpecYaml(source ?? DEFAULT_SPEC_YAML);
    return {
      valid: result.issues.length === 0,
      issues: result.issues,
      spec: result.spec ?? null,
    };
  },
});
