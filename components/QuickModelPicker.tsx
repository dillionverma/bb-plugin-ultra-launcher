import { SortablePresets } from "./SortablePresets";
import { useRef, useState, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Icon } from "./ui/icon";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { effortLabel, isActivePreset, presetSchema, type ModelPreset } from "../lib/presets";
import type { PresetSelectionProps } from "../lib/model-picker";
import type { ExperimentalProviderModelPickerValue } from "@get-bb/plugin-sdk";

export interface PresetPickerProps extends PresetSelectionProps {
  presets: ModelPreset[];
  revision: number;
  onReorder(presets: ModelPreset[], revision: number): Promise<void>;
  onSave(presets: ModelPreset[], revision: number): Promise<void>;
  renderModelPicker?(value: ModelPreset, onChange: (value: ExperimentalProviderModelPickerValue) => void, disabled: boolean): ReactNode;
  defaultOpen?: boolean;
  loading?: boolean;
  loadError?: string | null;
  actionError?: string | null;
  onEdit(): void;
  renderProviderIcon?(id: string): ReactNode;
}

export function QuickModelPicker(props: PresetPickerProps) {
  const [open, setOpen] = useState(props.defaultOpen ?? false);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ draft: ModelPreset; presets: ModelPreset[]; revision: number; isNew: boolean } | null>(null);
  const saving = useRef(false);
  const rows = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = props.presets.find((preset) => isActivePreset(preset, props));
  const busy = pending !== null || props.disabled || props.loading || !!props.loadError;
  const conflict = editor !== null && editor.revision !== props.revision;

  function edit(preset?: ModelPreset) {
    setError(null);
    setEditor({
      draft: preset ? { ...preset } : {
        id: crypto.randomUUID(), name: "", providerId: props.providerId,
        model: props.model, reasoningLevel: props.reasoningLevel,
        serviceTier: props.serviceTier ?? "default",
      },
      presets: props.presets, revision: props.revision, isNew: !preset,
    });
  }

  async function persist(presets: ModelPreset[], revision: number) {
    if (saving.current || busy) return;
    saving.current = true;
    setPending("save");
    setError(null);
    try {
      await props.onSave(presets, revision);
      setEditor(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      saving.current = false;
      setPending(null);
    }
  }

  function saveDraft() {
    if (!editor || conflict) return;
    const { draft, presets, revision, isNew } = editor;
    const parsed = presetSchema.safeParse({ ...draft, name: draft.name.trim() || `${draft.model} · ${effortLabel(draft.reasoningLevel)}`.slice(0, 80) });
    if (!parsed.success) { setError("Choose a model to continue."); return; }
    void persist(isNew ? [...presets, parsed.data] : presets.map((item) => item.id === draft.id ? parsed.data : item), revision);
  }

  function inlineEditor() {
    if (!editor) return null;
    return <div data-preset-editor="" className="space-y-2 rounded-lg bg-accent/30 p-2" onKeyDown={(event) => {
      // Nested portaled menus own their keyboard events.
      if (!event.currentTarget.contains(event.target as Node)) return;
      event.stopPropagation();
      if (event.key === "Enter" && event.target instanceof HTMLInputElement && !event.nativeEvent.isComposing) { event.preventDefault(); saveDraft(); }
      if (event.key === "Escape" && !busy) { event.preventDefault(); setEditor(null); setError(null); }
    }}>
      {editor.isNew ? <div className="min-w-0 rounded-md border border-border/60 px-1 py-1">
        {props.renderModelPicker?.(editor.draft, (value) => setEditor((current) => current ? { ...current, draft: { ...current.draft, ...value, serviceTier: value.serviceTier ?? "default" } } : null), !!busy)}
      </div> : null}
      <Input autoFocus aria-label="Preset name" placeholder={`${editor.draft.model} · ${effortLabel(editor.draft.reasoningLevel)}`} maxLength={80} value={editor.draft.name} disabled={busy}
        onChange={(event) => setEditor({ ...editor, draft: { ...editor.draft, name: event.target.value } })} className="h-8 text-sm" />
      {conflict ? <p role="alert" className="text-xs text-destructive">Presets changed. Cancel and reopen to use the latest list.</p> : null}
      <div className="flex justify-end gap-1">
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => { setEditor(null); setError(null); }}>Cancel</Button>
        <Button type="button" size="sm" disabled={busy || conflict || !editor.draft.model.trim()} onClick={saveDraft}>{pending === "save" ? "Saving…" : editor.isNew ? "Add preset" : "Save name"}</Button>
      </div>
    </div>;
  }

  async function select(preset: ModelPreset) {
    if (busy) return;
    setPending(preset.id);
    setError(null);
    try {
      await props.onPresetSelect({
        providerId: preset.providerId,
        model: preset.model,
        reasoningLevel: preset.reasoningLevel,
        serviceTier: preset.serviceTier,
      });
      setOpen(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setPending(null);
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(value) => {
        if (!pending && !dragging) {
          setOpen(value);
          setError(null);
          if (!value) setEditor(null);
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={props.disabled}
          aria-label={`Choose preset${selected ? `: ${selected.name}` : ""}`}
          className="flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {selected && props.renderProviderIcon ? (
            props.renderProviderIcon(selected.providerId)
          ) : (
            <Icon name="Bot" className="size-4 shrink-0" />
          )}
          <span className="min-w-0 text-left">
            <span className="block truncate font-medium text-foreground">{selected?.name ?? "Choose preset"}</span>
            {selected ? <span className="block truncate text-[11px] leading-4 text-muted-foreground" title={`${selected.model} · ${effortLabel(selected.reasoningLevel)}`}>
              {selected.model} · {effortLabel(selected.reasoningLevel)}
            </span> : null}
          </span>
          <Icon name="ChevronDown" className="size-3.5 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-96 max-w-[calc(100vw-2rem)] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto rounded-xl border border-border/60 bg-popover p-1 text-popover-foreground shadow-xl"
        onEscapeKeyDown={(event) => { if (dragging || editor || pending) event.preventDefault(); }}
        onOpenAutoFocus={(event) => {
          if (props.presets.length) {
            event.preventDefault();
            rows.current[
              Math.max(
                0,
                props.presets.findIndex((preset) => preset.id === selected?.id),
              )
            ]?.focus();
          }
        }}
        onKeyDown={(event) => {
          if (!event.currentTarget.contains(event.target as Node)) return;
          if (event.target instanceof Element && event.target.closest("[data-preset-editor]")) return;
          if (event.target instanceof Element && event.target.closest("[data-preset-drag-handle]")) return;
          if (event.key === "Enter") event.stopPropagation();
          if (!(event.target instanceof Element) || event.target.getAttribute("role") !== "menuitemradio") return;
          if (
            event.key !== "ArrowDown" &&
            event.key !== "ArrowUp" &&
            event.key !== "Home" &&
            event.key !== "End"
          )
            return;
          if (!props.presets.length) return;
          event.preventDefault();
          event.stopPropagation();
          const current = rows.current.findIndex((button) => button === document.activeElement);
          const index =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? props.presets.length - 1
                : (current + (event.key === "ArrowDown" ? 1 : -1) + props.presets.length) %
                  props.presets.length;
          rows.current[index]?.focus();
        }}
      >
        <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground"><span>Presets</span><span>Drag to reorder</span></div>
        <div role="menu" aria-label="Model presets" className="max-h-72 overflow-y-auto">
          {props.loading ? (
            <p role="status" className="px-3 py-4 text-sm text-muted-foreground">
              Loading presets…
            </p>
          ) : props.loadError ? (
            <p role="alert" className="px-3 py-3 text-sm text-destructive">
              {props.loadError}
            </p>
          ) : props.presets.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              No presets yet. Add one below.
            </p>
          ) : (
            <SortablePresets presets={props.presets} revision={props.revision} disabled={busy || !!editor} onReorder={props.onReorder} onDraggingChange={setDragging} renderRow={(preset, index, handle) => (
              <div><div className="group flex items-center gap-1 rounded-lg px-1 hover:bg-accent/50">{handle}
              <button
                key={preset.id}
                ref={(element) => {
                  rows.current[index] = element;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={preset.id === selected?.id}
                disabled={busy || dragging || !!editor}
                onClick={() => void select(preset)}
                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-2.5 pr-3 text-left focus-visible:bg-accent focus-visible:outline-none disabled:opacity-50"
              >
                {props.renderProviderIcon ? (
                  props.renderProviderIcon(preset.providerId)
                ) : (
                  <Icon name="Bot" className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{preset.name}</span>
                  <span className="block truncate text-xs text-muted-foreground" title={`${preset.model} · ${effortLabel(preset.reasoningLevel)}`}>
                    {preset.model} · {effortLabel(preset.reasoningLevel)}
                  </span>
                </span>
                <span className="ml-auto flex shrink-0 items-center gap-1.5">
                  {preset.serviceTier === "fast" ? (
                    <Icon name="Zap" className="size-3.5 text-muted-foreground" />
                  ) : null}
                  {pending === preset.id ? (
                    <Icon name="Spinner" className="size-4 animate-spin" />
                  ) : preset.id === selected?.id ? (
                    <Icon name="Check" className="size-4" />
                  ) : null}
                </span>
              </button>
              <button type="button" aria-label={`Rename ${preset.name}`} title="Rename preset" disabled={busy || dragging || !!editor} onClick={() => edit(preset)} className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30"><Icon name="Edit" className="size-3.5" /></button>
              <button type="button" aria-label={`Delete ${preset.name}`} title="Delete preset" disabled={busy || dragging || !!editor} onClick={() => void persist(props.presets.filter((item) => item.id !== preset.id), props.revision)} className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30"><Icon name="Trash2" className="size-3.5" /></button>
              </div>{editor && !editor.isNew && editor.draft.id === preset.id ? inlineEditor() : null}</div>
            )} />
          )}
        </div>
        {error || props.actionError ? (
          <p role="alert" className="px-3 py-2 text-xs text-destructive">
            {error ?? props.actionError}
          </p>
        ) : null}
        <div className="mt-1 border-t border-border/60 pt-1">
          {editor?.isNew ? inlineEditor() : <button type="button" disabled={busy || dragging || !!editor || props.presets.length >= 30} onClick={() => edit()} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"><Icon name="Plus" className="size-4" />Add new preset<span className="ml-auto text-xs text-muted-foreground">{props.presets.length >= 30 ? "30 preset limit" : "Model + name"}</span></button>}
          <button
            type="button"
            disabled={busy || dragging || !!editor}
            onClick={() => {
              setOpen(false);
              props.onEdit();
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon name="Settings" className="size-4" />
            Edit presets<span className="ml-auto text-xs text-muted-foreground/50">↗</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
