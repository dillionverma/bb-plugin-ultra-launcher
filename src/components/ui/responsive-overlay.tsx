import * as React from "react";
import { createPortal } from "react-dom";

import { useIsCompactViewport } from "./use-media-query";
import { usePortalScopeProps } from "../../lib/portal-scope";
import { cn } from "../../lib/utils";

export interface ResponsiveOverlayContextValue {
  isCompactViewport: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

function isKeyboardInputElement(element: Element): element is HTMLElement {
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLInputElement) {
    return (
      !element.disabled &&
      !element.readOnly &&
      !NON_TEXT_INPUT_TYPES.has(element.type)
    );
  }
  if (!(element instanceof HTMLElement)) return false;

  return (
    element.isContentEditable ||
    element.closest("[contenteditable='true']") !== null
  );
}

export function blurActiveKeyboardInputWithin(container: Element | null): void {
  const activeElement = document.activeElement;
  if (!activeElement || !isKeyboardInputElement(activeElement)) return;
  if (container !== null && !container.contains(activeElement)) return;

  activeElement.blur();
}

const DRAWER_KEYBOARD_INSET_PROPERTY = "--bb-drawer-keyboard-inset";
const DRAWER_KEYBOARD_MIN_OVERLAP_PX = 80;

function resetDrawerKeyboardStyles(drawerElement: HTMLElement | null): void {
  if (drawerElement === null) return;

  drawerElement.style.height = "";
  drawerElement.style.bottom = "";
  drawerElement.style.removeProperty(DRAWER_KEYBOARD_INSET_PROPERTY);
}

function measureDrawerKeyboardOverlap({
  layoutViewportHeight,
  visualViewportHeight,
  visualViewportOffsetTop,
}: {
  layoutViewportHeight: number;
  visualViewportHeight: number;
  visualViewportOffsetTop: number;
}): number {
  const overlap = Math.round(
    layoutViewportHeight - (visualViewportHeight + visualViewportOffsetTop),
  );
  return overlap >= DRAWER_KEYBOARD_MIN_OVERLAP_PX ? overlap : 0;
}

function useDrawerKeyboardInset(
  panelRef: React.RefObject<HTMLElement | null>,
  open: boolean,
): void {
  React.useEffect(() => {
    const panel = panelRef.current;
    const visualViewport = window.visualViewport;
    if (panel === null || !open || !visualViewport) return;

    let animationFrame: number | null = null;
    const applyInset = () => {
      animationFrame = null;
      if (visualViewport.scale !== 1) {
        resetDrawerKeyboardStyles(panel);
        return;
      }
      const overlap = measureDrawerKeyboardOverlap({
        layoutViewportHeight: panel.ownerDocument.documentElement.clientHeight,
        visualViewportHeight: visualViewport.height,
        visualViewportOffsetTop: visualViewport.offsetTop,
      });
      if (overlap === 0) {
        panel.style.bottom = "";
        panel.style.removeProperty(DRAWER_KEYBOARD_INSET_PROPERTY);
        return;
      }
      panel.style.bottom = `${overlap}px`;
      panel.style.setProperty(DRAWER_KEYBOARD_INSET_PROPERTY, `${overlap}px`);
    };
    const scheduleUpdate = () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
      animationFrame = window.requestAnimationFrame(applyInset);
    };

    applyInset();
    visualViewport.addEventListener("resize", scheduleUpdate);
    visualViewport.addEventListener("scroll", scheduleUpdate);

    return () => {
      visualViewport.removeEventListener("resize", scheduleUpdate);
      visualViewport.removeEventListener("scroll", scheduleUpdate);
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
      resetDrawerKeyboardStyles(panel);
    };
  }, [open, panelRef]);
}

export function useResponsiveRoot(
  open: boolean,
  onOpenChange: (open: boolean) => void,
): ResponsiveOverlayContextValue {
  const isCompactViewport = useIsCompactViewport();

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (open && !next && isCompactViewport) {
        blurActiveKeyboardInputWithin(null);
      }
      onOpenChange(next);
    },
    [isCompactViewport, onOpenChange, open],
  );

  return React.useMemo(
    () => ({ isCompactViewport, open, onOpenChange: handleOpenChange }),
    [isCompactViewport, open, handleOpenChange],
  );
}

const RADIX_CONTENT_PROP_NAMES = [
  "side",
  "sideOffset",
  "align",
  "alignOffset",
  "collisionPadding",
  "collisionBoundary",
  "arrowPadding",
  "sticky",
  "hideWhenDetached",
  "avoidCollisions",
  "onOpenAutoFocus",
  "onCloseAutoFocus",
  "onEscapeKeyDown",
  "onPointerDownOutside",
  "onFocusOutside",
  "onInteractOutside",
] as const;

