import { z } from "zod";
export const selectionSchema = z.object({
  providerId: z.string().trim().min(1).max(256),
  model: z.string().trim().min(1).max(512),
  reasoningLevel: z.enum(["none", "low", "medium", "high", "xhigh", "max", "ultra", "ultracode"]),
  serviceTier: z.enum(["default", "fast"]).default("default"),
});
export const presetSchema = selectionSchema.extend({
  id: z.string().min(1).max(80),
  name: z.string().trim().min(1).max(80),
});
export const presetsSchema = z
  .array(presetSchema)
  .max(30)
  .refine(
    (items) => new Set(items.map((item) => item.id)).size === items.length,
    "Preset IDs must be unique",
  );
export const presetStateSchema = z.object({
  revision: z.number().int().nonnegative(),
  presets: presetsSchema,
});
export type ModelPreset = z.infer<typeof presetSchema>;
export type PresetState = z.infer<typeof presetStateSchema>;
export const EMPTY_PRESETS: PresetState = { revision: 0, presets: [] };
export const PRESETS_CHANNEL = "model-presets";
export const EDIT_PRESETS_EVENT = "quick-thread:edit-presets";
export const effortLabel = (value: string) =>
  ({
    none: "None",
    low: "Low",
    medium: "Medium",
    high: "High",
    xhigh: "Extra high",
    max: "Max",
    ultra: "Ultra",
    ultracode: "Ultra code",
  })[value] ?? value;
export function isActivePreset(
  preset: ModelPreset,
  selection: {
    providerId: string;
    model: string;
    reasoningLevel: string;
    serviceTier?: string;
    supportsServiceTier?: boolean;
  },
) {
  return (
    preset.providerId === selection.providerId &&
    preset.model === selection.model &&
    preset.reasoningLevel === selection.reasoningLevel &&
    preset.serviceTier ===
      (selection.supportsServiceTier === false ? "default" : (selection.serviceTier ?? "default"))
  );
}
export function movePreset(presets: ModelPreset[], id: string, offset: number): ModelPreset[] {
  const index = presets.findIndex((preset) => preset.id === id);
  const next = index + offset;
  if (index < 0 || next < 0 || next >= presets.length) return presets;
  const result = [...presets];
  const [item] = result.splice(index, 1);
  result.splice(next, 0, item);
  return result;
}
