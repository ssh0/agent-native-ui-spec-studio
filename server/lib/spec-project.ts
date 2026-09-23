import { fail } from "@agent-native/core/action";
import { readAppState } from "@agent-native/core/application-state";
import { getRequestUserEmail } from "@agent-native/core/server/request-context";
import { and, eq } from "drizzle-orm";

import { getDb } from "../db/index.js";
import { specProjects, uiSpecs } from "../db/schema.js";

export function currentUserEmail(): string {
  const email = getRequestUserEmail();
  if (!email)
    fail("ログインしてからプロジェクトを開いてください。", { statusCode: 401 });
  return email;
}

/** The old document has no owner column. The first authenticated opener claims it once. */
export async function claimLegacyProject(email = currentUserEmail()) {
  const db = getDb();
  const [legacy] = await db
    .select({ id: uiSpecs.id })
    .from(uiSpecs)
    .where(eq(uiSpecs.id, "default"));
  if (!legacy) return;
  const [claimed] = await db
    .insert(specProjects)
    .values({ id: "default", ownerEmail: email, name: "以前のプロジェクト" })
    .onConflictDoNothing()
    .returning();
  if (claimed)
    await db
      .update(uiSpecs)
      .set({ ownerEmail: email })
      .where(eq(uiSpecs.id, "default"));
}

export async function resolveSpecProject(projectId?: string) {
  const email = currentUserEmail();
  const navigation = projectId ? null : await readAppState("navigation");
  const navId =
    navigation && typeof navigation === "object" && "projectId" in navigation
      ? navigation.projectId
      : null;
  const id = projectId ?? (typeof navId === "string" ? navId : null);
  if (!id) fail("プロジェクトを選択してください。", { statusCode: 400 });
  const [project] = await getDb()
    .select()
    .from(specProjects)
    .where(and(eq(specProjects.id, id), eq(specProjects.ownerEmail, email)));
  if (!project)
    fail("プロジェクトが見つかりません。一覧から開き直してください。", {
      statusCode: 404,
    });
  return project;
}