type RadixContentPropName = (typeof RADIX_CONTENT_PROP_NAMES)[number];

const RADIX_CONTENT_KEYS: ReadonlySet<string> = new Set(
  RADIX_CONTENT_PROP_NAMES,
);

export function stripRadixContentProps<T extends Record<string, unknown>>(
  props: T,
): Omit<T, RadixContentPropName> {
  const result = {} as Record<string, unknown>;
  for (const key of Object.keys(props)) {
    if (!RADIX_CONTENT_KEYS.has(key)) {
      result[key] = props[key];
    }
  }
  return result as Omit<T, RadixContentPropName>;
}

interface LazyDrawerShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  srLabel?: string;
  labelledBy?: string;
  describedBy?: string;
  children: React.ReactNode;
}

export function LazyDrawerShell({
  open,
  ...props
}: LazyDrawerShellProps) {
  const [hasOpened, setHasOpened] = React.useState(open);
  if (open && !hasOpened) setHasOpened(true);
  if (!hasOpened) return null;

  return <PersistentResponsiveDrawerShell open={open} {...props} />;
}

interface PersistentResponsiveDrawerShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  srLabel?: string;
  labelledBy?: string;
  describedBy?: string;
  contentClassName?: string;
  onContentAnimationEnd?: (open: boolean) => void;
  children: React.ReactNode;
}

const PERSISTENT_DRAWER_MOTION_MS = 220;
const PERSISTENT_DRAWER_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";
const PERSISTENT_DRAWER_TRANSITION = `transform ${PERSISTENT_DRAWER_MOTION_MS}ms ${PERSISTENT_DRAWER_EASING}`;
const PERSISTENT_DRAWER_BACKDROP_TRANSITION = `opacity ${PERSISTENT_DRAWER_MOTION_MS}ms ${PERSISTENT_DRAWER_EASING}`;
const PERSISTENT_DRAWER_CLOSE_RATIO = 0.25;
const PERSISTENT_DRAWER_CLOSE_VELOCITY_PX_PER_SEC = 450;
const PERSISTENT_DRAWER_FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

type PersistentDrawerStackEntry = {
  panel: () => HTMLElement | null;
  requestClose: () => void;
};

type PersistentDrawerStack = {
  entries: PersistentDrawerStackEntry[];
  handleKeyDown: (event: KeyboardEvent) => void;
};

const persistentDrawerStacks = new WeakMap<Document, PersistentDrawerStack>();

function getDrawerFocusableElements(panel: HTMLElement): HTMLElement[] {
  return Array.from(
    panel.querySelectorAll<HTMLElement>(PERSISTENT_DRAWER_FOCUSABLE_SELECTOR),
  ).filter(
    (element) => element.closest('[aria-hidden="true"], [inert]') === null,
  );
}

function activeElementIsInAnotherOverlay(
  activeElement: Element | null,
  panel: HTMLElement,
): boolean {
  const overlay = activeElement?.closest<HTMLElement>(
    "[data-bb-portaled-overlay]",
  );
  return overlay !== null && overlay !== undefined && overlay !== panel;
}

function handleDrawerTab(event: KeyboardEvent, panel: HTMLElement): void {
  const activeElement = panel.ownerDocument.activeElement;
  if (
    !panel.contains(activeElement) &&
    activeElementIsInAnotherOverlay(activeElement, panel)
  ) {
    return;
  }

  const focusable = getDrawerFocusableElements(panel);
  event.preventDefault();
  if (focusable.length === 0) {
    panel.focus({ preventScroll: true });
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey) {
    if (
      !panel.contains(activeElement) ||
      activeElement === panel ||
      activeElement === first
    ) {
      last?.focus({ preventScroll: true });
      return;
    }
    const index = focusable.indexOf(activeElement as HTMLElement);
    focusable[Math.max(0, index - 1)]?.focus({ preventScroll: true });
    return;
  }

  if (
    !panel.contains(activeElement) ||
    activeElement === panel ||
    activeElement === last
  ) {
    first?.focus({ preventScroll: true });
    return;
  }
  const index = focusable.indexOf(activeElement as HTMLElement);
  focusable[Math.min(focusable.length - 1, index + 1)]?.focus({
    preventScroll: true,
  });
}

