// Frontend-safe preset model: types, constants, and helpers only. The zod
// schemas live in presets.schema.ts so the app bundle never pulls zod in
// (~450 KB minified), which delayed every plugin frontend on load.
export const REASONING_LEVELS = ["none", "low", "medium", "high", "xhigh", "max", "ultra", "ultracode"] as const;
export type ReasoningLevel = (typeof REASONING_LEVELS)[number];
export const SERVICE_TIERS = ["default", "fast"] as const;
export type ServiceTier = (typeof SERVICE_TIERS)[number];
export const MAX_PRESETS = 30;

export interface ModelSelection {
  providerId: string;
  model: string;
  reasoningLevel: ReasoningLevel;
  serviceTier: ServiceTier;
}
export interface ModelPreset extends ModelSelection {
  id: string;
  name: string;
}
export interface PresetState {
  revision: number;
  presets: ModelPreset[];
}
export const EMPTY_PRESETS: PresetState = { revision: 0, presets: [] };
export const PRESETS_CHANNEL = "model-presets";
export const EDIT_PRESETS_EVENT = "quick-thread:edit-presets";

function boundedString(value: unknown, max: number, trim: boolean): string | null {
  if (typeof value !== "string") return null;
  const text = trim ? value.trim() : value;
  return text.length >= 1 && text.length <= max ? text : null;
}

/** Mirrors presets.schema.ts `selectionSchema`; null when the draft is invalid. */
export function parseSelection(value: unknown): ModelSelection | null {
  if (typeof value !== "object" || value === null) return null;
  const draft = value as Record<string, unknown>;
  const providerId = boundedString(draft.providerId, 256, true);
  const model = boundedString(draft.model, 512, true);
  const reasoningLevel = REASONING_LEVELS.find((level) => level === draft.reasoningLevel);
  const serviceTier = draft.serviceTier === undefined
    ? "default"
    : SERVICE_TIERS.find((tier) => tier === draft.serviceTier);
  if (providerId === null || model === null || reasoningLevel === undefined || serviceTier === undefined) return null;
  return { providerId, model, reasoningLevel, serviceTier };
}

/** Mirrors presets.schema.ts `presetSchema`; null when the draft is invalid. */
export function parsePreset(value: unknown): ModelPreset | null {
  const selection = parseSelection(value);
  if (selection === null) return null;
  const draft = value as Record<string, unknown>;
  const id = boundedString(draft.id, 80, false);
  const name = boundedString(draft.name, 80, true);
  if (id === null || name === null) return null;
  return { ...selection, id, name };
}

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
