import { defineAction, fail } from "@agent-native/core/action";
import { DEFAULT_SPEC_YAML } from "@shared/default-spec";
import { parseSpecYaml, renderFlow } from "@shared/spec-utils";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "../server/db/index.js";
import * as schema from "../server/db/schema.js";

export default defineAction({
  description:
    "Render screens (default), useCases with branches/exceptions, or states as Mermaid.",
  mcpTool: true,
  schema: z.object({
    kind: z
      .enum(["screens", "useCases", "states"])
      .default("screens")
      .describe("Diagram kind; defaults to screens"),
    selectedId: z
      .string()
      .optional()
      .describe("Optional use case or screen ID to focus"),
    yaml: z
      .string()
      .optional()
      .describe("YAML to render; loads the shared document when omitted"),
  }),
  publicAgent: { expose: true, readOnly: false, requiresAuth: true },
  run: async ({ yaml, kind, selectedId }) => {
    let source = yaml;
    if (source === undefined) {
      const [row] = await getDb()
        .select()
        .from(schema.uiSpecs)
        .where(eq(schema.uiSpecs.id, "default"));
      source = row?.yaml ?? DEFAULT_SPEC_YAML;
    }
    const parsed = parseSpecYaml(source ?? DEFAULT_SPEC_YAML);
    if (!parsed.spec || parsed.issues.length > 0) {
      fail("仕様の形式・参照エラーを修正してから描画してください。", {
        details: { issues: parsed.issues },
      });
    }
    return {
      format: "mermaid",
      mermaid: renderFlow(parsed.spec, kind, selectedId),
    };
  },
});
