import { beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { parse, stringify } from "yaml";
import { specProposals, specVersions, uiSpecs } from "../db/schema.js";
import type { SourceInput } from "./proposal-sources.js";

const holder = vi.hoisted(() => ({ db: null as any, thread: null as any }));
vi.mock("../db/index.js", () => ({ getDb: () => holder.db }));
vi.mock("@agent-native/core/server", () => ({ getThread: async () => holder.thread }));
vi.mock("./spec-project.js", () => ({ resolveSpecProject: async (id: string) => ({ id, ownerEmail: "owner@example.test" }) }));
import { saveSpecVersion } from "./spec-version-store.js";
import { createSpecProposal, decideSpecProposal, loadSpecProposal } from "./spec-proposals.js";
import { diffSpecVersions, specTargets } from "../../shared/spec-versions.js";
import { parseSpecYaml } from "../../shared/spec-utils.js";
import bootstrap from "../../actions/spec-bootstrap.js";
import update from "../../actions/spec-update.js";
import edit from "../../actions/spec-edit.js";
import migrate from "../../actions/spec-migrate.js";

const ownerEmail = "owner@example.test";
const projectId = "project-a";
const baseYaml = readFileSync(new URL("../../specs/example.yaml", import.meta.url), "utf8");
const candidate = parse(baseYaml);
candidate.title = `${candidate.title} revised`;
const nextYaml = stringify(candidate);
const source = { kind: "chat" as const, threadId: "thread-a", messageId: "message-a", locator: "user request, sentence 1", evidence: "Add a revised title", targetKeys: ['["document"]'] };
const attachmentSource = { kind: "attachment" as const, threadId: "thread-a", messageId: "message-a", attachmentId: "attachment-a", locator: "page 2, section 3", evidence: "Requested title wording", targetKeys: ['["document"]'] };

beforeEach(async () => {
  const client = new PGlite();
  await client.exec(`CREATE TABLE ui_specs (id TEXT PRIMARY KEY, owner_email TEXT, yaml TEXT NOT NULL, current_version_id TEXT, review_status TEXT NOT NULL DEFAULT 'draft', review_history JSONB NOT NULL DEFAULT '[]'::jsonb, review_comment TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE spec_versions (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, owner_email TEXT NOT NULL, yaml TEXT NOT NULL, document_hash TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE spec_proposals (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, owner_email TEXT NOT NULL, base_version_id TEXT, yaml TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'proposed', summary TEXT NOT NULL, impact_summary TEXT NOT NULL, sources JSONB NOT NULL, assumptions JSONB NOT NULL, questions JSONB NOT NULL, created_at TEXT NOT NULL, decided_at TEXT, decided_by TEXT, applied_version_id TEXT);`);
  holder.db = drizzle(client);
  holder.thread = { id: "thread-a", ownerEmail, scope: { type: "ui-spec-project", id: projectId }, threadData: JSON.stringify({ messages: [{ message: { id: "message-a", role: "user", content: [{ type: "text", text: "Add a revised title" }], attachments: [{ id: "attachment-a", name: "brief.pdf", metadata: { uploadUrl: "https://files.example.test/brief.pdf" }, content: [{ type: "file", url: "https://files.example.test/brief.pdf" }] }] } }] }) };
});

async function draft(sources: SourceInput[] = [source]) {
  const base = await saveSpecVersion(projectId, ownerEmail, baseYaml);
  return createSpecProposal({ projectId, ownerEmail, baseVersionId: base.currentVersionId!, yaml: nextYaml, summary: "Title change", impactSummary: "Document title changes", sources, assumptions: [], questions: [] });
}

describe("source-backed spec proposals", () => {
  it("holds the first chat-first skeleton as an unapproved proposal until the user applies it", async () => {
    const first = await bootstrap.run({ projectId, yaml: baseYaml, summary: "Initial skeleton", impactSummary: "Creates the initial document", sources: [{ ...source, targetKeys: [source.targetKeys[0], ...specTargets(parseSpecYaml(baseYaml).spec!).map((target) => target.key)] }], assumptions: [], questions: [] });
    expect(first.status).toBe("proposed");
    expect(first.baseVersionId).toBeNull();
    expect(await holder.db.select().from(uiSpecs)).toHaveLength(0);
    expect(await holder.db.select().from(specVersions)).toHaveLength(0);
    await decideSpecProposal(projectId, ownerEmail, first.id, "approved");
    expect((await holder.db.select().from(uiSpecs))[0].yaml).toBe(baseYaml);
    expect(await holder.db.select().from(specVersions)).toHaveLength(1);
    await expect(bootstrap.run({ projectId, yaml: baseYaml, summary: "Initial skeleton", impactSummary: "Creates the initial document", sources: [{ ...source, targetKeys: specTargets(parseSpecYaml(baseYaml).spec!).map((target) => target.key) }], assumptions: [], questions: [] })).rejects.toThrow();
    expect(update.agentTool).toBe(false);
    expect(edit.agentTool).toBe(false);
    expect(migrate.agentTool).toBe(false);
  });

  it("can reject an initial skeleton without ever creating canonical content", async () => {
    const first = await bootstrap.run({ projectId, yaml: baseYaml, summary: "Initial skeleton", impactSummary: "Creates the initial document", sources: [{ ...source, targetKeys: specTargets(parseSpecYaml(baseYaml).spec!).map((target) => target.key) }], assumptions: [], questions: [] });
    await decideSpecProposal(projectId, ownerEmail, first.id, "rejected");
    expect(await holder.db.select().from(uiSpecs)).toHaveLength(0);
    expect(await holder.db.select().from(specVersions)).toHaveLength(0);
  });

  it("keeps the canonical spec untouched until approval, then creates a versioned diff", async () => {
    const { proposal, changes } = await draft([source, attachmentSource]);
    expect((await holder.db.select().from(uiSpecs))[0].yaml).toBe(baseYaml);
    expect(changes).toEqual(expect.arrayContaining([expect.objectContaining({ change: "changed", target: expect.objectContaining({ kind: "document" }) })]));
    const loaded = await loadSpecProposal(projectId, ownerEmail, proposal.id);
    expect(loaded.sources).toEqual([
      expect.objectContaining({ kind: "chat", evidenceVerified: true }),
      expect.objectContaining({ kind: "attachment", attachmentName: "brief.pdf", attachmentUrl: "https://files.example.test/brief.pdf", evidenceVerified: false }),
    ]);
    expect(loaded.changes[0].key).toBe('["document"]');
    const approved = await decideSpecProposal(projectId, ownerEmail, proposal.id, "approved");
    expect(approved.status).toBe("approved");
    expect(approved.appliedVersionId).toBeTruthy();
    expect((await holder.db.select().from(uiSpecs))[0]).toEqual(expect.objectContaining({ yaml: nextYaml, currentVersionId: approved.appliedVersionId, reviewStatus: "draft" }));
    expect(await holder.db.select().from(specVersions)).toHaveLength(2);
    await expect(decideSpecProposal(projectId, ownerEmail, proposal.id, "approved")).rejects.toThrow();
  });

  it("rejects without changing the spec or version history", async () => {
    const { proposal } = await draft();
    await decideSpecProposal(projectId, ownerEmail, proposal.id, "rejected");
    expect((await holder.db.select().from(uiSpecs))[0].yaml).toBe(baseYaml);
    expect(await holder.db.select().from(specVersions)).toHaveLength(1);
    expect((await holder.db.select().from(specProposals).where(eq(specProposals.id, proposal.id)))[0].status).toBe("rejected");
  });

  it("surfaces a stale base instead of overwriting a newer spec", async () => {
    const { proposal } = await draft();
    const current = (await holder.db.select().from(uiSpecs))[0];
    await saveSpecVersion(projectId, ownerEmail, `${baseYaml}\n# later edit\n`, current.updatedAt);
    expect((await loadSpecProposal(projectId, ownerEmail, proposal.id)).stale).toBe(true);
    await expect(decideSpecProposal(projectId, ownerEmail, proposal.id, "approved")).rejects.toThrow();
    expect((await holder.db.select().from(specProposals))[0].status).toBe("proposed");
  });

  it("validates source ownership, real quotes, and durable attachments", async () => {
    const base = await saveSpecVersion(projectId, ownerEmail, baseYaml);
    const input = { projectId, ownerEmail, baseVersionId: base.currentVersionId!, yaml: nextYaml, summary: "Title change", impactSummary: "Document title changes", assumptions: [], questions: [] };
    await expect(createSpecProposal({ ...input, sources: [{ ...source, evidence: "fabricated quote" }] })).rejects.toThrow();
    await expect(createSpecProposal({ ...input, sources: [{ ...source, targetKeys: ['["missing"]'] }] })).rejects.toThrow();
    holder.thread.scope.id = "other-project";
    await expect(createSpecProposal({ ...input, sources: [source] })).rejects.toThrow();
    holder.thread.scope.id = projectId;
    holder.thread.threadData = JSON.stringify({ messages: [{ message: { id: "message-a", role: "user", content: [{ type: "text", text: source.evidence }], attachments: [{ id: "attachment-a", name: "brief.pdf", metadata: { storageRequired: true }, content: [] }] } }] });
    await expect(createSpecProposal({ ...input, sources: [attachmentSource] })).rejects.toThrow();
    holder.thread.threadData = JSON.stringify({ messages: [{ message: { id: "message-a", role: "user", content: [{ type: "text", text: source.evidence }], attachments: [{ id: "attachment-a", name: "brief.pdf", metadata: { uploadUrl: "data:application/pdf;base64,AAAA" }, content: [] }] } }] });
    await expect(createSpecProposal({ ...input, sources: [attachmentSource] })).rejects.toThrow();
    expect(await holder.db.select().from(specProposals)).toHaveLength(0);
  });

  it("reports stable parent elements when ordered child IDs move", () => {
    const initial = parseSpecYaml(baseYaml).spec!;
    const reordered = structuredClone(initial);
    reordered.domain.actors.reverse();
    if (initial.domain.actors.length > 1)
      expect(diffSpecVersions(initial, reordered)).toEqual(expect.arrayContaining([expect.objectContaining({ change: "changed", target: expect.objectContaining({ key: '["document"]' }) })]));
  });
});
