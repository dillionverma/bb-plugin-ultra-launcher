import { presetStateSchema, presetsSchema, PRESETS_CHANNEL } from "./lib/presets";
import { createPresetStore } from "./lib/preset-store";
import { createSelectionStore, selectedPresetSchema, SELECTION_CHANNEL } from "./lib/selection-store";
import { resolveDefaultPresets, type Catalog, type CatalogModel } from "./lib/default-presets";
// bb-plugin-quick-thread — backend entry.
//
// Two jobs:
//
// 1. `create_thread` RPC: take the NewThreadRequest that the frontend's
//    NewThreadComposer produces and create the thread with it. The composer
//    resolves every selection (project, environment, provider/model,
//    permission mode, prompt input); this handler just forwards it to
//    bb.sdk.threads.spawn, which fills in `origin: "plugin"` /
//    `originPluginId` so quick-created threads stay attributed to this plugin.
//
// 2. Free Ctrl/Cmd+N for the dialog. In the desktop app BB's native
//    "New Thread" menu item carries the host's `thread.new` keybinding, which
//    defaults to Mod+N on desktop. Electron consumes menu accelerators before
//    the renderer sees the keydown, so the overlay's listener never fires.
//    The fix is to move `thread.new` to its web-only default (Mod+Shift+O) via
//    a keybinding override; the desktop menu re-reads accelerators from system
//    config, so this takes effect without a restart. The plugin only ever
//    writes an override it created itself and restores it on release.
import { defineRpcContract, type BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";

// The composer's NewThreadRequest. Fields we forward verbatim; `.passthrough()`
// keeps any additive fields a newer BB adds. spawn does the real validation.
const newThreadRequestSchema = z
  .object({
    projectId: z.string(),
    providerId: z.string(),
    model: z.string(),
    reasoningLevel: z.string().nullish(),
    permissionMode: z.string().nullish(),
    serviceTier: z.string().nullish(),
    executionInputSources: z.unknown(),
    environment: z.unknown(),
    input: z.unknown(),
  })
  .passthrough();

export const rpcContract = defineRpcContract({
  get_presets: { input: z.object({}), output: presetStateSchema },
  save_presets: { input: z.object({ expectedRevision: z.number().int().nonnegative(), presets: presetsSchema }), output: presetStateSchema },
  restore_default_presets: { input: z.object({}), output: presetStateSchema },
  get_selected_preset: { input: z.object({}), output: selectedPresetSchema },
  set_selected_preset: { input: selectedPresetSchema, output: selectedPresetSchema },
  create_thread: {
    input: z.object({ request: newThreadRequestSchema }),
    output: z.object({ threadId: z.string() }),
  },
});

// --- Hotkey takeover -------------------------------------------------------

const HOST_COMMAND = "thread.new" as const;
/** BB's own web-only default for `thread.new`; keeps "New thread" reachable. */
const RELOCATED_SHORTCUT = {
  key: "o",
  mod: true,
  meta: false,
  control: false,
  alt: false,
  shift: true,
} as const;
/** KV marker: set only when we wrote the override, so release never removes a
 * binding the user chose themselves. */
const CLAIM_KEY = "hotkey.claimed";

type Shortcut = {
  key: string;
  mod: boolean;
  meta: boolean;
  control: boolean;
  alt: boolean;
  shift: boolean;
} | null;

function isModN(shortcut: Shortcut): boolean {
  return (
    shortcut !== null &&
    shortcut.key.toLowerCase() === "n" &&
    shortcut.mod &&
    !shortcut.shift &&
    !shortcut.alt &&
    !shortcut.control &&
    !shortcut.meta
  );
}

type HotkeyStatus =
  | { state: "free"; reason: "claimed" | "not-bound" | "user-override" }
  | { state: "taken"; reason: "host-default" | "user-override" };

async function hotkeyStatus(bb: BbPluginApi): Promise<HotkeyStatus> {
  const config = await bb.sdk.system.config();
  const override = config.keybindingOverrides.find(
    (entry) => entry.command === HOST_COMMAND,
  );
  const hostHoldsModN = config.keybindings.some(
    (binding) => binding.command === HOST_COMMAND && isModN(binding.shortcut),
  );
  const claimed = (await bb.storage.kv.get<boolean>(CLAIM_KEY)) === true;
  if (hostHoldsModN) {
    return { state: "taken", reason: override ? "user-override" : "host-default" };
  }
  if (claimed) return { state: "free", reason: "claimed" };
  if (override) return { state: "free", reason: "user-override" };
  return { state: "free", reason: "not-bound" };
}

/** Move `thread.new` off Mod+N. No-op when it is already free, and never
 * overwrites an override the user set themselves. */
async function claimHotkey(bb: BbPluginApi): Promise<HotkeyStatus> {
  const status = await hotkeyStatus(bb);
  if (status.state === "free") return status;
  if (status.reason === "user-override") {
    bb.log.warn(
      `${HOST_COMMAND} is bound to Mod+N by a user override; leaving it alone. ` +
        `Run \`bb settings keyboard set ${HOST_COMMAND} disabled\` to free Ctrl/Cmd+N.`,
    );
    return status;
  }
  const config = await bb.sdk.system.config();
  await bb.sdk.system.updateKeyboardSettings([
    ...config.keybindingOverrides.filter((entry) => entry.command !== HOST_COMMAND),
    { command: HOST_COMMAND, shortcut: { ...RELOCATED_SHORTCUT } },
  ]);
  await bb.storage.kv.set(CLAIM_KEY, true);
  bb.log.info(`moved ${HOST_COMMAND} to Mod+Shift+O; Ctrl/Cmd+N now opens Ultra Launcher`);
  return { state: "free", reason: "claimed" };
}

/** Undo claimHotkey. Only removes the override we wrote. */
async function releaseHotkey(bb: BbPluginApi): Promise<HotkeyStatus> {
  const claimed = (await bb.storage.kv.get<boolean>(CLAIM_KEY)) === true;
  if (claimed) {
    const config = await bb.sdk.system.config();
    await bb.sdk.system.updateKeyboardSettings(
      config.keybindingOverrides.filter((entry) => entry.command !== HOST_COMMAND),
    );
    await bb.storage.kv.delete(CLAIM_KEY);
    bb.log.info(`restored ${HOST_COMMAND} to BB's default binding`);
  }
  return hotkeyStatus(bb);
}

function describe(status: HotkeyStatus): string {
  switch (`${status.state}/${status.reason}`) {
    case "free/claimed":
      return "Ctrl/Cmd+N opens Ultra Launcher (BB's New thread moved to Mod+Shift+O by this plugin).";
    case "free/not-bound":
      return "Ctrl/Cmd+N opens Ultra Launcher (BB does not bind it).";
    case "free/user-override":
      return "Ctrl/Cmd+N opens Ultra Launcher (you rebound BB's New thread yourself).";
    case "taken/host-default":
      return "BB's New thread still owns Ctrl/Cmd+N in the desktop app; run `bb quick-thread claim`.";
    case "taken/user-override":
      return "You bound BB's New thread to Ctrl/Cmd+N yourself; run `bb settings keyboard set thread.new disabled` to free it.";
    default:
      return `${status.state} (${status.reason})`;
  }
}

// --- Plugin ---------------------------------------------------------------

export default async function plugin(bb: BbPluginApi) {
  bb.log.info("loaded");

  const settings = bb.settings.define({
    takeOverNewThreadHotkey: {
      type: "boolean",
      label: "Take over Ctrl/Cmd+N",
      description:
        "Move BB's own New thread shortcut to Mod+Shift+O so Ctrl/Cmd+N opens the Ultra Launcher dialog in the desktop app. Turning this off restores BB's default.",
      default: true,
    },
  });

  // Starter presets come from the host's live catalog so every row is a
  // combination this machine can actually run. A provider whose catalog fails
  // to load (signed out, CLI missing) simply contributes nothing.
  const loadCatalog = async (): Promise<Catalog> => {
    const providers = await bb.sdk.providers.list();
    const entries = await Promise.all(
      providers
        .filter((provider) => provider.available)
        .map(async (provider): Promise<[string, readonly CatalogModel[]]> => {
          try {
            const result = await bb.sdk.providers.models({ providerId: provider.id });
            return [provider.id, result.modelLoadError ? [] : result.models];
          } catch (error) {
            bb.log.warn(`catalog for ${provider.id} unavailable: ${error instanceof Error ? error.message : String(error)}`);
            return [provider.id, []];
          }
        }),
    );
    return new Map(entries);
  };
  const presetStore = createPresetStore({
    read: () => bb.storage.kv.get("model-presets.v1"),
    write: (value) => bb.storage.kv.set("model-presets.v1", value),
    defaults: async () => resolveDefaultPresets(await loadCatalog()),
  });
  const selectionStore = createSelectionStore({
    read: () => bb.storage.kv.get("model-presets.selected.v1"),
    write: (value) => bb.storage.kv.set("model-presets.selected.v1", value),
  });
  bb.rpc.register(rpcContract, {
    get_presets: () => presetStore.read(),
    restore_default_presets: async () => {
      const next = await presetStore.restoreDefaults();
      bb.realtime.publish(PRESETS_CHANNEL, { revision: next.revision });
      return next;
    },
    get_selected_preset: () => selectionStore.read(),
    set_selected_preset: async ({ presetId }) => {
      const next = await selectionStore.write(presetId);
      bb.realtime.publish(SELECTION_CHANNEL, next);
      return next;
    },
    save_presets: async ({ expectedRevision, presets }) => {
      const next = await presetStore.save(expectedRevision, presets);
      bb.realtime.publish(PRESETS_CHANNEL, { revision: next.revision });
      return next;
    },
    create_thread: async ({ request }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const thread = await bb.sdk.threads.spawn({ ...(request as any) });
      bb.log.info(`created thread ${thread.id}`);
      return { threadId: thread.id };
    },
  });

  bb.cli.register({
    name: "quick-thread",
    summary: "Manage Ultra Launcher hotkeys and model presets",
    commands: [
      { name: "presets", summary: "List saved model presets", usage: "bb quick-thread presets" },
      { name: "restore-defaults", summary: "Replace saved presets with the recommended defaults", usage: "bb quick-thread restore-defaults" },
      { name: "status", summary: "Show whether Ctrl/Cmd+N opens Ultra Launcher", usage: "bb quick-thread status" },
      { name: "claim", summary: "Move BB's New thread off Ctrl/Cmd+N", usage: "bb quick-thread claim" },
      { name: "release", summary: "Restore BB's default New thread binding", usage: "bb quick-thread release" },
    ],
    run: async (argv) => {
      const [action = "status"] = argv;
      if (action === "presets") {
        const [presets, selection] = await Promise.all([presetStore.read(), selectionStore.read()]);
        return { exitCode: 0, stdout: JSON.stringify({ ...presets, ...selection }, null, 2) + "\n" };
      }
      if (action === "restore-defaults") {
        const next = await presetStore.restoreDefaults();
        bb.realtime.publish(PRESETS_CHANNEL, { revision: next.revision });
        return { exitCode: 0, stdout: JSON.stringify(next, null, 2) + "\n" };
      }
      if (!["status", "claim", "release"].includes(action)) {
        return {
          exitCode: 2,
          stderr: "usage: bb quick-thread [status|presets|restore-defaults|claim|release]\n",
        };
      }
      const status =
        action === "claim"
          ? await claimHotkey(bb)
          : action === "release"
            ? await releaseHotkey(bb)
            : await hotkeyStatus(bb);
      return { exitCode: 0, stdout: `${describe(status)}\n` };
    },
  });

  const syncHotkey = async (takeOver: boolean) => {
    try {
      const status = takeOver ? await claimHotkey(bb) : await releaseHotkey(bb);
      bb.log.info(`hotkey: ${describe(status)}`);
    } catch (error) {
      bb.log.warn(`hotkey sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  settings.onChange((next, prev) => {
    if (next.takeOverNewThreadHotkey !== prev.takeOverNewThreadHotkey) {
      void syncHotkey(next.takeOverNewThreadHotkey);
    }
  });
  void settings.get().then((values) => syncHotkey(values.takeOverNewThreadHotkey));

  bb.onDispose(() => {
    bb.log.info("disposed");
  });
}
