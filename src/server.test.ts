import { describe, expect, it } from "vitest";
import type { BbPluginApi } from "@get-bb/plugin-sdk";
import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import plugin from "./server";

type Overrides = Parameters<BbPluginApi["sdk"]["system"]["updateKeyboardSettings"]>[0];
const hostShortcut = { key: "n", mod: true, meta: false, control: false, alt: false, shift: false };
const relocatedShortcut = { key: "o", mod: true, meta: false, control: false, alt: false, shift: true };

async function setup() {
  let overrides: Overrides = [];
  const host = createFakePluginHost({
    pluginId: "ultra-launcher",
    settings: { takeOverNewThreadHotkey: false },
    sdk: {
      system: {
        config: async () => {
          const override = overrides.find((entry) => entry.command === "thread.new");
          return {
            keybindingOverrides: overrides,
            keybindings: [{ command: "thread.new", shortcut: override ? override.shortcut : hostShortcut }],
          };
        },
        updateKeyboardSettings: async (next) => { overrides = next; },
      },
      threads: { spawn: async () => ({ id: "thr_spawned" }) },
    },
  });
  await plugin(host.bb);
  return { ...host, get overrides() { return overrides; } };
}

const presetsSavedBy02x = {
  revision: 7,
  presets: [
    { id: "018e5279-1858-4bb1-afbd-69a18e361859", name: "Daily coding", providerId: "claude-code", model: "claude-opus-5[1m]", reasoningLevel: "high", serviceTier: "default" },
    { id: "5b8f2c9e-7a41-4d0b-9e3a-2f6c1d8e4a70", name: "Review", providerId: "codex", model: "gpt-5.6-sol", reasoningLevel: "high", serviceTier: "default" },
    { id: "c2a7e1f4-3b9d-4e6a-8f05-9d1b7c3e5a28", name: "Quick fix", providerId: "codex", model: "gpt-5.6-terra", reasoningLevel: "medium", serviceTier: "default" },
    { id: "9e4d6b2a-1c8f-4a3e-b7d5-0f2e8c6a4b91", name: "Hard problem", providerId: "codex", model: "gpt-6-astra", reasoningLevel: "xhigh", serviceTier: "default" },
    { id: "71f3a9c5-e2d8-4b6f-a0c4-5e9b3d7f1a62", name: "Sonnet", providerId: "claude-code", model: "claude-sonnet-5", reasoningLevel: "high", serviceTier: "default" },
  ],
};

describe("saved presets", () => {
  it("loads saved presets and the remembered selection exactly as stored", async () => {
    const host = await setup();
    try {
      await host.bb.storage.kv.set("model-presets.v1", presetsSavedBy02x);
      await host.bb.storage.kv.set("model-presets.selected.v1", { presetId: presetsSavedBy02x.presets[1]!.id });
      expect(await host.harness.behavior.callRpc("get_presets", {})).toEqual(presetsSavedBy02x);
      expect(await host.harness.behavior.callRpc("get_selected_preset", {})).toEqual({ presetId: presetsSavedBy02x.presets[1]!.id });
      expect(await host.bb.storage.kv.get("model-presets.v1")).toEqual(presetsSavedBy02x);
      expect(host.harness.inspection.sdk.callsTo("providers.list")).toEqual([]);
    } finally {
      await host.harness.lifecycle.dispose();
    }
  });
});

describe("service tiers", () => {
  it("saves a preset on any service tier the provider declares", async () => {
    const host = await setup();
    try {
      await host.bb.storage.kv.set("model-presets.v1", presetsSavedBy02x);
      const ultrafast = { ...presetsSavedBy02x.presets[1]!, id: "6d2c8a14-9b7e-4f30-a5c1-8e4f2b7d9a03", name: "Review, ultrafast", serviceTier: "ultrafast" };
      const next = { revision: 8, presets: [...presetsSavedBy02x.presets, ultrafast] };
      expect(await host.harness.behavior.callRpc("save_presets", { expectedRevision: 7, presets: next.presets })).toEqual(next);
      expect(await host.harness.behavior.callRpc("get_presets", {})).toEqual(next);
    } finally {
      await host.harness.lifecycle.dispose();
    }
  });
});

describe("thread creation", () => {
  it("forwards composer fields BB adds later to the spawn request", async () => {
    const host = await setup();
    try {
      const request = {
        projectId: "proj_1",
        providerId: "codex",
        model: "gpt-5.6-sol",
        reasoningLevel: "high",
        permissionMode: "full",
        serviceTier: "fast",
        executionInputSources: {},
        environment: { type: "project-default" },
        input: [{ type: "text", text: "Fix the flaky test", mentions: [] }],
        experimental_futureField: { kept: true },
      };
      expect(await host.harness.behavior.callRpc("create_thread", { request })).toEqual({ threadId: "thr_spawned" });
      const [[spawned]] = host.harness.inspection.sdk.callsTo("threads.spawn");
      expect(spawned).toMatchObject(request);
    } finally {
      await host.harness.lifecycle.dispose();
    }
  });
});

describe("launcher hotkey ownership", () => {
  it("claims the host default and releases only its relocated shortcut", async () => {
    const host = await setup();
    try {
      const unrelated: Overrides = [{ command: "palette.open", shortcut: { ...hostShortcut, key: "k" } }];
      await host.bb.sdk.system.updateKeyboardSettings(unrelated);
      expect((await host.harness.behavior.runCli(["claim"])).exitCode).toBe(0);
      expect(host.overrides).toEqual([...unrelated, { command: "thread.new", shortcut: relocatedShortcut }]);
      expect(await host.bb.storage.kv.get("hotkey.claimed")).toBe(true);
      expect((await host.harness.behavior.runCli(["release"])).exitCode).toBe(0);
      expect(host.overrides).toEqual(unrelated);
      expect(await host.bb.storage.kv.get("hotkey.claimed")).not.toBe(true);
    } finally {
      await host.harness.lifecycle.dispose();
    }
  });

  it.each([
    { ...relocatedShortcut, key: "p" },
    { ...relocatedShortcut, alt: true },
    null,
  ])("preserves a subsequent user override %j when releasing", async (shortcut) => {
    const host = await setup();
    try {
      await host.harness.behavior.runCli(["claim"]);
      const userOverrides: Overrides = [{ command: "thread.new", shortcut }];
      await host.bb.sdk.system.updateKeyboardSettings(userOverrides);
      expect((await host.harness.behavior.runCli(["release"])).exitCode).toBe(0);
      expect(host.overrides).toEqual(userOverrides);
      expect(await host.bb.storage.kv.get("hotkey.claimed")).not.toBe(true);
    } finally {
      await host.harness.lifecycle.dispose();
    }
  });
});
