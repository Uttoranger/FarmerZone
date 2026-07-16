'use client'

import {
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'

// Gemeinsame DnD-Sensorik (Sprint 18):
// - Maus/Pointer: kleiner Mindestabstand, damit Klicks (Lightbox, Buttons) nicht als Drag starten
// - Touch: Long-Press ~250 ms — der Bauer sortiert am Handy (touch-action: none am Handle!)
// - Keyboard: Barrierefreiheit (Leertaste greift, Pfeile verschieben)
export function useReorderSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
}
