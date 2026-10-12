import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { experimental_Icon as Icon } from "@get-bb/plugin-sdk/app";

import { cn } from "../../lib/utils";
import { usePortalScopeProps } from "../../lib/portal-scope";
import {
  type ResponsiveOverlayContextValue,
  useResponsiveRoot,
  ResponsiveDrawerShell,
  stripRadixContentProps,
} from "./responsive-overlay";

interface ResponsiveDialogContextValue extends ResponsiveOverlayContextValue {
  titleId: string;
  descriptionId: string;
}

const ResponsiveDialogContext =
  React.createContext<ResponsiveDialogContextValue>({
    isCompactViewport: false,
    open: false,
    onOpenChange: () => {},
    titleId: "",
    descriptionId: "",
  });

function useResponsiveDialog() {
  return React.useContext(ResponsiveDialogContext);
}

function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const responsiveRoot = useResponsiveRoot(open, onOpenChange);
  const titleId = React.useId();
  const descriptionId = React.useId();
  const ctx = React.useMemo(
    () => ({ ...responsiveRoot, titleId, descriptionId }),
    [descriptionId, responsiveRoot, titleId],
  );

  return (
    <ResponsiveDialogContext.Provider value={ctx}>
      {ctx.isCompactViewport ? (
        children
      ) : (
        <DialogPrimitive.Root open={ctx.open} onOpenChange={ctx.onOpenChange}>
          {children}
        </DialogPrimitive.Root>
      )}
    </ResponsiveDialogContext.Provider>
  );
}

const DialogContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const { isCompactViewport, open, onOpenChange, titleId, descriptionId } =
    useResponsiveDialog();
  const scopeProps = usePortalScopeProps();

  if (isCompactViewport) {
    return (
      <ResponsiveDrawerShell
        open={open}
        onOpenChange={onOpenChange}
        labelledBy={titleId}
        describedBy={descriptionId}
      >
        <div
          ref={ref}
          className={cn(
            "grid grid-cols-[minmax(0,1fr)] gap-4 overflow-y-auto px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]",
            className,
            "max-w-none",
          )}
          {...stripRadixContentProps(props)}
        >
          {children}
        </div>
      </ResponsiveDrawerShell>
    );
  }

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        {...scopeProps}
        className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
      />
      <DialogPrimitive.Content
        ref={ref}
        {...scopeProps}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg grid-cols-[minmax(0,1fr)] translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-sm duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 cursor-pointer rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-state-active data-[state=open]:text-foreground">
          <Icon name="X" className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});
DialogContent.displayName = "DialogContent";

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col space-y-1.5 text-left", className)}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

// The bottom sheet is not a Radix dialog, so it labels itself with these ids.
function DialogTitle({ className, ...props }: { className?: string; children: React.ReactNode }) {
  const { isCompactViewport, titleId } = useResponsiveDialog();
  const titleClassName = cn(
    "text-base font-semibold leading-none tracking-tight",
    className,
  );
  return isCompactViewport ? (
    <h2 id={titleId} className={titleClassName} {...props} />
  ) : (
    <DialogPrimitive.Title className={titleClassName} {...props} />
  );
}

function DialogDescription({ className, ...props }: { className?: string; children: React.ReactNode }) {
  const { isCompactViewport, descriptionId } = useResponsiveDialog();
  const descriptionClassName = cn("text-sm text-muted-foreground", className);
  return isCompactViewport ? (
    <p id={descriptionId} className={descriptionClassName} {...props} />
  ) : (
    <DialogPrimitive.Description className={descriptionClassName} {...props} />
  );
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription };
