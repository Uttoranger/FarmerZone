'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import * as Sentry from '@sentry/nextjs'
import { loeseOrtAuf, type OrtsTreffer } from '@/server/actions/hoefe'
import type { Bezugspunkt } from '@/lib/hofuebersicht'
import { erkenneOrtseingabe, hinweisMehrere } from '@/lib/geokodierung'
import { SUCHFELD_TEXT, standortIstUngenau, standortUngefaehrText } from '@/lib/hoefe-entdecken'
import { BEZEICHNER, fehlerKlasse, istNetzfehler } from '@/lib/upload-diagnose'

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
 * (`loeseOrtAuf`, serverseitig mit Bremse), und auch das erst, wenn die
 * Kundin ihn absendet — mit Enter, über den Eintrag „Höfe rund um …" oder
 * indem sie mit einem Suchtext auf /hoefe ankommt (Startseite, Kopfzeile,
 * 404: Dort hat sie abgesendet; was die Seite selbst beim Tippen in die
 * Adresse schrieb, ist kein Ankunftstext, abgesendeterSuchtext) —, nie beim
 * Tippen.
 *
 * Nichts wird gemerkt: kein localStorage, kein Konto, keine URL-Parameter —
 * der Bezugspunkt lebt ausschließlich im Seitenzustand (hoefe-client.tsx).
 *
 * ÜBER DIE GRENZE (AT/DE): Derselbe Ortsname kommt beiderseits der Grenze
 * vor; bei mehreren Treffern erscheint eine Auswahl MIT Bundesland statt
 * einer stillen Entscheidung, bei genau einem wird direkt übernommen.
 *
 * STANDORT NUR UNGEFÄHR (Nr. 84): Ein Browser ohne GPS ortet über die
 * IP-Adresse und liegt 10 bis 50 km daneben — `coords.accuracy` sagt es. Ab
 * 2 000 m gilt der Punkt trotzdem sofort (die Liste zeigt Höfe im Umkreis,
 * Mockup Zustand 3), und der Hinweis sagt es dazu: „Genauer bestimmen" holt
 * einen genauen Wert, „So lassen" schließt den Hinweis. Das Gerät behält die
 * Position auch dann; es geht nichts hinaus.
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
/** Beim genaueren Bestimmen ist die Erlaubnis schon da: 12 s Zeitlimit des Browsers plus Luft. */
const STANDORT_GENAU_GEDULD_MS = 14_000

/**
 * Ein Standort, der schon gilt, aber nur ungefähr stimmt: Die Kundin
 * entscheidet, ob sie ihn so lässt oder genauer bestimmen lässt.
 */
export type UngefaehrerStandort = {
  punkt: Bezugspunkt
  /** „Dein Standort ist nur ungefähr bekannt (etwa 15 km)." */
  satz: string
  /** Das genauere Bestimmen hat nicht geklappt — der Hinweis sagt es dazu. */
  genauerMisslang: boolean
}

export type Ortssuche = {
  /** Die sichtbare Meldezeile (null = keine). */
  hinweis: string | null
  /** Mehrdeutige Orte zur Auswahl — leer, sobald einer gewählt ist. */
  kandidaten: OrtsTreffer[]
  /** Ein nur ungefähr bekannter Standort gilt schon; der Hinweis bietet „Genauer bestimmen" und „So lassen" an. */
  ungefaehr: UngefaehrerStandort | null
  /** Die Standortabfrage läuft. */
  ortet: boolean
  /** Die Ortssuche läuft. */
  laeuft: boolean
  standortErfragen: () => void
  /** Zweiter Anlauf mit hoher Genauigkeit (GPS), höchstens 12 s. */
  genauerBestimmen: () => void
  /** Den Hinweis schließen — der ungefähre Standort gilt schon. */
  soLassen: () => void
  ortSuchen: (text: string) => void
  uebernimm: (treffer: OrtsTreffer) => void
  keinerDavon: () => void
  /** Das Feld wird getippt: Der Satz und die Auswahl zum alten Text gelten nicht mehr. */
  textGeaendert: () => void
  /** „Ort ändern": Was noch unterwegs ist, gilt nicht mehr. */
  aufheben: () => void
}

