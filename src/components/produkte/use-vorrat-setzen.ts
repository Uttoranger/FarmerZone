/** Den Vorrat eines Produkts setzen: eine reine Schleife und ein Hook darauf, für Tabelle und Vorrat-Blatt (Register N25). */
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { setzeVorrat, type VorratErgebnis } from '@/server/actions/products'
import { NETZ_SATZ, istNetzFehler } from '@/lib/netz'

export const SPEICHERN_GING_NICHT = 'Wir konnten den Vorrat nicht speichern. Bitte versuch es noch einmal.'

/** Wie eine Runde des Sendens ausging — das Blatt schließt nur nach `ok` oder ohne Änderung. */
export type VorratAusgang =
  | { art: 'ok'; vorrat: number }
  | { art: 'abgewiesen'; stand: number; fehler: string }
  /** Eine Anfrage läuft schon; der Wert geht danach mit dem neuen Stand los. */
  | { art: 'wartet' }
  /** Der Wert ist der bestätigte Stand — keine Anfrage. */
  | { art: 'unveraendert' }

export type VorratMeldungen = {
  beginn: () => void
  ok: (vorrat: number, wiederDa: boolean) => void
  abgewiesen: (stand: number, fehler: string, geaendert: boolean) => void
  ende: () => void
}

export type VorratSchleife = {
  senden: (ziel: number) => Promise<VorratAusgang>
  /** Ein neuer Stand vom Server gilt nur, solange nichts unterwegs ist — sonst überschriebe er die Eingabe. */
  nimmServerStand: (stand: number) => void
}

/*
 * Die Schleife des Sendens, rein und ohne React (Register N25; prüfbar in
 * tests/vorrat-setzen.test.ts). Gesetzt wird bedingt (setzeVorrat): Sie
 * schickt den letzten BESTÄTIGTEN Vorrat als `vorher`. Kommt eine zweite
 * Änderung, während die erste noch läuft, wartet sie und geht danach mit dem
 * neuen bestätigten Stand los — nie zwei Anfragen mit demselben `vorher`, die
 * sich gegenseitig als „inzwischen geändert" abwiesen. Weist der Server ab,
 * gilt sein Stand, und eine wartende Änderung entfällt (sie beruhte auf dem
 * alten). Gespeichert wird immer ein neuer Wert, nie eine Erhöhung.
 */
export function erzeugeVorratSchleife(optionen: {
  productId: string
  bestaetigt: number
  setze: (eingabe: { productId: string; vorher: number; neu: number }) => Promise<VorratErgebnis>
  melde: VorratMeldungen
}): VorratSchleife {
  const { productId, setze, melde } = optionen
  let bestaetigt = optionen.bestaetigt
  let laeuft = false
  let wartend: number | null = null

  async function senden(ziel: number): Promise<VorratAusgang> {
    if (laeuft) {
      wartend = ziel
      return { art: 'wartet' }
    }
    laeuft = true
    melde.beginn()
    let ausgang: VorratAusgang = { art: 'unveraendert' }

    let naechstes: number | null = ziel
    while (naechstes !== null) {
      const neu: number = naechstes
      naechstes = null
      const vorher = bestaetigt
      if (neu !== vorher) {
        let ergebnis: VorratErgebnis
        try {
          ergebnis = await setze({ productId, vorher, neu })
        } catch (fehler) {
          // Am Netz gescheitert: der eine Satz dafür (Register N29), sonst wie bisher.
          ergebnis = { error: istNetzFehler(fehler) ? NETZ_SATZ : SPEICHERN_GING_NICHT }
        }
        if ('ok' in ergebnis) {
          bestaetigt = ergebnis.vorrat
          ausgang = { art: 'ok', vorrat: ergebnis.vorrat }
          melde.ok(ergebnis.vorrat, ergebnis.wiederDa)
        } else {
          wartend = null
          const stand = ergebnis.vorrat ?? bestaetigt
          bestaetigt = stand
          ausgang = { art: 'abgewiesen', stand, fehler: ergebnis.error }
          melde.abgewiesen(stand, ergebnis.error, ergebnis.code === 'GEAENDERT')
          break
        }
      }
      naechstes = wartend
      wartend = null
    }

    laeuft = false
    melde.ende()
    return ausgang
  }

  return {
    senden,
    nimmServerStand: (stand) => {
      if (!laeuft) bestaetigt = stand
    },
  }
}

export type VorratSetzen = {
  /** Was das Feld zeigt — die Eingabe, nach einer Abweisung der Stand des Servers. */
  anzeige: number
  setAnzeige: (wert: number) => void
  /** Der Vorrat, den der Server zuletzt bestätigt hat. */
  bestaetigt: number
  laeuft: boolean
  fehler: string | null
  senden: (ziel: number) => Promise<VorratAusgang>
}

/**
 * Der Vorrat eines Produkts setzen — EINE Logik für das Feld der Tabelle
 * (`VorratFeld`) und das Vorrat-Blatt der Karten-Zeilen (`VorratBlatt`).
 * `onWiederDa`: Der Server hat 0 → mehr als 0 bestätigt; ob und wann der
 * Moment kommt, entscheidet der Aufrufer.
 */
export function useVorratSetzen({
  productId,
  stock,
  onWiederDa,
}: {
  productId: string
  /** Der Vorrat aus der letzten Server-Antwort der Seite. */
  stock: number
  onWiederDa: (vorrat: number) => void
}): VorratSetzen {
  const [anzeige, setAnzeige] = useState(stock)
  const [bestaetigt, setBestaetigt] = useState(stock)
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const router = useRouter()

  // Ein neuer Stand vom Server (nach dem Speichern oder einer Bestellung) gilt,
  // solange gerade nichts unterwegs ist — sonst überschriebe er die Eingabe.
  const [letzterStand, setLetzterStand] = useState(stock)
  if (stock !== letzterStand) {
    setLetzterStand(stock)
    if (!laeuft) {
      setAnzeige(stock)
      setBestaetigt(stock)
    }
  }

  // Die Schleife ruft zurück, wenn der Render, aus dem sie stammt, längst vorbei ist: immer der neueste Rückruf.
  const rueckrufe = useRef({ onWiederDa, router })
  useEffect(() => {
    rueckrufe.current = { onWiederDa, router }
  })

  // Die Schleife entsteht beim ersten Senden (im Handler, nie beim Rendern) und lebt so lange wie die Komponente.
  const schleife = useRef<VorratSchleife | null>(null)
  useEffect(() => {
    schleife.current?.nimmServerStand(bestaetigt)
  }, [bestaetigt])

  function senden(ziel: number): Promise<VorratAusgang> {
    schleife.current ??= erzeugeVorratSchleife({
      productId,
      bestaetigt,
      setze: setzeVorrat,
      melde: {
        beginn: () => {
          setLaeuft(true)
          setFehler(null)
        },
        ok: (vorrat, wiederDa) => {
          setBestaetigt(vorrat)
          if (wiederDa) rueckrufe.current.onWiederDa(vorrat)
        },
        abgewiesen: (stand, text, geaendert) => {
          setBestaetigt(stand)
          setAnzeige(stand)
          setFehler(text)
          // Status, Kopfzeile und „Heute" sollen denselben Stand zeigen wie das Feld.
          if (geaendert) rueckrufe.current.router.refresh()
        },
        ende: () => setLaeuft(false),
      },
    })
    return schleife.current.senden(ziel)
  }

  return { anzeige, setAnzeige, bestaetigt, laeuft, fehler, senden }
}
