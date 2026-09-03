'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Loader2, LocateFixed, X } from 'lucide-react'
import { loeseOrtAuf, type OrtsTreffer } from '@/server/actions/hoefe'
import { UMKREIS_STUFEN, type Bezugspunkt, type UmkreisStufe } from '@/lib/hofuebersicht'
import { hinweisMehrere } from '@/lib/geokodierung'

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
 * „Umkreis aufheben" wieder fort.
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
  stufe,
  onBezugspunkt,
  onStufe,
  onAufheben,
}: {
  bezugspunkt: Bezugspunkt | null
  stufe: UmkreisStufe
  onBezugspunkt: (punkt: Bezugspunkt) => void
  onStufe: (stufe: UmkreisStufe) => void
  onAufheben: () => void
}) {
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

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* BEWUSST NICHT `disabled` während der Abfrage: Ein deaktivierter
            Knopf verliert den Tastatur-Fokus an den Seitenanfang. Der
            Doppelklick-Schutz sitzt in standortErfragen selbst. */}
        <button
          type="button"
          onClick={standortErfragen}
          aria-busy={ortet}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/40 aria-busy:opacity-60"
        >
          {ortet ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <LocateFixed className="size-4" aria-hidden="true" />
          )}
          In meiner Nähe
        </button>

        <form onSubmit={ortSuchen} className="flex min-w-0 flex-1 items-center gap-2">
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
            placeholder="PLZ oder Ort (AT/DE)"
            className="min-h-11 w-full min-w-0 flex-1 rounded-lg border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            aria-busy={laeuft}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/40 aria-busy:opacity-60"
          >
            {laeuft && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Suchen
          </button>
        </form>
      </div>

      {/* Die Meldezeile steht DAUERHAFT im Baum (Hausmuster wie
          password-form.tsx): Eine Live-Region, die erst mit ihrem Text
          entsteht, sprechen mehrere Vorleseprogramme nicht. Sie trägt beide
          Fälle — den ruhigen Hinweis UND den gefundenen Bezugspunkt, damit
          auch der Erfolg angesagt wird und sichtbar ist, worauf sich die
          Entfernungen beziehen. */}
      {/* `break-words`: Der gewählte Name kann sehr lang sein („Simbach am
          Inn, Landkreis Rottal-Inn, Bayern, 84359, Deutschland") — ohne
          Umbruch liefe er bei 375 px aus der Zeile. */}
      <p
        className="mt-2 min-h-5 break-words text-sm text-muted-foreground"
        role="status"
        id="umkreis-meldung"
      >
        {hinweis ?? (bezugspunkt ? `Entfernungen ab: ${bezugspunkt.name ?? 'deinem Punkt'}` : '')}
      </p>

      {/* Die Auswahl bei mehrdeutigen Orten — untereinander statt nebeneinander:
          Die Namen tragen Bezirk und Land („Simbach am Inn, …, Deutschland")
          und wären in einer Zeile bei 375px unlesbar. `text-left` und
          `break-words`, damit lange Namen umbrechen statt abzuschneiden. */}
      {kandidaten.length > 0 && (
        <ul className="mt-2 space-y-1.5" aria-label="Welchen Ort meinst du?">
          {kandidaten.map((treffer, i) => (
            /* Der Index gehört in den Schlüssel: Zwei Nominatim-Zeilen
               können dieselben Koordinaten tragen. */
            <li key={`${i}:${treffer.lat},${treffer.lon}`}>
              <button
                type="button"
                onClick={() => uebernimm(treffer)}
                className="min-h-11 w-full rounded-lg border border-border bg-card px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted/40"
              >
                <span className="break-words">{treffer.name}</span>
              </button>
            </li>
          ))}
          {/* Ein Ausstieg, der OHNE Bezugspunkt erreichbar ist: „Umkreis
              aufheben" erscheint erst mit einem — wer die Rückfrage nicht
              meinte, säße sonst darin fest. */}
          <li>
            <button
              type="button"
              onClick={() => {
                setKandidaten([])
                setHinweis(null)
                plzFeld.current?.focus()
              }}
              className="inline-flex min-h-9 items-center gap-1 rounded-full px-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden="true" />
              Keiner davon
            </button>
          </li>
        </ul>
      )}

      {bezugspunkt && (
        <div
          className="mt-2 flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Umkreis begrenzen"
        >
          <span className="text-sm text-muted-foreground" aria-hidden="true">Umkreis:</span>
          {UMKREIS_STUFEN.map((wert) => {
            const aktiv = stufe === wert
            return (
              <button
                key={wert ?? 'egal'}
                type="button"
                onClick={() => onStufe(wert)}
                aria-pressed={aktiv}
                className={`min-h-9 rounded-full border px-3 text-[13px] font-medium transition-colors ${
                  aktiv
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-foreground hover:bg-muted/40'
                }`}
              >
                {wert === null ? 'egal' : `${wert} km`}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => {
              // Auch hier: was noch unterwegs ist, gilt nicht mehr.
              laufNr.current += 1
              verwerfeWaechter()
              setOrtet(false)
              setEingabe('')
              setHinweis(null)
              // Auch eine offene Ortsauswahl gehört zum Aufheben — sonst
              // stünde sie noch da, obwohl der Bezugspunkt fort ist.
              setKandidaten([])
              onAufheben()
            }}
            className="inline-flex min-h-9 items-center gap-1 rounded-full px-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-3.5" aria-hidden="true" />
            Umkreis aufheben
          </button>
        </div>
      )}
    </div>
  )
}
