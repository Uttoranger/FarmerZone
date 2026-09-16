'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { setServiceFeeAction } from '@/server/actions/admin'
import {
  SERVICEGEBUEHR_ADMIN_ERKLAERUNG,
  centsAlsEuro,
  einstellungKurz,
  kalendertagInWien,
} from '@/lib/servicegebuehr'
import type { AdminMonatsSpalten } from '@/server/queries/admin'
import { formatEuro } from '@/lib/preis-format'
import { Button } from '@/components/ui/button'

/**
 * Der kompakte Einstellungsbereich je Hof in der Admin-Liste (Sprint
 * servicegebuehr, Teil E): eine Zeile mit der aktuellen Einstellung und den
 * Monatsspalten, aufklappbar zum Formular. Bewusst kein Dialog — der
 * Betreiber stellt mehrere Höfe hintereinander ein und will die Liste dabei
 * sehen. Bei 375 px stapeln die drei Felder untereinander.
 */
export function ServicegebuehrEinstellung({
  farmId,
  percent,
  minCents,
  activeFrom,
  monat,
  monatBezeichnung,
}: {
  farmId: string
  percent: number
  minCents: number
  activeFrom: Date | null
  monat: AdminMonatsSpalten
  monatBezeichnung: string
}) {
  const [offen, setOffen] = useState(false)
  const [isPending, startTransition] = useTransition()
  // Formularzustand als Text — <input type="number"> liefert Text, und der
  // Server prüft ohnehin (servicegebuehrEinstellungSchema).
  const [prozent, setProzent] = useState(String(percent))
  const [mindestEuro, setMindestEuro] = useState((minCents / 100).toFixed(2))
  const [giltAb, setGiltAb] = useState(activeFrom ? kalendertagInWien(new Date(activeFrom)) : '')

  const kurz = einstellungKurz({
    serviceFeePercent: percent,
    serviceFeeMinCents: minCents,
    serviceFeeActiveFrom: activeFrom,
  })

  function speichern() {
    startTransition(async () => {
      const mindest = Math.round(Number(mindestEuro.replace(',', '.')) * 100)
      const result = await setServiceFeeAction(farmId, {
        percent: prozent.replace(',', '.'),
        minCents: Number.isFinite(mindest) ? mindest : mindestEuro,
        activeFrom: giltAb,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(giltAb ? 'Servicegebühr gespeichert' : 'Hof ist gebührenfrei')
        setOffen(false)
      }
    })
  }

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="min-w-0 text-xs">
          <span className="font-medium text-foreground">Servicegebühr:</span>{' '}
          <span className={activeFrom ? 'text-foreground' : 'text-muted-foreground'}>{kurz}</span>
        </p>
        <button
          type="button"
          onClick={() => setOffen((o) => !o)}
          className="min-h-9 text-xs font-medium text-primary underline-offset-2 hover:underline"
          aria-expanded={offen}
        >
          {offen ? 'Schließen' : 'Einstellen'}
        </button>
      </div>

      {/* Die Monatsspalten (E-3) — als umbrechende Angaben statt Tabelle,
          damit bei 375 px nichts seitlich wegläuft. */}
      <dl className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        <div className="flex gap-1">
          <dt>{monatBezeichnung}:</dt>
          <dd className="text-foreground">
            {monat.bestellungen} {monat.bestellungen === 1 ? 'Bestellung' : 'Bestellungen'}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>online einbehalten</dt>
          <dd className="text-foreground">{formatEuro(centsAlsEuro(monat.gebuehrOnlineCents))}</dd>
        </div>
        <div className="flex gap-1">
          <dt>bar offen</dt>
          <dd className="text-foreground">{formatEuro(centsAlsEuro(monat.gebuehrBarCents))}</dd>
        </div>
        <div className="flex gap-1">
          <dt>entfallen</dt>
          <dd className="text-foreground">{formatEuro(centsAlsEuro(monat.gebuehrEntfallenCents))}</dd>
        </div>
      </dl>

      {offen && (
        <form
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            speichern()
          }}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">Prozentsatz (%)</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                max="100"
                value={prozent}
                onChange={(e) => setProzent(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">Mindestgebühr (€)</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={mindestEuro}
                onChange={(e) => setMindestEuro(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">Gebühr gilt ab</span>
              <input
                type="date"
                value={giltAb}
                onChange={(e) => setGiltAb(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
              />
              <span className="mt-1 block text-muted-foreground">Leer = gebührenfrei</span>
            </label>
          </div>
          <p className="text-xs text-muted-foreground">{SERVICEGEBUEHR_ADMIN_ERKLAERUNG}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? 'Moment…' : 'Speichern'}
            </Button>
            {giltAb !== '' && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => setGiltAb('')}
              >
                Gebührenfrei stellen
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
