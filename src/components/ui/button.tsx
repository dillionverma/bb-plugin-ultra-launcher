import * as React from "react";

import { cn } from "../../lib/utils";
import { CONTROL_HOVER_TRANSITION } from "./motion";

const VARIANT_CLASSES = {
  default: "bg-foreground text-background hover:bg-foreground/90",
  ghost:
    "hover:bg-state-hover hover:text-foreground aria-pressed:bg-state-active aria-pressed:text-foreground aria-pressed:hover:bg-state-active data-[state=open]:bg-state-active data-[state=open]:text-foreground data-[state=open]:hover:bg-state-active",
};

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: keyof typeof VARIANT_CLASSES;
  }
>(({ className, variant = "default", ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      `inline-flex h-8 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 text-xs font-medium ${CONTROL_HOVER_TRANSITION} focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0`,
      VARIANT_CLASSES[variant],
      className,
    )}
    {...props}
  />
));
Button.displayName = "Button";

export { Button };
