import { describe, expect, it } from "vitest";
import {
  EMPTY_PRESETS,
  isActivePreset,
  movePreset,
  type ModelPreset,
  type PresetState,
} from "./presets";
import { presetsSchema } from "./presets.schema";
import { createPresetStore } from "./preset-store";
const preset: ModelPreset = {
  id: "one",
  name: "Daily coding",
  providerId: "codex",
  model: "sol",
  reasoningLevel: "high",
  serviceTier: "default",
};
describe("preset settings", () => {
  it("rejects duplicate IDs, empty names and oversized lists", () => {
    for (const list of [
      [preset, preset],
      [{ ...preset, name: " " }],
      Array.from({ length: 31 }, (_, index) => ({ ...preset, id: String(index) })),
    ])
      expect(presetsSchema.safeParse(list).success).toBe(false);
  });
  it("matches the full preset, including reasoning and fast mode", () => {
    expect(isActivePreset(preset, preset)).toBe(true);
    expect(isActivePreset(preset, { ...preset, reasoningLevel: "low" })).toBe(false);
    expect(isActivePreset(preset, { ...preset, serviceTier: "fast" })).toBe(false);
    expect(isActivePreset(preset, { ...preset, providerId: "claude" })).toBe(false);
  });
  it("preserves saved ordering and ignores invalid moves", () => {
    const other = { ...preset, id: "two" };
    const list = [preset, other];
    expect(movePreset(list, "two", -1)).toEqual([other, preset]);
    expect(movePreset(list, "one", -1)).toBe(list);
  });
  it("serializes concurrent saves, rejects stale revisions, and stays usable after a conflict", async () => {
    let state: PresetState = EMPTY_PRESETS;
    const store = createPresetStore({
      read: async () => state,
      write: async (next) => {
        state = next;
      },
    });
    const results = await Promise.allSettled([store.save(0, [preset]), store.save(0, [])]);
    expect(results.map((result) => result.status)).toEqual(["fulfilled", "rejected"]);
    expect((await store.read()).presets).toEqual([preset]);
    await store.save(1, []);
    expect(await store.read()).toEqual({ revision: 2, presets: [] });
  });
});
describe("default presets", () => {
  const seeded = { ...preset, id: "default:daily" };
  function storage(initial: PresetState | null, defaults: ModelPreset[]) {
    let state: PresetState | null = initial;
    let resolved = 0;
    const store = createPresetStore({
      read: async () => state,
      write: async (next) => {
        state = next;
      },
      defaults: async () => {
        resolved += 1;
        return defaults;
      },
    });
    return { store, get state() { return state; }, get resolved() { return resolved; } };
  }
  it("seeds a never-saved host once and persists the result", async () => {
    const fixture = storage(null, [seeded]);
    expect(await fixture.store.read()).toEqual({ revision: 1, presets: [seeded] });
    expect(await fixture.store.read()).toEqual({ revision: 1, presets: [seeded] });
    expect(fixture.resolved).toBe(1);
    expect(fixture.state).toEqual({ revision: 1, presets: [seeded] });
  });
  it("does not persist an empty resolution and does not reseed an emptied list", async () => {
    const empty = storage(null, []);
    expect(await empty.store.read()).toEqual(EMPTY_PRESETS);
    expect(empty.state).toBeNull();
    const cleared = storage({ revision: 4, presets: [] }, [seeded]);
    expect(await cleared.store.read()).toEqual({ revision: 4, presets: [] });
    expect(cleared.resolved).toBe(0);
  });
  it("restores defaults over a customised list with a fresh revision", async () => {
    const fixture = storage({ revision: 2, presets: [preset] }, [seeded]);
    expect(await fixture.store.restoreDefaults()).toEqual({ revision: 3, presets: [seeded] });
    await expect(storage({ revision: 2, presets: [preset] }, []).store.restoreDefaults()).rejects.toThrow(
      /No default presets/,
    );
  });
});
