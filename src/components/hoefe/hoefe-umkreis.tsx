'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Loader2, LocateFixed, MapPin, X } from 'lucide-react'
import { loeseOrtAuf, type OrtsTreffer } from '@/server/actions/hoefe'
import type { Bezugspunkt } from '@/lib/hofuebersicht'
import { hinweisMehrere } from '@/lib/geokodierung'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'

/**
 * Die Umkreissuche der Hofübersicht: zwei gleichrangige Wege zum
 * Bezugspunkt — der eigene Standort oder eine eingetippte Postleitzahl.
 *
 * DATENSPARSAMKEIT (nicht verhandelbar): Der vom Browser gemessene Standort
 * bleibt IM BROWSER. Er wird niemals an einen Server geschickt — weder an
 * uns noch an Dritte; die Entfernungen rechnet der Browser selbst auf den
 * ohnehin geladenen Hofkoordinaten (src/lib/hofuebersicht.ts). Nur der
 * PLZ-Weg schickt die GETIPPTE Eingabe zur Auflösung an Nominatim, und auch
 * das erst beim Absenden, nie beim Tippen.
 *
 * Nichts wird gemerkt: kein localStorage, kein Konto, keine URL-Parameter —
 * der Bezugspunkt lebt ausschließlich im Seitenzustand und ist mit
 * „ändern" wieder fort.
 *
 * GESTALT seit Nr. 09 (Mockup web-k1-entdecken-einstieg): der
 * Einstiegshinweis als grüne Hinweiskarte — ohne Bezugspunkt die Frage nach
 * Postleitzahl oder Standort, mit Bezugspunkt „Wir zeigen Höfe rund um …".
 * Einen „grob nach deiner Region geschätzten" Ort wie im Mockup gibt es
 * nicht: Das bräuchte eine Ortung über die IP-Adresse, also einen Dienst,
 * der jede Anfrage sieht. Die Umkreis-Stufen stehen in der Filterzeile
 * (hoefe-client.tsx).
 *
 * ÜBER DIE GRENZE (AT/DE): Im Innviertel liegt Bayern näher als halb
 * Oberösterreich, deshalb sucht die Auflösung in beiden Ländern. Weil
 * derselbe Ortsname beiderseits der Grenze vorkommt, erscheint bei mehreren
 * Treffern eine Auswahlliste MIT Landangabe statt einer stillen Entscheidung
 * für den ersten Treffer — bei genau einem Treffer bleibt es beim direkten
 * Übernehmen, damit der häufige Fall keinen Zusatzklick bekommt.
 */

const HINWEIS_OHNE_STANDORT = 'Kein Problem — gib einfach deine Postleitzahl ein.'
const HINWEIS_OHNE_TREFFER = 'Diesen Ort kennen wir nicht — probier es mit der Postleitzahl.'
/** Der Dialog liegt noch offen: kein Scheitern, nur Geduld — und ein zweiter Weg. */
const HINWEIS_DAUERT = 'Das dauert gerade — du kannst auch deine Postleitzahl eingeben.'

/**
 * Zeitwächter über der Standortabfrage — Hausmuster wie beim Foto-Upload:
 * kein Hänger bleibt stumm.
 *
 * Nötig, weil das `timeout` der Browser-Schnittstelle laut Spezifikation NUR
 * die Ermittlung der Position deckelt, NICHT die Wartezeit auf die
 * Entscheidung im Berechtigungs-Dialog: Wer den Dialog offen liegen lässt,
 * bekommt weder Erfolgs- noch Fehlerruf — der Knopf bliebe ewig im
 * Ladezustand (in echtem Chromium nachgemessen).
 *
 * WICHTIG: Der Wächter beendet nur das WARTEN, nicht die Abfrage. Wer erst
 * nach 20 Sekunden auf „Erlauben" tippt (auf Mobilgeräten liegen dort schnell
 * zwei Dialoge übereinander), bekommt seinen Bezugspunkt trotzdem — und der
 * Wächter reißt auch den Fokus nicht an sich, weil der Dialog noch offen sein
 * kann. Nur eine ausdrückliche Ablehnung führt zum Feld.
 */
const STANDORT_GEDULD_MS = 10_000

