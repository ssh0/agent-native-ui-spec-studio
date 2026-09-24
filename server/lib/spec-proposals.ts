import { randomUUID } from "node:crypto";
import { fail } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";
import { parseSpecYaml } from "../../shared/spec-utils.js";
import { diffSpecVersions, specTargets } from "../../shared/spec-versions.js";
import { getDb } from "../db/index.js";
import { specProposals, specVersions, uiSpecs } from "../db/schema.js";
import { ensureCurrentVersion } from "./spec-version-store.js";
import { resolveProposalSources, type SourceInput } from "./proposal-sources.js";

const parseValid = (yaml: string) => {
  const parsed = parseSpecYaml(yaml);
  if (!parsed.spec || parsed.issues.length) fail(`仕様案の YAML が無効です: ${parsed.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`, { statusCode: 400 });
  return parsed.spec;
};

export async function createSpecProposal(input: {
  projectId: string; ownerEmail: string; baseVersionId: string | null; yaml: string;
  summary: string; impactSummary: string; sources: SourceInput[]; assumptions: string[]; questions: string[];
}) {
  const current = await ensureCurrentVersion(input.projectId);
  if ((current?.currentVersionId ?? null) !== input.baseVersionId || (input.baseVersionId === null && current))
    fail("基準版が現在の仕様と一致しません。仕様を読み直してください。", { statusCode: 409 });
  const [base] = input.baseVersionId ? await getDb().select().from(specVersions).where(and(eq(specVersions.id, input.baseVersionId), eq(specVersions.projectId, input.projectId), eq(specVersions.ownerEmail, input.ownerEmail))) : [];
  if (input.baseVersionId && !base) fail("基準版が見つかりません。", { statusCode: 404 });
  const before = base ? parseValid(base.yaml) : null;
  const after = parseValid(input.yaml);
  if (base?.yaml === input.yaml) fail("仕様案に変更がありません。", { statusCode: 400 });
  if (!base && after.version !== "2.0") fail("最初の仕様案は 2.0 YAML にしてください。", { statusCode: 400 });
  const sources = await resolveProposalSources(input.projectId, input.ownerEmail, input.sources);
  const changes = before ? diffSpecVersions(before, after) : specTargets(after).map((target) => ({ change: "added" as const, target }));
  const changedKeys = new Set(changes.map(({ target }) => target.key));
  if (!changes.length) fail("安定 ID による差分がありません。変更内容を確認してください。", { statusCode: 400 });
  if (sources.some((source) => source.targetKeys.some((key) => !changedKeys.has(key))) ||
      changes.some(({ target }) => !sources.some((source) => source.targetKeys.includes(target.key))))
    fail("すべての変更要素に有効な出典を対応付けてください。", { statusCode: 400 });
  const [proposal] = await getDb().insert(specProposals).values({
    id: randomUUID(), projectId: input.projectId, ownerEmail: input.ownerEmail,
    baseVersionId: input.baseVersionId, yaml: input.yaml, status: "proposed",
    summary: input.summary, impactSummary: input.impactSummary, sources,
    assumptions: input.assumptions, questions: input.questions, createdAt: new Date().toISOString(),
  }).returning();
  return { proposal, changes };
}

export async function loadSpecProposal(projectId: string, ownerEmail: string, proposalId: string) {
  const [proposal] = await getDb().select().from(specProposals).where(and(eq(specProposals.id, proposalId), eq(specProposals.projectId, projectId), eq(specProposals.ownerEmail, ownerEmail)));
  if (!proposal) fail("仕様案が見つかりません。", { statusCode: 404 });
  const [base] = proposal.baseVersionId ? await getDb().select().from(specVersions).where(and(eq(specVersions.id, proposal.baseVersionId), eq(specVersions.projectId, projectId), eq(specVersions.ownerEmail, ownerEmail))) : [];
  if (proposal.baseVersionId && !base) fail("仕様案の基準版が見つかりません。", { statusCode: 500 });
  const after = parseValid(proposal.yaml);
  const changes = (base ? diffSpecVersions(parseValid(base.yaml), after) : specTargets(after).map((target) => ({ change: "added" as const, target }))).map(({ change, target }) => ({ change, ...target }));
  const current = await ensureCurrentVersion(projectId);
  return { ...proposal, baseYaml: base?.yaml ?? "", changes, currentVersionId: current?.currentVersionId ?? null, stale: (current?.currentVersionId ?? null) !== proposal.baseVersionId || (proposal.baseVersionId === null && !!current) };
}

export async function decideSpecProposal(projectId: string, ownerEmail: string, proposalId: string, decision: "approved" | "rejected") {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [proposal] = await tx.select().from(specProposals).where(and(eq(specProposals.id, proposalId), eq(specProposals.projectId, projectId), eq(specProposals.ownerEmail, ownerEmail))).for("update");
    if (!proposal) fail("仕様案が見つかりません。", { statusCode: 404 });
    if (proposal.status !== "proposed") fail("この仕様案はすでに判断済みです。", { statusCode: 409 });
    const [current] = await tx.select().from(uiSpecs).where(and(eq(uiSpecs.id, projectId), eq(uiSpecs.ownerEmail, ownerEmail))).for("update");
    if (decision === "approved" && ((current?.currentVersionId ?? null) !== proposal.baseVersionId || (proposal.baseVersionId === null && !!current)))
      fail("基準版より仕様が変更されました。新しい版から仕様案を作り直してください。", { statusCode: 409 });
    const now = new Date().toISOString();
    let appliedVersionId: string | null = null;
    if (decision === "approved") {
      parseValid(proposal.yaml);
      appliedVersionId = randomUUID();
      const { createHash } = await import("node:crypto");
      if (current) {
        await tx.update(uiSpecs).set({ yaml: proposal.yaml, currentVersionId: appliedVersionId, reviewStatus: "draft", reviewComment: null, updatedAt: now }).where(eq(uiSpecs.id, projectId));
      } else {
        const [inserted] = await tx.insert(uiSpecs).values({ id: projectId, ownerEmail, yaml: proposal.yaml, currentVersionId: appliedVersionId, reviewStatus: "draft", updatedAt: now }).onConflictDoNothing().returning();
        if (!inserted) fail("仕様が作成されました。仕様案を作り直してください。", { statusCode: 409 });
      }
      await tx.insert(specVersions).values({ id: appliedVersionId, projectId, ownerEmail, yaml: proposal.yaml, documentHash: createHash("sha256").update(proposal.yaml).digest("hex"), createdAt: now });
    }
    const [updated] = await tx.update(specProposals).set({ status: decision, decidedAt: now, decidedBy: ownerEmail, appliedVersionId }).where(eq(specProposals.id, proposalId)).returning();
    return updated;
  });
}
