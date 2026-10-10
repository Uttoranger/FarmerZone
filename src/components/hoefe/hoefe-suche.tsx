'use client'

import { useId, useRef, useState } from 'react'
import { Loader2, LocateFixed, MapPin, Search, X } from 'lucide-react'
import { tasteInVorschlaegen, type Bezugspunkt, type ProduktVorschlag, type VorschlagsLage } from '@/lib/hofuebersicht'
import {
  ORT_VORSCHLAG,
  SUCHFELD_TEXT,
  enterImSuchfeld,
  ortVorschlagAnbieten,
  ortVorschlagText,
} from '@/lib/hoefe-entdecken'
import { SUCHTEXT_MAX } from '@/schemas/hoefe-filter'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN, FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { useOrtssuche } from '@/components/hoefe/use-ortssuche'

/**
 * Das EINE Suchfeld von Entdecken (/hoefe): „Ort oder Produkt", daneben
 * „Standort nutzen" (Nachtlauf Nr. 46, freigabe.md §12 — vorher ein
 * Produkt-Suchfeld und darunter eine grüne Karte mit eigenem Feld für die
 * Postleitzahl; am Handy schob das den ersten Hof aus dem Bild).
 *
 * - Beim Tippen filtert das Feld Höfe und Produkte wie bisher (im Browser,
 *   berechneHofAuswahl); darunter erst ab dem ersten Zeichen die
 *   Vorschlagsliste aus dem VERFÜGBAREN Angebot (höchstens sechs) und als
 *   letzter Eintrag „Höfe rund um „…" zeigen" — der sucht den Text als Ort.
 * - Enter ohne Markierung sucht den Ort nur bei vier Ziffern; findet die
 *   Produktsuche nichts, markiert Enter den Eintrag „Höfe rund um …", und
 *   erst ein zweites Enter (oder ein Tipp darauf) sucht ihn (enterImSuchfeld,
 *   Nachbesserung Runde 1).
 * - Combobox-Muster (CODING_STANDARDS §8): Pfeiltasten, Enter, Escape; die
 *   Tastenlogik ist tasteInVorschlaegen (rein, getestet), hier wird nur
 *   ausgeführt. Die Liste steht im Fluss statt darüber, damit sie nie unter
 *   der Karte (Leaflet) verschwindet.
 *
 * Übernommene Produkt-Vorschläge werden Such-Marken („Aktive Filter"). Ein
 * gefundener Ort wird der Bezugspunkt; der Text verlässt dann das Feld, denn
 * er war kein Produkt. Ortssuche und Standort: useOrtssuche.
 */