/**
 * Meldet eine gescheiterte Ortsauflösung (Aktion nach einem Deploy unbekannt,
 * Serverfehler) an Sentry: fester Text und Fehlerklasse (Vorbild
 * meldeGescheitertesLaden in components/teilen/beitrag-teilen.tsx), aber anders
 * als dort keine Fehlermeldung, auch keine bereinigte: Sie kann den getippten
 * Text in anderer Schreibweise zitieren, und die Bereinigung erkennt nur seine
 * wörtliche. Die Funktion bekommt den Text darum gar nicht erst. Ein
 * Netzabbruch ist nur eine Brotkrume. Wirft nie — die Kundin behält ihre
 * Produktsuche auch, wenn Sentry selbst scheitert.
 */
function meldeGescheiterteOrtssuche(fehler: unknown): void {
  try {
    const klasse = fehlerKlasse(fehler)
    const name = BEZEICHNER.test(klasse) ? klasse : 'Unbekannt'
    if (istNetzfehler(fehler)) {
      Sentry.addBreadcrumb({ category: 'ortssuche', level: 'warning', message: 'Ortssuche: Verbindung abgebrochen', data: { klasse: name } })
      return
    }
    const ereignis = new Error('Ortssuche: Auflösen gescheitert')
    ereignis.name = name
    Sentry.captureException(ereignis, { level: 'error', tags: { bereich: 'ortssuche', klasse: name } })
  } catch {
    // Absichtlich leer: Telemetrie scheitert leise, die Kundin behält ihre Produktsuche.
  }
}

