import { ConfiguredModelPicker } from "./ConfiguredModelPicker";
import { EDIT_PRESETS_EVENT } from "../lib/presets";
import { usePresets } from "../hooks/usePresets";
import { useSelectedPreset } from "../hooks/useSelectedPreset";
import { resolveSelected } from "../lib/selection";
// The floating "quick new thread" dialog.
//
// Registered as an app overlay (app.slots.experimental_appOverlay), so it is
// mounted once per window, outside any route layout, and stays available on
// every screen — including while you are reading another thread.
//
// Open it with Ctrl/Cmd+N, or the "Ultra Launcher: new thread" command-palette
// row (which dispatches OPEN_EVENT on window). In the desktop app Ctrl/Cmd+N
// only reaches this listener once server.ts has moved BB's own `thread.new`
// menu accelerator off it (see "Hotkey takeover" there).
//
// Dispatch:
//   Enter / "Create"             -> create the thread and navigate to it
//   Ctrl/Cmd+Enter / "Background" -> create the thread, stay where you are,
//                                    show a toast with an Open action
//
// Model presets: stock BB has no slot for replacing the composer's model
// picker, so the dialog does it from the outside — it hides the host button
// with scoped CSS, renders its own presets popover in that spot, and feeds the
// chosen preset back through the composer's `default*` seed props. Seeding is
// the host's own supported path (it marks the values caller-explicit so
// threads.spawn keeps them). One documented cost: the host re-seeds every
// execution and environment selection when a seed changes, so switching preset
// mid-compose also resets a project/environment the user picked by hand in the
// same dialog. The remembered preset makes that rare — the common open already
// has the right model.
//
// Design: a single frameless card. BB's host composer renders the editor and
// every picker; the plugin re-arranges that fixed DOM with scoped CSS so the
// project / environment / permission row becomes the card header, the editor
// fills the body, and the model picker sits in the footer next to our own
// "Create ⏎" button.
//
// Presentation: on a regular viewport the card floats near the top of the
// window. On a compact viewport (phones, ≤767px) a floating card reads as a
// stranded box that the keyboard shoves around, so the same card is rendered
// inside PersistentResponsiveDrawerShell instead — a bottom sheet with a drag
// handle that sits on top of the software keyboard. The footer also restacks
// into two rows (presets, then + / Background / Create) because a phone is not
// wide enough for the single-row desktop footer.
//
// Performance: mounting the host composer costs ~200ms of main-thread work,
// which read as lag on every Cmd+N. The dialog is therefore a plain portal
// that stays mounted and is hidden with display:none while closed, so opening
// is a style flip plus a 150ms fade. (A Radix Dialog kept mounted this way
// leaves its dismiss layer live while hidden and swallows Escape app-wide,
// so the few things we need — backdrop click, Escape, focus — are hand-rolled.)
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BorderBeam } from "border-beam";
import {
  experimental_NewThreadComposer as NewThreadComposer,
  useBbNavigate,
  useRpc,
} from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import type { rpcContract } from "../server";
import { cn } from "@/lib/utils";
import { usePortalScopeProps } from "@/lib/portal-scope";
import {
  PersistentResponsiveDrawerShell,
  useResponsiveOverlayBehavior,
} from "@/components/ui/responsive-overlay";

export const OPEN_EVENT = "quick-thread:open";

type DispatchMode = "open" | "background";

function isNewThreadHotkey(event: KeyboardEvent): boolean {
  return (
    (event.ctrlKey || event.metaKey) &&
    !event.shiftKey &&
    !event.altKey &&
    !event.repeat &&
    !event.isComposing &&
    (event.code === "KeyN" || event.key === "n" || event.key === "N")
  );
}

