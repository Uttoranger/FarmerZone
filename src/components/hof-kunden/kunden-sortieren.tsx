'use client'

import { useState } from 'react'
import { BestellDialog } from '@/components/hof-bestellungen/bestell-dialog'
import { KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'
import { KICKER_12 } from '@/components/mein-hof/kicker-12'
import {
  KUNDEN_FILTER_LABEL,
  ZEIGEN_REIHENFOLGE,
  KUNDEN_SORTIERUNG_LABEL,
  SORTIEREN_TEXT,
  ZEIGEN_TEXT,
  blattAdresse,
  blattStart,
  mitSortierung,
  richtungText,
  richtungenFuer,
  sortierungBeschreibung,
  type KundenBlattWahl,
} from '@/lib/hof-kunden'
import {
  KUNDEN_SORTIERUNG_WERTE,
  type KundenAnsicht,
  type KundenFilter,
  type KundenRichtung,
  type KundenSortierung,
} from '@/schemas/hof-kunden'
import { cn } from '@/lib/utils'

/*
 * Die Sortierung der Kundenliste hinter EINEM Knopf „Sortieren"
 * (freigabe.md §12 Nr. 45) — vorher standen Auswahlliste und Richtungsknopf
 * offen neben den Filtern. Dahinter ab 768 px ein Dialog, darunter ein Blatt
 * (BestellDialog, DESIGN_SYSTEM „Dialoge und Blätter"), eine Sortierwahl für
 * alle Breiten (Register F6). Im selben Blatt der Abschnitt „Zeigen" mit allen
 * fünf Filtern — als Chips stehen nur zwei da (Runde 1). Gewählt wird erst mit
 * „Übernehmen"; „Abbrechen" lässt die Liste, wie sie war. Was die Wahl
 * bedeutet, entscheidet src/lib/hof-kunden.ts (blattStart, mitSortierung,
 * blattAdresse, Wortlaute).
 */

const WAHL_ZEILE =
  'flex min-h-12 cursor-pointer items-center gap-3 rounded-[10px] border px-3.5 py-2.5 text-sm font-semibold text-foreground has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring'

function wahlKlassen(gewaehlt: boolean): string {
  // Gewählt orange umrandet und getönt (V51: Hofbereich orange; Liste Lauf 32 kunden); Text in normaler Textfarbe.
  return cn(WAHL_ZEILE, gewaehlt ? 'border-primary bg-primary/12' : 'border-border hover:bg-muted')
}

const LEGENDE = cn(KICKER_12, 'mb-2')
const RADIO = 'size-4 shrink-0 cursor-pointer accent-primary outline-none'

/**
 * Der Inhalt des Blatts: wonach sortiert wird, in welcher Reihenfolge und wen
 * die Liste zeigt — echte Radioknöpfe (Pfeiltasten, eine Gruppe je Frage). Die
 * Richtung heißt, was sie bei dieser Sortierung tut („Meiste zuerst", „A bis
 * Z"), die Standardrichtung steht oben; jeder Filter trägt seine Zahl wie sein Chip.
 */
export function SortierFelder({
  sortierung,
  richtung,
  filter,
  zahlen,
  onSortierung,
  onRichtung,
  onFilter,
}: KundenBlattWahl & {
  zahlen: Record<KundenFilter, number>
  onSortierung: (sortierung: KundenSortierung) => void
  onRichtung: (richtung: KundenRichtung) => void
  onFilter: (filter: KundenFilter) => void
}): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <fieldset className="min-w-0">
        <legend className={LEGENDE}>Sortieren nach</legend>
        {/* Zweispaltig (Board s2-/w2-kunden Bild 2). */}
        <div className="grid grid-cols-2 gap-2">
          {KUNDEN_SORTIERUNG_WERTE.map((s) => (
            <label key={s} className={cn(wahlKlassen(s === sortierung), 'min-w-0')}>
              <input
                type="radio"
                name="kunden-sortierung"
                value={s}
                checked={s === sortierung}
                onChange={() => onSortierung(s)}
                className={RADIO}
              />
              {KUNDEN_SORTIERUNG_LABEL[s]}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="min-w-0">
        <legend className={LEGENDE}>Reihenfolge</legend>
        <div className="grid grid-cols-2 gap-2">
          {richtungenFuer(sortierung).map((r) => (
            <label key={r} className={cn(wahlKlassen(r === richtung), 'min-w-0')}>
              <input
                type="radio"
                name="kunden-richtung"
                value={r}
                checked={r === richtung}
                onChange={() => onRichtung(r)}
                className={RADIO}
              />
              {richtungText(sortierung, r)}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="min-w-0">
        <legend className={LEGENDE}>{ZEIGEN_TEXT}</legend>
        <div className="grid grid-cols-2 gap-2">
          {ZEIGEN_REIHENFOLGE.map((f) => (
            <label key={f} className={cn(wahlKlassen(f === filter), 'min-w-0')}>
              <input
                type="radio"
                name="kunden-filter"
                value={f}
                checked={f === filter}
                onChange={() => onFilter(f)}
                className={RADIO}
              />
              <span className="min-w-0">
                {KUNDEN_FILTER_LABEL[f]}
                <span className="ml-1 tabular-nums">· {zahlen[f]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  )
}

/** Der Knopf „Sortieren" und sein Blatt. `onAdresse` schreibt die übernommene Wahl in die Adresse. */
export function KundenSortieren({
  ansicht,
  zahlen,
  onAdresse,
}: {
  /** Was die Liste gerade zeigt — mit der Suche, die beim Übernehmen bleibt. */
  ansicht: KundenAnsicht
  zahlen: Record<KundenFilter, number>
  onAdresse: (adresse: string) => void
}): React.JSX.Element {
  const [offen, setOffen] = useState(false)
  const [entwurf, setEntwurf] = useState<KundenBlattWahl>(() => blattStart(ansicht))

  function schliesse(aktion: 'uebernehmen' | 'abbrechen') {
    const adresse = blattAdresse(ansicht, entwurf, aktion)
    if (adresse !== null) onAdresse(adresse)
    setOffen(false)
  }

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => {
          setEntwurf(blattStart(ansicht))
          setOffen(true)
        }}
        className={KNOPF_RAHMEN}
      >
        {SORTIEREN_TEXT}
        <span className="sr-only">, jetzt: {sortierungBeschreibung(ansicht.sortierung, ansicht.richtung)}</span>
      </button>
      <BestellDialog
        offen={offen}
        onOffenChange={(auf) => (auf ? setOffen(true) : schliesse('abbrechen'))}
        titel={SORTIEREN_TEXT}
        // „Abbrechen“ oben rechts mit dem Startfokus, abgedunkelt statt weichgezeichnet, Hauptknopf orange (Liste Lauf 32 kunden).
        mitte
        hauptaktion={{ text: 'Übernehmen', ton: 'haupt', onClick: () => schliesse('uebernehmen') }}
      >
        <SortierFelder
          {...entwurf}
          zahlen={zahlen}
          onSortierung={(s) => setEntwurf((e) => mitSortierung(e, s))}
          onRichtung={(r) => setEntwurf((e) => ({ ...e, richtung: r }))}
          onFilter={(f) => setEntwurf((e) => ({ ...e, filter: f }))}
        />
      </BestellDialog>
    </>
  )
}