export function useOrtssuche({
  onStandort,
  onOrt,
  onZumFeld,
  ankunftsText = '',
  onAnkunftErledigt,
  onAnkunftAufgeloest,
}: {
  /** Der eigene Standort ist da — die Suche im Feld bleibt, wie sie ist. */
  onStandort: (punkt: Bezugspunkt) => void
  /** Ein getippter Ort ist aufgelöst — der Text war ein Ort, kein Produkt. */
  onOrt: (punkt: Bezugspunkt) => void
  /** Zum Suchfeld, wenn der Standort nicht geht: dort führt der andere Weg weiter. */
  onZumFeld: () => void
  /** Der Suchtext, mit dem die Kundin abgesendet auf /hoefe ankam: wird einmal wie Enter aufgelöst. */
  ankunftsText?: string
  /** Der Ankunftstext ist abgearbeitet — die Seite vergisst ihn, ein neuer Aufbau des Felds löst nichts mehr aus. */
  onAnkunftErledigt?: () => void
  /** Die Auflösung ist durch (Treffer, keiner oder gescheitert) — die Seite vermerkt in der Adresse, dass der Text abgesendet UND aufgelöst ist. Nicht mehr, wenn die Kundin /hoefe inzwischen verlassen hat. */
  onAnkunftAufgeloest?: () => void
}): Ortssuche {
  const [hinweis, setHinweis] = useState<string | null>(null)
  const [kandidaten, setKandidaten] = useState<OrtsTreffer[]>([])
  const [ungefaehr, setUngefaehr] = useState<UngefaehrerStandort | null>(null)
  const [ortet, setOrtet] = useState(false)
  const [laeuft, starteAufloesung] = useTransition()
  const waechter = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Die Laufnummer entscheidet, WESSEN Antwort noch zählt: Wer inzwischen
  // einen Ort gesucht oder den Umkreis aufgehoben hat, soll von einer späten
  // Antwort nicht überfahren werden — in beide Richtungen.
  const laufNr = useRef(0)
  const ankunftBegonnen = useRef(false)
  // Ob die Seite noch steht: Die Antwort der Ortssuche kann kommen, nachdem die Kundin /hoefe verlassen hat (Ankunfts-Effekt unten).
  const montiert = useRef(true)

  const verwerfeWaechter = () => {
    if (waechter.current) clearTimeout(waechter.current)
    waechter.current = null
  }

  // Kein Geister-Zeitgeber nach dem Abbau (Hausstandard); derselbe Abbau meldet späten Antworten, dass die Seite weg ist (montiert).
  useEffect(() => {
    // Beim Aufbau wieder auf true: Im Entwicklungsmodus baut React jeden Effekt einmal ab und gleich wieder auf — ohne das gälte die Seite dort für immer als verlassen.
    montiert.current = true
    return () => {
      montiert.current = false
      if (waechter.current) clearTimeout(waechter.current)
    }
  }, [])

  function zumFeld() {
    setHinweis(SUCHFELD_TEXT.ohneStandort)
    onZumFeld()
  }

  /** Die Ortung des Browsers ist da; ohne sie bleibt nur der Weg über das Suchfeld. */
  const kannOrten = () => typeof navigator !== 'undefined' && !!navigator.geolocation

  function standortErfragen() {
    if (ortet) return
    // Erst der Frühausstieg, DANN aufräumen: Ohne Geolocation soll ein
    // Fehlklick nicht die eben erarbeitete Ortsauswahl vernichten.
    if (!kannOrten()) {
      zumFeld()
      return
    }
    setHinweis(null)
    setKandidaten([])
    setUngefaehr(null)
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
        const punkt = { lat: position.coords.latitude, lon: position.coords.longitude }
        if (standortIstUngenau(position.coords.accuracy)) {
          // Meist die IP-Adresse statt GPS: Der ungefähre Punkt gilt trotzdem sofort — die Liste zeigt Höfe im Umkreis
          // (Mockup Zustand 3) —, und der Hinweis sagt es dazu und bietet „Genauer bestimmen" und „So lassen" an.
          setUngefaehr({ punkt, satz: standortUngefaehrText(position.coords.accuracy), genauerMisslang: false })
        }
        onStandort(punkt)
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

  function genauerBestimmen() {
    if (ortet || !ungefaehr) return
    const stand = ungefaehr
    setOrtet(true)
    const meinLauf = ++laufNr.current
    const veraltet = () => laufNr.current !== meinLauf
    verwerfeWaechter()

    // Misslingt der zweite Anlauf (Fehler, Zeit oder wieder nur grob), gilt der erste Wert weiter: Der Hinweis steht wieder da.
    const misslungen = () => {
      verwerfeWaechter()
      setOrtet(false)
      setUngefaehr({ ...stand, genauerMisslang: true })
    }
    waechter.current = setTimeout(() => {
      if (!veraltet()) misslungen()
    }, STANDORT_GENAU_GEDULD_MS)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (veraltet()) return
        // Am Rechner ohne GPS kommt auch beim zweiten Anlauf wieder die IP-Ortung: Der Hinweis bleibt, mit dem Zusatz.
        if (standortIstUngenau(position.coords.accuracy)) {
          misslungen()
          return
        }
        verwerfeWaechter()
        setOrtet(false)
        setUngefaehr(null)
        onStandort({ lat: position.coords.latitude, lon: position.coords.longitude })
      },
      () => {
        if (!veraltet()) misslungen()
      },
      { enableHighAccuracy: true, timeout: 12_000 }
    )
  }

  function soLassen() {
    if (!ungefaehr) return
    // Der ungefähre Punkt gilt schon seit seiner Ankunft — „So lassen" schließt nur den Hinweis.
    // Eine laufende Nachfrage gilt nicht mehr.
    laufNr.current += 1
    verwerfeWaechter()
    setOrtet(false)
    setUngefaehr(null)
  }

  function uebernimm(treffer: OrtsTreffer) {
    setKandidaten([])
    setHinweis(null)
    // Der aufgelöste Name statt des Rohtexts: „Mattighofen, Oberösterreich"
    // sagt mehr als „5230" — und zeigt, worauf sich die Entfernungen beziehen.
    onOrt({ lat: treffer.lat, lon: treffer.lon, name: treffer.name })
  }

  /** Löst den Text auf und setzt die Antwort ein — nur, solange `meinLauf` der jüngste Lauf ist. */
  async function loeseAuf(text: string, meinLauf: number) {
    let treffer: OrtsTreffer[]
    try {
      treffer = await loeseOrtAuf(text)
    } catch (fehler) {
      // Ein Wurf ginge an die Fehlergrenze — und seit dem Auflösen beim Ankommen endete jede Suche von der
      // Startseite auf der Fehlerseite. Für die Kundin ist es „kein Treffer"; Sentry sieht die Art, nie den Text.
      meldeGescheiterteOrtssuche(fehler)
      treffer = []
    }
    if (laufNr.current !== meinLauf) return
    // Die Seite ist weg (Tipp auf einen Hof, während die Ortssuche noch lief): Eine Antwort danach darf weder Hinweis noch
    // Auswahl setzen — und vor allem nicht über uebernimm → onOrt → onSuchtext('') → setzeFilter → schreibeUrl die Adresse
    // der inzwischen angezeigten Seite umschreiben (Neuladen oder Teilen landete sonst auf /hoefe).
    if (!montiert.current) return
    if (treffer.length === 0) {
      // Kein Treffer: ruhiger Hinweis, der Text bleibt eine Suche nach Höfen und Produkten.
      setHinweis(SUCHFELD_TEXT.keinOrt)
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
  }

  function ortSuchen(eingabe: string) {
    const text = eingabe.trim()
    if (!text || laeuft) return
    const meinLauf = ++laufNr.current
    verwerfeWaechter()
    setOrtet(false)
    setHinweis(null)
    setKandidaten([])
    setUngefaehr(null)
    starteAufloesung(() => loeseAuf(text, meinLauf))
  }

  // Die Kundin kam mit einem Suchtext an: Dort hat sie abgesendet, also löst die Seite ihn einmal auf —
  // genau wie Enter. Die Seite vergisst den Text danach (onAnkunftErledigt); ein neu aufgebautes Feld
  // (Karte ↔ Liste) löst damit nichts mehr aus, und getippter, nicht abgesendeter Text nie (die Seite
  // reicht nur den abgesendeten herein, abgesendeterSuchtext). Frisch aufgebaut ist nichts abzuräumen,
  // deshalb startet der Effekt nur die Auflösung. Die Adresse vermerkt erst NACH der Antwort, dass der
  // Text erledigt ist (onAnkunftAufgeloest), nicht schon hier: Next erweitert history.replaceState in
  // einem Effekt der Wurzel, und der läuft nach denen ihrer Kinder — nach der Antwort ist der Aufbau sicher durch.
  useEffect(() => {
    if (ankunftBegonnen.current || ankunftsText.trim() === '') return
    ankunftBegonnen.current = true
    onAnkunftErledigt?.()
    if (erkenneOrtseingabe(ankunftsText).art === 'text') return
    const meinLauf = ++laufNr.current
    starteAufloesung(async () => {
      await loeseAuf(ankunftsText.trim(), meinLauf)
      // Die Antwort kann kommen, nachdem die Kundin /hoefe verlassen hat (Tipp auf einen Hof, während die Ortssuche noch läuft). Dann
      // gehört die Adresse einer anderen Seite, und der Vermerk schriebe sie mit dem Pfad von /hoefe um: Neuladen oder Teilen landete
      // auf /hoefe. Ein nur neu aufgebautes Feld (Karte ↔ Liste, während die Antwort unterwegs ist) kann der Hook davon nicht
      // unterscheiden: Dann verwirft loeseAuf die Antwort ganz (kein Ort, kein Satz, keine Auswahl), und das neue Feld kennt den
      // Ankunftstext nicht mehr (onAnkunftErledigt) — die Kundin sendet neu ab; ein späteres Neuladen löst den Text noch einmal auf.
      if (montiert.current) onAnkunftAufgeloest?.()
    })
  })

  function keinerDavon() {
    setKandidaten([])
    setHinweis(null)
    onZumFeld()
  }

  function textGeaendert() {
    setHinweis(null)
    setKandidaten([])
  }

  function aufheben() {
    laufNr.current += 1
    verwerfeWaechter()
    setOrtet(false)
    setHinweis(null)
    setKandidaten([])
    setUngefaehr(null)
  }

  return {
    hinweis,
    kandidaten,
    ungefaehr,
    ortet,
    laeuft,
    standortErfragen,
    genauerBestimmen,
    soLassen,
    ortSuchen,
    uebernimm,
    keinerDavon,
    textGeaendert,
    aufheben,
  }
}
