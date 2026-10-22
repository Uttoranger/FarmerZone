/** Vorrat ändern im Blatt der Karten-Zeilen unter 1024 px (Register N25; Board system-h1-mein-hof-v3, Bildschirm B). */
'use client'

import { useRef, type ReactNode } from 'react'
import { Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetBlatt, SheetClose, SheetTitle } from '@/components/ui/sheet'
import { Stepper } from '@/components/ui/stepper'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { useVorratSetzen } from '@/components/produkte/use-vorrat-setzen'
import { LOW_STOCK_THRESHOLD } from '@/lib/dashboard-hints'
import { VORRAT_MAX } from '@/lib/eingabegrenzen'
import { bestandLabel, formatEuro, formatGebinde, formatZahl, hofVorratText } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ProductData } from '@/server/queries/products'

/** „Dazu": setzt das Feld auf den angezeigten Wert plus n — gespeichert wird erst mit „Speichern". */
export const VORRAT_DAZU = [5, 10, 25, 50] as const

/** Der Satz zur Grenze — die Zahl aus derselben Konstante, die bei der Kundin „Nur noch …" auslöst. */
export function vorratGrenzSatz(unit: string, unitSize: number | null): string {
  return `Hast du noch ${hofVorratText(LOW_STOCK_THRESHOLD, unit, unitSize)} oder weniger, steht bei der Kundin „Nur noch …“. Bei 0 kann niemand bestellen.`
}

/*
 * Vorrat ändern im Blatt (Register N25; Board system-h1-mein-hof-v3,
 * Bildschirm B). Es steht EINMAL in ProdukteAnsicht und öffnet sich mit dem
 * Produkt: Wechselt ein Produkt nach dem Speichern den Abschnitt, baut React
 * seine Zeile neu — ein Blatt in der Zeile verlöre dabei Fokus, Satz und den
 * Moment „wieder da".
 *
 * Gesetzt wird über `useVorratSetzen`, dieselbe Schleife wie in der Tabelle:
 * immer ein neuer Wert mit `vorher`, nie eine Erhöhung auf dem Server.
 *
 * Form nach DESIGN_SYSTEM „Dialoge und Blätter", nicht nach dem Board: kein
 * Kreuz, „Speichern" über die volle Breite, „Abbrechen" als Textknopf darunter,
 * „Ausverkauft" als Umriss darüber. Das Feld nimmt `inputMode="numeric"` —
 * der Vorrat ist eine ganze Zahl (das Board zeigt `decimal`).
 */
export function VorratBlatt({
  produkt,
  offen,
  bild,
  onSchliessen,
  onWiederDa,
  fokusZiel,
}: {
  produkt: ProductData
  offen: boolean
  /** Das Produktbild der Zeile — dieselbe Darstellung wie in der Liste. */
  bild: ReactNode
  onSchliessen: () => void
  /** Der Server hat 0 → mehr bestätigt; kommt erst, wenn das Blatt zu ist. */
  onWiederDa: (vorrat: number) => void
  /** Der Vorrat-Knopf dieses Produkts, gesucht beim Schließen — auch nach einem Wechsel des Abschnitts. */
  fokusZiel: () => HTMLElement | null
}): React.JSX.Element {
  const titel = useRef<HTMLHeadingElement>(null)
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
    // zurück an den Anfang des Blatts; den Satz sagt die Live-Region an.
    else if (ausgang.art === 'abgewiesen') titel.current?.focus()
  }

  function nachDemSchliessen(): void {
    // Wurde die Zeile beim Speichern neu gebaut, stand der Fokus kurz auf body — zurück auf den Knopf.
    const ziel = fokusZiel()
    if (ziel && (document.activeElement === null || document.activeElement === document.body)) ziel.focus()
    const vorrat = momentDanach.current
    momentDanach.current = null
    if (vorrat !== null) onWiederDa(vorrat)
  }

  return (
    <Sheet
      open={offen}
      onOpenChange={(auf) => {
        // Solange gespeichert wird, schließt nichts (Escape, Tipp daneben, „Abbrechen").
        if (!auf && !laeuft) onSchliessen()
      }}
      onOpenChangeComplete={(auf) => {
        if (!auf) nachDemSchliessen()
      }}
    >
      <SheetBlatt initialFocus={titel} finalFocus={() => fokusZiel() ?? true} className="gap-4">
        <div className="flex items-center gap-3">
          {bild}
          <div className="min-w-0 flex-1">
            <SheetTitle ref={titel} tabIndex={-1} className="font-heading text-xl leading-tight font-semibold break-words outline-none">
              {`Vorrat · ${produkt.name}`}
            </SheetTitle>
            <p className="text-[12.5px] text-muted-foreground">
              {formatGebinde(produkt.unit, produkt.unitSize)} · {formatEuro(produkt.price)}
            </p>
          </div>
        </div>

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
          <p className="text-[12.5px] text-muted-foreground">vorher {vorratText(bestaetigt)}</p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-[12.5px] text-muted-foreground">Dazu</p>
          <div className="grid grid-cols-4 gap-2">
            {VORRAT_DAZU.map((n) => (
              <button
                key={n}
                type="button"
                disabled={laeuft}
                onClick={() => setAnzeige(Math.min(anzeige + n, max))}
                className={cn('h-11 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50', FOKUS_RAHMEN)}
              >
                {`+${n}`}
              </button>
            ))}
          </div>
        </div>

        <p className="flex gap-2 text-[12.5px] leading-normal text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
          <span>{vorratGrenzSatz(produkt.unit, produkt.unitSize)}</span>
        </p>

        {/* Ständig vorhanden, damit der Screenreader die Meldung ansagt, sobald sie kommt. */}
        <p aria-live="polite" className={cn('text-sm leading-snug text-status-offen', !fehler && 'sr-only')}>
          {fehler}
        </p>

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={laeuft}
            onClick={() => void speichern(0)}
            className="h-12 w-full rounded-[14px] text-[15px] font-semibold"
          >
            Ausverkauft
          </Button>
          <Button
            type="button"
            disabled={laeuft}
            aria-busy={laeuft || undefined}
            onClick={() => void speichern(anzeige)}
            className="h-12 w-full rounded-[14px] text-[15px] font-semibold"
          >
            {laeuft ? 'Speichert …' : 'Speichern'}
          </Button>
          <SheetClose
            disabled={laeuft}
            className={cn('mx-auto min-h-11 rounded-full px-5 text-sm font-semibold text-brand-text hover:bg-muted disabled:opacity-60', FOKUS_RAHMEN)}
          >
            Abbrechen
          </SheetClose>
        </div>
      </SheetBlatt>
    </Sheet>
  )
}
