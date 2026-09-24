import { defineAction, fail } from "@agent-native/core/action";
import { generateSpecLists } from "@shared/spec-lists";
import { parseSpecYaml } from "@shared/spec-utils";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "../server/db/index.js";
import { uiSpecs } from "../server/db/schema.js";
import { resolveSpecProject } from "../server/lib/spec-project.js";

export default defineAction({
  description: "Generate read-only screen and item/action lists from the saved UI specification YAML.",
  mcpTool: true,
  schema: z.object({ projectId: z.string().optional().describe("Selected project ID; defaults to current navigation") }),
  http: { method: "GET" },
  readOnly: true,
  publicAgent: { expose: true, readOnly: true, requiresAuth: true },
  run: async ({ projectId }) => {
    const project = await resolveSpecProject(projectId);
    const [row] = await getDb().select().from(uiSpecs).where(eq(uiSpecs.id, project.id));
    if (!row) fail("保存済みの仕様がありません。", { statusCode: 404 });
    const parsed = parseSpecYaml(row.yaml);
    if (!parsed.spec || parsed.issues.length)
      fail("保存済みの仕様に検証エラーがあります。修正してから一覧を生成してください。", { statusCode: 400 });
    return { ...generateSpecLists(parsed.spec), updatedAt: row.updatedAt };
  },
});
