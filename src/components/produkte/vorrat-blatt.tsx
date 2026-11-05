/** Vorrat ändern: am Handy im Blatt, ab 768 px im zentrierten Dialog (Boards s1/w1-produkte, Bild 2). */
'use client'

import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogMitte } from '@/components/ui/dialog'
import { Sheet, SheetBlatt, SheetKopf } from '@/components/ui/sheet'
import { Stepper } from '@/components/ui/stepper'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { useVorratSetzen } from '@/components/produkte/use-vorrat-setzen'
import { VORRAT_MAX } from '@/lib/eingabegrenzen'
import { bestandLabel, formatZahl, hofVorratText } from '@/lib/format'
import {
  VORRAT_AUSVERKAUFT_KNOPF,
  VORRAT_DAZU,
  VORRAT_DAZU_TITEL,
  VORRAT_NULL_SATZ,
  vorratFrage,
  vorratTitel,
} from '@/lib/produkte-hof'
import { useMindestbreite } from '@/lib/use-mindestbreite'
import { cn } from '@/lib/utils'
import type { ProductData } from '@/server/queries/products'

/*
 * Vorrat ändern (Register N25; Boards s1/w1-produkte, Bild 2, Lauf 30). Es
 * steht EINMAL in ProdukteAnsicht und öffnet sich mit dem Produkt: Wechselt
 * ein Produkt nach dem Speichern den Abschnitt, baut React seine Zeile neu —
 * ein Blatt in der Zeile verlöre dabei Fokus, Satz und den Moment „wieder da".
 *
 * Gesetzt wird über `useVorratSetzen`: immer ein neuer Wert mit `vorher`, nie
 * eine Erhöhung auf dem Server. Seit Lauf 30 auch aus der Tabelle (der Vorrat
 * ist dort ein Knopf wie in den Zeilen, Board w1-produkte).
 *
 * Form nach „Dialoge und Blätter" (N41 d): am Handy das Blatt von unten mit
 * Griff, oben Titel und genau ein „Abbrechen", „Speichern" orange über die
 * volle Breite; ab 768 px DialogMitte (≤ 560 px) mit „Abbrechen" oben und
 * „Speichern" am Ende. Inhalt nach dem Board: Frage in der Einheit des Vorrats,
 * Stepper, der Satz zu 0. Dazu „Dazu +5 +10 +25 +50" und „Ausverkauft", die
 * das Board nicht zeigt: Register N25 nennt beide wörtlich, und bei Widerspruch
 * gilt das Register (Entscheidung im Nachtlauf 30, Nr. 223, Runde 1). Das Feld
 * nimmt `inputMode="numeric"` — der Vorrat ist eine ganze Zahl.
 */
