import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "../../lib/utils";
import { usePortalScopeProps } from "../../lib/portal-scope";
import {
  type ResponsiveOverlayContextValue,
  blurActiveKeyboardInputWithin,
  useResponsiveRoot,
  ResponsiveDrawerShell,
  stripRadixContentProps,
} from "./responsive-overlay";
import { usePointerCoarse } from "./use-media-query";

const ResponsivePopoverContext =
  React.createContext<ResponsiveOverlayContextValue>({
    isCompactViewport: false,
    open: false,
    onOpenChange: () => {},
  });

function useResponsivePopover() {
  return React.useContext(ResponsivePopoverContext);
}

function Popover({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const ctx = useResponsiveRoot(open, onOpenChange);
  const content = (
    <ResponsivePopoverContext.Provider value={ctx}>
      {children}
    </ResponsivePopoverContext.Provider>
  );

  if (ctx.isCompactViewport) return content;

  return (
    <PopoverPrimitive.Root open={ctx.open} onOpenChange={ctx.onOpenChange}>
      {content}
    </PopoverPrimitive.Root>
  );
}

const PopoverTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<"button">
>(({ className, onClick, ...props }, ref) => {
  const { isCompactViewport, open, onOpenChange } = useResponsivePopover();
  const triggerClassName = cn("select-none", className);

  if (isCompactViewport) {
    return (
      <button
        ref={ref}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        data-state={open ? "open" : "closed"}
        className={triggerClassName}
        onMouseDown={(event) => event.preventDefault()}
        onClick={(event) => {
          onClick?.(event);
          if (event.defaultPrevented) return;
          if (!open) blurActiveKeyboardInputWithin(null);
          onOpenChange(!open);
        }}
        {...props}
      />
    );
  }

  return (
    <PopoverPrimitive.Trigger
      ref={ref}
      className={triggerClassName}
      onClick={onClick}
      onMouseDown={(event) => {
        if (!open) blurActiveKeyboardInputWithin(null);
        event.preventDefault();
      }}
      {...props}
    />
  );
});
PopoverTrigger.displayName = "PopoverTrigger";

const PopoverContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, children, onOpenAutoFocus, ...props }, ref) => {
  const { isCompactViewport, open, onOpenChange } = useResponsivePopover();
  const isPointerCoarse = usePointerCoarse();
  const scopeProps = usePortalScopeProps();

  if (isCompactViewport) {
    const { style, ...domProps } = stripRadixContentProps(props);

    return (
      <ResponsiveDrawerShell
        open={open}
        onOpenChange={onOpenChange}
        srLabel="Options"
      >
        <div
          ref={ref}
          className={cn(
            "overflow-y-auto px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]",
            className,
          )}
          {...domProps}
          style={{ ...style, width: "auto", minWidth: "auto", maxWidth: "none" }}
        >
          {children}
        </div>
      </ResponsiveDrawerShell>
    );
  }

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        {...scopeProps}
        onOpenAutoFocus={(event) => {
          if (isPointerCoarse) event.preventDefault();
          else onOpenAutoFocus?.(event);
        }}
        className={cn(
          "z-50 w-96 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className,
        )}
        {...props}
      >
        {children}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
});
PopoverContent.displayName = "PopoverContent";

export { Popover, PopoverTrigger, PopoverContent };
