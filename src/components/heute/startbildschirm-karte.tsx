'use client'

import { useId, useState, useSyncExternalStore } from 'react'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'
import { STARTBILDSCHIRM_KARTE, laeuftAlsApp } from '@/lib/startbildschirm'

/*
 * Die Karte „auf den Startbildschirm legen" — zuletzt in der Seitenspalte von Heute (Board w1-heute), nur im
 * Browser, nicht in der installierten App (Register N1, Nachtlauf Nr. 41).
 * Texte und Regel: src/lib/startbildschirm.ts.
 *
 * Ob die Seite als App läuft, weiß erst der Browser. Der Server rendert
 * deshalb nichts, und die Entscheidung fällt nach dem Mounten
 * (useSyncExternalStore mit eigenem Server-Wert) — sonst wiche das HTML beim
 * Hydrieren ab. Die Karte steht als letzter Teil der Seite, ihr Erscheinen
 * schiebt nichts darüber. Kein Speicher im Browser (Register T1): Ein
 * „Ausblenden" gibt es nicht, wer installiert hat, sieht sie nicht mehr.
 */

const APP_ABFRAGE = '(display-mode: standalone)'

type Anzeige = 'app' | 'browser'

function abonniere(melde: () => void): () => void {
  // Wird die Seite installiert, während sie offen ist, wechselt der Modus.
  const liste = window.matchMedia(APP_ABFRAGE)
  liste.addEventListener('change', melde)
  return () => liste.removeEventListener('change', melde)
}

/** Im Browser: läuft die Seite als installierte App? */
export function anzeigeImBrowser(): Anzeige {
  // navigator.standalone gibt es nur in Safari auf iPhone und iPad.
  const ios = (navigator as Navigator & { standalone?: boolean }).standalone
  return laeuftAlsApp({ standalone: window.matchMedia(APP_ABFRAGE).matches, iosStandalone: ios }) ? 'app' : 'browser'
}

function aufDemServer(): null {
  return null
}

/**
 * Der Inhalt der Karte — ohne Entscheidung, ob sie erscheint. Nach Board
 * s1-/w1-heute: Titel „Mit einem Tipp in deinem Hof“, darunter der Satz
 * „Leg … auf den Startbildschirm.“ und der Umriss-Knopf „So geht’s“ über die
 * volle Breite, der die Anleitung für iPhone und Android aufklappt. Titel und
 * Satz sind die zwei Hälften von STARTBILDSCHIRM_KARTE.titel (Text bleibt in
 * src/lib/startbildschirm.ts); die Anleitung steht im HTML, nur verborgen.
 */
export function StartbildschirmAnleitung(): React.JSX.Element {
  const [offen, setOffen] = useState(false)
  const anleitungId = useId()
  const trenner = STARTBILDSCHIRM_KARTE.titel.indexOf(': ')
  const titel = trenner > 0 ? STARTBILDSCHIRM_KARTE.titel.slice(0, trenner) : STARTBILDSCHIRM_KARTE.titel
  const satz = trenner > 0 ? `${STARTBILDSCHIRM_KARTE.titel.slice(trenner + 2)}.` : null
  return (
    <section aria-labelledby="heute-startbildschirm" className="flex flex-col gap-1 rounded-[12px] border border-border bg-card p-[18px]">
      <h2 id="heute-startbildschirm" className="text-[15px] leading-snug font-semibold">
        {titel}
      </h2>
      {satz && <p className="text-[13.5px] leading-snug text-muted-foreground">{satz}</p>}
      <button
        type="button"
        aria-expanded={offen}
        aria-controls={anleitungId}
        onClick={() => setOffen((alt) => !alt)}
        className={cn(
          'mt-2.5 inline-flex min-h-[52px] w-full items-center justify-center rounded-[14px] border-[1.5px] border-foreground/70 bg-card px-4 text-[15px] font-bold text-foreground transition-colors duration-[250ms] hover:bg-muted',
          FOKUS_RAHMEN
        )}
      >
        So geht’s
      </button>
      <dl id={anleitungId} hidden={!offen} className="mt-3 grid gap-3">
        {STARTBILDSCHIRM_KARTE.anleitungen.map((anleitung) => (
          <div key={anleitung.geraet}>
            <dt className="text-[13px] font-semibold">{anleitung.geraet}</dt>
            <dd className="mt-0.5 text-[13px] leading-normal text-muted-foreground">{anleitung.saetze.join(' ')}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function StartbildschirmKarte(): React.JSX.Element | null {
  const anzeige = useSyncExternalStore(abonniere, anzeigeImBrowser, aufDemServer)
  if (anzeige !== 'browser') return null
  return <StartbildschirmAnleitung />
}
