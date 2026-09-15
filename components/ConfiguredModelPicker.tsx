import { useState } from "react";
import { experimental_ProviderModelPicker as ProviderModelPicker } from "@get-bb/plugin-sdk/app";
import { PresetProviderLogo } from "./PresetProviderLogo";
import { usePresets } from "../hooks/usePresets";
import { EDIT_PRESETS_EVENT } from "../lib/presets";
import type { PresetSelectionProps } from "../lib/model-picker";
import { QuickModelPicker } from "./QuickModelPicker";
/**
 * The presets popover, wired to stored presets. Used both as the patched
 * host's model-picker slot and, on stock BB, directly by the Ultra Launcher
 * dialog (see QuickThreadOverlay).
 */
export function ConfiguredModelPicker(props: PresetSelectionProps) {
  const store = usePresets();
  const [reorderError, setReorderError] = useState<string | null>(null);
  return (
    <QuickModelPicker
      {...props}
      presets={store.state.presets}
      revision={store.state.revision}
      onSave={async (presets, revision) => {
        setReorderError(null);
        await store.save(presets, revision);
      }}
      renderModelPicker={(value, onChange, disabled) => <ProviderModelPicker value={value} onChange={onChange} disabled={disabled} />}
      onReorder={async (presets, revision) => {
        setReorderError(null);
        try { await store.save(presets, revision); }
        catch (error) { setReorderError(error instanceof Error ? error.message : String(error)); }
      }}
      loading={store.loading}
      loadError={store.error}
      actionError={reorderError}
      onEdit={() => window.dispatchEvent(new Event(EDIT_PRESETS_EVENT))}
      renderProviderIcon={(id) => (
        <PresetProviderLogo providerId={id} />
      )}
    />
  );
}
