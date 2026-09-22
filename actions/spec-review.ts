import { createHash, randomUUID } from "node:crypto";

import { defineAction, fail } from "@agent-native/core/action";
import { stages, type ReviewEntry } from "@shared/spec-schema";
import { parseSpecYaml } from "@shared/spec-utils";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "../server/db/index.js";
import { uiSpecs } from "../server/db/schema.js";

export default defineAction({
  description:
    "Approve or return the saved specification; retain a review history linked to stage and document hash. Approval requires valid YAML.",
  schema: z.object({
    status: z.enum(["approved", "changes_requested"]),
    comment: z.string().max(2000).optional().describe("Review note"),
    stage: z
      .enum(stages)
      .default("screens")
      .describe(
        "Review focus; defaults to screens. Approval applies to the whole saved document.",
      ),
    expectedUpdatedAt: z
      .string()
      .optional()
      .describe("Last loaded timestamp to reject a stale review"),
  }),
  run: async ({ status, comment, stage, expectedUpdatedAt }) => {
    const db = getDb();
    const [row] = await db
      .select()
      .from(uiSpecs)
      .where(eq(uiSpecs.id, "default"));
    if (!row) fail("仕様が保存されていません。", { statusCode: 404 });
    if (expectedUpdatedAt && row.updatedAt !== expectedUpdatedAt)
      fail("仕様が更新されています。読み直してからレビューしてください。", {
        statusCode: 409,
      });
    if (status === "approved" && parseSpecYaml(row.yaml).issues.length)
      fail("検証エラーのある仕様は承認できません。");
    const entry: ReviewEntry = {
      id: randomUUID(),
      status,
      comment: comment ?? "",
      stage,
      createdAt: new Date().toISOString(),
      documentHash: createHash("sha256").update(row.yaml).digest("hex"),
    };
    const [updated] = await db
      .update(uiSpecs)
      .set({
        reviewStatus: status,
        reviewComment: comment ?? null,
        reviewHistory: [...row.reviewHistory, entry],
        updatedAt: entry.createdAt,
      })
      .where(
        and(eq(uiSpecs.id, "default"), eq(uiSpecs.updatedAt, row.updatedAt)),
      )
      .returning();
    if (!updated)
      fail("仕様が更新されています。読み直してからレビューしてください。", {
        statusCode: 409,
      });
    return {
      status: updated.reviewStatus,
      comment: updated.reviewComment,
      updatedAt: updated.updatedAt,
      reviewHistory: updated.reviewHistory,
    };
  },
});
