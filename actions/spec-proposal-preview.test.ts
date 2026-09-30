import { describe, expect, it } from "vitest";
import { z } from "zod";
import { previewBaseVersionIdSchema } from "./spec-proposal-preview";

describe("proposal preview base version tool schema", () => {
  it("preserves UUID and null runtime validation without unsupported provider formats", () => {
    const original = z.string().uuid().nullable();
    for (const id of [null, "00000000-0000-0000-0000-000000000000", "11111111-1111-4111-8111-111111111111", "not-a-uuid", "11111111-1111-1111-1111-111111111111"]) {
      expect(previewBaseVersionIdSchema.safeParse(id).success).toBe(original.safeParse(id).success);
    }
    const schema = z.toJSONSchema(z.object({ baseVersionId: previewBaseVersionIdSchema }));
    expect(JSON.stringify(schema)).not.toContain('"format":"uuid"');
    expect(schema.properties?.baseVersionId).toBeDefined();
  });
});
