import { useRef, useState, type ReactNode } from "react";
import { DndContext, closestCenter, MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ModelPreset } from "../lib/presets";
import { Icon } from "./ui/icon";
import { cn } from "../lib/utils";

type Snapshot = { presets: ModelPreset[]; revision: number };
interface Props extends Snapshot {
  disabled?: boolean;
  onReorder(presets: ModelPreset[], revision: number): Promise<void>;
  onDraggingChange?(dragging: boolean): void;
  renderRow(preset: ModelPreset, index: number, handle: ReactNode): ReactNode;
}
export function SortablePresets(props: Props) {
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const drag = useRef<Snapshot | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [optimistic, setOptimistic] = useState<ModelPreset[] | null>(null);
  const list = optimistic ?? snapshot?.presets ?? props.presets;
  const locked = props.disabled || optimistic !== null;
  function finish() { drag.current = null; setSnapshot(null); props.onDraggingChange?.(false); }
  async function drop(event: DragEndEvent) {
    const source = drag.current; finish();
    if (!source || !event.over || event.active.id === event.over.id) return;
    const from = source.presets.findIndex((item) => item.id === event.active.id);
    const to = source.presets.findIndex((item) => item.id === event.over?.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(source.presets, from, to);
    setOptimistic(next);
    try { await props.onReorder(next, source.revision); } finally { setOptimistic(null); }
  }
  return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={() => {
    drag.current = { presets: props.presets, revision: props.revision }; setSnapshot(drag.current); props.onDraggingChange?.(true);
  }} onDragEnd={(event) => void drop(event)} onDragCancel={finish} accessibility={{ screenReaderInstructions: { draggable: "Press Space to pick up a preset. Use arrow keys to move it. Press Space to drop, or Escape to cancel." } }}>
    <SortableContext items={list.map((item) => item.id)} strategy={verticalListSortingStrategy}>
      {list.map((preset, index) => <SortableRow key={preset.id} preset={preset} disabled={locked}>{(handle) => props.renderRow(preset, index, handle)}</SortableRow>)}
    </SortableContext>
  </DndContext>;
}
function SortableRow({ preset, disabled, children }: { preset: ModelPreset; disabled?: boolean; children(handle: ReactNode): ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: preset.id, disabled });
  return <div data-preset-row={preset.id} ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, position: "relative", zIndex: isDragging ? 10 : undefined }} className={cn("rounded-lg motion-reduce:transition-none", isDragging && "bg-popover shadow-lg ring-1 ring-border")}>
    {children(<button ref={setActivatorNodeRef} type="button" {...attributes} {...listeners} data-preset-drag-handle="" aria-label={`Reorder ${preset.name}`} disabled={disabled} className="flex h-8 w-6 shrink-0 touch-none items-center justify-center rounded-md text-muted-foreground/40 outline-none hover:text-muted-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30 cursor-grab active:cursor-grabbing"><Icon name="DragDropVertical" className="size-3.5" /></button>)}
  </div>;
}
