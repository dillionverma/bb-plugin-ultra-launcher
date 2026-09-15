import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { QuickModelPicker } from "../components/QuickModelPicker";
import { PresetSettings } from "../components/PresetSettings";
import { usePresets } from "../hooks/usePresets";
import { experimental_ProviderIcon as ProviderIcon, experimental_ProviderModelPicker as ProviderModelPicker } from "./sdk";
import type { ModelPickerProps } from "../lib/model-picker";
import "./preview.css";
import "../dist/app.css";

function Preview() {
  const store = usePresets();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selection, setSelection] = useState({ providerId: "claude", model: "opus-5", reasoningLevel: "xhigh", serviceTier: "default" } as Pick<ModelPickerProps, "providerId" | "model" | "reasoningLevel" | "serviceTier">);
  return <main data-bb-plugin-root="" data-bb-plugin="quick-thread">
    <p className="eyebrow">QUICK THREAD / PRESETS</p><h1>Ultra Launcher</h1><p className="intro">Your model presets, ready when you need them.</p>
    <section className="compose-card"><header>Personal workspace <span>⌘ N</span></header><textarea aria-label="Draft" placeholder="What do you want to work on?" /><footer><QuickModelPicker defaultOpen {...selection} presets={store.state.presets} revision={store.state.revision} onSave={async (presets, revision) => { await store.save(presets, revision); }} renderModelPicker={(value, onChange, disabled) => <ProviderModelPicker value={value} onChange={onChange} disabled={disabled} />} onReorder={async (presets, revision) => { await store.save(presets, revision); }} loading={store.loading} loadError={store.error} onEdit={() => setSettingsOpen(true)} renderProviderIcon={(id) => <ProviderIcon provider={{ id }} className="size-4" />} providers={[]} models={[]} reasoningOptions={[]} supportsServiceTier={selection.providerId === "codex"} isLoading={false} error={null} disabled={false} canSelectModel canChangeProvider onPresetSelect={async (value) => setSelection(value)} onModelChange={() => {}} onProviderChange={() => {}} onReasoningChange={() => {}} onServiceTierChange={() => {}} /><span className="create-label">Create ↵</span></footer></section>
    <div className="preview-actions"><span>Sample catalogs · No threads are created</span><button onClick={() => setSettingsOpen((open) => !open)}>{settingsOpen ? "Close settings" : "Edit presets ↗"}</button></div>
    {settingsOpen ? <section className="settings-card"><h2>Model presets</h2><PresetSettings /></section> : null}
  </main>;
}
createRoot(document.getElementById("root")!).render(<Preview />);
