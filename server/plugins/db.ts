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
  ],
  { table: "ui_spec_studio_migrations" },
);
