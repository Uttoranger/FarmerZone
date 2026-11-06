'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PFLICHT_KNOPF, PFLICHT_KNOPF_RAHMEN, PflichtKarte } from '@/components/heute/pflicht-karte'
import { aktionOhneWurf } from '@/components/mein-hof/abschnitt-speichern'
import { AGB_ZUSTIMMUNG_TEXT } from '@/lib/agb-zustimmung'
import { stimmeAgbZu } from '@/server/actions/agb-zustimmung'

/**
 * Karte „AGB bestätigen“ (Nr. 207, § 104 JN, P2B) in Heute und in „Hof
 * einrichten“ — dasselbe Muster wie die anderen Karten in Heute
 * (PflichtKarte: orange, ohne Symbol, Knöpfe über die volle Breite, Board
 * s1-heute Bild 5): „Ich stimme den AGB zu“ und darunter der Link zu /agb
 * (neuer Tab, die Karte bleibt). Wortlaut und Ablauf bleiben (Nr. 207). Die Seite zeigt die Karte nur, solange
 * der Hof der aktuellen Fassung nicht zugestimmt hat (brauchtAgbZustimmung);
 * nach dem Speichern lädt sie neu, die Karte ist weg. Kein Lockout.
 */
export function AgbZustimmenKarte({ fassung, geaendert }: { fassung: string; geaendert: boolean }): React.JSX.Element {
  const router = useRouter()
  const [laeuft, starte] = useTransition()
  const [fehler, setFehler] = useState<string | null>(null)
  return (
    <PflichtKarte
      titel={AGB_ZUSTIMMUNG_TEXT.titel}
      knoepfe={
        <>
          <button
            type="button"
            className={PFLICHT_KNOPF}
            disabled={laeuft}
            aria-busy={laeuft || undefined}
            onClick={() =>
              starte(async () => {
                setFehler(null)
                const antwort = await aktionOhneWurf(() => stimmeAgbZu({ fassung }))
                if ('error' in antwort) setFehler(antwort.error)
                else router.refresh()
              })
            }
          >
            {AGB_ZUSTIMMUNG_TEXT.knopf}
          </button>
          <Link href={AGB_ZUSTIMMUNG_TEXT.pfad} target="_blank" rel="noopener noreferrer" className={PFLICHT_KNOPF_RAHMEN}>
            {AGB_ZUSTIMMUNG_TEXT.lesen}
            <span className="sr-only"> (öffnet in neuem Tab)</span>
          </Link>
        </>
      }
    >
      <p>{geaendert ? AGB_ZUSTIMMUNG_TEXT.satzGeaendert(fassung) : AGB_ZUSTIMMUNG_TEXT.satzNeu(fassung)}</p>
      {fehler && (
        <p role="alert" className="mt-1 font-semibold">
          {fehler}
        </p>
      )}
    </PflichtKarte>
  )
}
