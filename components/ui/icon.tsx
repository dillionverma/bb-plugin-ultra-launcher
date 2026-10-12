import type { CSSProperties } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  ArrowLeft01Icon,
  BotIcon,
  Cancel01Icon,
  DashedLineCircleIcon,
  Delete02Icon,
  DragDropVerticalIcon,
  Edit02Icon,
  PlusSignIcon,
  Settings01Icon,
  Tick02Icon,
  ZapIcon,
} from "@hugeicons/core-free-icons";

const ICON_MAP = {
  Bot: BotIcon,
  Check: Tick02Icon,
  ChevronDown: ArrowDown01Icon,
  ChevronLeft: ArrowLeft01Icon,
  DragDropVertical: DragDropVerticalIcon,
  Edit: Edit02Icon,
  Plus: PlusSignIcon,
  Settings: Settings01Icon,
  Spinner: DashedLineCircleIcon,
  Trash2: Delete02Icon,
  X: Cancel01Icon,
  Zap: ZapIcon,
} satisfies Record<string, IconSvgElement>;

type IconProps = {
  name: keyof typeof ICON_MAP;
  className?: string;
  style?: CSSProperties;
  "aria-hidden"?: boolean | "true" | "false";
  "aria-label"?: string;
};

export function Icon({ name, ...props }: IconProps) {
  return <HugeiconsIcon icon={ICON_MAP[name]} data-icon={name} {...props} />;
}
