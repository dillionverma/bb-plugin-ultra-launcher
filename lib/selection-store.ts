import { z } from "zod";

/** Which preset the Ultra Launcher dialog seeds the composer with. */
export const selectedPresetSchema = z.object({ presetId: z.string().min(1).max(80).nullable() });
export type SelectedPreset = z.infer<typeof selectedPresetSchema>;
export const NO_SELECTION: SelectedPreset = { presetId: null };
export const SELECTION_CHANNEL = "model-preset-selection";

/**
 * Remembers the last preset picked in the dialog. Kept apart from the preset
 * list so choosing a preset never bumps the list revision and races a settings
 * edit in another window.
 */
export function createSelectionStore(storage: {
  read(): Promise<unknown>;
  write(value: SelectedPreset): Promise<void>;
}) {
  async function read(): Promise<SelectedPreset> {
    const value = await storage.read();
    if (value == null) return NO_SELECTION;
    const parsed = selectedPresetSchema.safeParse(value);
    return parsed.success ? parsed.data : NO_SELECTION;
  }
  async function write(presetId: string | null): Promise<SelectedPreset> {
    const next = selectedPresetSchema.parse({ presetId });
    await storage.write(next);
    return next;
  }
  return { read, write };
}

/** The preset a dialog should seed: the remembered one, else the first row. */
export function resolveSelected<T extends { id: string }>(
  presets: readonly T[],
  presetId: string | null,
): T | null {
  return presets.find((preset) => preset.id === presetId) ?? presets[0] ?? null;
}
