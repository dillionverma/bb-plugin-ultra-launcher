import { PresetSettings, PresetSettingsOverlay } from "./components/PresetSettings";
import { definePluginApp } from "@get-bb/plugin-sdk/app";
import { OPEN_EVENT, LauncherOverlay } from "./components/LauncherOverlay";

export default definePluginApp((app) => {
  app.slots.settingsSection({ id: "model-presets", title: "Model presets", description: "Choose the presets shown in the Cmd+N model menu.", component: PresetSettings });
  app.slots.experimental_appOverlay({ id: "preset-settings", component: PresetSettingsOverlay });

  app.slots.experimental_appOverlay({
    id: "ultra-launcher",
    component: LauncherOverlay,
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
