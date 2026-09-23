import { defineAction } from "@agent-native/core/action";
import { parseSpecYaml } from "@shared/spec-utils";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "../server/db/index.js";
import * as schema from "../server/db/schema.js";
import { resolveSpecProject } from "../server/lib/spec-project.js";

export default defineAction({
  description:
    "Validate UI specification YAML, scoped IDs and references across domain, flows, use cases, screens, states and component actions.",
  mcpTool: true,
  schema: z.object({
    projectId: z
      .string()
      .optional()
      .describe("Selected project ID; defaults to current navigation"),
    yaml: z
      .string()
      .optional()
      .describe("YAML to validate; loads the shared document when omitted"),
  }),
  publicAgent: { expose: true, readOnly: false, requiresAuth: true },
  run: async ({ yaml, projectId }) => {
    const project = await resolveSpecProject(projectId);
    let source = yaml;
    if (source === undefined) {
      const [row] = await getDb()
        .select()
        .from(schema.uiSpecs)
        .where(eq(schema.uiSpecs.id, project.id));
      source = row?.yaml;
    }
    if (!source)
      return {
        valid: false,
        issues: [
          {
            path: "",
            message:
              "仕様の骨格がまだありません。チャットでプロダクトを説明してください。",
          },
        ],
        spec: null,
      };
    const result = parseSpecYaml(source);
    return {
      valid: result.issues.length === 0,
      issues: result.issues,
      spec: result.spec ?? null,
    };
  },
});
