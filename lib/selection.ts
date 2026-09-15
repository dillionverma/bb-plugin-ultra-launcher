// Frontend-safe half of the selection store: no zod (see presets.ts).
/** Which preset the Ultra Launcher dialog seeds the composer with. */
export interface SelectedPreset {
  presetId: string | null;
}
export const NO_SELECTION: SelectedPreset = { presetId: null };
export const SELECTION_CHANNEL = "model-preset-selection";

/** The preset a dialog should seed: the remembered one, else the first row. */
export function resolveSelected<T extends { id: string }>(
  presets: readonly T[],
  presetId: string | null,
): T | null {
  return presets.find((preset) => preset.id === presetId) ?? presets[0] ?? null;
}
