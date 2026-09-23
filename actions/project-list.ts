import { defineAction } from "@agent-native/core/action";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "../server/db/index.js";
import { specProjects } from "../server/db/schema.js";
import {
  claimLegacyProject,
  currentUserEmail,
} from "../server/lib/spec-project.js";

export default defineAction({
  description:
    "List this user's UI Spec Studio projects, including an imported legacy document.",
  schema: z.object({}),
  http: { method: "GET" },
  run: async () => {
    const email = currentUserEmail();
    await claimLegacyProject(email);
    return getDb()
      .select()
      .from(specProjects)
      .where(eq(specProjects.ownerEmail, email))
      .orderBy(desc(specProjects.updatedAt));
  },
});
