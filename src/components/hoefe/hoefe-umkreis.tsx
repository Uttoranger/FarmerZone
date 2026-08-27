'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Loader2, LocateFixed, X } from 'lucide-react'
import { loeseOrtAuf } from '@/server/actions/hoefe'
import { UMKREIS_STUFEN, type Bezugspunkt, type UmkreisStufe } from '@/lib/hofuebersicht'

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
    setHinweis(null)
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      zurPlz()
      return
    }
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

  function ortSuchen(e: React.FormEvent) {
    e.preventDefault()
    const text = eingabe.trim()
    if (!text || laeuft) return
    // Diese Suche gilt jetzt — eine späte Standort-Antwort zählt nicht mehr.
    laufNr.current += 1
    verwerfeWaechter()
    setOrtet(false)
    setHinweis(null)
    starteAufloesung(async () => {
      const treffer = await loeseOrtAuf(text)
      if (!treffer) {
        // Kein Treffer: ruhiger Hinweis, die Liste bleibt unverändert.
        setHinweis(HINWEIS_OHNE_TREFFER)
        return
      }
      // Der aufgelöste Name statt des Rohtexts: „4910 Ried im Innkreis" sagt
      // mehr als „4910" — und zeigt, worauf sich die Entfernungen beziehen.
      onBezugspunkt({ lat: treffer.lat, lon: treffer.lon, name: treffer.name })
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
            onChange={(e) => setEingabe(e.target.value)}
            inputMode="text"
            enterKeyHint="search"
            aria-label="Postleitzahl oder Ort"
            // Der Fokus springt bei abgelehntem Standort hierher — dann muss
            // die Meldezeile mitgelesen werden.
            aria-describedby="umkreis-meldung"
            placeholder="PLZ oder Ort"
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
      <p className="mt-2 min-h-5 text-sm text-muted-foreground" role="status" id="umkreis-meldung">
        {hinweis ?? (bezugspunkt ? `Entfernungen ab: ${bezugspunkt.name ?? 'deinem Punkt'}` : '')}
      </p>

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
