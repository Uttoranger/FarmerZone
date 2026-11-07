'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { meldeArtikelFehlt } from '@/server/actions/orders'
import { aktionOhneWurf } from '@/components/mein-hof/abschnitt-speichern'
import type { HofBestellDetail } from '@/server/queries/orders'
import { artikelFehltZeilen } from '@/lib/artikel-fehlt'
import { centsAlsEuro } from '@/lib/servicegebuehr'
import { formatEuro } from '@/lib/format'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RUNDUNG } from '@/components/ui/rundung'
import { BestellDialog, DialogFehler } from './bestell-dialog'
import { LEISE, TEXT_ORANGE } from './stil'

const euro = (cents: number): string => formatEuro(centsAlsEuro(cents))

/**
 * „Was fehlt bei …?" (Board s1-/w1-bestellung Bild 3, Lauf 31; E14). Die
 * Positionen in einer Karte mit Kästchen: Ein Tipp markiert, was fehlt (eine
 * je Speichern — mehrere nacheinander, jedes Mal vom neuen Stand), der
 * Betrag darunter passt sich an („Neu zu kassieren: € … statt € …“ bzw. was
 * die Kundin zurückbekommt und was vom Hof abgezogen wird) — gerechnet hat der
 * Server (fehltVorschau, src/lib/artikel-fehlt.ts); beim Speichern rechnet er
 * unter der Sperre neu. Hauptaktion „Ohne <Artikel> übergeben“, darunter der
 * Weg „Ganze Bestellung stornieren …“ (öffnet den Storno-Dialog).
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
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, starte] = useTransition()
  const { kunde } = bestellung

  const position = bestellung.positionen.find((p) => p.id === gewaehlt) ?? null
  const vorschau = position?.fehltVorschau ?? null
  const letzter = vorschau?.art === 'storno'
  const zeilen = vorschau ? artikelFehltZeilen(vorschau, kunde.vorname) : null
  const vorOrt = vorschau?.art === 'teil' && vorschau.zahlung === 'vor_ort'

  function speichern() {
    if (letzter) {
      onStornoWaehlen()
      return
    }
    if (!gewaehlt) return
    setFehler(null)
    starte(async () => {
      // Ohne Wurf (Register N29): Ohne Netz steht der Netzsatz im Dialog.
      const ergebnis = await aktionOhneWurf(() => meldeArtikelFehlt({ orderId: bestellung.id, itemId: gewaehlt }), { unsicher: true })
      if (ergebnis.error) {
        setFehler(ergebnis.error)
        return
      }
      onOffenChange(false)
      setGewaehlt(null)
      toast(
        ergebnis.erstattetCents
          ? `Gespeichert. ${kunde.vorname} bekommt ${euro(ergebnis.erstattetCents)} zurück und eine E-Mail.`
          : `Gespeichert. Neu zu kassieren: ${euro(ergebnis.neuGesamtCents ?? 0)}. ${kunde.vorname} bekommt eine E-Mail.`
      )
    })
  }

  return (
    <BestellDialog
      mitte
      offen={offen}
      onOffenChange={(o) => {
        if (!o) setFehler(null)
        onOffenChange(o)
      }}
      breite="breit"
      titel={`Was fehlt bei ${kunde.name}?`}
      hauptaktion={{
        text: letzter ? 'Weiter zum Stornieren' : position ? `Ohne ${artikelName(position.zeile)} übergeben` : 'Artikel antippen',
        onClick: speichern,
        ton: letzter ? 'orange' : 'haupt',
        laeuft,
        gesperrt: !gewaehlt,
      }}
      nebenaktion={
        !letzter && (
          <button type="button" onClick={onStornoWaehlen} disabled={laeuft} className={cn(TEXT_ORANGE, 'text-foreground')}>
            Ganze Bestellung stornieren …
          </button>
        )
      }
    >
      <fieldset className="min-w-0">
        <legend className={cn('mb-2.5 text-[14px] leading-snug', LEISE)}>Tipp an, was du nicht mitgeben kannst. Der Betrag wird automatisch angepasst.</legend>
        <ul className="overflow-hidden rounded-[14px] border border-border bg-card">
          {bestellung.positionen.map((p) => {
            const fehlt = p.fehlt || p.id === gewaehlt
            return (
              <li key={p.id} className="border-t border-border first:border-t-0">
                {/* Ein Kästchen je Position; gewählt wird genau eine (Radio darunter, Pfeiltasten wählen). */}
                <label
                  className={cn(
                    'flex min-h-14 cursor-pointer items-center gap-3.5 px-3.5 py-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-[-2px] has-[:focus-visible]:outline-ring has-[:focus-visible]:outline-solid',
                    p.fehlt && 'cursor-default',
                    p.id === gewaehlt && 'bg-zustand-tun-grund'
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
                  <span
                    aria-hidden="true"
                    className={cn('flex size-7 shrink-0 items-center justify-center rounded-[6px]', fehlt ? 'bg-status-offen text-card' : 'border-2 border-input bg-card')}
                  >
                    {fehlt && <Check className="size-5" strokeWidth={2.4} />}
                  </span>
                  <span className={cn('min-w-0 flex-1 text-[15px] break-words', fehlt && 'text-muted-foreground line-through')}>{p.zeile}</span>
                  {fehlt && <span className="shrink-0 text-[13px] font-bold text-status-offen">{p.fehlt ? 'fehlt schon' : 'fehlt'}</span>}
                  <span className={cn('shrink-0 text-[14px] tabular-nums', LEISE)}>{euro(p.betragCents)}</span>
                </label>
              </li>
            )
          })}
        </ul>
      </fieldset>

      {letzter && (
        <p className={cn(RUNDUNG.hinweis, 'border border-primary/45 bg-primary/12 px-4 py-3 text-[14px]')}>
          Das ist der letzte Artikel. Ohne ihn bleibt nichts übrig – die ganze Bestellung wird storniert.
        </p>
      )}

      {zeilen && !letzter && (
        <div aria-live="polite" className="flex flex-col gap-1">
          {vorOrt ? (
            // Board: „Neu zu kassieren: € 12,54 statt € 17,31“ — dieselben Beträge wie bisher, nur in einem Satz.
            <p className="text-[15px]">
              Neu zu kassieren: <span className="font-bold tabular-nums">{zeilen.neu.betrag}</span> statt {zeilen.bisher.betrag}
            </p>
          ) : (
            <>
              <p className="flex items-baseline gap-3 text-[14px]">
                <span>{zeilen.bisher.text}</span>
                <span className="ml-auto font-bold tabular-nums">{zeilen.bisher.betrag}</span>
              </p>
              <p className="flex items-baseline gap-3 text-[14px]">
                <span className="min-w-0">{zeilen.neu.text}</span>
                <span className="ml-auto font-bold whitespace-nowrap tabular-nums">{zeilen.neu.betrag}</span>
              </p>
            </>
          )}
          {zeilen.saetze.map((satz) => (
            <p key={satz} className={cn('text-[13px]', LEISE)}>
              {satz}
            </p>
          ))}
        </div>
      )}
      <DialogFehler text={fehler} />
    </BestellDialog>
  )
}

/** „Freilandeier · 10 Stk.“ → „Freilandeier“ — der Name im Knopf (Board: „Ohne Freilandeier übergeben“). */
function artikelName(zeile: string): string {
  return zeile.split(' · ')[0] || zeile
}
