import { ConfiguredModelPicker } from "./ConfiguredModelPicker";
import { EDIT_PRESETS_EVENT } from "../lib/presets";
import { usePresets } from "../hooks/usePresets";
import { useSelectedPreset } from "../hooks/useSelectedPreset";
import { resolveSelected } from "../lib/selection";
import { submitHostComposer } from "../lib/submit-composer";
// The host composer stays mounted while closed to retain the draft. Preset
// changes use BB's seed props, which also reset project/environment choices.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BorderBeam } from "border-beam";
import {
  experimental_NewThreadComposer as NewThreadComposer,
  useBbNavigate,
  useRpc,
} from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import type { rpcContract } from "../server";
import type { NewThreadRequest } from "@get-bb/plugin-sdk";
import { cn } from "../lib/utils";
import { usePortalScopeProps } from "../lib/portal-scope";
import { PersistentResponsiveDrawerShell } from "./ui/responsive-overlay";
import { useIsCompactViewport } from "./ui/use-media-query";

export const OPEN_EVENT = "ultra-launcher:open";

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

// Host composer DOM, top to bottom:
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
  "[&_form_button[type=submit]]:hidden",
  "[&_form_button[title^='Talk']]:hidden",
  "[&_form_button[aria-label='Start_voice_input']]:hidden",

].join(" ");

const PRESET_PICKER_CSS = `
[data-ultra-launcher-presets] button[aria-label^="Provider, model and reasoning"] { display: none; }
[data-ultra-launcher-presets] [data-promptbox-action-row] {
  display: flex;
  align-items: center;
  gap: .5rem;
  padding: .75rem 1rem 1rem;
}
[data-ultra-launcher-presets] [data-promptbox-action-row] > [data-promptbox-standard-actions] {
  flex: 0 0 auto;
  gap: 0;
}
[data-ultra-launcher-presets] [data-promptbox-action-row] > [data-promptbox-expanded-only] { order: 0; }
[data-ultra-launcher-presets] [data-ultra-launcher-model] { order: 1; flex: 1 1 0%; min-width: 0; }
[data-ultra-launcher-presets] [data-promptbox-action-row] > [data-promptbox-standard-actions]:not([data-promptbox-expanded-only]) { order: 2; }
[data-ultra-launcher-presets] [data-ultra-launcher-dispatch] { order: 3; flex: 0 0 auto; }
[data-ultra-launcher-presets] [data-promptbox-action-row] > [data-promptbox-standard-actions]:not([data-promptbox-expanded-only]):not(:has(button[aria-label="Send options"]:not([aria-hidden="true"]))) { display: none; }
[data-ultra-launcher-presets] [data-promptbox-action-row] [data-plugin-composer-action-plugin] { display: none; }
[data-ultra-launcher-presets] [data-promptbox-submit-disabled-reason] { display: none; }
[data-ultra-launcher-presets] [data-promptbox-send-menu] { margin: 0; background-color: transparent; color: var(--muted-foreground); }
[data-ultra-launcher-presets] [data-promptbox-action-row] button { height: 2.25rem; }
[data-ultra-launcher-presets] button[aria-label="Prompt actions"],
[data-ultra-launcher-presets] button[aria-label="Send options"]:not([aria-hidden="true"]) {
  width: 2.25rem;
  padding: 0;
  margin: 0;
  border-radius: .5rem;
  color: var(--muted-foreground);
}
@layer base {
  [data-ultra-launcher-presets] form button[aria-label="Send options"]:hover {
    background-color: var(--state-hover) !important;
    color: var(--foreground) !important;
  }
  [data-ultra-launcher-presets] form button[aria-label="Send options"][data-state="open"] {
    background-color: var(--state-active) !important;
    color: var(--foreground) !important;
  }
}
[data-ultra-launcher-presets][data-presentation="drawer"] [data-promptbox-action-row] { flex-wrap: wrap; }
[data-ultra-launcher-presets][data-presentation="drawer"] [data-ultra-launcher-model] { order: -1; flex-basis: 100%; }
[data-ultra-launcher-presets][data-presentation="drawer"] [data-promptbox-action-row] > [data-promptbox-expanded-only] { margin-right: auto; }
[data-ultra-launcher-presets][data-presentation="drawer"] [data-promptbox-action-row] button { height: 2.5rem; }
[data-ultra-launcher-presets][data-presentation="drawer"] button[aria-label="Prompt actions"],
[data-ultra-launcher-presets][data-presentation="drawer"] button[aria-label="Send options"]:not([aria-hidden="true"]) { width: 2.5rem; }
`;

