import { createHash, randomUUID } from "node:crypto";

import { defineAction, fail } from "@agent-native/core/action";
import { stages, type ReviewEntry } from "@shared/spec-schema";
import { parseSpecYaml } from "@shared/spec-utils";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "../server/db/index.js";
import { uiSpecs } from "../server/db/schema.js";
import { resolveSpecProject } from "../server/lib/spec-project.js";
import { ensureCurrentVersion } from "../server/lib/spec-version-store.js";

export default defineAction({
  description:
    "Approve or return the saved specification; retain a review history linked to stage and document hash. Review requires valid YAML.",
  mcpTool: true,
  schema: z.object({
    projectId: z
      .string()
      .optional()
      .describe("Selected project ID; defaults to current navigation"),
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
  publicAgent: { expose: true, readOnly: false, requiresAuth: true },
  run: async ({ status, comment, stage, expectedUpdatedAt, projectId }) => {
    const project = await resolveSpecProject(projectId);
    const db = getDb();
    const row = await ensureCurrentVersion(project.id);
    if (!row) fail("仕様が保存されていません。", { statusCode: 404 });
    if (expectedUpdatedAt && row.updatedAt !== expectedUpdatedAt)
      fail("仕様が更新されています。読み直してからレビューしてください。", {
        statusCode: 409,
      });
    if (parseSpecYaml(row.yaml).issues.length)
      fail("検証エラーのある仕様はレビューできません。");
    const entry: ReviewEntry = {
      id: randomUUID(),
      status,
      comment: comment ?? "",
      stage,
      createdAt: new Date().toISOString(),
      documentHash: createHash("sha256").update(row.yaml).digest("hex"),
      versionId: row.currentVersionId ?? undefined,
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
        and(eq(uiSpecs.id, project.id), eq(uiSpecs.updatedAt, row.updatedAt)),
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
