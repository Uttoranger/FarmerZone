'use client'

import type { ReactNode } from 'react'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { useReorderSensors } from './use-reorder-sensors'

// Gemeinsamer DnD-Wrapper (Sprint 18): umschließt eine sortierbare Liste/ein Grid.
// enabled=false rendert die Kinder unverändert (Kundenansicht/Preview: kein DnD).
export function ReorderContext({
  enabled,
  items,
  onDragEnd,
  children,
}: {
  enabled: boolean
  items: string[]
  onDragEnd: (event: DragEndEvent) => void
  children: ReactNode
}) {
  const sensors = useReorderSensors()

  if (!enabled) return <>{children}</>

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items} strategy={rectSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  )
}