// Compact viewport, plain CSS. The bottom sheet is capped at
// 92dvh minus the software keyboard (the shell publishes the keyboard height
// as --bb-drawer-keyboard-inset on the panel), and the card's header, footer,
// handle and safe-area padding take roughly 18rem of that. The editor
// scroller gets whatever is left, so the footer with Create never ends up
// below the keyboard where it cannot be tapped. The 5rem floor keeps the
// editor usable on very short viewports; the sheet scrolls past it instead.
const DRAWER_CSS = `
[data-ultra-launcher-presets][data-presentation="drawer"] form .overflow-y-auto:has([contenteditable]) {
  max-height: max(5rem, min(38dvh, calc(92dvh - var(--bb-drawer-keyboard-inset, 0px) - 18rem)));
}
`;

// Compact-viewport overrides layered on top of COMPOSER_RESTYLE. The footer
// becomes two rows: the presets trigger gets the upper row to itself (the host
// action row wraps naturally), and the lower row holds the host
// "+" on the left with our Background / Create on the right.
const COMPOSER_RESTYLE_DRAWER = [
  // Header pickers wrap instead of overflowing a narrow card.
  "[&_form+div]:flex-wrap [&_form+div]:gap-y-2",
  // Shorter editor so the sheet fits above the keyboard; the sheet itself is
  // capped by the shell, so the editor scrolls internally past this.
  "[&_form_[contenteditable]]:min-h-[6.5rem]",
  // (The editor scroller's max-height is keyboard-aware; see DRAWER_CSS.)
  "[&_form_.overflow-y-auto:has([contenteditable])]:px-4",
  "[&_form_.overflow-y-auto:has([contenteditable])]:pt-4",
  "[&_form_[role=textbox]]:text-base",
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

export function LauncherOverlay() {
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
  const [composerRoot, setComposerRoot] = useState<HTMLDivElement | null>(null);
  const [footer, setFooter] = useState<HTMLElement | null>(null);
  const attachComposer = useCallback((node: HTMLDivElement | null) => {
    wrapperRef.current = node;
    setComposerRoot(node);
  }, []);

  useLayoutEffect(() => {
    if (!composerRoot) {
      setFooter(null);
      return;
    }
    const syncFooter = () => setFooter(composerRoot.querySelector<HTMLElement>("[data-promptbox-action-row]"));
    syncFooter();
    const observer = new MutationObserver(syncFooter);
    observer.observe(composerRoot, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [composerRoot]);

  const scopeProps = usePortalScopeProps();
  const isDrawer = useIsCompactViewport();
  const isDrawerRef = useRef(isDrawer);
  isDrawerRef.current = isDrawer;

  // Floating card: focus the editor the moment it opens. Bottom sheet: wait
  // for the slide-in to settle (see onContentAnimationEnd below). Focusing
  // during the transition raises the software keyboard mid-animation, and the
  // keyboard inset then re-positions the sheet while it is still moving.
  const show = useCallback(() => {
    setMode("open");
    setOpen(true);
    if (!isDrawerRef.current) setFocusNonce((n) => n + 1);
  }, []);

  // Global open: Ctrl/Cmd+N and the command-palette bridge event.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isNewThreadHotkey(event)) return;
      event.preventDefault();
      setOpen((current) => {
        if (!current) {
          setMode("open");
          if (!isDrawerRef.current) setFocusNonce((n) => n + 1);
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

  // A tap must not move focus off
  // the editor first: on a phone that dismisses the keyboard, the sheet drops
  // to fill the space, and the tap lands on a moving target. The host guards
  // its own send button the same way.
  const keepEditorFocus = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
    },
    [],
  );

  const onDrawerSettled = useCallback((settledOpen: boolean) => {
    if (settledOpen) setFocusNonce((n) => n + 1);
  }, []);

  const dispatchWith = useCallback(
    (next: DispatchMode) => {
      modeRef.current = next;
      setMode(next);
      submitHostComposer(wrapperRef.current);
    },
    [],
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
    async (request: NewThreadRequest) => {
      const chosen = modeRef.current;
      setBusy(true);
      try {
        const { threadId } = await rpc.call("create_thread", {
          request: { ...request },
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
      ref={attachComposer}
      onKeyDownCapture={onKeyDownCapture}
      data-ultra-launcher-presets=""
      data-presentation={isDrawer ? "drawer" : "floating"}
      style={
        isDrawer
          ? ({
              "--ultra-launcher-inset": "calc(1.5rem + env(safe-area-inset-bottom))",
            } as React.CSSProperties)
          : undefined
      }
      className={cn(
        "relative bg-popover",
        COMPOSER_RESTYLE,
        TYPEAHEAD_RESTYLE,
        isDrawer
          ? cn(
              // The sheet panel is transparent; the card carries the chrome so
              // the beam can wrap it. Top padding leaves room for the shell's
              // drag handle, which overlays the card's top edge.
              "rounded-t-2xl border border-b-0 border-border/70 pt-8",
              "pb-[var(--ultra-launcher-inset)]",
              CARD_SHADOW,
              COMPOSER_RESTYLE_DRAWER,
            )
          : cn("rounded-2xl border border-border/70", CARD_SHADOW),
      )}
    >
      <style>{PRESET_PICKER_CSS}</style>
      {isDrawer ? <style>{DRAWER_CSS}</style> : null}
      <NewThreadComposer
        defaultPermissionMode="full"
        defaultProviderId={preset?.providerId}
        defaultModel={preset?.model}
        defaultReasoningLevel={preset?.reasoningLevel}
        defaultServiceTier={preset?.serviceTier}
        focusRequest={focusNonce}
        draftKey="ultra-launcher"
        layout="document"
        placeholder="What do you want to work on?"
        onSubmit={handleSubmit}
      />

      {footer ? createPortal(
        <>
          <div data-ultra-launcher-model="">
            <ConfiguredModelPicker
              providerId={preset?.providerId ?? ""}
              model={preset?.model ?? ""}
              reasoningLevel={preset?.reasoningLevel ?? "medium"}
              serviceTier={preset?.serviceTier ?? "default"}
              disabled={busy}
              onPresetSelect={applyPreset}
            />
          </div>
          <div data-ultra-launcher-dispatch="" className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              title="Create and keep working here (⌘/Ctrl+Enter)"
              onPointerDown={keepEditorFocus}
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
              onPointerDown={keepEditorFocus}
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
        </>,
        footer,
      ) : null}
      {presetError ? <p role="alert" className="px-5 pb-3 text-xs text-destructive">{presetError}</p> : null}
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
        onContentAnimationEnd={onDrawerSettled}
        srLabel="New thread"
        contentClassName={cn(
          // Chrome lives on the card (see below); keep the handle above it.
          "rounded-none border-0 bg-transparent",
          "[&>[data-persistent-drawer-handle]]:relative [&>[data-persistent-drawer-handle]]:z-10",
        )}
      >
        <BorderBeam
          active={open && !prefersReducedMotion()}
          colorVariant="colorful"
          theme="auto"
          strength={0.7}
          borderRadius={16}
          // Pull the beam up under the drag handle and push its bottom edge
          // (and rounded bottom corners) just below the viewport, so only the
          // top and sides of the sheet glow. The wrapper is the sheet's scroll
          // container: when the card is taller than the space above the
          // keyboard it scrolls here instead of spilling under the keyboard.
          className="-mb-6 -mt-8 min-h-0 overscroll-contain"
          style={{ overflowX: "hidden", overflowY: "auto" }}
        >
          {card}
        </BorderBeam>
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
