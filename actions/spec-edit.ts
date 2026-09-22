import { defineAction } from "@agent-native/core/action";
import { EditOperationSchema, editSpec } from "@shared/spec-edit";
import { SpecSchema } from "@shared/spec-schema";
import { and, eq } from "drizzle-orm";
import { parse, stringify } from "yaml";

import { getDb } from "../server/db/index.js";
import { uiSpecs } from "../server/db/schema.js";

export default defineAction({
  description:
    "Edit screens/components/transitions or replace domain/flows/useCases with set_section. Validates all references; use spec-update for full YAML drafts.",
  schema: EditOperationSchema,
  run: async (input) => {
    const db = getDb();
    const [row] = await db
      .select()
      .from(uiSpecs)
      .where(eq(uiSpecs.id, "default"));
    if (!row) throw new Error("仕様が保存されていません。");
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
        and(eq(uiSpecs.id, "default"), eq(uiSpecs.updatedAt, row.updatedAt)),
      )
      .returning();
    if (!updated)
      throw new Error("別の編集が保存されました。仕様を読み直してください。");
    return {
      yaml: updated.yaml,
      reviewStatus: updated.reviewStatus,
      updatedAt: updated.updatedAt,
    };
  },
});
