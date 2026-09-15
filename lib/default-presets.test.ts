import { describe, expect, it } from "vitest";
import { DEFAULT_RUNGS, resolveDefaultPresets, type Catalog, type CatalogModel } from "./default-presets";

const efforts = (...levels: string[]) => levels.map((reasoningEffort) => ({ reasoningEffort }));
const model = (id: string, levels: string[], defaultReasoningEffort = levels[0]): CatalogModel => ({
  id,
  supportedReasoningEfforts: efforts(...levels),
  defaultReasoningEffort,
});
const full = ["low", "medium", "high", "xhigh", "max"];
const claudeModels = [
  model("claude-fable-5-1", full),
  model("claude-opus-5[1m]", full),
  model("claude-sonnet-5", full),
  model("claude-haiku-4-5-20251001", ["low"]),
];
const codexModels = [
  model("gpt-6-astra", [...full, "ultra"]),
  model("gpt-5.6-sol", [...full, "ultra"]),
  model("gpt-5.6-terra", full),
  model("gpt-5.6-luna", full),
];
const catalog = (entries: [string, CatalogModel[]][]): Catalog => new Map(entries);

describe("resolveDefaultPresets", () => {
  it("fills every rung from the preferred provider when both labs are available", () => {
    const presets = resolveDefaultPresets(
      catalog([
        ["claude-code", claudeModels],
        ["codex", codexModels],
      ]),
    );
    expect(presets.map((preset) => [preset.name, preset.providerId, preset.model, preset.reasoningLevel])).toEqual([
      ["Daily coding", "claude-code", "claude-opus-5[1m]", "high"],
      ["Quick fix", "claude-code", "claude-sonnet-5", "medium"],
      ["Hard problem", "claude-code", "claude-opus-5[1m]", "xhigh"],
      ["Long autonomous run", "claude-code", "claude-fable-5-1", "high"],
      ["Code review", "codex", "gpt-5.6-sol", "high"],
      ["Build a feature", "codex", "gpt-6-astra", "xhigh"],
      ["Cheap & fast", "codex", "gpt-5.6-luna", "low"],
    ]);
    expect(presets.every((preset) => preset.serviceTier === "default")).toBe(true);
    expect(presets.map((preset) => preset.id)).toEqual(DEFAULT_RUNGS.map((rung) => rung.id));
  });

  it("falls back to the other lab and collapses duplicate combinations for a single-provider install", () => {
    const presets = resolveDefaultPresets(catalog([["codex", codexModels]]));
    expect(presets.map((preset) => [preset.name, preset.model, preset.reasoningLevel])).toEqual([
      ["Daily coding", "gpt-6-astra", "medium"],
      ["Quick fix", "gpt-5.6-terra", "medium"],
      ["Hard problem", "gpt-6-astra", "xhigh"],
      ["Long autonomous run", "gpt-6-astra", "max"],
      ["Code review", "gpt-5.6-sol", "high"],
      // "Build a feature" resolves to the same combination as "Hard problem" and is dropped.
      ["Cheap & fast", "gpt-5.6-luna", "low"],
    ]);
  });

  it("keeps the Claude ladder alone when Codex is missing", () => {
    const presets = resolveDefaultPresets(catalog([["claude-code", claudeModels]]));
    expect(presets.map((preset) => preset.name)).toEqual([
      "Daily coding",
      "Quick fix",
      "Hard problem",
      "Long autonomous run",
      "Code review",
      "Cheap & fast",
    ]);
    expect(presets.find((preset) => preset.name === "Cheap & fast")).toMatchObject({
      model: "claude-haiku-4-5-20251001",
      reasoningLevel: "low",
    });
  });

  it("tries alternate catalog ids and downgrades an unsupported effort to the model default", () => {
    const presets = resolveDefaultPresets(
      catalog([["claude-code", [model("claude-opus-5", ["low", "medium", "high"], "high")]]]),
    );
    expect(presets).toEqual([
      expect.objectContaining({ name: "Daily coding", model: "claude-opus-5", reasoningLevel: "high" }),
      // xhigh is not offered, so "Hard problem" lands on the default (high) and
      // collapses onto "Daily coding".
    ]);
  });

  it("returns nothing when no catalog has any candidate", () => {
    expect(resolveDefaultPresets(catalog([["pi", [model("unknown", full)]]]))).toEqual([]);
    expect(resolveDefaultPresets(catalog([]))).toEqual([]);
  });
});
