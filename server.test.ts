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
    },
  });
  await plugin(host.bb);
  return { ...host, get overrides() { return overrides; } };
}

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