// Host composer DOM, top to bottom (see README "Design notes"):
//   div.w-full
//     div.mb-2            attachments / banners (often empty)
//     form.group/promptbox editor + bottom row (+, model picker, voice, submit)
//     form + div           meta row: project, environment | permission mode
// The selectors below only reshape that structure; they never reach into the
// pickers' popovers, which the host portals out of this subtree.
const COMPOSER_RESTYLE = [
  // Stack: meta row first (header), then editor card.
  "[&_form]:order-2 [&_form+div]:order-1",
  // Attachments row: no dead space when empty, room when it has chips.
  "[&_.w-full>.mb-2]:order-3 [&_.w-full>.mb-2]:mx-4 [&_.w-full>.mb-2]:mb-0",
  "[&_.w-full>.mb-2:has(>.contents>*)]:pb-4",
  "[&_.w-full:has(>form)]:flex [&_.w-full:has(>form)]:flex-col",
  // Header row.
  "[&_form+div]:mt-0 [&_form+div]:border-b [&_form+div]:border-border/60",
  "[&_form+div]:px-3 [&_form+div]:py-2.5",
  "[&_form+div_button]:h-8 [&_form+div_button]:rounded-lg [&_form+div_button]:px-2.5",
  "[&_form+div_button]:text-xs [&_form+div_button]:font-medium",
  "[&_form+div_button]:transition-colors",
  "[&_form+div_button:hover]:bg-state-hover",
  "[&_form+div_button[data-state=open]]:bg-state-active",
  "[&_form+div>div:first-child>button]:border",
  "[&_form+div>div:first-child>button]:border-border/70",
  "[&_form+div>div:first-child>button:first-child]:bg-background",
  // Machine and branch are two host pickers but one decision ("where does
  // this run"): join them into a single segmented pill. The branch button is
  // only present once a project is selected, wrapped in a div.contents.
  "[&_form+div>div:first-child>button:nth-child(2)]:bg-background",
  "[&_form+div>div:first-child>button:nth-child(2):not(:last-child)]:rounded-r-none",
  "[&_form+div>div:first-child>div>button]:bg-background",
  "[&_form+div>div:first-child>div>button]:rounded-l-none",
  "[&_form+div>div:first-child>div>button]:-ml-1",
  "[&_form+div>div:first-child>div>button]:border",
  "[&_form+div>div:first-child>div>button]:border-border/70",
  "[&_form+div>div:first-child>div>button]:pl-3",
  // Body: strip the prompt box chrome and let the editor breathe.
  "[&_form]:rounded-none [&_form]:border-0 [&_form]:bg-transparent [&_form]:shadow-none",
  "[&_form_[contenteditable]]:min-h-[9.5rem]",
  "[&_form_[role=textbox]]:text-[15px] [&_form_[role=textbox]]:leading-relaxed",
  // Only the editor scroller gets body padding; suggestion lists scroll too.
  "[&_form_.overflow-y-auto:has([contenteditable])]:px-5",
  "[&_form_.overflow-y-auto:has([contenteditable])]:pt-5",
  // Footer row inside the form (div.select-none, not the buttons that also
  // carry select-none): keep the model picker, hide the icon-only submit,
  // voice and Aide buttons; we render the Create button ourselves.
  "[&_form_div.select-none]:px-5 [&_form_div.select-none]:pb-4 [&_form_div.select-none]:pt-3",
  "[&_form_div.select-none]:pr-[14.5rem]",
  // Left group holds [+, model]; reverse it so "+" sits beside Create.
  "[&_form_div.select-none>div:first-child]:flex-row-reverse",
  "[&_form_div.select-none>div:first-child]:justify-between",
  "[&_form_div.select-none>div:first-child]:gap-3",
  "[&_form_button[type=submit]]:hidden",
  "[&_form_button[title^='Talk']]:hidden",
  "[&_form_div.select-none>div:last-child>button]:hidden",
  // Model / effort trigger reads like a plain label with a chevron.
  "[&_form_div.select-none_button]:h-9 [&_form_div.select-none_button]:text-sm",
  "[&_form_div.select-none_button]:text-foreground",

].join(" ");

// Applied only while the dialog renders its own presets popover: hide the
// host's model button and keep the "+" clear of the space ours occupies.
// Plain CSS rather than an arbitrary Tailwind variant because the selector
// matches on an aria-label containing spaces and a comma.
const PRESET_PICKER_CSS = `
[data-quick-thread-presets] button[aria-label^="Provider, model and reasoning"] { display: none; }
[data-quick-thread-presets][data-presentation="floating"] [data-promptbox-action-row] { padding-left: 14rem; }
`;

