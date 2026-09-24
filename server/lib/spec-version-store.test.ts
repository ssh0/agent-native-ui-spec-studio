import { beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFileSync } from "node:fs";
import { stringify } from "yaml";
import { parseSpecYaml } from "../../shared/spec-utils.js";
import { specVersions, uiSpecs } from "../db/schema.js";
import { eq } from "drizzle-orm";

const holder = vi.hoisted(() => ({ db: null as any }));
vi.mock("../db/index.js", () => ({ getDb: () => holder.db }));
vi.mock("./spec-project.js", () => ({
  resolveSpecProject: async (projectId: string) => {
    if (projectId !== "project-a") throw new Error("not found");
    return { id: "project-a", ownerEmail: "owner@example.test" };
  },
  currentUserEmail: () => "owner@example.test",
}));
import { ensureCurrentVersion, saveSpecVersion } from "./spec-version-store.js";
import elementReview from "../../actions/spec-element-review.js";
import versionLoad from "../../actions/spec-version-load.js";
import versionCompare from "../../actions/spec-version-compare.js";
import { specTargets } from "../../shared/spec-versions.js";

const yaml = readFileSync(new URL("../../specs/example.yaml", import.meta.url), "utf8");

beforeEach(async () => {
  const client = new PGlite();
  await client.exec(`CREATE TABLE ui_specs (id TEXT PRIMARY KEY, owner_email TEXT, yaml TEXT NOT NULL, current_version_id TEXT, review_status TEXT NOT NULL DEFAULT 'draft', review_history JSONB NOT NULL DEFAULT '[]'::jsonb, review_comment TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE spec_versions (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, owner_email TEXT NOT NULL, yaml TEXT NOT NULL, document_hash TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE spec_element_reviews (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, owner_email TEXT NOT NULL, version_id TEXT NOT NULL, target_key TEXT NOT NULL, target_kind TEXT NOT NULL, target_title TEXT NOT NULL, reviewer_email TEXT NOT NULL, decision TEXT NOT NULL, comment TEXT NOT NULL, created_at TEXT NOT NULL);`);
  holder.db = drizzle(client);
});

describe("spec version persistence", () => {
  it("creates one immutable version and keeps approval on a no-op save", async () => {
    const first = await saveSpecVersion("project-a", "owner@example.test", yaml);
    expect(first.currentVersionId).toBeTruthy();
    await holder.db.update(uiSpecs).set({ reviewStatus: "approved" }).where(eq(uiSpecs.id, "project-a"));
    const again = await saveSpecVersion("project-a", "owner@example.test", yaml, first.updatedAt);
    expect(again.currentVersionId).toBe(first.currentVersionId);
    expect(again.reviewStatus).toBe("approved");
    expect(await holder.db.select().from(specVersions)).toHaveLength(1);
  });

  it("keeps prior versions and does not snapshot invalid drafts", async () => {
    const first = await saveSpecVersion("project-a", "owner@example.test", yaml);
    const second = await saveSpecVersion("project-a", "owner@example.test", `${yaml}\n# revision\n`, first.updatedAt);
    // A changed YAML must create a new snapshot when it remains valid.
    const parsed = parseSpecYaml(second.yaml);
    if (parsed.spec && !parsed.issues.length) expect(second.currentVersionId).not.toBe(first.currentVersionId);
    const draft = await saveSpecVersion("project-a", "owner@example.test", "invalid: [", second.updatedAt);
    expect(draft.currentVersionId).toBeNull();
    expect((await holder.db.select().from(specVersions)).length).toBe(parsed.spec && !parsed.issues.length ? 2 : 1);
  });

  it("indexes a legacy valid row once", async () => {
    await holder.db.insert(uiSpecs).values({ id: "legacy", yaml, ownerEmail: "owner@example.test", updatedAt: "2026-01-01T00:00:00Z" });
    const first = await ensureCurrentVersion("legacy");
    const second = await ensureCurrentVersion("legacy");
    expect(first?.currentVersionId).toBe(second?.currentVersionId);
    expect(await holder.db.select().from(specVersions)).toHaveLength(1);
  });
});


describe("version-bound element feedback and access", () => {
  it("binds reviewer and target to the exact saved version, then keeps feedback after deletion", async () => {
    const baseSpec = { version: "2.1", title: "Review", domain: { actors: [], externalSystems: [], entities: [], relations: [], terms: [] }, flows: [], useCases: [], screens: [{ id: "screen-one", title: "Screen one", entities: [], useCases: [], components: [], stateFlow: { initial: null, states: [], transitions: [] } }], transitions: [] };
    const firstYaml = stringify(baseSpec);
    const first = await saveSpecVersion("project-a", "owner@example.test", firstYaml);
    const screen = specTargets(parseSpecYaml(firstYaml).spec!).find((item) => item.kind === "screen")!;
    const entry = await elementReview.run({ projectId: "project-a", versionId: first.currentVersionId!, targetKey: screen.key, decision: "changes_requested", comment: "Revise this screen" });
    expect(entry.reviewerEmail).toBe("owner@example.test");
    expect(entry.versionId).toBe(first.currentVersionId);
    const newer = stringify({ ...baseSpec, screens: [] });
    const second = await saveSpecVersion("project-a", "owner@example.test", newer, first.updatedAt);
    expect(second.currentVersionId).not.toBe(first.currentVersionId);
    const historical = await versionLoad.run({ projectId: "project-a", versionId: first.currentVersionId! });
    expect(historical.feedback).toEqual(expect.arrayContaining([expect.objectContaining({ id: entry.id, targetKey: screen.key })]));
    const current = await versionLoad.run({ projectId: "project-a", versionId: second.currentVersionId! });
    expect(current.feedback).toEqual([]);
    expect(current.targets.some((item) => item.key === screen.key)).toBe(false);
    expect((await holder.db.select().from(uiSpecs).where(eq(uiSpecs.id, "project-a")))[0].reviewStatus).toBe("draft");
  });

  it("rejects a foreign version and a target absent from the selected version", async () => {
    const own = await saveSpecVersion("project-a", "owner@example.test", yaml);
    const foreign = await saveSpecVersion("project-b", "other@example.test", yaml);
    await expect(versionLoad.run({ projectId: "project-a", versionId: foreign.currentVersionId! })).rejects.toThrow();
    await expect(versionCompare.run({ projectId: "project-a", fromVersionId: own.currentVersionId!, toVersionId: foreign.currentVersionId! })).rejects.toThrow();
    await expect(elementReview.run({ projectId: "project-a", versionId: foreign.currentVersionId!, targetKey: "[]", decision: "approved", comment: "" })).rejects.toThrow();
    await expect(elementReview.run({ projectId: "project-a", versionId: own.currentVersionId!, targetKey: "[]", decision: "approved", comment: "" })).rejects.toThrow();
  });
});
