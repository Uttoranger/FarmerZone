'use client'

import { useState } from 'react'
import { ArrowDownUp } from 'lucide-react'
import { BestellDialog } from '@/components/hof-bestellungen/bestell-dialog'
import { KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'
import { KUNDEN_SORTIERUNG_LABEL, SORTIEREN_TEXT, andereRichtung, richtungText, sortierungBeschreibung } from '@/lib/hof-kunden'
import { KUNDEN_SORTIERUNG_WERTE, STANDARD_RICHTUNG, type KundenRichtung, type KundenSortierung } from '@/schemas/hof-kunden'
import { cn } from '@/lib/utils'

/*
 * Die Sortierung der Kundenliste hinter EINEM Knopf „Sortieren"
 * (freigabe.md §12 Nr. 45) — vorher standen Auswahlliste und Richtungsknopf
 * offen neben den Filtern. Dahinter ab 768 px ein Dialog, darunter ein Blatt
 * (BestellDialog, DESIGN_SYSTEM „Dialoge und Blätter"), eine Sortierwahl für
 * alle Breiten (Register F6). Gewählt wird erst mit „Übernehmen";
 * „Abbrechen" lässt die Liste, wie sie war. Was die Wahl bedeutet, entscheidet
 * src/lib/hof-kunden.ts (Sortierung, Standardrichtung, Wortlaute).
 */

const WAHL_ZEILE =
  'flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm font-medium text-foreground has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring'

function wahlKlassen(gewaehlt: boolean): string {
  // Gewählt grün umrandet und getönt wie die Wahl im Dialog „Artikel fehlt"; Text in normaler Textfarbe.
  return cn(WAHL_ZEILE, gewaehlt ? 'border-accent/60 bg-accent/12' : 'border-border hover:bg-muted')
}

export type KundenSortierWahl = { sortierung: KundenSortierung; richtung: KundenRichtung }

/**
 * Der Inhalt des Blatts: wonach sortiert wird und in welcher Reihenfolge —
 * echte Radioknöpfe (Pfeiltasten, eine Gruppe je Frage). Die Richtung heißt,
 * was sie bei dieser Sortierung tut („Meiste zuerst", „A bis Z"), die
 * Standardrichtung steht oben.
 */
export function SortierFelder({
  sortierung,
  richtung,
  onSortierung,
  onRichtung,
}: KundenSortierWahl & {
  onSortierung: (sortierung: KundenSortierung) => void
  onRichtung: (richtung: KundenRichtung) => void
}): React.JSX.Element {
  const standard = STANDARD_RICHTUNG[sortierung]
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <fieldset className="min-w-0">
        <legend className="mb-2 text-[13px] font-semibold text-muted-foreground">Sortieren nach</legend>
        <div className="flex flex-col gap-2">
          {KUNDEN_SORTIERUNG_WERTE.map((s) => (
            <label key={s} className={wahlKlassen(s === sortierung)}>
              <input
                type="radio"
                name="kunden-sortierung"
                value={s}
                checked={s === sortierung}
                onChange={() => onSortierung(s)}
                className="size-4 shrink-0 cursor-pointer accent-accent outline-none"
              />
              {KUNDEN_SORTIERUNG_LABEL[s]}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="min-w-0">
        <legend className="mb-2 text-[13px] font-semibold text-muted-foreground">Reihenfolge</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {[standard, andereRichtung(standard)].map((r) => (
            <label key={r} className={wahlKlassen(r === richtung)}>
              <input
                type="radio"
                name="kunden-richtung"
                value={r}
                checked={r === richtung}
                onChange={() => onRichtung(r)}
                className="size-4 shrink-0 cursor-pointer accent-accent outline-none"
              />
              {richtungText(sortierung, r)}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  )
}

/** Der Knopf „Sortieren" und sein Blatt. `onWaehle` schreibt die Wahl in die Adresse. */
export function KundenSortieren({
  sortierung,
  richtung,
  onWaehle,
}: KundenSortierWahl & { onWaehle: (wahl: KundenSortierWahl) => void }): React.JSX.Element {
  const [offen, setOffen] = useState(false)
  const [entwurf, setEntwurf] = useState<KundenSortierWahl>({ sortierung, richtung })

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => {
          // Jedes Öffnen beginnt beim Stand der Liste — ein abgebrochener Entwurf bleibt nicht hängen.
          setEntwurf({ sortierung, richtung })
          setOffen(true)
        }}
        className={KNOPF_RAHMEN}
      >
        <ArrowDownUp className="size-4" strokeWidth={1.7} aria-hidden="true" />
        {SORTIEREN_TEXT}
        <span className="sr-only">, jetzt: {sortierungBeschreibung(sortierung, richtung)}</span>
      </button>
      <BestellDialog
        offen={offen}
        onOffenChange={setOffen}
        titel={SORTIEREN_TEXT}
        hauptaktion={{
          text: 'Übernehmen',
          ton: 'gruen',
          onClick: () => {
            onWaehle(entwurf)
            setOffen(false)
          },
        }}
      >
        <SortierFelder
          sortierung={entwurf.sortierung}
          richtung={entwurf.richtung}
          // Eine neue Sortierung beginnt in ihrer Standardrichtung (Name A–Z, sonst das Größte zuerst).
          onSortierung={(s) => setEntwurf({ sortierung: s, richtung: STANDARD_RICHTUNG[s] })}
          onRichtung={(r) => setEntwurf((e) => ({ ...e, richtung: r }))}
        />
      </BestellDialog>
    </>
  )
}