export default function HoefeUmkreis({
  bezugspunkt,
  onBezugspunkt,
  onAufheben,
}: {
  bezugspunkt: Bezugspunkt | null
  onBezugspunkt: (punkt: Bezugspunkt) => void
  onAufheben: () => void
}): React.JSX.Element {
  const [eingabe, setEingabe] = useState('')
  const [hinweis, setHinweis] = useState<string | null>(null)
  /** Mehrdeutige Treffer zur Auswahl — leer, sobald einer gewählt ist. */
  const [kandidaten, setKandidaten] = useState<OrtsTreffer[]>([])
  const [ortet, setOrtet] = useState(false)
  const [laeuft, starteAufloesung] = useTransition()
  const plzFeld = useRef<HTMLInputElement>(null)
  const waechter = useRef<ReturnType<typeof setTimeout> | null>(null)
  const laufNr = useRef(0)

  const verwerfeWaechter = () => {
    if (waechter.current) clearTimeout(waechter.current)
    waechter.current = null
  }

  // Kein Geister-Zeitgeber nach dem Abbau (Hausstandard).
  useEffect(() => {
    return () => {
      if (waechter.current) clearTimeout(waechter.current)
    }
  }, [])

  function standortErfragen() {
    if (ortet) return
    // Erst der Frühausstieg, DANN aufräumen: Auf einem Browser ohne
    // Geolocation soll ein Fehlklick nicht die eben erarbeitete Ortsauswahl
    // vernichten und dafür nur „gib deine Postleitzahl ein" hinterlassen.
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      zurPlz()
      return
    }
    setHinweis(null)
    // Wer den eigenen Standort wählt, hat die Ortsauswahl verworfen.
    setKandidaten([])
    setOrtet(true)

    // Die Laufnummer entscheidet, WESSEN Antwort noch zählt: Wer inzwischen
    // eine Postleitzahl gesucht oder den Umkreis aufgehoben hat, soll von
    // einer späten Standort-Antwort nicht überfahren werden.
    const meinLauf = ++laufNr.current
    const veraltet = () => laufNr.current !== meinLauf
    verwerfeWaechter()

    waechter.current = setTimeout(() => {
      if (veraltet()) return
      // NUR das Warten endet — die Abfrage läuft weiter, der Fokus bleibt,
      // wo er ist (der Berechtigungs-Dialog kann noch offen sein).
      setOrtet(false)
      setHinweis(HINWEIS_DAUERT)
    }, STANDORT_GEDULD_MS)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (veraltet()) return
        verwerfeWaechter()
        setOrtet(false)
        setHinweis(null)
        // Bleibt im Browser: von hier geht die Position in keine Anfrage.
        onBezugspunkt({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          name: 'dein Standort',
        })
      },
      () => {
        if (veraltet()) return
        verwerfeWaechter()
        setOrtet(false)
        // Ablehnung ist kein Fehler — kein roter Text, nur der andere Weg.
        // Hier ist der Fokussprung richtig: Die Nutzerin hat gerade selbst
        // entschieden und wartet auf das, was als Nächstes hilft.
        zurPlz()
      },
      { enableHighAccuracy: false, timeout: 8_000 }
    )
  }

  function zurPlz() {
    setHinweis(HINWEIS_OHNE_STANDORT)
    plzFeld.current?.focus()
  }

  /** Einen Treffer übernehmen — aus der Liste oder als einziger Fund. */
  function uebernimm(treffer: OrtsTreffer) {
    setKandidaten([])
    setHinweis(null)
    // Der aufgelöste Name statt des Rohtexts: „4910 Ried im Innkreis" sagt
    // mehr als „4910" — und zeigt, worauf sich die Entfernungen beziehen.
    onBezugspunkt({ lat: treffer.lat, lon: treffer.lon, name: treffer.name })
  }

  function ortSuchen(e: React.FormEvent) {
    e.preventDefault()
    const text = eingabe.trim()
    if (!text || laeuft) return
    // Diese Suche gilt jetzt — eine späte Standort-Antwort zählt nicht mehr.
    // UND UMGEKEHRT: Wer zwischendurch „In meiner Nähe" drückt, erhöht die
    // Nummer, und dann zählt DIESE Antwort nicht mehr. Ohne die Prüfung
    // unten setzte eine längst verworfene Suche noch einen Bezugspunkt (bei
    // genau einem Treffer) oder brächte die eben geleerte Auswahl zurück.
    const meinSuchlauf = ++laufNr.current
    const suchlaufVeraltet = () => laufNr.current !== meinSuchlauf
    verwerfeWaechter()
    setOrtet(false)
    setHinweis(null)
    setKandidaten([])
    starteAufloesung(async () => {
      const treffer = await loeseOrtAuf(text)
      if (suchlaufVeraltet()) return
      if (treffer.length === 0) {
        // Kein Treffer: ruhiger Hinweis, die Liste bleibt unverändert.
        setHinweis(HINWEIS_OHNE_TREFFER)
        return
      }
      // Die Liste ist bereits serverseitig entdoppelt (loeseOrtAuf): Hier
      // stehen nur noch WIRKLICH unterscheidbare Orte. Genau einer wird
      // direkt übernommen — der häufige Weg bleibt damit einstufig.
      if (treffer.length === 1) {
        uebernimm(treffer[0])
        return
      }
      setHinweis(hinweisMehrere(treffer.length))
      setKandidaten(treffer)
    })
  }

  const knopf = cn(
    'inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-[13.5px] font-semibold transition-colors duration-[250ms] aria-busy:opacity-60',
    FOKUS_RAHMEN
  )

  return (
    <div className="flex flex-col gap-2">
      {bezugspunkt ? (
        <Hinweiskarte
          symbol={MapPin}
          aktion={
            <button
              type="button"
              onClick={() => {
                // Was noch unterwegs ist, gilt nicht mehr.
                laufNr.current += 1
                verwerfeWaechter()
                setOrtet(false)
                setEingabe('')
                setHinweis(null)
                setKandidaten([])
                onAufheben()
              }}
              className={cn(knopf, 'border border-border bg-card text-foreground hover:bg-muted')}
            >
              <X className="size-4" strokeWidth={1.7} aria-hidden="true" />
              Ort ändern
            </button>
          }
        >
          {/* break-words: Der Name kann lang sein („Simbach am Inn, Landkreis
              Rottal-Inn, Bayern, 84359, Deutschland"). */}
          <span className="break-words">
            Wir zeigen Höfe rund um <strong className="font-semibold">{bezugspunkt.name ?? 'deinen Punkt'}</strong> – nichts
            wird gespeichert.
          </span>
        </Hinweiskarte>
      ) : (
        <Hinweiskarte symbol={MapPin}>
          <span className="flex flex-col gap-3">
            <span>
              Wo bist du? Gib deine Postleitzahl ein oder nutze deinen Standort – dann stehen die nächsten Höfe oben.
              Nichts wird gespeichert.
            </span>
            <span className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <form onSubmit={ortSuchen} className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-sm">
                <input
                  ref={plzFeld}
                  value={eingabe}
                  onChange={(e) => {
                    setEingabe(e.target.value)
                    // Die Auswahl gehört zur GESUCHTEN Eingabe: Wer das Feld
                    // ändert, tippte sonst später einen Treffer an, der zu einem
                    // anderen Wort gehört.
                    if (kandidaten.length > 0) setKandidaten([])
                  }}
                  inputMode="text"
                  enterKeyHint="search"
                  aria-label="Postleitzahl oder Ort in Österreich oder Deutschland"
                  // Der Fokus springt bei abgelehntem Standort hierher — dann muss
                  // die Meldezeile mitgelesen werden.
                  aria-describedby="umkreis-meldung"
                  placeholder="PLZ oder Ort"
                  className={cn(
                    'h-11 w-full min-w-0 flex-1 rounded-full border border-border bg-card px-4 text-base text-foreground placeholder:text-muted-foreground md:text-sm',
                    FOKUS_RAHMEN
                  )}
                />
                <button
                  type="submit"
                  aria-busy={laeuft}
                  className={cn(knopf, 'border border-border bg-card text-foreground hover:bg-muted')}
                >
                  {laeuft && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                  Suchen
                </button>
              </form>
              {/* BEWUSST NICHT `disabled` während der Abfrage: Ein deaktivierter
                  Knopf verliert den Tastatur-Fokus an den Seitenanfang. Der
                  Doppelklick-Schutz sitzt in standortErfragen selbst. */}
              <button
                type="button"
                onClick={standortErfragen}
                aria-busy={ortet}
                className={cn(knopf, 'bg-accent text-accent-foreground hover:opacity-90')}
              >
                {ortet ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <LocateFixed className="size-4" strokeWidth={1.7} aria-hidden="true" />
                )}
                Standort nutzen
              </button>
            </span>
          </span>
        </Hinweiskarte>
      )}

      {/* Die Meldezeile steht DAUERHAFT im Baum (Hausmuster wie
          password-form.tsx): Eine Live-Region, die erst mit ihrem Text
          entsteht, sprechen mehrere Vorleseprogramme nicht. Den gefundenen
          Bezugspunkt sagt sie mit an. */}
      {/* Sichtbar nur der Hinweis; „Entfernungen ab …" sagt die Karte darüber
          schon und steht deshalb nur für Vorleseprogramme da. */}
      <p
        className={hinweis ? 'text-[13px] break-words text-muted-foreground' : 'sr-only'}
        role="status"
        id="umkreis-meldung"
      >
        {hinweis ?? (bezugspunkt ? `Entfernungen ab: ${bezugspunkt.name ?? 'deinem Punkt'}` : '')}
      </p>

      {/* Die Auswahl bei mehrdeutigen Orten — untereinander statt nebeneinander:
          Die Namen tragen Bezirk und Land und wären in einer Zeile bei 375 px
          unlesbar. */}
      {kandidaten.length > 0 && (
        <ul className="flex flex-col gap-1.5" aria-label="Welchen Ort meinst du?">
          {kandidaten.map((treffer, i) => (
            /* Der Index gehört in den Schlüssel: Zwei Nominatim-Zeilen
               können dieselben Koordinaten tragen. */
            <li key={`${i}:${treffer.lat},${treffer.lon}`}>
              <button
                type="button"
                onClick={() => uebernimm(treffer)}
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
              onClick={() => {
                setKandidaten([])
                setHinweis(null)
                plzFeld.current?.focus()
              }}
              className={cn(
                'inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground',
                FOKUS_RAHMEN
              )}
            >
              <X className="size-3.5" strokeWidth={1.7} aria-hidden="true" />
              Keiner davon
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}