export function VorratBlatt({
  produkt,
  offen,
  onSchliessen,
  onWiederDa,
  fokusZiel,
}: {
  produkt: ProductData
  offen: boolean
  onSchliessen: () => void
  /** Der Server hat 0 → mehr bestätigt; kommt erst, wenn das Blatt zu ist. */
  onWiederDa: (vorrat: number) => void
  /** Der Vorrat-Knopf dieses Produkts, gesucht beim Schließen — auch nach einem Wechsel des Abschnitts. */
  fokusZiel: () => HTMLElement | null
}): React.JSX.Element {
  const breit = useMindestbreite(768)
  const frage = useRef<HTMLParagraphElement>(null)
  // Erst schließt das Vorrat-Blatt, dann öffnet der Moment (am Handy selbst ein Blatt).
  const momentDanach = useRef<number | null>(null)
  const { anzeige, setAnzeige, bestaetigt, laeuft, fehler, senden } = useVorratSetzen({
    productId: produkt.id,
    stock: produkt.stock,
    onWiederDa: (vorrat) => {
      momentDanach.current = vorrat
    },
  })
  // Ein Altbestand über der Grenze bleibt sichtbar und darf sinken (src/schemas/vorrat.ts).
  const max = Math.max(VORRAT_MAX, bestaetigt)
  const vorratText = (n: number) => hofVorratText(n, produkt.unit, produkt.unitSize)
  // Die Einheit neben der großen Zahl: der Text ohne die Zahl davor („Pakete", „Paket", „kg").
  const einheit = vorratText(anzeige).slice(formatZahl(anzeige).length + 1)

  async function speichern(ziel: number): Promise<void> {
    const ausgang = await senden(ziel)
    // Abgewiesen (inzwischen bestellt) oder Fehler: Das Blatt bleibt offen, der Satz steht darin.
    if (ausgang.art === 'ok' || ausgang.art === 'unveraendert') onSchliessen()
    // Der gedrückte Knopf war während der Anfrage gesperrt und hat den Fokus an body verloren:
    // zurück an die Frage; den Satz sagt die Live-Region an.
    else if (ausgang.art === 'abgewiesen') frage.current?.focus()
  }

  function nachDemSchliessen(): void {
    // Wurde die Zeile beim Speichern neu gebaut, stand der Fokus kurz auf body — zurück auf den Knopf.
    const ziel = fokusZiel()
    if (ziel && (document.activeElement === null || document.activeElement === document.body)) ziel.focus()
    const vorrat = momentDanach.current
    momentDanach.current = null
    if (vorrat !== null) onWiederDa(vorrat)
  }

  const wechsel = (auf: boolean) => {
    // Solange gespeichert wird, schließt nichts (Escape, Tipp daneben, „Abbrechen").
    if (!auf && !laeuft) onSchliessen()
  }
  const fertig = (auf: boolean) => {
    if (!auf) nachDemSchliessen()
  }

  const inhalt = (
    <>
      <p ref={frage} tabIndex={-1} className="text-[15px] leading-snug text-muted-foreground outline-none">
        {vorratFrage(produkt.unit, produkt.unitSize)}
      </p>
      <div className="flex flex-col items-center gap-1">
        <Stepper
          gross
          beschriftung={bestandLabel(produkt.unit, produkt.unitSize)}
          wert={anzeige}
          onWertChange={setAnzeige}
          min={0}
          max={max}
          laeuft={laeuft}
          inputMode="numeric"
          einheit={einheit}
        />
        {/* Hat inzwischen jemand bestellt, zeigt das Feld den Stand des Servers — „vorher" sagt, wovon es ausgeht. */}
        {bestaetigt !== produkt.stock && <p className="text-[12.5px] text-muted-foreground">vorher {vorratText(bestaetigt)}</p>}
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-[12.5px] text-muted-foreground">{VORRAT_DAZU_TITEL}</p>
        <div className="grid grid-cols-4 gap-2">
          {VORRAT_DAZU.map((n) => (
            <button
              key={n}
              type="button"
              disabled={laeuft}
              // Nur das Feld; gespeichert wird erst mit „Speichern".
              onClick={() => setAnzeige(Math.min(anzeige + n, max))}
              className={cn('h-11 rounded-xl border border-input text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50', FOKUS_RAHMEN)}
            >
              {`+${n}`}
            </button>
          ))}
        </div>
      </div>
      <p className="text-[13.5px] leading-normal text-muted-foreground">{VORRAT_NULL_SATZ}</p>
      {/* Ständig vorhanden, damit der Screenreader die Meldung ansagt, sobald sie kommt. */}
      <p aria-live="polite" className={cn('text-sm leading-snug font-semibold text-status-offen', !fehler && 'sr-only')}>
        {fehler}
      </p>
    </>
  )

  // Hauptknopf im Hofbereich orange (N42 a) — der Grundbaustein in seiner Standardfarbe.
  const speichernKnopf = (klassen: string) => (
    <Button type="button" disabled={laeuft} aria-busy={laeuft || undefined} onClick={() => void speichern(anzeige)} className={klassen}>
      {laeuft ? 'Speichert …' : 'Speichern'}
    </Button>
  )
  // „Ausverkauft" als Umriss neben bzw. über der Hauptaktion: speichert sofort 0.
  const ausverkauftKnopf = (klassen: string) => (
    <Button type="button" variant="outline" disabled={laeuft} onClick={() => void speichern(0)} className={klassen}>
      {VORRAT_AUSVERKAUFT_KNOPF}
    </Button>
  )

  if (breit) {
    return (
      <Dialog open={offen} onOpenChange={wechsel} onOpenChangeComplete={fertig}>
        <DialogMitte titel={vorratTitel(produkt.name)} schliessen="Abbrechen" initialFocus={frage} finalFocus={() => fokusZiel() ?? true} className="gap-4">
          {inhalt}
          <div className="flex justify-end gap-2">
            {ausverkauftKnopf('h-11 rounded-full px-5 text-[15px] font-semibold')}
            {speichernKnopf('h-11 min-w-[120px] rounded-full px-5 text-[15px] font-semibold')}
          </div>
        </DialogMitte>
      </Dialog>
    )
  }

  return (
    <Sheet open={offen} onOpenChange={wechsel} onOpenChangeComplete={fertig}>
      <SheetBlatt initialFocus={frage} finalFocus={() => fokusZiel() ?? true} className="gap-4">
        <SheetKopf titel={vorratTitel(produkt.name)} schliessen="Abbrechen" className="break-words" />
        {inhalt}
        <div className="flex flex-col gap-2">
          {ausverkauftKnopf('h-12 w-full rounded-[14px] text-[15px] font-semibold')}
          {speichernKnopf('h-12 w-full rounded-[14px] text-[15px] font-semibold')}
        </div>
      </SheetBlatt>
    </Sheet>
  )
}
