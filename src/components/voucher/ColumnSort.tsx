'use client';

import React from 'react';
import { useMounted } from '@/hooks/useMounted';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ColumnItem {
  id: string;
  label: string;
  visible: boolean;
}

interface ColumnSortProps {
  columns: ColumnItem[];
  onReorder: (orderedColumns: ColumnItem[]) => void;
  onToggleVisibility: (columnId: string) => void;
}

function SortableItem({ column, onToggleVisibility }: { column: ColumnItem; onToggleVisibility: (columnId: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 mb-2 cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-center gap-3">
        <button
          className="w-5 h-5 text-gray-400"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
          <span className="font-medium">{column.label}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onToggleVisibility(column.id)}
          className={column.visible ? "text-blue-600 hover:bg-blue-50" : "text-gray-400 hover:bg-gray-100"}
        >
          {column.visible ? "显示" : "隐藏"}
        </Button>
        <Button variant="ghost" size="sm">
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export function ColumnSort({ columns, onReorder, onToggleVisibility }: ColumnSortProps) {
  const isClient = useMounted();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = columns.findIndex(column => column.id === active.id);
      const newIndex = columns.findIndex(column => column.id === over?.id);

      const reorderedColumns = arrayMove(columns, oldIndex, newIndex);
      onReorder(reorderedColumns);
    }
  }

  if (!isClient) {
    // Render a static version on server to avoid hydration mismatch
    return (
      <div className="space-y-2">
        {columns.map((column) => (
          <div
            key={column.id}
            className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 mb-2"
          >
            <div className="flex items-center gap-3">
              <button className="w-5 h-5 text-gray-400">
                <GripVertical className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span className="font-medium">{column.label}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleVisibility(column.id)}
                className={column.visible ? "text-blue-600 hover:bg-blue-50" : "text-gray-400 hover:bg-gray-100"}
              >
                {column.visible ? "显示" : "隐藏"}
              </Button>
              <Button variant="ghost" size="sm">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Render the interactive dnd version on client
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={columns.map(c => c.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {columns.map((column) => (
            <SortableItem
              key={column.id}
              column={column}
              onToggleVisibility={onToggleVisibility}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}