'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { addPickupSlot, deletePickupSlot, togglePickupSlotActive } from '@/server/actions/farm'
import { findSlotError, DAY_NAMES } from '@/lib/pickup-slot-rules'
import type { FarmSettings } from '@/server/queries/farm'

type Slot = FarmSettings['pickupSlots'][number]

function SlotRow({ slot, onDelete, onToggle }: { slot: Slot; onDelete: () => void; onToggle: () => void }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${slot.isActive ? 'border-border bg-card' : 'border-border/50 bg-muted/30 opacity-60'}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          {DAY_NAMES[slot.dayOfWeek]}
        </p>
        <p className="text-xs text-muted-foreground">
          {slot.startTime}–{slot.endTime} Uhr
          {slot.maxOrders ? ` · max. ${slot.maxOrders} Bestellungen` : ''}
        </p>
      </div>
      {/* min. 44px Tippfläche (Mobil-Pflicht): der Schalter ist die
          Urlaubs-Funktion und muss mit dem Daumen sicher treffbar sein */}
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={slot.isActive}
        className={`text-xs min-h-11 min-w-11 px-3 rounded-full border font-semibold transition-colors outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring ${
          slot.isActive
            ? 'border-accent/50 bg-accent/18 text-status-fertig hover:bg-accent/25'
            : 'border-border bg-muted text-foreground hover:bg-muted/70'
        }`}
      >
        {slot.isActive ? 'Aktiv' : 'Pausiert'}
      </button>
      {/* 44 px und ein Name für Screenreader: welcher Tag, welche Zeit. */}
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Abholzeit ${DAY_NAMES[slot.dayOfWeek]} ${slot.startTime}–${slot.endTime} löschen`}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-status-offen outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring"
        title="Löschen"
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}

// Anzeige-Reihenfolge wie die Server-Query (dayOfWeek, dann Beginn) — damit
// ein optimistisch eingefügter Slot sofort an der richtigen Stelle steht
function sortSlots(list: Slot[]): Slot[] {
  return [...list].sort(
    (a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)
  )
}

/**
 * Die Abholzeiten — unter /settings/pickup-slots und im Hofseiten-Editor ab lg
 * (components/farmer/hofseite-editor.tsx), der über `onGespeichert` nach jeder
 * Änderung seine Vorschau neu lädt.
 */
export function PickupSlotsClient({
  initialSlots,
  onGespeichert,
}: {
  initialSlots: Slot[]
  onGespeichert?: () => void
}): React.JSX.Element {
  const router = useRouter()
  const [slots, setSlots] = useState(initialSlots)
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({ dayOfWeek: 1, startTime: '14:00', endTime: '16:00', maxOrders: '' })

  // Haus-Muster (nachlese-4 Punkt 14): alle drei Wege optimistisch, nach
  // Erfolg router.refresh(). Der Refresh liefert neue initialSlots — dieser
  // Sync übernimmt sie, sonst würde der useState-Startwert ewig festhängen
  // und Server- und Client-Stand könnten nie konvergieren.
  useEffect(() => {
    setSlots(initialSlots)
  }, [initialSlots])

  function handleAdd() {
    // Clientseitig dieselben Regeln wie der Server (Zeitlogik, Dublette,
    // Überschneidung) — spart den Roundtrip und zeigt die Meldung sofort
    const clientError = findSlotError(
      { dayOfWeek: form.dayOfWeek, startTime: form.startTime, endTime: form.endTime },
      { all: slots, active: slots.filter((s) => s.isActive) }
    )
    if (clientError) {
      toast.error(clientError)
      return
    }
    // Optimistisch: sofort einsortiert anzeigen; die Temp-Id wird nach dem
    // router.refresh() durch die echte Server-Id ersetzt (Prop-Sync oben)
    const maxOrders = form.maxOrders ? parseInt(form.maxOrders) : null
    const tempId = `temp-${form.dayOfWeek}-${form.startTime}-${form.endTime}`
    const optimistic: Slot = {
      id: tempId,
      dayOfWeek: form.dayOfWeek,
      startTime: form.startTime,
      endTime: form.endTime,
      maxOrders,
      isActive: true,
    }
    const prevForm = form
    setSlots((s) => sortSlots([...s, optimistic]))
    setForm({ dayOfWeek: 1, startTime: '14:00', endTime: '16:00', maxOrders: '' })
    startTransition(async () => {
      const res = await addPickupSlot({
        dayOfWeek: optimistic.dayOfWeek,
        startTime: optimistic.startTime,
        endTime: optimistic.endTime,
        maxOrders,
      })
      if (res.error) {
        // Revert: Eintrag raus, Eingaben zurück, Meldung zeigen
        setSlots((s) => s.filter((x) => x.id !== tempId))
        setForm(prevForm)
        toast.error(res.error)
      } else {
        toast.success('Abholzeit hinzugefügt')
        router.refresh()
        onGespeichert?.()
      }
    })
  }

  function handleDelete(slotId: string) {
    // Optimistisch: sofort ausblenden, bei Server-Fehler zurückrollen
    const prev = slots
    setSlots((s) => s.filter((x) => x.id !== slotId))
    startTransition(async () => {
      const res = await deletePickupSlot(slotId)
      if (res.error) {
        setSlots(prev)
        toast.error(res.error)
      } else {
        toast.success('Abholzeit gelöscht')
        router.refresh()
        onGespeichert?.()
      }
    })
  }

  function handleToggle(slot: Slot) {
    // Optimistisch: sofort umschalten, bei Server-Fehler zurückrollen
    const next = !slot.isActive
    setSlots((s) => s.map((x) => (x.id === slot.id ? { ...x, isActive: next } : x)))
    startTransition(async () => {
      const res = await togglePickupSlotActive(slot.id, next)
      if (res.error) {
        setSlots((s) => s.map((x) => (x.id === slot.id ? { ...x, isActive: slot.isActive } : x)))
        toast.error(res.error)
      } else {
        router.refresh()
        onGespeichert?.()
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Existing slots */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h2 className="font-medium text-foreground mb-3">Aktuelle Abholzeiten</h2>
        {slots.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Noch keine Abholzeiten angelegt.</p>
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
        <p className="text-xs text-muted-foreground mt-3">
          Pausierte Zeiten sind für Kundinnen unsichtbar — praktisch für Urlaub.
        </p>
      </div>

      {/* Add new slot */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-4">
        <h2 className="font-medium text-foreground">Abholzeit hinzufügen</h2>

        <div>
          <Label htmlFor="dayOfWeek" className="text-sm text-muted-foreground mb-1 block">Wochentag</Label>
          <select
            value={form.dayOfWeek}
            onChange={(e) => setForm({ ...form, dayOfWeek: parseInt(e.target.value) })}
            id="dayOfWeek"
            className="min-h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
          >
            {DAY_NAMES.map((name, i) => (
              <option key={i} value={i}>{name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="startTime" className="text-sm text-muted-foreground mb-1 block">Von</Label>
            <Input
              id="startTime"
              type="time"
              className="min-h-11"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="endTime" className="text-sm text-muted-foreground mb-1 block">Bis</Label>
            <Input
              id="endTime"
              type="time"
              className="min-h-11"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="maxOrders" className="text-sm text-muted-foreground mb-1 block">
            Max. Bestellungen (optional, leer = unbegrenzt)
          </Label>
          <Input
            id="maxOrders"
            type="number"
            className="min-h-11"
            min="1"
            value={form.maxOrders}
            onChange={(e) => setForm({ ...form, maxOrders: e.target.value })}
            placeholder="z.B. 20"
          />
        </div>

        <Button
          onClick={handleAdd}
          disabled={isPending}
          className="min-h-11 w-full bg-primary text-primary-foreground hover:opacity-90"
        >
          {isPending ? <Loader2 className="size-4 animate-spin" aria-label="Einen Moment …" /> : <><Plus className="size-4 mr-1" aria-hidden="true" /> Abholzeit hinzufügen</>}
        </Button>
      </div>
    </div>
  )
}

