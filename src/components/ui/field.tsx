// Compact subset of shadcn Field, using native labels and the plugin's tokens.
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

export function FieldGroup({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="field-group" className={cn("flex w-full flex-col gap-5", className)} {...props} />;
}
export function Field({ className, ...props }: ComponentProps<"div">) {
  return <div role="group" data-slot="field" className={cn("group/field flex w-full flex-col gap-2 data-[invalid=true]:text-destructive", className)} {...props} />;
}
export function FieldLabel({ className, ...props }: ComponentProps<"label">) {
  return <label data-slot="field-label" className={cn("text-xs font-medium text-muted-foreground group-data-[disabled=true]/field:opacity-50", className)} {...props} />;
}
