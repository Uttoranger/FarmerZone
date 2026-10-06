'use client'

import { useId, useState } from 'react'
import { Search } from 'lucide-react'
import { tasteInVorschlaegen, type ProduktVorschlag, type VorschlagsLage } from '@/lib/hofuebersicht'
import { SUCHTEXT_MAX } from '@/schemas/hoefe-filter'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'

/**
 * Die Produktsuche von Entdecken (/hoefe) — Feld oben, darunter erst ab dem
 * ersten Zeichen die Vorschlagsliste aus dem VERFÜGBAREN Angebot des
 * Ausschnitts (berechneHofAuswahl, höchstens sechs). Combobox-Muster
 * (CODING_STANDARDS §8): Pfeiltasten, Enter, Escape; die Tastenlogik ist
 * tasteInVorschlaegen (rein, getestet), hier wird nur ausgeführt. Die Liste
 * steht im Fluss statt darüber, damit sie nie unter der Karte (Leaflet)
 * verschwindet.
 *
 * Übernommene Vorschläge werden Such-Marken; sie stehen seit Nr. 09 unter
 * „Aktive Filter" (je ein Link zum Entfernen), nicht mehr über dem Feld.
 */
export function HoefeSuche({
  suchtext,
  vorschlaege,
  status,
  onSuchtext,
  onUebernehmen,
}: {
  suchtext: string
  vorschlaege: readonly ProduktVorschlag[]
  /** Die Ansage fürs Vorlesen („3 Treffer gefunden."); leer ohne Suche. */
  status: string
  onSuchtext: (wert: string) => void
  onUebernehmen: (name: string) => void
}): React.JSX.Element {
  // Offen nur beim Tippen bzw. solange das Feld den Fokus hat — beim Laden
  // mit ?q=… bleibt sie zu, bis jemand ins Feld geht. Markiert wird über den
  // Namen, nicht die Stelle (VorschlagsLage).
  const [vorschlagsLage, setVorschlagsLage] = useState<VorschlagsLage>({ offen: false, markiert: null })
  const listeId = useId()
  const vorschlagsNamen = vorschlaege.map((v) => v.name)
  const listeOffen = vorschlaege.length > 0 && vorschlagsLage.offen
  // Ein markierter Name, den ein Filterwechsel aus der Liste genommen hat, gilt als keiner.
  const markiertGueltig = vorschlagsLage.markiert === null ? -1 : vorschlagsNamen.indexOf(vorschlagsLage.markiert)

  function uebernimm(name: string) {
    onUebernehmen(name)
    setVorschlagsLage({ offen: false, markiert: null })
  }

  function tasteImSuchfeld(e: React.KeyboardEvent<HTMLInputElement>) {
    const ergebnis = tasteInVorschlaegen(e.key, vorschlagsLage, vorschlagsNamen)
    if (ergebnis.verbrauchen) e.preventDefault()
    setVorschlagsLage(ergebnis.lage)
    if (ergebnis.uebernehmen) onUebernehmen(ergebnis.uebernehmen)
  }

  return (
    <div role="search" className="min-w-0">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.7}
          aria-hidden="true"
        />
        <input
          type="search"
          role="combobox"
          value={suchtext}
          // Mehr trägt die Adresse nicht (SUCHTEXT_MAX) — ein längerer Text
          // fiele beim nächsten Lesen der URL weg und das Feld stünde leer da.
          maxLength={SUCHTEXT_MAX}
          onChange={(e) => {
            setVorschlagsLage({ offen: true, markiert: null })
            onSuchtext(e.target.value)
          }}
          onKeyDown={tasteImSuchfeld}
          // Wer das Feld verlässt (Tab, Antippen eines Chips), schließt die
          // Liste — sonst schöbe sie die Chips weiter nach unten. Das Antippen
          // eines Vorschlags nimmt dem Feld den Fokus nicht (onMouseDown unten).
          onFocus={() => setVorschlagsLage((l) => ({ ...l, offen: true }))}
          onBlur={() => setVorschlagsLage({ offen: false, markiert: null })}
          placeholder="Hof oder Produkt suchen …"
          aria-label="Nach Produkten oder Höfen suchen"
          aria-autocomplete="list"
          aria-expanded={listeOffen}
          aria-controls={listeId}
          aria-activedescendant={listeOffen && markiertGueltig >= 0 ? `${listeId}-${markiertGueltig}` : undefined}
          // 16 px: iOS zoomt bei kleinerer Schrift ins Feld.
          className={cn(
            'h-12 w-full rounded-full border border-border bg-card pr-4 pl-11 text-base text-foreground placeholder:text-muted-foreground md:h-11 md:text-sm',
            'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring'
          )}
        />
      </div>
      {listeOffen && (
        <ul
          id={listeId}
          role="listbox"
          aria-label="Vorschläge"
          className="mt-1.5 overflow-hidden rounded-2xl border border-border bg-popover py-1 shadow-sm dark:shadow-none"
        >
          {vorschlaege.map((vorschlag, i) => (
            <li
              key={vorschlag.name}
              id={`${listeId}-${i}`}
              role="option"
              aria-selected={i === markiertGueltig}
              // Der Fokus bleibt im Suchfeld — sonst schlösse das Antippen die
              // Tastatur, bevor der Vorschlag übernommen ist.
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setVorschlagsLage((l) => ({ ...l, markiert: vorschlag.name }))}
              onMouseLeave={() => setVorschlagsLage((l) => ({ ...l, markiert: null }))}
              onClick={() => uebernimm(vorschlag.name)}
              className={cn(
                'flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 text-sm',
                i === markiertGueltig && 'bg-muted',
                FOKUS_RAHMEN_INNEN
              )}
            >
              <span className="min-w-0 truncate text-popover-foreground">{vorschlag.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {vorschlag.hoefe === 1 ? '1 Hof' : `${vorschlag.hoefe} Höfe`}
              </span>
            </li>
          ))}
        </ul>
      )}
      {/* Dauerhaft im Baum, sonst verpasst der Screenreader die erste Änderung.
          Sichtbar ändert sich die Liste selbst, deshalb sr-only. */}
      <p role="status" className="sr-only">
        {status}
      </p>
    </div>
  )
}
