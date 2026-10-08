'use client'

import { useSyncExternalStore } from 'react'
import { Smartphone } from 'lucide-react'
import { STARTBILDSCHIRM_KARTE, laeuftAlsApp } from '@/lib/startbildschirm'

/*
 * „Leg FarmerZone auf den Startbildschirm" — ganz unten auf Heute, nur im
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

/** Der Inhalt der Karte — ohne Entscheidung, ob sie erscheint. */
export function StartbildschirmAnleitung(): React.JSX.Element {
  return (
    <section aria-labelledby="heute-startbildschirm" className="rounded-2xl border border-border bg-card p-[18px]">
      <h2 id="heute-startbildschirm" className="flex items-start gap-2.5 text-[15px] leading-snug font-semibold">
        <Smartphone className="mt-px size-[18px] shrink-0 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
        {STARTBILDSCHIRM_KARTE.titel}
      </h2>
      <dl className="mt-3 grid gap-3 md:grid-cols-2 md:gap-5">
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