export function HoefeSuche({
  suchtext,
  vorschlaege,
  status,
  treffer,
  bezugspunkt,
  onSuchtext,
  onUebernehmen,
  onBezugspunkt,
  onAufheben,
}: {
  suchtext: string
  vorschlaege: readonly ProduktVorschlag[]
  /** Die Ansage fürs Vorlesen („3 Treffer gefunden."); leer ohne Suche. */
  status: string
  /** Wie viel die Suche gerade zeigt — bei 0 zeigt Enter den Eintrag „Höfe rund um …". */
  treffer: number
  bezugspunkt: Bezugspunkt | null
  onSuchtext: (wert: string) => void
  onUebernehmen: (name: string) => void
  onBezugspunkt: (punkt: Bezugspunkt) => void
  onAufheben: () => void
}): React.JSX.Element {
  // Offen nur beim Tippen bzw. solange das Feld den Fokus hat — beim Laden
  // mit ?q=… bleibt sie zu, bis jemand ins Feld geht. Markiert wird über den
  // Namen, nicht die Stelle (VorschlagsLage).
  const [vorschlagsLage, setVorschlagsLage] = useState<VorschlagsLage>({ offen: false, markiert: null })
  const feld = useRef<HTMLInputElement>(null)
  const listeId = useId()
  const ort = useOrtssuche({
    onStandort: onBezugspunkt,
    onOrt: (punkt) => {
      onBezugspunkt(punkt)
      onSuchtext('')
    },
    onZumFeld: () => feld.current?.focus(),
  })

  const mitOrt = ortVorschlagAnbieten(suchtext)
  // Der Ort-Eintrag steht immer zuletzt: Pfeil nach oben aus dem Feld landet auf ihm.
  const vorschlagsNamen = [...vorschlaege.map((v) => v.name), ...(mitOrt ? [ORT_VORSCHLAG] : [])]
  const listeOffen = vorschlagsNamen.length > 0 && vorschlagsLage.offen
  // Ein markierter Name, den ein Filterwechsel aus der Liste genommen hat, gilt als keiner.
  const markiertGueltig = vorschlagsLage.markiert === null ? -1 : vorschlagsNamen.indexOf(vorschlagsLage.markiert)

  function uebernimm(name: string) {
    setVorschlagsLage({ offen: false, markiert: null })
    if (name === ORT_VORSCHLAG) ort.ortSuchen(suchtext)
    else onUebernehmen(name)
  }

  function tasteImSuchfeld(e: React.KeyboardEvent<HTMLInputElement>) {
    const ergebnis = tasteInVorschlaegen(e.key, vorschlagsLage, vorschlagsNamen)
    if (ergebnis.verbrauchen) e.preventDefault()
    setVorschlagsLage(ergebnis.lage)
    if (ergebnis.uebernehmen) uebernimm(ergebnis.uebernehmen)
  }

  /** Enter ohne markierten Vorschlag (die Taste hat tasteImSuchfeld dann nicht verbraucht). */
  function absenden(e: React.FormEvent) {
    e.preventDefault()
    const aktion = enterImSuchfeld(suchtext, treffer)
    // Ohne Treffer: den Eintrag zeigen und markieren — ausgelöst wird er erst
    // mit dem nächsten Enter oder Tipp, also ausdrücklich (Nominatim, Datenschutz).
    if (aktion === 'ort-eintrag-zeigen') setVorschlagsLage({ offen: true, markiert: ORT_VORSCHLAG })
    else setVorschlagsLage({ offen: false, markiert: null })
    if (aktion === 'ort-suchen') ort.ortSuchen(suchtext)
  }

  const knopf = cn(
    'inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-[13.5px] font-semibold transition-colors duration-[250ms] aria-busy:opacity-60',
    FOKUS_RAHMEN
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        <form role="search" onSubmit={absenden} className="min-w-0 sm:flex-1">
          <div className="relative">
            {ort.laeuft ? (
              <Loader2 className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden="true" />
            ) : (
              <Search
                className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
                strokeWidth={1.7}
                aria-hidden="true"
              />
            )}
            <input
              ref={feld}
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
              enterKeyHint="search"
              placeholder={SUCHFELD_TEXT.platzhalter}
              aria-label={SUCHFELD_TEXT.beschriftung}
              aria-autocomplete="list"
              aria-expanded={listeOffen}
              aria-controls={listeId}
              aria-activedescendant={listeOffen && markiertGueltig >= 0 ? `${listeId}-${markiertGueltig}` : undefined}
              // Springt der Fokus nach einem abgelehnten Standort hierher, wird die Meldezeile mitgelesen.
              aria-describedby="umkreis-meldung"
              aria-busy={ort.laeuft}
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
              {vorschlagsNamen.map((name, i) => {
                const vorschlag = vorschlaege[i]
                const istOrt = name === ORT_VORSCHLAG
                return (
                  <li
                    key={istOrt ? 'ort' : name}
                    id={`${listeId}-${i}`}
                    role="option"
                    aria-selected={i === markiertGueltig}
                    // Der Fokus bleibt im Suchfeld — sonst schlösse das Antippen die
                    // Tastatur, bevor der Vorschlag übernommen ist.
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setVorschlagsLage((l) => ({ ...l, markiert: name }))}
                    onMouseLeave={() => setVorschlagsLage((l) => ({ ...l, markiert: null }))}
                    onClick={() => uebernimm(name)}
                    className={cn(
                      'flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 text-sm',
                      istOrt && i > 0 && 'border-t border-border',
                      i === markiertGueltig && 'bg-muted',
                      FOKUS_RAHMEN_INNEN
                    )}
                  >
                    {istOrt ? (
                      <span className="flex min-w-0 items-center gap-2 text-popover-foreground">
                        <MapPin className="size-4 shrink-0 text-status-fertig" strokeWidth={1.7} aria-hidden="true" />
                        {/* Der Text darf 100 Zeichen lang sein — eine Zeile, voller Text im title. */}
                        <span className="min-w-0 truncate" title={ortVorschlagText(suchtext)}>
                          {ortVorschlagText(suchtext)}
                        </span>
                      </span>
                    ) : (
                      <>
                        <span className="min-w-0 truncate text-popover-foreground">{name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {vorschlag?.hoefe === 1 ? '1 Hof' : `${vorschlag?.hoefe ?? 0} Höfe`}
                        </span>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {/* Dauerhaft im Baum, sonst verpasst der Screenreader die erste Änderung.
              Sichtbar ändert sich die Liste selbst, deshalb sr-only. */}
          <p role="status" className="sr-only">
            {status}
          </p>
        </form>

        {!bezugspunkt && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {/* BEWUSST NICHT `disabled` während der Abfrage: Ein deaktivierter
                Knopf verliert den Tastatur-Fokus an den Seitenanfang. Der
                Doppelklick-Schutz sitzt in standortErfragen selbst. */}
            <button
              type="button"
              onClick={ort.standortErfragen}
              aria-busy={ort.ortet}
              className={cn(knopf, 'bg-accent text-accent-foreground hover:opacity-90')}
            >
              {ort.ortet ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <LocateFixed className="size-4" strokeWidth={1.7} aria-hidden="true" />
              )}
              {SUCHFELD_TEXT.standort}
            </button>
            <span className="text-[12.5px] text-muted-foreground">{SUCHFELD_TEXT.nichtsGespeichert}</span>
          </div>
        )}
      </div>

      {bezugspunkt && (
        <Hinweiskarte
          symbol={MapPin}
          aktion={
            <button
              type="button"
              onClick={() => {
                ort.aufheben()
                onAufheben()
              }}
              className={cn(knopf, 'border border-border bg-card text-foreground hover:bg-muted')}
            >
              <X className="size-4" strokeWidth={1.7} aria-hidden="true" />
              {SUCHFELD_TEXT.ortAendern}
            </button>
          }
        >
          {/* break-words: Der Name kann lang sein („Simbach am Inn, Landkreis
              Rottal-Inn, Bayern, 84359, Deutschland"). */}
          <span className="break-words">
            Wir zeigen Höfe rund um <strong className="font-semibold">{bezugspunkt.name ?? SUCHFELD_TEXT.rundUmStandort}</strong> – nichts
            wird gespeichert.
          </span>
        </Hinweiskarte>
      )}

      {/* Die Meldezeile steht DAUERHAFT im Baum (Hausmuster wie
          password-form.tsx): Eine Live-Region, die erst mit ihrem Text
          entsteht, sprechen mehrere Vorleseprogramme nicht. Den gefundenen
          Bezugspunkt sagt sie mit an. */}
      <p className={ort.hinweis ? 'text-[13px] break-words text-muted-foreground' : 'sr-only'} role="status" id="umkreis-meldung">
        {ort.hinweis ?? (bezugspunkt ? `Entfernungen ab ${bezugspunkt.name ?? SUCHFELD_TEXT.abStandort}` : '')}
      </p>

      {/* Die Auswahl bei mehrdeutigen Orten — untereinander statt nebeneinander:
          Die Namen tragen Bezirk und Land und wären in einer Zeile bei 375 px
          unlesbar. */}
      {ort.kandidaten.length > 0 && (
        <ul className="flex flex-col gap-1.5" aria-label={SUCHFELD_TEXT.mehrereOrte}>
          {ort.kandidaten.map((treffer, i) => (
            /* Der Index gehört in den Schlüssel: Zwei Nominatim-Zeilen
               können dieselben Koordinaten tragen. */
            <li key={`${i}:${treffer.lat},${treffer.lon}`}>
              <button
                type="button"
                onClick={() => ort.uebernimm(treffer)}
                className={cn(
                  'min-h-11 w-full rounded-xl border border-border bg-card px-4 py-2 text-left text-sm text-foreground transition-colors duration-[250ms] hover:bg-muted',
                  FOKUS_RAHMEN
                )}
              >
                <span className="break-words">{treffer.name}</span>
              </button>
            </li>
          ))}
          {/* Ein Ausstieg ohne Bezugspunkt — wer die Rückfrage nicht meinte,
              säße sonst darin fest. */}
          <li>
            <button
              type="button"
              onClick={ort.keinerDavon}
              className={cn(
                'inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground',
                FOKUS_RAHMEN
              )}
            >
              <X className="size-3.5" strokeWidth={1.7} aria-hidden="true" />
              {SUCHFELD_TEXT.keinerDavon}
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}
