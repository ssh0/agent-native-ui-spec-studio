import { defineAction, fail } from "@agent-native/core/action";
import { flowToBpmnXml } from "@shared/bpmn-flow";
import { parseSpecYaml, renderFlow } from "@shared/spec-utils";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "../server/db/index.js";
import * as schema from "../server/db/schema.js";
import { resolveSpecProject } from "../server/lib/spec-project.js";

export default defineAction({
  description:
    "Render business flows as BPMN 2.0 XML with interactive-compatible layout; screens (default), useCases and states remain Mermaid.",
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
  publicAgent: { expose: true, readOnly: true, requiresAuth: true },
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
    if (kind === "flows") {
      const flows = selectedId
        ? parsed.spec.flows.filter((flow) => flow.id === selectedId)
        : parsed.spec.flows;
      if (selectedId && !flows.length)
        fail("指定した業務フローは存在しません。");
      return {
        format: "bpmn" as const,
        diagrams: flows.map((flow) => ({
          id: flow.id,
          xml: flowToBpmnXml(parsed.spec!, flow),
        })),
      };
    }
    return {
      format: "mermaid" as const,
      mermaid: renderFlow(parsed.spec, kind, selectedId),
    };
  },
});
