import { z } from "zod";
import { NO_SELECTION, type SelectedPreset } from "./selection";

export { NO_SELECTION, SELECTION_CHANNEL, resolveSelected, type SelectedPreset } from "./selection";

export const selectedPresetSchema: z.ZodType<SelectedPreset, unknown> = z.object({
  presetId: z.string().min(1).max(80).nullable(),
});

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
