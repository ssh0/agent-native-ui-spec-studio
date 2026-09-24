import { createHash, randomUUID } from "node:crypto";
import { fail } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { specVersions, uiSpecs } from "../db/schema.js";
import { parseSpecYaml } from "../../shared/spec-utils.js";

const hash = (yaml: string) => createHash("sha256").update(yaml).digest("hex");
const valid = (yaml: string) => { const parsed = parseSpecYaml(yaml); return !!parsed.spec && !parsed.issues.length; };

/** Lazily index a pre-P2 valid document without changing its saved YAML or review status. */
export async function ensureCurrentVersion(projectId: string) {
  const db = getDb();
  const [row] = await db.select().from(uiSpecs).where(eq(uiSpecs.id, projectId));
  if (!row || row.currentVersionId || !valid(row.yaml)) return row;
  const version = { id: randomUUID(), projectId, ownerEmail: row.ownerEmail!, yaml: row.yaml, documentHash: hash(row.yaml), createdAt: row.updatedAt };
  await db.transaction(async (tx) => {
    const [claimed] = await tx.update(uiSpecs).set({ currentVersionId: version.id })
      .where(and(eq(uiSpecs.id, projectId), eq(uiSpecs.updatedAt, row.updatedAt), eq(uiSpecs.yaml, row.yaml)))
      .returning();
    if (claimed) await tx.insert(specVersions).values(version);
  });
  const [current] = await db.select().from(uiSpecs).where(eq(uiSpecs.id, projectId));
  return current;
}

export async function saveSpecVersion(projectId: string, ownerEmail: string, yaml: string, expectedUpdatedAt?: string) {
  const db = getDb();
  await ensureCurrentVersion(projectId);
  return db.transaction(async (tx) => {
    const [previous] = await tx.select().from(uiSpecs).where(eq(uiSpecs.id, projectId)).for("update");
    if (expectedUpdatedAt && previous?.updatedAt !== expectedUpdatedAt)
      fail("別の編集が保存されました。仕様を読み直してください。", { statusCode: 409 });
    if (previous?.yaml === yaml) return previous;
    const now = new Date().toISOString();
    const version = valid(yaml) ? { id: randomUUID(), projectId, ownerEmail, yaml, documentHash: hash(yaml), createdAt: now } : null;
    const values = { ownerEmail, yaml, currentVersionId: version?.id ?? null, reviewStatus: "draft", reviewComment: null, updatedAt: now };
    const [updated] = previous
      ? await tx.update(uiSpecs).set(values).where(eq(uiSpecs.id, projectId)).returning()
      : await tx.insert(uiSpecs).values({ id: projectId, ...values }).returning();
    if (version) await tx.insert(specVersions).values(version);
    return updated;
  });
}
