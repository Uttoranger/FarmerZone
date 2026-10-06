'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { cancelOrder } from '@/server/actions/orders'
import type { HofBestellDetail } from '@/server/queries/orders'
import { ZeichenZaehler } from '@/components/shared/zeichen-zaehler'
import { STORNO_GRUND_MAX } from '@/lib/eingabegrenzen'
import { centsAlsEuro } from '@/lib/servicegebuehr'
import { formatEuro } from '@/lib/format'
import { cn } from '@/lib/utils'
import { BestellDialog, DialogFehler } from './bestell-dialog'
import { FELD, FELD_LABEL, LEISE } from './stil'

const euro = (cents: number): string => formatEuro(centsAlsEuro(cents))

/**
 * „Bestellung stornieren?" (Mockups web-h3-stornieren-erstatten,
 * mobil-h3-stornieren). Zeigt VOR dem Speichern, wer was zurückbekommt — die
 * Beträge hat der Server gerechnet (src/lib/storno.ts, nach „Artikel fehlt"
 * der aktuelle Stand); cancelOrder rechnet beim Speichern dasselbe noch
 * einmal unter der Sperre. Der Grund geht in die Mail an die Kundin.
 */
export function StornoDialog({
  bestellung,
  offen,
  onOffenChange,
}: {
  bestellung: HofBestellDetail
  offen: boolean
  onOffenChange: (offen: boolean) => void
}): React.JSX.Element {
  const [grund, setGrund] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, starte] = useTransition()
  const { storno, kunde } = bestellung
  const fehlende = bestellung.positionen.filter((p) => p.fehlt).length
  const zuLang = [...grund.trim()].length > STORNO_GRUND_MAX

  function stornieren() {
    setFehler(null)
    starte(async () => {
      const ergebnis = await cancelOrder(bestellung.id, grund.trim() || undefined)
      if (ergebnis.erstattungOffen) {
        // Storniert ist sie trotzdem — nur das Geld steht aus (Sentry hat es).
        onOffenChange(false)
        toast.warning('Storniert. Die Rückerstattung hat nicht geklappt – wir kümmern uns darum und melden uns.', { duration: 10000 })
        return
      }
      if (ergebnis.error) {
        setFehler(ergebnis.error)
        return
      }
      onOffenChange(false)
      toast.success(
        ergebnis.erstattetCents
          ? `Storniert. ${kunde.vorname} bekommt ${euro(ergebnis.erstattetCents)} zurück.`
          : 'Storniert. Die Kundin bekommt eine E-Mail.'
      )
    })
  }

  return (
    <BestellDialog
      offen={offen}
      onOffenChange={(o) => {
        if (!o) setFehler(null)
        onOffenChange(o)
      }}
      titel={`Bestellung ${bestellung.nummer} stornieren?`}
      unterzeile={`${kunde.name} · ${bestellung.zahlart}`}
      hauptaktion={{
        text: storno ? 'Stornieren und erstatten' : 'Stornieren',
        onClick: stornieren,
        ton: 'orange',
        laeuft,
        gesperrt: zuLang,
      }}
    >
      {storno ? (
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-background px-4 py-3.5">
          <p className="flex items-baseline gap-3 text-[13.5px]">
            <span className={LEISE}>{kunde.vorname} bekommt zurück</span>
            <span className="ml-auto font-semibold tabular-nums">{euro(storno.erstattetCents)}</span>
          </p>
          <p className={cn('text-[12.5px]', LEISE)}>
            {storno.servicegebuehrCents > 0
              ? `Warenpreis ${euro(storno.erstattetCents - storno.servicegebuehrCents)} + Servicegebühr ${euro(storno.servicegebuehrCents)}`
              : 'Warenpreis'}
          </p>
          <div aria-hidden="true" className="my-2 h-px bg-border" />
          <p className="flex items-baseline gap-3 text-[15px]">
            <span>Von deiner nächsten Auszahlung abgezogen</span>
            <span className="ml-auto font-semibold tabular-nums">{euro(storno.vomHofCents)}</span>
          </p>
          <p className={cn('text-[12.5px]', LEISE)}>
            {storno.provisionCents > 0
              ? 'Das ist der Warenpreis ohne die Provision.'
              : 'Das ist genau der Warenpreis, den du für diese Bestellung bekommen hast.'}
            {storno.servicegebuehrCents > 0 ? ' Die Servicegebühr erstattet FarmerZone.' : ''}
          </p>
        </div>
      ) : (
        <p className="rounded-xl border border-border bg-background px-4 py-3.5 text-[13.5px]">
          {bestellung.vorOrt
            ? 'Bei Barzahlung wird nichts erstattet – die Bestellung entfällt einfach.'
            : 'Es wurde noch nichts bezahlt – die Bestellung entfällt einfach.'}
        </p>
      )}

      <div>
        <label htmlFor={`storno-grund-${bestellung.id}`} className={FELD_LABEL}>
          Grund für {kunde.vorname} (kommt in die E-Mail, freiwillig)
        </label>
        <textarea
          id={`storno-grund-${bestellung.id}`}
          rows={2}
          value={grund}
          onChange={(e) => setGrund(e.target.value)}
          aria-invalid={zuLang || undefined}
          placeholder="Zum Beispiel: Die Karotten sind leider ausgegangen."
          className={cn(FELD, 'min-h-[72px] resize-none')}
        />
        <ZeichenZaehler laenge={[...grund.trim()].length} max={STORNO_GRUND_MAX} />
      </div>

      <p className={cn('text-[12.5px]', LEISE)}>
        Die Ware kommt automatisch zurück in deinen Vorrat
        {fehlende > 0 ? ' – fehlende Artikel nicht, die waren ja nicht da.' : '.'}
      </p>
      <DialogFehler text={fehler} />
    </BestellDialog>
  )
}
