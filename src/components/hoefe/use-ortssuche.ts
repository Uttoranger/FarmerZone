'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { loeseOrtAuf, type OrtsTreffer } from '@/server/actions/hoefe'
import type { Bezugspunkt } from '@/lib/hofuebersicht'
import { hinweisMehrere } from '@/lib/geokodierung'
import { SUCHFELD_TEXT } from '@/lib/hoefe-entdecken'

/**
 * Der Bezugspunkt der Umkreissuche auf /hoefe: eigener Standort oder ein
 * eingetippter Ort (bis Nr. 46 in hoefe-umkreis.tsx, jetzt hinter dem einen
 * Suchfeld „Ort oder Produkt").
 *
 * DATENSPARSAMKEIT (nicht verhandelbar): Der vom Browser gemessene Standort
 * bleibt IM BROWSER. Er wird niemals an einen Server geschickt — weder an
 * uns noch an Dritte; die Entfernungen rechnet der Browser selbst auf den
 * ohnehin geladenen Hofkoordinaten (src/lib/hofuebersicht.ts). Nur die
 * Ortssuche schickt den GETIPPTEN Text zur Auflösung an Nominatim
 * (`loeseOrtAuf`, serverseitig mit Bremse), und auch das erst auf Wunsch,
 * nie beim Tippen.
 *
 * Nichts wird gemerkt: kein localStorage, kein Konto, keine URL-Parameter —
 * der Bezugspunkt lebt ausschließlich im Seitenzustand (hoefe-client.tsx).
 *
 * ÜBER DIE GRENZE (AT/DE): Derselbe Ortsname kommt beiderseits der Grenze
 * vor; bei mehreren Treffern erscheint eine Auswahl MIT Landangabe statt
 * einer stillen Entscheidung, bei genau einem wird direkt übernommen.
 */

/**
 * Zeitwächter über der Standortabfrage — Hausmuster wie beim Foto-Upload:
 * kein Hänger bleibt stumm. Nötig, weil das `timeout` der Browser-
 * Schnittstelle NUR die Ermittlung der Position deckelt, NICHT die Wartezeit
 * auf die Entscheidung im Berechtigungs-Dialog (in echtem Chromium
 * nachgemessen). Der Wächter beendet nur das WARTEN, nicht die Abfrage: Wer
 * erst nach 20 Sekunden auf „Erlauben" tippt, bekommt seinen Bezugspunkt
 * trotzdem.
 */
const STANDORT_GEDULD_MS = 10_000

export type Ortssuche = {
  /** Die sichtbare Meldezeile (null = keine). */
  hinweis: string | null
  /** Mehrdeutige Orte zur Auswahl — leer, sobald einer gewählt ist. */
  kandidaten: OrtsTreffer[]
  /** Die Standortabfrage läuft. */
  ortet: boolean
  /** Die Ortssuche läuft. */
  laeuft: boolean
  standortErfragen: () => void
  ortSuchen: (text: string) => void
  uebernimm: (treffer: OrtsTreffer) => void
  keinerDavon: () => void
  /** „Ort ändern": Was noch unterwegs ist, gilt nicht mehr. */
  aufheben: () => void
}

