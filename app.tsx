import { PresetSettings, PresetSettingsOverlay } from "./components/PresetSettings";
// bb-plugin-quick-thread — frontend entry.
//
// A floating "new thread" dialog you can open from anywhere without leaving
// the thread you are on. All of the UI lives in QuickThreadOverlay; this file
// only wires it into BB.
import { definePluginApp } from "@get-bb/plugin-sdk/app";
import { OPEN_EVENT, QuickThreadOverlay } from "@/components/QuickThreadOverlay";

export default definePluginApp((app) => {
  app.slots.settingsSection({ id: "model-presets", title: "Model presets", description: "Choose the presets shown in the Cmd+N model menu.", component: PresetSettings });
  app.slots.experimental_appOverlay({ id: "preset-settings", component: PresetSettingsOverlay });

  // App-wide floating dialog. Owns its own Ctrl/Cmd+N shortcut.
  app.slots.experimental_appOverlay({
    id: "quick-thread",
    component: QuickThreadOverlay,
  });

  // Reliable fallback for browsers/OSes that reserve Cmd/Ctrl+N. The palette
  // row cannot reach React state directly, so it signals the overlay.
  app.slots.commandPaletteAction({
    id: "new-thread",
    title: "Ultra Launcher: new thread",
    run: () => {
      window.dispatchEvent(new Event(OPEN_EVENT));
    },
  });
});
