import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { experimental_Icon as Icon } from "@get-bb/plugin-sdk/app";

import { cn } from "../../lib/utils";
import { usePortalScopeProps } from "../../lib/portal-scope";
import {
  type ResponsiveOverlayContextValue,
  useResponsiveRoot,
  LazyDrawerShell,
  stripRadixContentProps,
} from "./responsive-overlay";

interface ResponsiveDialogContextValue extends ResponsiveOverlayContextValue {
  sheetTitleId: string;
  sheetDescriptionId: string;
}

const ResponsiveDialogContext =
  React.createContext<ResponsiveDialogContextValue>({
    isCompactViewport: false,
    open: false,
    onOpenChange: () => {},
    sheetTitleId: "",
    sheetDescriptionId: "",
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
  const sheetTitleId = React.useId();
  const sheetDescriptionId = React.useId();
  const ctx = React.useMemo(
    () => ({ ...responsiveRoot, sheetTitleId, sheetDescriptionId }),
    [sheetDescriptionId, responsiveRoot, sheetTitleId],
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
  const { isCompactViewport, open, onOpenChange, sheetTitleId, sheetDescriptionId } =
    useResponsiveDialog();
  const scopeProps = usePortalScopeProps();

  if (isCompactViewport) {
    return (
      <LazyDrawerShell
        open={open}
        onOpenChange={onOpenChange}
        labelledBy={sheetTitleId}
        describedBy={sheetDescriptionId}
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
      </LazyDrawerShell>
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

function DialogTitle({ className, ...props }: { className?: string; children: React.ReactNode }) {
  const { isCompactViewport, sheetTitleId } = useResponsiveDialog();
  const titleClassName = cn(
    "text-base font-semibold leading-none tracking-tight",
    className,
  );
  return isCompactViewport ? (
    <h2 id={sheetTitleId} className={titleClassName} {...props} />
  ) : (
    <DialogPrimitive.Title className={titleClassName} {...props} />
  );
}

function DialogDescription({ className, ...props }: { className?: string; children: React.ReactNode }) {
  const { isCompactViewport, sheetDescriptionId } = useResponsiveDialog();
  const descriptionClassName = cn("text-sm text-muted-foreground", className);
  return isCompactViewport ? (
    <p id={sheetDescriptionId} className={descriptionClassName} {...props} />
  ) : (
    <DialogPrimitive.Description className={descriptionClassName} {...props} />
  );
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription };
