import { randomUUID } from "node:crypto";

import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db/index.js";
import { specProjects } from "../server/db/schema.js";
import { currentUserEmail } from "../server/lib/spec-project.js";

export default defineAction({
  description:
    "Create a new private UI Spec Studio project. Begin in its chat and save the first rough specification with spec-update.",
  schema: z.object({
    name: z.string().trim().min(1).max(120).describe("Project name"),
  }),
  run: async ({ name }) => {
    const [project] = await getDb()
      .insert(specProjects)
      .values({ id: randomUUID(), ownerEmail: currentUserEmail(), name })
      .returning();
    return project;
  },
});
