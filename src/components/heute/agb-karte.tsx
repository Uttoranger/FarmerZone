'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FileText } from 'lucide-react'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { KNOPF_ORANGE, KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'
import { aktionOhneWurf } from '@/components/mein-hof/abschnitt-speichern'
import { AGB_ZUSTIMMUNG_TEXT } from '@/lib/agb-zustimmung'
import { stimmeAgbZu } from '@/server/actions/agb-zustimmung'

/**
 * Karte „AGB bestätigen“ (Nr. 207, § 104 JN, P2B) in Heute und in „Hof
 * einrichten“ — dasselbe Muster wie die anderen Karten in Heute
 * (Hinweiskarte orange, ein Hauptknopf): Link zu /agb (neuer Tab, die Karte
 * bleibt) und „Ich stimme den AGB zu“. Die Seite zeigt die Karte nur, solange
 * der Hof der aktuellen Fassung nicht zugestimmt hat (brauchtAgbZustimmung);
 * nach dem Speichern lädt sie neu, die Karte ist weg. Kein Lockout.
 */
export function AgbZustimmenKarte({ fassung, geaendert }: { fassung: string; geaendert: boolean }): React.JSX.Element {
  const router = useRouter()
  const [laeuft, starte] = useTransition()
  const [fehler, setFehler] = useState<string | null>(null)
  return (
    <Hinweiskarte
      ton="orange"
      symbol={FileText}
      titel={AGB_ZUSTIMMUNG_TEXT.titel}
      aktion={
        <div className="flex flex-wrap gap-2">
          <Link href={AGB_ZUSTIMMUNG_TEXT.pfad} target="_blank" rel="noopener noreferrer" className={KNOPF_RAHMEN}>
            {AGB_ZUSTIMMUNG_TEXT.lesen}
            <span className="sr-only"> (öffnet in neuem Tab)</span>
          </Link>
          <button
            type="button"
            className={KNOPF_ORANGE}
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
        </div>
      }
    >
      <p className="text-[12.5px]">{geaendert ? AGB_ZUSTIMMUNG_TEXT.satzGeaendert(fassung) : AGB_ZUSTIMMUNG_TEXT.satzNeu(fassung)}</p>
      {fehler && (
        <p role="alert" className="mt-1 text-[12.5px]">
          {fehler}
        </p>
      )}
    </Hinweiskarte>
  )
}
