import { runMigrations } from "@agent-native/core/db";

export default runMigrations(
  [
    {
      version: 1,
      name: "create-ui-specs",
      sql: `CREATE TABLE IF NOT EXISTS ui_specs (
        id TEXT PRIMARY KEY,
        yaml TEXT NOT NULL,
        review_status TEXT NOT NULL DEFAULT 'draft',
        review_comment TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    },
    {
      version: 2,
      name: "ui-spec-review-history",
      sql: `ALTER TABLE ui_specs ADD COLUMN IF NOT EXISTS review_history JSONB NOT NULL DEFAULT '[]'::jsonb`,
    },
    {
      version: 3,
      name: "spec-projects",
      sql: `CREATE TABLE IF NOT EXISTS spec_projects (
        id TEXT PRIMARY KEY,
        owner_email TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    },
    {
      version: 4,
      name: "ui-spec-owner",
      sql: `ALTER TABLE ui_specs ADD COLUMN IF NOT EXISTS owner_email TEXT`,
    },
    {
      version: 5,
      name: "spec-versioned-review",
      sql: `ALTER TABLE ui_specs ADD COLUMN IF NOT EXISTS current_version_id TEXT;
        CREATE TABLE IF NOT EXISTS spec_versions (
          id TEXT PRIMARY KEY, project_id TEXT NOT NULL, owner_email TEXT NOT NULL, yaml TEXT NOT NULL,
          document_hash TEXT NOT NULL, created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS spec_versions_project_idx ON spec_versions (project_id, created_at);
        CREATE TABLE IF NOT EXISTS spec_element_reviews (
          id TEXT PRIMARY KEY, project_id TEXT NOT NULL, owner_email TEXT NOT NULL, version_id TEXT NOT NULL,
          target_key TEXT NOT NULL, target_kind TEXT NOT NULL, target_title TEXT NOT NULL,
          reviewer_email TEXT NOT NULL, decision TEXT NOT NULL, comment TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS spec_element_reviews_version_idx ON spec_element_reviews (project_id, version_id)`,
    },
  ],
  { table: "ui_spec_studio_migrations" },
);