function pushDrawerKeyHandler(
  ownerDocument: Document,
  entry: PersistentDrawerStackEntry,
): () => void {
  let stack = persistentDrawerStacks.get(ownerDocument);
  if (stack === undefined) {
    const entries: PersistentDrawerStackEntry[] = [];
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      const topEntry = entries[entries.length - 1];
      const panel = topEntry?.panel() ?? null;
      if (topEntry === undefined || panel === null) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        topEntry.requestClose();
      } else if (event.key === "Tab") {
        handleDrawerTab(event, panel);
      }
    };
    stack = { entries, handleKeyDown };
    persistentDrawerStacks.set(ownerDocument, stack);
    ownerDocument.addEventListener("keydown", handleKeyDown);
  }
  stack.entries.push(entry);

  return () => {
    const currentStack = persistentDrawerStacks.get(ownerDocument);
    if (currentStack === undefined) {
      return;
    }
    const index = currentStack.entries.indexOf(entry);
    if (index >= 0) {
      currentStack.entries.splice(index, 1);
    }
    if (currentStack.entries.length === 0) {
      ownerDocument.removeEventListener("keydown", currentStack.handleKeyDown);
      persistentDrawerStacks.delete(ownerDocument);
    }
  };
}

function isFocusReturnable(element: HTMLElement): boolean {
  return (
    element.isConnected &&
    element.closest('[aria-hidden="true"], [inert]') === null
  );
}

function usePersistentOverlayFocus(
  panelRef: React.RefObject<HTMLElement | null>,
  open: boolean,
  requestClose: () => void,
): void {
  const returnFocusRef = React.useRef<HTMLElement | null>(null);

  React.useLayoutEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (panel === null) return;
    const ownerDocument = panel.ownerDocument;
    const previousFocus = ownerDocument.activeElement;
    returnFocusRef.current =
      previousFocus instanceof HTMLElement &&
      previousFocus !== ownerDocument.body
        ? previousFocus
        : null;
    const unregister = pushDrawerKeyHandler(ownerDocument, {
      panel: () => panelRef.current,
      requestClose,
    });
    panel.focus({ preventScroll: true });
    return unregister;
  }, [open, panelRef, requestClose]);

  const previousOpenRef = React.useRef(open);
  React.useLayoutEffect(() => {
    let cancelDeferredFocus: (() => void) | undefined;
    if (previousOpenRef.current && !open) {
      blurActiveKeyboardInputWithin(panelRef.current);
      resetDrawerKeyboardStyles(panelRef.current);
      const returnFocus = returnFocusRef.current;
      if (returnFocus !== null && isFocusReturnable(returnFocus)) {
        returnFocus.focus({ preventScroll: true });
        const ownerWindow = returnFocus.ownerDocument.defaultView;
        if (
          returnFocus.ownerDocument.activeElement !== returnFocus &&
          ownerWindow !== null
        ) {
          const frame = ownerWindow.requestAnimationFrame(() => {
            if (isFocusReturnable(returnFocus)) {
              returnFocus.focus({ preventScroll: true });
            }
          });
          cancelDeferredFocus = () => ownerWindow.cancelAnimationFrame(frame);
        }
      }
      returnFocusRef.current = null;
    }
    previousOpenRef.current = open;
    return cancelDeferredFocus;
  }, [open, panelRef]);
}

type PersistentDrawerDrag = {
  pointerId: number;
  startY: number;
  lastY: number;
  lastTimeMs: number;
  velocityY: number;
  height: number;
};

