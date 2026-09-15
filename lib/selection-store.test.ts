import { describe, expect, it } from "vitest";
import { createSelectionStore, resolveSelected, NO_SELECTION } from "./selection-store";

function memoryStorage(initial: unknown = null) {
  let value = initial;
  return { read: async () => value, write: async (next: unknown) => { value = next; }, peek: () => value };
}

describe("createSelectionStore", () => {
  it("starts with no selection and round-trips a preset id", async () => {
    const storage = memoryStorage();
    const store = createSelectionStore(storage);
    expect(await store.read()).toEqual(NO_SELECTION);
    expect(await store.write("preset-1")).toEqual({ presetId: "preset-1" });
    expect(await store.read()).toEqual({ presetId: "preset-1" });
  });

  it("clears a selection", async () => {
    const store = createSelectionStore(memoryStorage({ presetId: "preset-1" }));
    expect(await store.write(null)).toEqual(NO_SELECTION);
    expect(await store.read()).toEqual(NO_SELECTION);
  });

  it("ignores stored junk instead of throwing at the picker", async () => {
    const store = createSelectionStore(memoryStorage({ presetId: 42 }));
    expect(await store.read()).toEqual(NO_SELECTION);
  });
});

describe("resolveSelected", () => {
  const presets = [{ id: "a" }, { id: "b" }];
  it("prefers the remembered preset", () => {
    expect(resolveSelected(presets, "b")).toEqual({ id: "b" });
  });
  it("falls back to the first preset when the remembered one is gone", () => {
    expect(resolveSelected(presets, "deleted")).toEqual({ id: "a" });
    expect(resolveSelected(presets, null)).toEqual({ id: "a" });
  });
  it("returns null with no presets", () => {
    expect(resolveSelected([], "a")).toBeNull();
  });
});
