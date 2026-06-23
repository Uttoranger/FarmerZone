'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { addPickupSlot, deletePickupSlot, togglePickupSlotActive } from '@/server/actions/farm'
import type { FarmSettings } from '@/server/queries/farm'

const DAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']

type Slot = FarmSettings['pickupSlots'][number]

function SlotRow({ slot, onDelete, onToggle }: { slot: Slot; onDelete: () => void; onToggle: () => void }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${slot.isActive ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800">
          {DAY_NAMES[slot.dayOfWeek]}
        </p>
        <p className="text-xs text-slate-500">
          {slot.startTime}–{slot.endTime} Uhr
          {slot.maxOrders ? ` · max. ${slot.maxOrders} Bestellungen` : ''}
        </p>
      </div>
      <button
        onClick={onToggle}
        className={`text-xs px-2 py-1 rounded-full font-medium transition-colors ${
          slot.isActive
            ? 'bg-green-100 text-green-700 hover:bg-green-200'
            : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
        }`}
      >
        {slot.isActive ? 'Aktiv' : 'Inaktiv'}
      </button>
      <button
        onClick={onDelete}
        className="p-1.5 text-slate-400 hover:text-red-600 transition-colors rounded"
        title="Löschen"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  )
}

export function PickupSlotsClient({ initialSlots }: { initialSlots: Slot[] }) {
  const [slots, setSlots] = useState(initialSlots)
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({ dayOfWeek: 1, startTime: '14:00', endTime: '16:00', maxOrders: '' })

  function handleAdd() {
    startTransition(async () => {
      const res = await addPickupSlot({
        dayOfWeek: form.dayOfWeek,
        startTime: form.startTime,
        endTime: form.endTime,
        maxOrders: form.maxOrders ? parseInt(form.maxOrders) : null,
      })
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Abholzeit hinzugefügt')
        setForm({ dayOfWeek: 1, startTime: '14:00', endTime: '16:00', maxOrders: '' })
      }
    })
  }

  function handleDelete(slotId: string) {
    startTransition(async () => {
      const res = await deletePickupSlot(slotId)
      if (res.error) {
        toast.error(res.error)
      } else {
        setSlots((s) => s.filter((x) => x.id !== slotId))
        toast.success('Abholzeit gelöscht')
      }
    })
  }

  function handleToggle(slot: Slot) {
    startTransition(async () => {
      const res = await togglePickupSlotActive(slot.id, !slot.isActive)
      if (res.error) {
        toast.error(res.error)
      } else {
        setSlots((s) => s.map((x) => x.id === slot.id ? { ...x, isActive: !x.isActive } : x))
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Existing slots */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="font-medium text-slate-700 mb-3">Aktuelle Abholzeiten</h2>
        {slots.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">Noch keine Abholzeiten angelegt.</p>
        ) : (
          <div className="space-y-2">
            {slots.map((slot) => (
              <SlotRow
                key={slot.id}
                slot={slot}
                onDelete={() => handleDelete(slot.id)}
                onToggle={() => handleToggle(slot)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add new slot */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <h2 className="font-medium text-slate-700">Abholzeit hinzufügen</h2>

        <div>
          <Label className="text-sm text-slate-600 mb-1 block">Wochentag</Label>
          <select
            value={form.dayOfWeek}
            onChange={(e) => setForm({ ...form, dayOfWeek: parseInt(e.target.value) })}
            className="w-full h-10 border border-slate-200 rounded-md px-3 text-sm bg-white"
          >
            {DAY_NAMES.map((name, i) => (
              <option key={i} value={i}>{name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="startTime" className="text-sm text-slate-600 mb-1 block">Von</Label>
            <Input
              id="startTime"
              type="time"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="endTime" className="text-sm text-slate-600 mb-1 block">Bis</Label>
            <Input
              id="endTime"
              type="time"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="maxOrders" className="text-sm text-slate-600 mb-1 block">
            Max. Bestellungen (optional, leer = unbegrenzt)
          </Label>
          <Input
            id="maxOrders"
            type="number"
            min="1"
            value={form.maxOrders}
            onChange={(e) => setForm({ ...form, maxOrders: e.target.value })}
            placeholder="z.B. 20"
          />
        </div>

        <Button
          onClick={handleAdd}
          disabled={isPending}
          className="w-full bg-green-700 hover:bg-green-800 text-white"
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <><Plus className="size-4 mr-1" /> Abholzeit hinzufügen</>}
        </Button>
      </div>
    </div>
  )
}
