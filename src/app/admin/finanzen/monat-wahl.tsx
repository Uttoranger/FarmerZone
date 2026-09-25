'use client'

import { monatsschluessel, zerlegeMonat, type Monatsschluessel } from '@/lib/servicegebuehr'

/**
 * Einen Monat wählen: zwei native `<select>` statt `<input type="month">`.
 *
 * Safari kennt `type="month"` nicht und zeigt dort ein Textfeld — der Betreiber
 * müsste „2026-09" von Hand tippen und trüge sich jeden Tippfehler als Datum
 * ein. Zwei Auswahllisten können alle Browser, und bei 375 px öffnen sie das
 * gerollte Rad des Systems (dasselbe Argument wie in der Triage-Maske).
 */

const MONATSNAMEN = [
  'Jänner',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

const FELD =
  'h-11 rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30'

export function MonatWahl({
  wert,
  onChange,
  /** Jahre um diesen Monat herum zur Wahl stellen. */
  bezug,
  idPraefix,
}: {
  wert: Monatsschluessel
  onChange: (monat: Monatsschluessel) => void
  bezug: Monatsschluessel
  idPraefix: string
}) {
  // `!` sicher: `bezug` kommt von der Seite und ist dort schon durch
  // istMonatsschluessel gegangen. Der Rückfall greift nur, wenn `wert` Unsinn
  // wäre — dann steht lieber der Bezugsmonat da als eine leere Auswahl.
  const teile = zerlegeMonat(wert) ?? zerlegeMonat(bezug)!
  const bezugsJahr = (zerlegeMonat(bezug) ?? teile).jahr

  // Vier Jahre zurück, eines vor: Ein Posten kann rückdatiert eingetragen
  // werden (die Plattform hat Kosten, seit es sie gibt) und ein Jahresabo darf
  // im kommenden Jahr beginnen. Das gewählte Jahr ist immer dabei, auch wenn
  // es außerhalb der Spanne liegt — sonst fiele ein alter Posten beim
  // Bearbeiten stillschweigend auf ein anderes Jahr.
  const jahre = new Set<number>([teile.jahr])
  for (let j = bezugsJahr - 4; j <= bezugsJahr + 1; j++) jahre.add(j)
  const jahreSortiert = [...jahre].sort((a, b) => b - a)

  return (
    <div className="flex gap-2">
      <label className="sr-only" htmlFor={`${idPraefix}-monat`}>
        Monat
      </label>
      <select
        id={`${idPraefix}-monat`}
        value={teile.monat}
        onChange={(e) => onChange(monatsschluessel(teile.jahr, Number(e.target.value)))}
        className={`${FELD} flex-1`}
      >
        {MONATSNAMEN.map((name, i) => (
          <option key={name} value={i + 1}>
            {name}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor={`${idPraefix}-jahr`}>
        Jahr
      </label>
      <select
        id={`${idPraefix}-jahr`}
        value={teile.jahr}
        onChange={(e) => onChange(monatsschluessel(Number(e.target.value), teile.monat))}
        className={`${FELD} w-28`}
      >
        {jahreSortiert.map((j) => (
          <option key={j} value={j}>
            {j}
          </option>
        ))}
      </select>
    </div>
  )
}