export function PersistentResponsiveDrawerShell({
  open,
  onOpenChange,
  srLabel,
  labelledBy,
  describedBy,
  contentClassName,
  onContentAnimationEnd,
  children,
}: PersistentResponsiveDrawerShellProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const backdropRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<PersistentDrawerDrag | null>(null);
  const settledStateRef = React.useRef<boolean | null>(null);
  const labelId = React.useId();
  const portalScopeProps = usePortalScopeProps();
  const onOpenChangeRef = React.useRef(onOpenChange);
  React.useLayoutEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);
  const requestClose = React.useCallback(() => {
    blurActiveKeyboardInputWithin(panelRef.current);
    resetDrawerKeyboardStyles(panelRef.current);
    onOpenChangeRef.current(false);
  }, []);

  usePersistentOverlayFocus(panelRef, open, requestClose);
  useDrawerKeyboardInset(panelRef, open);

  const reportSettled = React.useCallback(
    (settledOpen: boolean) => {
      if (settledStateRef.current === settledOpen) {
        return;
      }
      settledStateRef.current = settledOpen;
      onContentAnimationEnd?.(settledOpen);
    },
    [onContentAnimationEnd],
  );

  // transitionend never fires when no transition runs (the first mount) or
  // when one is interrupted, so a timer also reports the settled state.
  React.useEffect(() => {
    settledStateRef.current = null;
    const timeout = window.setTimeout(
      () => reportSettled(open),
      PERSISTENT_DRAWER_MOTION_MS + 50,
    );
    return () => window.clearTimeout(timeout);
  }, [open, reportSettled]);

  const setDragPosition = React.useCallback(
    (offsetY: number, height: number, animate: boolean) => {
      const panel = panelRef.current;
      const backdrop = backdropRef.current;
      if (panel === null || backdrop === null) {
        return;
      }
      panel.style.transition = animate ? PERSISTENT_DRAWER_TRANSITION : "none";
      panel.style.transform = `translate3d(0, ${offsetY}px, 0)`;
      backdrop.style.transition = animate
        ? PERSISTENT_DRAWER_BACKDROP_TRANSITION
        : "none";
      backdrop.style.opacity = String(
        Math.max(0, Math.min(1, 1 - offsetY / height)),
      );
    },
    [],
  );

  const handleDragStart = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!open || event.button !== 0) {
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      const nowMs = Date.now();
      const height = Math.max(panelRef.current?.clientHeight ?? 0, 1);
      dragRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        lastY: event.clientY,
        lastTimeMs: nowMs,
        velocityY: 0,
        height,
      };
      setDragPosition(0, height, false);
      event.preventDefault();
    },
    [open, setDragPosition],
  );

  const handleDragMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (drag === null || drag.pointerId !== event.pointerId) {
        return;
      }
      const nowMs = Date.now();
      const elapsedMs = nowMs - drag.lastTimeMs;
      if (elapsedMs > 0) {
        drag.velocityY = ((event.clientY - drag.lastY) / elapsedMs) * 1000;
        drag.lastY = event.clientY;
        drag.lastTimeMs = nowMs;
      }
      setDragPosition(
        Math.max(0, event.clientY - drag.startY),
        drag.height,
        false,
      );
      event.preventDefault();
    },
    [setDragPosition],
  );

  const finishDrag = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
      const drag = dragRef.current;
      if (drag === null || drag.pointerId !== event.pointerId) {
        return;
      }
      dragRef.current = null;
      const offsetY = Math.max(0, event.clientY - drag.startY);
      const shouldClose =
        !cancelled &&
        (offsetY >= drag.height * PERSISTENT_DRAWER_CLOSE_RATIO ||
          drag.velocityY >= PERSISTENT_DRAWER_CLOSE_VELOCITY_PX_PER_SEC);
      if (shouldClose) {
        setDragPosition(drag.height, drag.height, true);
        requestClose();
      } else {
        setDragPosition(0, drag.height, true);
      }
      event.preventDefault();
    },
    [requestClose, setDragPosition],
  );

  return createPortal(
    <>
      <div
        ref={backdropRef}
        {...portalScopeProps}
        aria-hidden="true"
        data-persistent-drawer-backdrop=""
        data-state={open ? "open" : "closed"}
        className="fixed inset-0 z-50 bg-black/40"
        style={{
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: PERSISTENT_DRAWER_BACKDROP_TRANSITION,
        }}
        onClick={requestClose}
        onTouchMove={(event) => event.preventDefault()}
      />
      <div
        ref={panelRef}
        {...portalScopeProps}
        aria-hidden={!open}
        aria-labelledby={
          labelledBy ?? (srLabel === undefined ? undefined : labelId)
        }
        aria-describedby={describedBy}
        aria-modal={open || undefined}
        data-bb-portaled-overlay=""
        data-persistent-drawer-content=""
        data-state={open ? "open" : "closed"}
        inert={!open}
        role="dialog"
        tabIndex={-1}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mt-24 flex max-h-[calc(92dvh-var(--bb-drawer-keyboard-inset,0px))] flex-col rounded-t-xl border bg-background outline-none",
          contentClassName,
        )}
        style={{
          transform: open ? "translate3d(0, 0, 0)" : "translate3d(0, 100%, 0)",
          transition: PERSISTENT_DRAWER_TRANSITION,
          willChange: open ? "transform" : undefined,
        }}
        onTransitionEnd={(event) => {
          if (
            event.currentTarget === event.target &&
            event.propertyName === "transform"
          ) {
            reportSettled(open);
          }
        }}
      >
        <div
          data-persistent-drawer-handle=""
          className="mx-auto flex h-8 w-16 shrink-0 touch-none cursor-grab items-center justify-center active:cursor-grabbing"
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={(event) => finishDrag(event, false)}
          onPointerCancel={(event) => finishDrag(event, true)}
        >
          <div className="h-1 w-10 rounded-full bg-muted-foreground/20" />
        </div>
        {srLabel === undefined ? null : (
          <h2 id={labelId} className="sr-only">
            {srLabel}
          </h2>
        )}
        {children}
      </div>
    </>,
    document.body,
  );
}
