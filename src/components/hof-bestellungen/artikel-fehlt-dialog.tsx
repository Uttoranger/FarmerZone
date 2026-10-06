'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { meldeArtikelFehlt } from '@/server/actions/orders'
import type { HofBestellDetail } from '@/server/queries/orders'
import { artikelFehltZeilen } from '@/lib/artikel-fehlt'
import { centsAlsEuro } from '@/lib/servicegebuehr'
import { formatEuro } from '@/lib/format'
import { cn } from '@/lib/utils'
import { BestellDialog, DialogFehler } from './bestell-dialog'
import { LEISE } from './stil'

const euro = (cents: number): string => formatEuro(centsAlsEuro(cents))

// Zeile mit verstecktem Radio: Die Tastatur wählt mit den Pfeiltasten, der
// Rahmen zeigt den Fokus der Zeile (outline-solid, FOKUS_RAHMEN-Regel).
const WAHL_ZEILE =
  'flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring'

/**
 * „Was fehlt bei …?" (Mockup web-h3-artikel-fehlt, E14). Eine Position wählen,
 * dann „Ohne diesen Artikel übergeben" (Teilstorno) oder „Ganze Bestellung
 * stornieren" (öffnet den Storno-Dialog). Der Betragsblock zeigt VOR dem
 * Speichern den neuen Barbetrag bzw. was die Kundin zurückbekommt und was vom
 * Hof abgezogen wird — gerechnet hat der Server (fehltVorschau,
 * src/lib/artikel-fehlt.ts); beim Speichern rechnet er unter der Sperre neu.
 * Mehrere fehlende Artikel: nacheinander, jedes Mal vom neuen Stand.
 */