// Compact-viewport overrides layered on top of COMPOSER_RESTYLE. The footer
// becomes two rows: the presets trigger gets the upper row to itself (the host
// action row reserves it with top padding), and the lower row holds the host
// "+" on the left with our Background / Create on the right.
const COMPOSER_RESTYLE_DRAWER = [
  // Header pickers wrap instead of overflowing a narrow card.
  "[&_form+div]:flex-wrap [&_form+div]:gap-y-2",
  // Shorter editor so the sheet fits above the keyboard; the sheet itself is
  // capped by the shell, so the editor scrolls internally past this.
  "[&_form_[contenteditable]]:min-h-[6.5rem]",
  "[&_form_.overflow-y-auto:has([contenteditable])]:max-h-[38dvh]",
  "[&_form_.overflow-y-auto:has([contenteditable])]:px-4",
  "[&_form_.overflow-y-auto:has([contenteditable])]:pt-4",
  "[&_form_[role=textbox]]:text-base",
  // Footer: reserve the upper row for presets, keep "+" on the left.
  "[&_form_div.select-none]:px-4 [&_form_div.select-none]:pt-[3.75rem]",
  "[&_form_div.select-none]:pr-[13rem]",
  "[&_form_div.select-none>div:first-child]:flex-row",
  "[&_form_div.select-none>div:first-child]:justify-start",
  "[&_form_div.select-none_button]:h-10",
  // Attachments row hugs the narrower body padding.
  "[&_.w-full>.mb-2]:mx-3",
  // The @-mention list cannot hang below a bottom sheet; open it upward.
  "[&_[data-promptbox-typeahead-menu]]:left-4",
  "[&_[data-promptbox-typeahead-menu]]:top-auto",
  "[&_[data-promptbox-typeahead-menu]]:bottom-full",
  "[&_[data-promptbox-typeahead-menu]]:mt-0",
  "[&_[data-promptbox-typeahead-menu]]:mb-2",
  "[&_[data-promptbox-typeahead-menu]]:w-[calc(100%-2rem)]",
  "[&_[data-promptbox-typeahead-menu]>div]:after:hidden",
].join(" ");

// The host owns search, selection, scrolling and dismissal. Its dedicated
// typeahead marker lets us style the existing list like a command popover
// without mounting another input or focus layer.
const TYPEAHEAD_RESTYLE = [
  "[&_[data-promptbox-typeahead-menu]]:left-5",
  "[&_[data-promptbox-typeahead-menu]]:right-auto",
  "[&_[data-promptbox-typeahead-menu]]:mt-2",
  "[&_[data-promptbox-typeahead-menu]]:w-[min(calc(100%-2.5rem),24rem)]",
  "[&_[data-promptbox-typeahead-menu]>div]:rounded-lg",
  "[&_[data-promptbox-typeahead-menu]>div]:border-border/70",
  "[&_[data-promptbox-typeahead-menu]>div]:shadow-md",
  "[&_[data-promptbox-typeahead-menu]>div]:p-1",
  // A small command-menu legend makes keyboard selection discoverable.
  "[&_[data-promptbox-typeahead-menu]>div]:after:content-['↑↓_navigate___↵_select___Esc_close']",
  "[&_[data-promptbox-typeahead-menu]>div]:after:block",
  "[&_[data-promptbox-typeahead-menu]>div]:after:mt-1",
  "[&_[data-promptbox-typeahead-menu]>div]:after:border-t",
  "[&_[data-promptbox-typeahead-menu]>div]:after:border-border/60",
  "[&_[data-promptbox-typeahead-menu]>div]:after:px-2.5",
  "[&_[data-promptbox-typeahead-menu]>div]:after:py-2",
  "[&_[data-promptbox-typeahead-menu]>div]:after:text-[11px]",
  "[&_[data-promptbox-typeahead-menu]>div]:after:text-muted-foreground",
  "[&_[data-promptbox-typeahead-menu]_.overflow-y-auto]:max-h-[min(18rem,30dvh)]",
  "[&_[data-promptbox-typeahead-menu]_.overflow-y-auto]:overscroll-contain",
  "[&_[data-promptbox-typeahead-menu]_.pb-1]:pb-0",
  // Quiet, title-case group labels with a small separator between groups.
  "[&_[data-promptbox-typeahead-menu]_.sticky]:bg-popover",
  "[&_[data-promptbox-typeahead-menu]_.sticky]:px-2.5",
  "[&_[data-promptbox-typeahead-menu]_.sticky]:py-1.5",
  "[&_[data-promptbox-typeahead-menu]_.sticky]:text-xs",
  "[&_[data-promptbox-typeahead-menu]_.sticky]:font-medium",
  "[&_[data-promptbox-typeahead-menu]_.pb-1>div+div]:mt-1",
  "[&_[data-promptbox-typeahead-menu]_.pb-1>div+div]:border-t",
  "[&_[data-promptbox-typeahead-menu]_.pb-1>div+div]:border-border/60",
  "[&_[data-promptbox-typeahead-menu]_.px-1]:px-0",
  // A title and optional description share one text column, so long skill
  // descriptions cannot squeeze the name out of the row.
  "[&_[data-promptbox-typeahead-menu]_button]:rounded-md",
  "[&_[data-promptbox-typeahead-menu]_button]:px-2.5",
  "[&_[data-promptbox-typeahead-menu]_button]:py-1.5",
  "[&_[data-promptbox-typeahead-menu]_button]:text-[13px]",
  "[&_[data-promptbox-typeahead-menu]_button]:leading-5",
  "[&_[data-promptbox-typeahead-menu]_button:hover]:bg-state-hover",
  "[&_[data-promptbox-typeahead-menu]_button.bg-state-active]:bg-state-active/60",
  "[&_[data-promptbox-typeahead-menu]_button>div]:grid",
  "[&_[data-promptbox-typeahead-menu]_button>div]:grid-cols-[1rem_minmax(0,1fr)]",
  "[&_[data-promptbox-typeahead-menu]_button>div]:gap-x-2.5",
  "[&_[data-promptbox-typeahead-menu]_button>div]:gap-y-0.5",
  "[&_[data-promptbox-typeahead-menu]_button>div>:first-child]:size-4",
  "[&_[data-promptbox-typeahead-menu]_button>div>:first-child]:row-span-2",
  "[&_[data-promptbox-typeahead-menu]_button>div>:first-child]:text-muted-foreground",
  "[&_[data-promptbox-typeahead-menu]_button_.text-foreground]:col-start-2",
  "[&_[data-promptbox-typeahead-menu]_button_.text-foreground]:font-medium",
  "[&_[data-promptbox-typeahead-menu]_button_.text-subtle-foreground]:col-start-2",
  "[&_[data-promptbox-typeahead-menu]_button_.text-subtle-foreground]:text-xs",
  "[&_[data-promptbox-typeahead-menu]_button_.text-subtle-foreground]:text-muted-foreground",
].join(" ");

