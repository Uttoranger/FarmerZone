'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Stepper } from '@/components/ui/stepper'
import { setzeVorrat, type VorratErgebnis } from '@/server/actions/products'
import { VORRAT_MAX } from '@/lib/eingabegrenzen'
import { cn } from '@/lib/utils'

const SPEICHERN_GING_NICHT = 'Wir konnten den Vorrat nicht speichern. Bitte versuch es noch einmal.'

/*
 * Der Vorrat einer Zeile, direkt änderbar (Mockup web-h2-produkte: „Vorrat
 * direkt hier ändern"). − und + oder eine eingetippte Zahl; zum Server geht
 * der Wert erst, wenn er fertig ist (Loslassen, Verlassen des Felds —
 * `onWertBestaetigt`), nicht bei jedem Tastendruck.
 *
 * Gesetzt wird bedingt (setzeVorrat): Der Browser schickt den letzten
 * BESTÄTIGTEN Vorrat als `vorher`. Kommt eine zweite Änderung, während die
 * erste noch läuft, wartet sie und geht danach mit dem neuen bestätigten Stand
 * los — nie zwei Anfragen mit demselben `vorher`, die sich gegenseitig als
 * „inzwischen geändert" abwiesen. Hat eine Bestellung dazwischen gebucht,
 * zeigt das Feld den Stand des Servers und den Satz dazu, inline.
 */
export function VorratFeld({
  productId,
  name,
  stock,
  onWiederDa,
  className,
}: {
  productId: string
  name: string
  /** Der Vorrat aus der letzten Server-Antwort der Seite. */
  stock: number
  /** Der Server hat 0 → mehr als 0 bestätigt; ob der Moment kommt, entscheidet die Ansicht. */
  onWiederDa: (vorrat: number) => void
  className?: string
}): React.JSX.Element {
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

  // Der bestätigte Stand für die Schleife unten — Refs liest nur der Handler, nie das Rendern.
  const bestaetigtRef = useRef(stock)
  const laeuftRef = useRef(false)
  const wartend = useRef<number | null>(null)
  useEffect(() => {
    if (!laeuftRef.current) bestaetigtRef.current = bestaetigt
  }, [bestaetigt])

  async function senden(ziel: number): Promise<void> {
    if (laeuftRef.current) {
      wartend.current = ziel
      return
    }
    laeuftRef.current = true
    setLaeuft(true)
    setFehler(null)

    let naechstes: number | null = ziel
    while (naechstes !== null) {
      const neu: number = naechstes
      naechstes = null
      const vorher = bestaetigtRef.current
      if (neu !== vorher) {
        let ergebnis: VorratErgebnis
        try {
          ergebnis = await setzeVorrat({ productId, vorher, neu })
        } catch {
          ergebnis = { error: SPEICHERN_GING_NICHT }
        }
        if ('ok' in ergebnis) {
          bestaetigtRef.current = ergebnis.vorrat
          setBestaetigt(ergebnis.vorrat)
          if (ergebnis.wiederDa) onWiederDa(ergebnis.vorrat)
        } else {
          // Abgewiesen: zurück auf den Stand, den der Server kennt; eine
          // wartende Änderung beruhte auf dem alten Stand und entfällt.
          wartend.current = null
          const stand = ergebnis.vorrat ?? bestaetigtRef.current
          bestaetigtRef.current = stand
          setBestaetigt(stand)
          setAnzeige(stand)
          setFehler(ergebnis.error)
          // Status, Kopfzeile und „Heute" sollen denselben Stand zeigen wie das Feld.
          if (ergebnis.code === 'GEAENDERT') router.refresh()
          break
        }
      }
      naechstes = wartend.current
      wartend.current = null
    }

    laeuftRef.current = false
    setLaeuft(false)
  }

  return (
    <div className={cn('flex flex-col items-start', className)}>
      <Stepper
        beschriftung={`Vorrat ${name}`}
        wert={anzeige}
        onWertChange={setAnzeige}
        onWertBestaetigt={(wert) => void senden(wert)}
        min={0}
        // Ein Altbestand über der Grenze bleibt sichtbar und darf sinken (src/schemas/vorrat.ts).
        max={Math.max(VORRAT_MAX, bestaetigt)}
        laeuft={laeuft}
        eingabeClassName="w-14"
      />
      {/* Ständig vorhanden, damit der Screenreader die Meldung ansagt, sobald sie kommt. */}
      <p aria-live="polite" className={cn('max-w-[11rem] text-xs leading-snug text-status-offen', !fehler && 'sr-only')}>
        {fehler}
      </p>
    </div>
  )
}
