// Server-side validation for presets. Keep this out of anything the app
// bundle imports: see presets.ts.
import { z } from "zod";
import { MAX_PRESETS, REASONING_LEVELS, SERVICE_TIERS, type ModelPreset, type PresetState } from "./presets";

export const selectionSchema = z.object({
  providerId: z.string().trim().min(1).max(256),
  model: z.string().trim().min(1).max(512),
  reasoningLevel: z.enum(REASONING_LEVELS),
  serviceTier: z.enum(SERVICE_TIERS).default("default"),
});
export const presetSchema: z.ZodType<ModelPreset, unknown> = selectionSchema.extend({
  id: z.string().min(1).max(80),
  name: z.string().trim().min(1).max(80),
});
export const presetsSchema = z
  .array(presetSchema)
  .max(MAX_PRESETS)
  .refine(
    (items) => new Set(items.map((item) => item.id)).size === items.length,
    "Preset IDs must be unique",
  );
export const presetStateSchema: z.ZodType<PresetState, unknown> = z.object({
  revision: z.number().int().nonnegative(),
  presets: presetsSchema,
});
