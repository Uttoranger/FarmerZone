'use client'

import { useSyncExternalStore } from 'react'
import { PauseCircle } from 'lucide-react'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { BESTELLSTOPP_TEXT, NOTBREMSE_PFAD, bestellstoppAusAntwort, bestellstoppBisText, type Bestellstopp } from '@/lib/notbremse'

/*
 * Das Band der Notbremse (Register N34, Nr. 189) unter dem Kopf jeder
 * Kundenseite (KundeShell und KundeFokusShell) — und der Hinweis an den
 * Kaufknöpfen (Hofseite, Produktseite, Korb-Blatt).
 *
 * Die Kundenseiten sind statisch bzw. gecacht (Startseite, Hofseite): Würden
 * sie die Notbremse beim Rendern lesen, müsste jede Seite neu gebaut werden.
 * Darum fragt der Browser nach dem Laden EINMAL nach (GET /api/notbremse, aus
 * dem Cache der Einstellung) und merkt sich die Antwort eine Minute für alle
 * Bauteile der Seite und die nächsten Seiten. Server und Hydrieren sagen
 * „keine Notbremse“ — dieselbe Ausgabe, kein Hydrationsfehler. Das Band ist
 * ein Hinweis; durchgesetzt wird die Notbremse am Server (Prüfkette).
 *
 * Läuft „bis“ ab, während die Seite offen ist, verschwindet das Band zu genau
 * diesem Zeitpunkt (Frist beim Lesen, auch im Browser).
 */

const MERKEN_MS = 60_000
// setTimeout trägt höchstens 2^31 − 1 ms; die Notbremse hält ohnehin höchstens 72 Stunden.
const TIMER_HOECHSTENS_MS = 2_147_483_647

let stand: Bestellstopp | null = null
let geholtAm = 0
let laeuft = false
let endeTimer: ReturnType<typeof setTimeout> | null = null
const hoerer = new Set<() => void>()

function melde(): void {
  for (const h of hoerer) h()
}

function setze(neu: Bestellstopp | null): void {
  if (endeTimer) clearTimeout(endeTimer)
  endeTimer = null
  const vorher = stand
  stand = neu
  if (neu) {
    const rest = Date.parse(neu.bis) - Date.now()
    if (rest <= 0) stand = null
    else
      endeTimer = setTimeout(() => {
        stand = null
        melde()
      }, Math.min(rest, TIMER_HOECHSTENS_MS))
  }
  if (vorher?.satz !== stand?.satz || vorher?.bis !== stand?.bis) melde()
}

function hole(): void {
  if (laeuft || Date.now() - geholtAm < MERKEN_MS) return
  laeuft = true
  fetch(NOTBREMSE_PFAD, { cache: 'no-store' })
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
    .then((daten: unknown) => {
      geholtAm = Date.now()
      setze(bestellstoppAusAntwort(daten))
    })
    // Kein Netz, Bremse oder Serverfehler: kein Band. Die Kasse lehnt notfalls am Server ab.
    .catch(() => {})
    .finally(() => {
      laeuft = false
    })
}

function abonniere(h: () => void): () => void {
  hoerer.add(h)
  hole()
  return () => {
    hoerer.delete(h)
  }
}

function lies(): Bestellstopp | null {
  return stand
}

function aufDemServer(): Bestellstopp | null {
  return null
}

/** Die Notbremse, wie der Browser sie gerade kennt — null, solange keine gilt (und auf dem Server). */
export function useBestellstopp(): Bestellstopp | null {
  return useSyncExternalStore(abonniere, lies, aufDemServer)
}

/**
 * Das Band selbst — ohne Abfrage, damit es sich ohne DOM prüfen lässt. Der
 * Rahmen mit `role="status"` steht immer da: Ein Vorleseprogramm sagt nur an,
 * was sich in einer schon vorhandenen Live-Region ändert (wie NetzZeile).
 */
export function BestellstoppZeile({ stopp }: { stopp: Bestellstopp | null }): React.JSX.Element {
  return (
    <div role="status" data-notbremse-band="" className="print:hidden">
      {stopp && (
        <p className="flex min-h-11 items-start gap-2.5 border-b border-primary/45 bg-zustand-tun-grund px-4 py-2.5 text-[13.5px] text-foreground md:items-center md:px-6">
          <PauseCircle className="mt-0.5 size-[18px] shrink-0 text-zustand-tun md:mt-0" strokeWidth={1.8} aria-hidden="true" />
          <span className="min-w-0 break-words">
            <span className="font-semibold">{stopp.satz}</span> <span className="whitespace-nowrap">{bestellstoppBisText(stopp.bis)}</span>
          </span>
        </p>
      )}
    </div>
  )
}

/** Das Band unter dem Kopf der Kundenseiten. */
export function NotbremseBand(): React.JSX.Element {
  return <BestellstoppZeile stopp={useBestellstopp()} />
}

/**
 * Der Grund an der Stelle, an der sonst „Zur Kasse“ bzw. die Kaufsperre steht
 * (Korb-Blatt, Produktseite) — dieselbe Gestalt wie `KaufSperreHinweis`.
 * Ohne Notbremse nichts.
 */
export function BestellstoppHinweis({ stopp }: { stopp: Bestellstopp | null }): React.JSX.Element | null {
  if (!stopp) return null
  return (
    <Hinweiskarte ton="orange" symbol={PauseCircle} titel={BESTELLSTOPP_TEXT.titel}>
      <span className="break-words">
        {stopp.satz} {bestellstoppBisText(stopp.bis)}.
      </span>
    </Hinweiskarte>
  )
}
