import { z } from "zod";

// Keep runtime UUID validation without emitting JSON Schema format: uuid for
// OpenAI-compatible providers that warn on unsupported string formats.
export const previewBaseVersionIdSchema = z.string().refine((id) => z.string().uuid().safeParse(id).success, "Invalid UUID").nullable();