export function ArtikelFehltDialog({
  bestellung,
  offen,
  onOffenChange,
  onStornoWaehlen,
}: {
  bestellung: HofBestellDetail
  offen: boolean
  onOffenChange: (offen: boolean) => void
  onStornoWaehlen: () => void
}): React.JSX.Element {
  const offenePositionen = bestellung.positionen.filter((p) => !p.fehlt)
  const [gewaehlt, setGewaehlt] = useState<string | null>(offenePositionen.length === 1 ? offenePositionen[0].id : null)
  const [weg, setWeg] = useState<'ohne' | 'storno'>('ohne')
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, starte] = useTransition()
  const { kunde } = bestellung

  const position = bestellung.positionen.find((p) => p.id === gewaehlt) ?? null
  const vorschau = position?.fehltVorschau ?? null
  const letzter = vorschau?.art === 'storno'
  const stornieren = weg === 'storno' || letzter
  const zeilen = vorschau ? artikelFehltZeilen(vorschau, kunde.vorname) : null

  function speichern() {
    if (stornieren) {
      onStornoWaehlen()
      return
    }
    if (!gewaehlt) return
    setFehler(null)
    starte(async () => {
      const ergebnis = await meldeArtikelFehlt({ orderId: bestellung.id, itemId: gewaehlt })
      if (ergebnis.error) {
        setFehler(ergebnis.error)
        return
      }
      onOffenChange(false)
      setGewaehlt(null)
      toast.success(
        ergebnis.erstattetCents
          ? `Gespeichert. ${kunde.vorname} bekommt ${euro(ergebnis.erstattetCents)} zurück und eine E-Mail.`
          : `Gespeichert. Neu zu kassieren: ${euro(ergebnis.neuGesamtCents ?? 0)}. ${kunde.vorname} bekommt eine E-Mail.`
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
      breite="breit"
      titel={`Was fehlt bei ${kunde.name}?`}
      unterzeile={`${bestellung.nummer} · ${bestellung.abholung}`}
      hauptaktion={{
        text: stornieren ? 'Weiter zum Stornieren' : `Änderung speichern und ${kunde.vorname} informieren`,
        onClick: speichern,
        ton: stornieren ? 'orange' : 'gruen',
        laeuft,
        gesperrt: !gewaehlt && !stornieren,
      }}
    >
      <fieldset className="min-w-0">
        <legend className={cn('mb-2 text-[13px]', LEISE)}>Tipp auf den Artikel, der fehlt.</legend>
        <ul className="flex flex-col gap-2">
          {bestellung.positionen.map((p) => {
            const fehlt = p.fehlt || p.id === gewaehlt
            return (
              <li key={p.id}>
                <label
                  className={cn(
                    WAHL_ZEILE,
                    p.fehlt && 'cursor-default opacity-80',
                    p.id === gewaehlt ? 'border-primary/70 bg-primary/12' : 'border-border'
                  )}
                >
                  <input
                    type="radio"
                    name={`fehlt-${bestellung.id}`}
                    value={p.id}
                    checked={p.id === gewaehlt}
                    disabled={p.fehlt}
                    onChange={() => setGewaehlt(p.id)}
                    className="sr-only"
                  />
                  <span className={cn('min-w-0 flex-1 text-[14.5px] break-words', fehlt && 'text-muted-foreground line-through')}>
                    {p.zeile}
                  </span>
                  <span className={cn('shrink-0 text-[13px] tabular-nums', LEISE)}>{euro(p.betragCents)}</span>
                  <span
                    className={cn(
                      'shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                      fehlt ? 'border-primary/70 bg-primary/16 text-foreground' : 'border-border text-muted-foreground'
                    )}
                  >
                    {p.fehlt ? 'fehlt schon' : fehlt ? 'fehlt' : 'da'}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      </fieldset>

      {letzter ? (
        <p className="rounded-xl border border-primary/45 bg-primary/12 px-4 py-3 text-[13.5px]">
          Das ist der letzte Artikel. Ohne ihn bleibt nichts übrig – die ganze Bestellung wird storniert.
        </p>
      ) : (
        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="sr-only">Wie geht es weiter?</legend>
          <label className={cn(WAHL_ZEILE, 'items-start', weg === 'ohne' ? 'border-accent/60 bg-accent/12' : 'border-border')}>
            <input type="radio" name={`weg-${bestellung.id}`} checked={weg === 'ohne'} onChange={() => setWeg('ohne')} className="mt-1 size-4 accent-accent" />
            <span>
              <span className="block text-sm font-semibold">Ohne diesen Artikel übergeben</span>
              <span className={cn('block text-[12.5px]', LEISE)}>
                {kunde.vorname} bekommt eine E-Mail mit der Änderung, bevor sie losfährt.
              </span>
            </span>
          </label>
          <label className={cn(WAHL_ZEILE, 'items-start', weg === 'storno' ? 'border-primary/60 bg-primary/12' : 'border-border')}>
            <input type="radio" name={`weg-${bestellung.id}`} checked={weg === 'storno'} onChange={() => setWeg('storno')} className="mt-1 size-4 accent-primary" />
            <span>
              <span className="block text-sm font-semibold">Ganze Bestellung stornieren</span>
              <span className={cn('block text-[12.5px]', LEISE)}>Wenn ohne den Artikel nichts übrig bleibt, was sich lohnt.</span>
            </span>
          </label>
        </fieldset>
      )}

      {zeilen && !stornieren && (
        <div aria-live="polite" className="flex flex-col gap-1.5 rounded-xl border border-primary/40 bg-primary/8 px-4 py-3.5">
          <p className="flex items-baseline gap-3 text-[13.5px]">
            <span className={LEISE}>{zeilen.bisher.text}</span>
            <span className="ml-auto font-semibold tabular-nums">{zeilen.bisher.betrag}</span>
          </p>
          <p className="flex items-baseline gap-3 text-[15px]">
            <span className="min-w-0">{zeilen.neu.text}</span>
            <span className="ml-auto font-heading text-lg font-semibold whitespace-nowrap text-status-offen tabular-nums">{zeilen.neu.betrag}</span>
          </p>
          {zeilen.saetze.map((satz) => (
            <p key={satz} className={cn('text-[12.5px]', LEISE)}>
              {satz}
            </p>
          ))}
        </div>
      )}
      <DialogFehler text={fehler} />
    </BestellDialog>
  )
}
