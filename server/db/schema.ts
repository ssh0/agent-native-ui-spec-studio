import { sql } from "drizzle-orm";
import { pgTable, text, jsonb } from "drizzle-orm/pg-core";

import type { ReviewEntry } from "../../shared/spec-schema.js";

export const uiSpecs = pgTable("ui_specs", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email"),
  yaml: text("yaml").notNull(),
  currentVersionId: text("current_version_id"),
  reviewStatus: text("review_status").notNull().default("draft"),
  reviewHistory: jsonb("review_history")
    .$type<ReviewEntry[]>()
    .notNull()
    .default([]),
  reviewComment: text("review_comment"),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const specProjects = pgTable("spec_projects", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  name: text("name").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const specVersions = pgTable("spec_versions", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  projectId: text("project_id").notNull(),
  yaml: text("yaml").notNull(),
  documentHash: text("document_hash").notNull(),
  createdAt: text("created_at").notNull(),
});

export const specElementReviews = pgTable("spec_element_reviews", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  projectId: text("project_id").notNull(),
  versionId: text("version_id").notNull(),
  targetKey: text("target_key").notNull(),
  targetKind: text("target_kind").notNull(),
  targetTitle: text("target_title").notNull(),
  reviewerEmail: text("reviewer_email").notNull(),
  decision: text("decision").notNull(),
  comment: text("comment").notNull(),
  createdAt: text("created_at").notNull(),
});

export type ProposalSource = {
  kind: "chat" | "attachment";
  threadId: string;
  messageId: string;
  attachmentId?: string;
  attachmentName?: string;
  attachmentUrl?: string;
  locator: string;
  evidence: string;
  evidenceVerified: boolean;
  targetKeys: string[];
};

export const specProposals = pgTable("spec_proposals", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  projectId: text("project_id").notNull(),
  baseVersionId: text("base_version_id"),
  yaml: text("yaml").notNull(),
  status: text("status").notNull().default("proposed"),
  summary: text("summary").notNull(),
  impactSummary: text("impact_summary").notNull(),
  sources: jsonb("sources").$type<ProposalSource[]>().notNull(),
  assumptions: jsonb("assumptions").$type<string[]>().notNull(),
  questions: jsonb("questions").$type<string[]>().notNull(),
  createdAt: text("created_at").notNull(),
  decidedAt: text("decided_at"),
  decidedBy: text("decided_by"),
  appliedVersionId: text("applied_version_id"),
});
