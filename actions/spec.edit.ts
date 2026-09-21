import { defineAction } from "@agent-native/core/action";
import { parse, stringify } from "yaml";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { SpecSchema } from "@shared/spec-schema";
import { getDb } from "../server/db/index.js";
import * as schema from "../server/db/schema.js";

const operation = z.object({
  kind: z.enum(["add_screen", "update_screen", "delete_screen", "add_component", "update_component", "delete_component", "add_transition", "update_transition", "delete_transition"]),
  screenId: z.string().optional(),
  nextScreenId: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  componentId: z.string().optional(),
  component: z.record(z.string(), z.unknown()).optional(),
  transitionIndex: z.number().int().nonnegative().optional(),
  transition: z.record(z.string(), z.unknown()).optional(),
});

export default defineAction({
  description: "Edit one screen, component, or transition in the shared UI specification. Use spec.update for complete YAML replacement.",
  schema: operation,
  run: async (input) => {
    const db = getDb();
    const [row] = await db.select().from(schema.uiSpecs).where(eq(schema.uiSpecs.id, "default"));
    if (!row) throw new Error("No UI specification has been saved yet.");
    const spec = SpecSchema.parse(parse(row.yaml));
    const index = input.screenId ? spec.screens.findIndex((screen) => screen.id === input.screenId) : -1;
    if (input.kind !== "add_screen" && index < 0) throw new Error(`Screen not found: ${input.screenId}`);
    if (input.kind === "add_screen") {
      if (!input.screenId || !input.title) throw new Error("screenId and title are required");
      spec.screens.push({ id: input.screenId, title: input.title, description: input.description, components: [] });
    } else if (input.kind === "update_screen") {
      const screen = spec.screens[index];
      if (input.nextScreenId) screen.id = input.nextScreenId;
      if (input.title !== undefined) screen.title = input.title;
      if (input.description !== undefined) screen.description = input.description;
    } else if (input.kind === "delete_screen") {
      if (spec.screens.length < 2) throw new Error("A specification must keep at least one screen");
      spec.screens.splice(index, 1);
      spec.transitions = spec.transitions.filter((t) => t.from !== input.screenId && t.to !== input.screenId);
    } else if (input.kind.includes("component")) {
      const screen = spec.screens[index];
      const componentIndex = screen.components.findIndex((component) => component.id === input.componentId);
      if (input.kind === "add_component") {
        if (!input.component) throw new Error("component is required");
        screen.components.push(input.component as typeof screen.components[number]);
      } else if (componentIndex < 0) throw new Error(`Component not found: ${input.componentId}`);
      else if (input.kind === "delete_component") screen.components.splice(componentIndex, 1);
      else Object.assign(screen.components[componentIndex], input.component ?? {});
    } else {
      const transitionIndex = input.transitionIndex ?? -1;
      if (input.kind === "add_transition") {
        if (!input.transition) throw new Error("transition is required");
        spec.transitions.push(input.transition as typeof spec.transitions[number]);
      } else if (transitionIndex < 0 || transitionIndex >= spec.transitions.length) throw new Error("Transition not found");
      else if (input.kind === "delete_transition") spec.transitions.splice(transitionIndex, 1);
      else Object.assign(spec.transitions[transitionIndex], input.transition ?? {});
    }
    const yaml = stringify(spec);
    const [updated] = await db.update(schema.uiSpecs).set({ yaml, reviewStatus: "draft", reviewComment: null, updatedAt: new Date().toISOString() }).where(eq(schema.uiSpecs.id, "default")).returning();
    return { yaml: updated.yaml, reviewStatus: updated.reviewStatus, updatedAt: updated.updatedAt };
  },
});
