import { defineAction, fail } from "@agent-native/core/action";
import { migrateSpecTo21 } from "@shared/spec-migration";
import { parseSpecYaml } from "@shared/spec-utils";
import { eq } from "drizzle-orm";
import { stringify } from "yaml";
import { z } from "zod";

import { getDb } from "../server/db/index.js";
import { uiSpecs } from "../server/db/schema.js";
import { resolveSpecProject } from "../server/lib/spec-project.js";
import { saveSpecVersion } from "../server/lib/spec-version-store.js";

export default defineAction({
  description: "Explicitly migrate a saved, valid UI specification from 2.0 to 2.1. Assign stable IDs to screen and state transitions. Existing review entries and hashes are preserved.",
  mcpTool: true,
  schema: z.object({
    projectId: z.string().optional().describe("Selected project ID; defaults to current navigation"),
    expectedUpdatedAt: z.string().describe("Timestamp from spec-load; rejects concurrent edits"),
  }),
  publicAgent: { expose: true, readOnly: false, requiresAuth: true },
  run: async ({ projectId, expectedUpdatedAt }) => {
    const project = await resolveSpecProject(projectId);
    const db = getDb();
    const [row] = await db.select().from(uiSpecs).where(eq(uiSpecs.id, project.id));
    if (!row) fail("保存済みの仕様がありません。", { statusCode: 404 });
    const parsed = parseSpecYaml(row.yaml);
    if (!parsed.spec || parsed.issues.length)
      fail(`移行前に仕様の検証エラーを解決してください。\n${parsed.issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n")}`, { statusCode: 400 });
    const migrated = migrateSpecTo21(parsed.spec);
    if (!migrated.spec || migrated.issues.length)
      fail(`移行できません。\n${migrated.issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n")}`, { statusCode: 400 });
    const yaml = stringify(migrated.spec);
    const updated = await saveSpecVersion(project.id, project.ownerEmail, yaml, expectedUpdatedAt);
    return { id: updated.id, yaml: updated.yaml, updatedAt: updated.updatedAt, version: "2.1" as const };
  },
});