// Card shadow: soft and short, in the shadcn/cmdk range rather than a heavy
// 80px drop. Sits on the inner card so the beam wrapper never clips it.
const CARD_SHADOW = "shadow-[0_8px_24px_-8px_rgba(0,0,0,0.35)]";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function QuickThreadOverlay() {
  const nav = useBbNavigate();
  const rpc = useRpc<typeof rpcContract>();
  useEffect(() => { const close = () => setOpen(false); window.addEventListener(EDIT_PRESETS_EVENT, close); return () => window.removeEventListener(EDIT_PRESETS_EVENT, close); }, []);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<DispatchMode>("open");
  const presets = usePresets();
  const selection = useSelectedPreset();
  // Keep the preset picker mounted even when the last preset is deleted so
  // users can add a replacement without leaving the dialog.
  const preset = resolveSelected(presets.state.presets, selection.presetId);
  const [presetError, setPresetError] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const [busy, setBusy] = useState(false);

  const modeRef = useRef<DispatchMode>("open");
  modeRef.current = mode;
  const wrapperRef = useRef<HTMLDivElement>(null);

  const show = useCallback(() => {
    setMode("open");
    setOpen(true);
    setFocusNonce((n) => n + 1);
  }, []);

  // Global open: Ctrl/Cmd+N and the command-palette bridge event.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isNewThreadHotkey(event)) return;
      event.preventDefault();
      setOpen((current) => {
        if (!current) {
          setMode("open");
          setFocusNonce((n) => n + 1);
        }
        return !current;
      });
    };
    const onOpenEvent = (event: Event) => {
      event.preventDefault();
      show();
    };
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_EVENT, onOpenEvent);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_EVENT, onOpenEvent);
    };
  }, [show]);

  // Escape closes the dialog. The host editor consumes Escape itself, so this
  // listens in the capture phase and steps aside when something closer owns
  // the key: the @-mention list (rendered inside the editor block), or a host
  // picker popover, which is portaled out of the card and holds focus.
  useEffect(() => {
    if (!open) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const card = wrapperRef.current;
      if (!card) return;
      if (card.querySelector("[data-promptbox-typeahead-menu]")) return;
      const active = document.activeElement;
      const inside =
        active === null || active === document.body || card.contains(active);
      if (!inside) return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    };
    document.addEventListener("keydown", onEscape, true);
    return () => document.removeEventListener("keydown", onEscape, true);
  }, [open]);

  const scopeProps = usePortalScopeProps();
  const { presentation } = useResponsiveOverlayBehavior();
  const isDrawer = presentation === "drawer";

  // Ask the embedded composer to submit itself (it owns its own submit button
  // and Enter handling; we drive it by dispatching a plain Enter keydown on
  // its editor so both the button row and the Ctrl+Enter hotkey go through the
  // same host path).
  const submitComposer = useCallback(() => {
    const editor = wrapperRef.current?.querySelector<HTMLElement>(
      '[contenteditable="true"], textarea',
    );
    if (!editor) return;
    editor.focus();
    editor.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
  }, []);

  const dispatchWith = useCallback(
    (next: DispatchMode) => {
      modeRef.current = next;
      setMode(next);
      submitComposer();
    },
    [submitComposer],
  );

  const onKeyDownCapture = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      // React portal events still bubble through this card. A preset editor
      // or model menu must never submit the composer with Cmd/Ctrl+Enter.
      if (!event.currentTarget.contains(event.target as Node)) return;
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        event.stopPropagation();
        dispatchWith("background");
      }
    },
    [dispatchWith],
  );

  // Applying a preset is just remembering it: the id drives the composer's
  // `default*` seeds on the next render, which is how the host wants callers
  // to set a provider/model/reasoning/tier combination at once.
  const applyPreset = useCallback(
    async (value: { providerId: string; model: string; reasoningLevel: string; serviceTier?: string }) => {
      const match = presets.state.presets.find(
        (item) =>
          item.providerId === value.providerId &&
          item.model === value.model &&
          item.reasoningLevel === value.reasoningLevel &&
          item.serviceTier === (value.serviceTier ?? "default"),
      );
      if (!match) throw new Error("That preset is no longer saved.");
      setPresetError(null);
      try {
        await selection.select(match.id);
      } catch (error) {
        setPresetError(error instanceof Error ? error.message : String(error));
        throw error;
      }
    },
    [presets.state.presets, selection],
  );

  const handleSubmit = useCallback(
    async (request: unknown) => {
      const chosen = modeRef.current;
      setBusy(true);
      try {
        const { threadId } = await rpc.call("create_thread", {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          request: request as any,
        });
        setOpen(false);
        setMode("open");
        if (chosen === "open") {
          nav.toThread(threadId);
        } else {
          toast.success("Thread started", {
            action: { label: "Open", onClick: () => nav.toThread(threadId) },
          });
        }
      } finally {
        setBusy(false);
      }
    },
    [nav, rpc],
  );

  const card = (
    <div
      ref={wrapperRef}
      onKeyDownCapture={onKeyDownCapture}
      data-quick-thread-presets=""
      data-presentation={presentation}
      className={cn(
        "relative bg-popover",
        COMPOSER_RESTYLE,
        TYPEAHEAD_RESTYLE,
        isDrawer
          ? cn("rounded-t-2xl", COMPOSER_RESTYLE_DRAWER)
          : cn("rounded-2xl border border-border/70", CARD_SHADOW),
      )}
    >
      <style>{PRESET_PICKER_CSS}</style>
      <NewThreadComposer
        {...{ experimental_ModelPicker: ConfiguredModelPicker }}
        defaultPermissionMode="full"
        defaultProviderId={preset?.providerId}
        defaultModel={preset?.model}
        defaultReasoningLevel={preset?.reasoningLevel}
        defaultServiceTier={preset?.serviceTier}
        focusRequest={focusNonce}
        draftKey="quick-thread"
        layout="document"
        placeholder="What do you want to work on?"
        onSubmit={handleSubmit}
      />

      {/* Presets popover, anchored over the footer slot the host's own model
          button occupies (hidden by PRESET_PICKER_CSS). In the drawer it gets
          the upper footer row to itself. */}
      <div
        className={cn(
          "absolute flex items-center",
          isDrawer
            ? "bottom-[3.75rem] left-3 max-w-[calc(100%-1.5rem)]"
            : "bottom-4 left-4 max-w-[13rem]",
        )}
      >
        <ConfiguredModelPicker
          providerId={preset?.providerId ?? ""}
          model={preset?.model ?? ""}
          reasoningLevel={preset?.reasoningLevel ?? "medium"}
          serviceTier={preset?.serviceTier ?? "default"}
          disabled={busy}
          onPresetSelect={applyPreset}
        />
      </div>
      {presetError ? (
        <p role="alert" className="absolute bottom-0 left-5 text-xs text-destructive">
          {presetError}
        </p>
      ) : null}

      {/* Our own dispatch controls, anchored over the composer's footer row.
          We own the right side. */}
      <div className="pointer-events-none absolute bottom-4 right-4 flex items-center gap-1.5">
        <button
          type="button"
          disabled={busy}
          title="Create and keep working here (⌘/Ctrl+Enter)"
          onClick={() => dispatchWith("background")}
          className={cn(
            "pointer-events-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 text-sm",
            "text-muted-foreground transition-colors hover:bg-state-hover hover:text-foreground",
            "disabled:pointer-events-none disabled:opacity-50",
            isDrawer ? "h-10" : "h-9",
          )}
        >
          Background
          {isDrawer ? null : (
            <kbd className="font-sans text-xs text-subtle-foreground">⌘↵</kbd>
          )}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => dispatchWith("open")}
          className={cn(
            "pointer-events-auto inline-flex items-center gap-2 rounded-lg px-3.5 text-sm font-medium",
            "bg-foreground text-background transition-colors hover:bg-foreground/90",
            "disabled:pointer-events-none disabled:opacity-50",
            isDrawer ? "h-10 px-4" : "h-9",
            mode === "open" && busy && "opacity-80",
          )}
        >
          Create
          {isDrawer ? null : (
            <span aria-hidden className="text-xs opacity-70">↵</span>
          )}
        </button>
      </div>
    </div>
  );

  if (isDrawer) {
    // Bottom sheet. The shell keeps the panel mounted while closed (translated
    // off-screen, inert) which preserves the "composer mounts once" budget,
    // and it owns the backdrop, drag-to-close, Escape, focus return and the
    // software-keyboard inset.
    return (
      <PersistentResponsiveDrawerShell
        open={open}
        onOpenChange={setOpen}
        srLabel="New thread"
        contentClassName={cn(
          "rounded-t-2xl border-border/70 bg-popover",
          "pb-[env(safe-area-inset-bottom)]",
          CARD_SHADOW,
        )}
      >
        {card}
      </PersistentResponsiveDrawerShell>
    );
  }

  return createPortal(
    <div
      {...scopeProps}
      role="dialog"
      // Only advertise a modal while open. bb's shortcut layer treats any
      // mounted [aria-modal="true"] / [role="dialog"][data-state="open"] that
      // is not inert as an open modal and suppresses every app shortcut
      // (Cmd+K, Cmd+P, Cmd+Shift+P, ...), so a closed-but-mounted overlay
      // must be marked closed and inert.
      aria-modal={open || undefined}
      aria-label="New thread"
      data-state={open ? "open" : "closed"}
      inert={!open}
      className={cn("fixed inset-0 z-50", !open && "hidden")}
    >
      <div
        aria-hidden
        onPointerDown={() => setOpen(false)}
        className="absolute inset-0 bg-black/40 animate-in fade-in-0 duration-150"
      />
      <div
        className={cn(
          "absolute left-1/2 top-[20%] w-[calc(100vw-2rem)] max-w-[46rem] -translate-x-1/2",
          "animate-in fade-in-0 zoom-in-95 duration-150",
        )}
      >
        <BorderBeam
          active={open && !prefersReducedMotion()}
          colorVariant="colorful"
          theme="auto"
          strength={0.7}
          borderRadius={16}
          // The beam wrapper defaults to overflow:hidden, which would clip the
          // card shadow and the @-mention list hanging below the card.
          style={{ overflow: "visible" }}
        >
          {card}
        </BorderBeam>
      </div>
    </div>,
    document.body,
  );
}
