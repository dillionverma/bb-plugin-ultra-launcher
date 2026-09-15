import { SortablePresets } from "./SortablePresets";
import { PresetProviderLogo } from "./PresetProviderLogo";
import { useEffect, useId, useRef, useState } from "react";
import {
  experimental_ProviderModelPicker as ProviderModelPicker,
  experimental_useProviders as useProviders,
} from "@get-bb/plugin-sdk/app";
import type { ExperimentalProviderModelPickerValue } from "@get-bb/plugin-sdk";
import { usePresets } from "../hooks/usePresets";
import { EDIT_PRESETS_EVENT, effortLabel, parsePreset, type ModelPreset } from "../lib/presets";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Field, FieldGroup, FieldLabel } from "./ui/field";
import { Icon } from "./ui/icon";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";

const suggestedName = (preset: ModelPreset) => `${preset.model} · ${effortLabel(preset.reasoningLevel)}`.slice(0, 80);

export function PresetSettings() {
  const store = usePresets();
  const { providers } = useProviders();
  const nameId = useId();
  const [draft, setDraft] = useState<ModelPreset | null>(null);
  const [editRevision, setEditRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [saved, setSaved] = useState(false);
  const addRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  function finishEditing() {
    setDraft(null);
    setError(null);
    requestAnimationFrame(() => {
      const target = returnFocus.current;
      if (target?.isConnected) target.focus();
      else addRef.current?.focus();
    });
  }

  async function restore() {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await store.restoreDefaults();
      setConfirmRestore(false);
      setSaved(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function persist(next: ModelPreset[], revision = store.state.revision, closeEditor = false) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await store.save(next, revision);
      if (closeEditor) finishEditing();
      setSaved(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  function edit(preset: ModelPreset) {
    returnFocus.current = document.activeElement as HTMLElement | null;
    setEditRevision(store.state.revision);
    setDraft({ ...preset });
    setConfirmRestore(false);
    setSaved(false);
    setError(null);
  }
  function select(value: ExperimentalProviderModelPickerValue) {
    setDraft((current) => current ? { ...current, ...value, serviceTier: value.serviceTier ?? "default" } : null);
  }
  const conflict = draft !== null && editRevision !== store.state.revision;
  const existing = draft !== null && store.state.presets.some((item) => item.id === draft.id);
  const locked = saving || store.loading || !!store.error;

  return (
    <div className="flex flex-col gap-4" data-preset-settings="">
      {store.error ? <p role="alert" className="text-sm text-destructive">{store.error} <Button variant="ghost" size="sm" onClick={() => void store.reload()}>Reload</Button></p> : null}
      {draft ? (
        <form
          className="flex flex-col gap-5"
          onKeyDown={(event) => {
            // A portaled model menu owns its own Escape/Enter handling.
            if (!event.currentTarget.contains(event.target as Node)) return;
            if (event.key === "Escape" && !saving) {
              event.preventDefault(); event.stopPropagation(); finishEditing();
            }
          }}
          onSubmit={(event) => {
            event.preventDefault(); event.stopPropagation();
            if (saving || conflict) return;
            const parsed = parsePreset({ ...draft, name: draft.name.trim() || suggestedName(draft) });
            if (parsed === null) { setError("Choose a model to continue."); return; }
            const next = existing
              ? store.state.presets.map((item) => item.id === draft.id ? parsed : item)
              : [...store.state.presets, parsed];
            void persist(next, editRevision, true);
          }}
        >
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={finishEditing} aria-label="Back to presets"><Icon name="ChevronLeft" data-icon="inline-start" />Presets</Button>
            <span className="text-sm text-muted-foreground">/</span>
            <span className="text-sm font-medium">{existing ? "Edit preset" : "New preset"}</span>
          </div>
          <FieldGroup>
            <Field data-disabled={saving}>
              <FieldLabel htmlFor={nameId}>Preset name <span className="font-normal">· optional</span></FieldLabel>
              <Input id={nameId} aria-label="Preset name" autoFocus value={draft.name} maxLength={80} disabled={saving}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder={draft.model ? suggestedName(draft) : "e.g. Daily coding"} />
            </Field>
            <Field data-disabled={saving}>
              <span className="text-xs font-medium text-muted-foreground" id={`${nameId}-model`}>Model & thinking</span>
              <div aria-labelledby={`${nameId}-model`} className="flex min-h-10 items-center rounded-lg border border-border/60 px-2">
                <ProviderModelPicker value={draft} onChange={select} disabled={saving} />
              </div>
            </Field>
          </FieldGroup>
          {conflict ? <p role="alert" className="text-sm text-destructive">Presets changed in another window. Cancel and reopen this preset to edit the latest version.</p> : null}
          <div className="flex items-center justify-end gap-2 pt-1">
            {existing ? <Button type="button" variant="ghost" size="sm" className="mr-auto" disabled={saving || conflict} onClick={() => void persist(store.state.presets.filter((preset) => preset.id !== draft.id), editRevision, true)}>Delete preset</Button> : null}
            <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={finishEditing}>Cancel</Button>
            <Button type="submit" size="sm" disabled={saving || conflict || !draft.model.trim()}>{saving ? "Saving…" : "Save preset"}<span aria-hidden="true" className="opacity-50">↵</span></Button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">{store.state.presets.length} presets <span className="px-1 opacity-50">·</span> Drag to reorder</p>
            <Button ref={addRef} type="button" size="sm" disabled={locked || !providers.length || store.state.presets.length >= 30}
              onClick={() => edit({
                ...(store.state.presets[0] ?? { providerId: providers[0].id, model: "", reasoningLevel: "medium", serviceTier: "default" }),
                id: crypto.randomUUID(), name: "",
              })}>
              <Icon name="Plus" data-icon="inline-start" />Add preset
            </Button>
          </div>
          {store.loading ? <p role="status" className="py-4 text-sm text-muted-foreground">Loading presets…</p> : (
            <div className="flex max-h-[45vh] flex-col gap-1 overflow-y-auto" aria-label="Saved presets">
              <SortablePresets presets={store.state.presets} revision={store.state.revision} disabled={locked} onReorder={persist} renderRow={(preset, _index, handle) => (
                <div className="group flex flex-wrap items-center gap-1 rounded-lg px-1 py-1 hover:bg-accent/40">
                  {handle}
                  <button type="button" aria-label={`Edit ${preset.name}`} disabled={locked} onClick={() => edit(preset)} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <PresetProviderLogo providerId={preset.providerId} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{preset.name}</span>
                  </button>
                  <div className="max-w-full rounded-md" aria-label={`Model for ${preset.name}`}>
                    <ProviderModelPicker value={preset} disabled={locked} align="end" onChange={(value) => {
                      const next = parsePreset({ ...preset, ...value, serviceTier: value.serviceTier ?? "default" });
                      if (next === null) return;
                      if (next.providerId === preset.providerId && next.model === preset.model && next.reasoningLevel === preset.reasoningLevel && next.serviceTier === preset.serviceTier) return;
                      void persist(store.state.presets.map((item) => item.id === preset.id ? next : item));
                    }} />
                  </div>
                </div>
              )} />
              {store.state.presets.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Your favorite model combinations, one click away.<br />Add a preset to get started.</p> : null}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            {confirmRestore ? <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{store.state.presets.length ? `Replace your ${store.state.presets.length} preset${store.state.presets.length === 1 ? "" : "s"}?` : "Add the recommended presets?"}</span>
              <Button type="button" size="sm" disabled={saving} onClick={() => void restore()}>{saving ? "Restoring…" : "Restore"}</Button>
              <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={() => setConfirmRestore(false)}>Cancel</Button>
            </div> : <Button type="button" size="sm" variant="ghost" disabled={locked} onClick={() => setConfirmRestore(true)}>Restore defaults</Button>}
            <span role="status" className="text-xs text-muted-foreground">{saving ? "Saving…" : saved ? "Changes saved" : "Model changes save automatically"}</span>
          </div>
        </>
      )}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export function PresetSettingsOverlay() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(EDIT_PRESETS_EVENT, show);
    return () => window.removeEventListener(EDIT_PRESETS_EVENT, show);
  }, []);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto gap-5 p-5"
        onEscapeKeyDown={(event) => {
          // Let the editor handle Escape before the surrounding modal closes.
          if (document.activeElement?.closest("[data-preset-settings] form")) event.preventDefault();
        }}>
        <DialogHeader>
          <DialogTitle>Model presets</DialogTitle>
          <DialogDescription>Choose your model once. Reuse it in every thread.</DialogDescription>
        </DialogHeader>
        {open ? <PresetSettings /> : null}
      </DialogContent>
    </Dialog>
  );
}
