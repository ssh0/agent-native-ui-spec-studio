import { sql } from "drizzle-orm";
import { pgTable, text } from "drizzle-orm/pg-core";

export const uiSpecs = pgTable("ui_specs", {
  id: text("id").primaryKey(),
  yaml: text("yaml").notNull(),
  reviewStatus: text("review_status").notNull().default("draft"),
  reviewComment: text("review_comment"),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
