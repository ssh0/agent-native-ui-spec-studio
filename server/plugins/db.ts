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
  ],
  { table: "ui_spec_studio_migrations" },
);
