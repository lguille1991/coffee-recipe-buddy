'use client'

import { memo } from 'react'
import { RecipeStep } from '@/types/recipe'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export type DraftStep = RecipeStep & { _dndId: string }

interface SortableStepRowProps {
  step: DraftStep
  stepIndex: number
  totalSteps: number
  onUpdate: (id: string, updates: Partial<DraftStep>) => void
  onDelete: (id: string) => void
}

const SortableStepRow = memo(function SortableStepRow({
  step,
  stepIndex,
  totalSteps,
  onUpdate,
  onDelete,
}: SortableStepRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step._dndId })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div ref={setNodeRef} style={style} className="bg-[var(--card)] rounded-2xl p-3 flex gap-2 items-start">
      <div className="flex flex-col items-center gap-1 mt-1">
        <span className="w-5 h-5 rounded-full bg-[var(--foreground)] text-[var(--background)] flex items-center justify-center text-[10px] font-bold shrink-0">
          {stepIndex + 1}
        </span>
        <button
          className="p-1 touch-none cursor-grab text-[#9CA3AF] active:cursor-grabbing"
          aria-label="Drag to reorder"
          {...listeners}
          {...attributes}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="4" cy="3" r="1.2" fill="currentColor"/>
            <circle cx="4" cy="7" r="1.2" fill="currentColor"/>
            <circle cx="4" cy="11" r="1.2" fill="currentColor"/>
            <circle cx="10" cy="3" r="1.2" fill="currentColor"/>
            <circle cx="10" cy="7" r="1.2" fill="currentColor"/>
            <circle cx="10" cy="11" r="1.2" fill="currentColor"/>
          </svg>
        </button>
      </div>
      <div className="flex-1 flex flex-col gap-1.5">
        <div className="flex gap-1.5 items-center">
          <input
            type="text"
            placeholder="0:00"
            value={step.time}
            onChange={e => onUpdate(step._dndId, { time: e.target.value.replace(/[^0-9:]/g, '') })}
            className="w-16 rounded-lg px-2.5 py-1.5 text-xs font-mono text-[var(--foreground)] bg-[var(--background)] border border-[var(--border)] focus:outline-none focus:ring-1 focus:ring-[var(--foreground)]/20"
          />
          <div className="relative">
            <input
              type="number"
              min={0}
              step={0.1}
              placeholder="0"
              value={step.water_poured_g === 0 ? '' : step.water_poured_g}
              onKeyDown={e => { if (e.key === '-' || e.key === 'e') e.preventDefault() }}
              onChange={e => onUpdate(step._dndId, { water_poured_g: Math.max(0, parseFloat(e.target.value) || 0) })}
              className="w-16 rounded-lg pl-2.5 pr-5 py-1.5 text-xs font-mono text-[var(--foreground)] bg-[var(--background)] border border-[var(--border)] focus:outline-none focus:ring-1 focus:ring-[var(--foreground)]/20"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#9CA3AF] pointer-events-none">g</span>
          </div>
          {step.water_poured_g > 0 && (
            <span className="text-[10px] font-mono text-[#9CA3AF] whitespace-nowrap">
              = {step.water_accumulated_g} g
            </span>
          )}
        </div>
        <input
          type="text"
          maxLength={80}
          placeholder="Step description…"
          value={step.action}
          onChange={e => onUpdate(step._dndId, { action: e.target.value })}
          className="w-full rounded-lg px-2.5 py-1.5 text-xs text-[var(--foreground)] bg-[var(--background)] border border-[var(--border)] focus:outline-none focus:ring-1 focus:ring-[var(--foreground)]/20"
        />
      </div>
      <button
        onClick={() => onDelete(step._dndId)}
        disabled={totalSteps <= 1}
        className="mt-2 p-1 text-red-400 disabled:opacity-30 active:opacity-60"
        aria-label="Delete step"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 4H12M5 4V2.5C5 2.22 5.22 2 5.5 2H8.5C8.78 2 9 2.22 9 2.5V4M5.5 6.5V10.5M8.5 6.5V10.5M3.5 4L4.5 12H9.5L10.5 4H3.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  )
})

interface SortableStepListProps {
  steps: DraftStep[]
  onUpdate: (id: string, updates: Partial<DraftStep>) => void
  onDelete: (id: string) => void
  onAdd: () => void
  onReorder: (newSteps: DraftStep[]) => void
  stepError: string | null
}

export default function SortableStepList({
  steps,
  onUpdate,
  onDelete,
  onAdd,
  onReorder,
  stepError,
}: SortableStepListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = steps.findIndex(s => s._dndId === active.id)
    const newIndex = steps.findIndex(s => s._dndId === over.id)
    onReorder(arrayMove(steps, oldIndex, newIndex))
  }

  return (
    <div className="flex flex-col gap-2">
      {stepError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-700">
          {stepError}
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={steps.map(s => s._dndId)} strategy={verticalListSortingStrategy}>
          {steps.map((step, i) => (
            <SortableStepRow
              key={step._dndId}
              step={step}
              stepIndex={i}
              totalSteps={steps.length}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
        </SortableContext>
      </DndContext>
      <button
        onClick={onAdd}
        className="w-full py-2.5 rounded-2xl border border-dashed border-[var(--border)] text-xs font-medium text-[var(--muted-foreground)] active:opacity-60 flex items-center justify-center gap-1.5"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 2V12M2 7H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        Add Step
      </button>
    </div>
  )
}
