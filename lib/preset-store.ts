import { EMPTY_PRESETS, presetStateSchema, type ModelPreset, type PresetState } from "./presets";

export function createPresetStore(storage: {
  read(): Promise<unknown>;
  write(value: PresetState): Promise<void>;
  /**
   * Starter presets for a host that has never saved any. Resolved lazily on
   * the first read and persisted, so later reads never touch the catalog and a
   * user who deliberately empties the list is not re-seeded. An empty result
   * (catalogs unavailable) is not persisted, so the next read tries again.
   */
  defaults?(): Promise<ModelPreset[]>;
}) {
  let queue: Promise<unknown> = Promise.resolve();
  async function read() {
    const value = await storage.read();
    if (value != null) return presetStateSchema.parse(value);
    return seed();
  }
  function seed() {
    return enqueue(async () => {
      const value = await storage.read();
      if (value != null) return presetStateSchema.parse(value);
      const presets = (await storage.defaults?.()) ?? [];
      if (!presets.length) return EMPTY_PRESETS;
      const next = presetStateSchema.parse({ revision: 1, presets });
      await storage.write(next);
      return next;
    });
  }
  function save(expectedRevision: number, presets: ModelPreset[]) {
    return enqueue(async () => {
      const current = await read();
      if (current.revision !== expectedRevision)
        throw new Error("Presets changed in another window. Reload before saving.");
      const next = presetStateSchema.parse({ revision: current.revision + 1, presets });
      await storage.write(next);
      return next;
    });
  }
  /** Replace whatever is saved with freshly resolved defaults. */
  function restoreDefaults() {
    return enqueue(async () => {
      const presets = (await storage.defaults?.()) ?? [];
      if (!presets.length)
        throw new Error("No default presets are available for this machine's providers.");
      const current = await read();
      const next = presetStateSchema.parse({ revision: current.revision + 1, presets });
      await storage.write(next);
      return next;
    });
  }
  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = queue.then(operation);
    queue = result.catch(() => {});
    return result;
  }
  return { read, save, restoreDefaults };
}