export function useOrtssuche({
  onStandort,
  onOrt,
  onZumFeld,
}: {
  /** Der eigene Standort ist da — die Suche im Feld bleibt, wie sie ist. */
  onStandort: (punkt: Bezugspunkt) => void
  /** Ein getippter Ort ist aufgelöst — der Text war ein Ort, kein Produkt. */
  onOrt: (punkt: Bezugspunkt) => void
  /** Zum Suchfeld, wenn der Standort nicht geht: dort führt der andere Weg weiter. */
  onZumFeld: () => void
}): Ortssuche {
  const [hinweis, setHinweis] = useState<string | null>(null)
  const [kandidaten, setKandidaten] = useState<OrtsTreffer[]>([])
  const [ortet, setOrtet] = useState(false)
  const [laeuft, starteAufloesung] = useTransition()
  const waechter = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Die Laufnummer entscheidet, WESSEN Antwort noch zählt: Wer inzwischen
  // einen Ort gesucht oder den Umkreis aufgehoben hat, soll von einer späten
  // Antwort nicht überfahren werden — in beide Richtungen.
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

  function zumFeld() {
    setHinweis(SUCHFELD_TEXT.ohneStandort)
    onZumFeld()
  }

  function standortErfragen() {
    if (ortet) return
    // Erst der Frühausstieg, DANN aufräumen: Ohne Geolocation soll ein
    // Fehlklick nicht die eben erarbeitete Ortsauswahl vernichten.
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      zumFeld()
      return
    }
    setHinweis(null)
    setKandidaten([])
    setOrtet(true)
    const meinLauf = ++laufNr.current
    const veraltet = () => laufNr.current !== meinLauf
    verwerfeWaechter()

    waechter.current = setTimeout(() => {
      if (veraltet()) return
      // NUR das Warten endet — die Abfrage läuft weiter, der Fokus bleibt,
      // wo er ist (der Berechtigungs-Dialog kann noch offen sein).
      setOrtet(false)
      setHinweis(SUCHFELD_TEXT.dauert)
    }, STANDORT_GEDULD_MS)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (veraltet()) return
        verwerfeWaechter()
        setOrtet(false)
        setHinweis(null)
        // Bleibt im Browser: von hier geht die Position in keine Anfrage.
        // Ohne Namen: Die Sätze nennen ihn „deinen Standort" (SUCHFELD_TEXT).
        onStandort({ lat: position.coords.latitude, lon: position.coords.longitude })
      },
      () => {
        if (veraltet()) return
        verwerfeWaechter()
        setOrtet(false)
        // Ablehnung ist kein Fehler — kein roter Text, nur der andere Weg.
        zumFeld()
      },
      { enableHighAccuracy: false, timeout: 8_000 }
    )
  }

  function uebernimm(treffer: OrtsTreffer) {
    setKandidaten([])
    setHinweis(null)
    // Der aufgelöste Name statt des Rohtexts: „4910 Ried im Innkreis" sagt
    // mehr als „4910" — und zeigt, worauf sich die Entfernungen beziehen.
    onOrt({ lat: treffer.lat, lon: treffer.lon, name: treffer.name })
  }

  function ortSuchen(eingabe: string) {
    const text = eingabe.trim()
    if (!text || laeuft) return
    const meinLauf = ++laufNr.current
    const veraltet = () => laufNr.current !== meinLauf
    verwerfeWaechter()
    setOrtet(false)
    setHinweis(null)
    setKandidaten([])
    starteAufloesung(async () => {
      const treffer = await loeseOrtAuf(text)
      if (veraltet()) return
      if (treffer.length === 0) {
        // Kein Treffer: ruhiger Hinweis, die Liste bleibt unverändert.
        setHinweis(SUCHFELD_TEXT.ohneTreffer)
        return
      }
      // Die Liste ist serverseitig entdoppelt (loeseOrtAuf): Genau einer wird
      // direkt übernommen — der häufige Weg bleibt einstufig.
      const [einziger] = treffer
      if (treffer.length === 1 && einziger) {
        uebernimm(einziger)
        return
      }
      setHinweis(hinweisMehrere(treffer.length))
      setKandidaten(treffer)
    })
  }

  function keinerDavon() {
    setKandidaten([])
    setHinweis(null)
    onZumFeld()
  }

  function aufheben() {
    laufNr.current += 1
    verwerfeWaechter()
    setOrtet(false)
    setHinweis(null)
    setKandidaten([])
  }

  return { hinweis, kandidaten, ortet, laeuft, standortErfragen, ortSuchen, uebernimm, keinerDavon, aufheben }
}
