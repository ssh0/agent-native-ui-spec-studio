import { defineAction, fail } from "@agent-native/core/action";
import { EditOperationSchema, editSpec } from "@shared/spec-edit";
import { SpecSchema } from "@shared/spec-schema";
import { and, eq } from "drizzle-orm";
import { parse, stringify } from "yaml";
import { z } from "zod";

import { getDb } from "../server/db/index.js";
import { uiSpecs } from "../server/db/schema.js";
import { resolveSpecProject } from "../server/lib/spec-project.js";

export default defineAction({
  description:
    "Edit screens/components/transitions or replace domain/flows/useCases with set_section. Validates all references; use spec-update for full YAML drafts.",
  mcpTool: true,
  schema: EditOperationSchema.extend({
    projectId: z
      .string()
      .optional()
      .describe("Selected project ID; defaults to current navigation"),
  }),
  publicAgent: { expose: true, readOnly: false, requiresAuth: true },
  run: async (input) => {
    const project = await resolveSpecProject(input.projectId);
    const db = getDb();
    const [row] = await db
      .select()
      .from(uiSpecs)
      .where(eq(uiSpecs.id, project.id));
    if (!row) fail("仕様が保存されていません。", { statusCode: 404 });
    const yaml = stringify(editSpec(SpecSchema.parse(parse(row.yaml)), input));
    const [updated] = await db
      .update(uiSpecs)
      .set({
        yaml,
        reviewStatus: "draft",
        reviewComment: null,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(eq(uiSpecs.id, project.id), eq(uiSpecs.updatedAt, row.updatedAt)),
      )
      .returning();
    if (!updated)
      fail("別の編集が保存されました。仕様を読み直してください。", {
        statusCode: 409,
      });
    return {
      yaml: updated.yaml,
      reviewStatus: updated.reviewStatus,
      updatedAt: updated.updatedAt,
    };
  },
});
