import { defineAction, fail } from "@agent-native/core/action";
import { parseSpecYaml, renderFlow } from "@shared/spec-utils";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "../server/db/index.js";
import * as schema from "../server/db/schema.js";
import { resolveSpecProject } from "../server/lib/spec-project.js";

export default defineAction({
  description:
    "Render business flows with participant lanes, screens (default), useCases with branches/exceptions, or states as Mermaid.",
  mcpTool: true,
  schema: z.object({
    projectId: z
      .string()
      .optional()
      .describe("Selected project ID; defaults to current navigation"),
    kind: z
      .enum(["flows", "screens", "useCases", "states"])
      .default("screens")
      .describe("Diagram kind; defaults to screens"),
    selectedId: z
      .string()
      .optional()
      .describe("Optional business flow, use case or screen ID to focus"),
    yaml: z
      .string()
      .optional()
      .describe("YAML to render; loads the shared document when omitted"),
  }),
  publicAgent: { expose: true, readOnly: false, requiresAuth: true },
  run: async ({ yaml, kind, selectedId, projectId }) => {
    const project = await resolveSpecProject(projectId);
    let source = yaml;
    if (source === undefined) {
      const [row] = await getDb()
        .select()
        .from(schema.uiSpecs)
        .where(eq(schema.uiSpecs.id, project.id));
      source = row?.yaml;
    }
    if (!source)
      fail(
        "仕様の骨格がまだありません。チャットでプロダクトを説明してください。",
      );
    const parsed = parseSpecYaml(source);
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
