'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { HinweiskarteFehler } from '@/components/ui/hinweiskarte'
import { ErfolgKasten } from '@/components/ui/erfolg-kasten'
import { RUNDUNG } from '@/components/ui/rundung'
import { bestaetigeNeuigkeiten } from '@/server/actions/subscriptions'
import { ABO_TEXT } from '@/lib/abo-bestaetigung'
import { TEXTLINK } from '@/components/anmelden/stil'
import { ZU_HOF_LINK } from './stil'

/*
 * Der Link aus der Bestätigungsmail landet hier (/account/neuigkeiten-bestaetigen,
 * Double-Opt-in, S11, Nr. 38). Bestätigt wird erst mit dem Knopf — ein Link
 * aus einer Mail ändert nie einen Zustand, Link-Scanner rufen ihn ungefragt
 * auf (ARCHITECTURE §5). In Grün: Kundensache. Seit Nr. 239 nach Board
 * s2-/w2-neuigkeiten ohne Symbol und ohne Karte, Fehler als Fehlerkasten.
 * Seit Nr. 279 (Abnahme Lauf 32, neuigkeiten Bild 2): „Danke, du bist
 * angemeldet“ als grün getönter Erfolgskasten mit Häkchen-Kreis, „Zu <Hof>“
 * darin als unterstrichener Textlink statt Knopf.
 */

const TITEL = 'font-heading text-[24px] leading-tight font-semibold outline-none'
const SATZ = 'text-[15px] leading-normal break-words text-muted-foreground [overflow-wrap:anywhere]'
/** Grüner Knopf über die volle Breite: Rechteck mit 14 px Rundung (Board s2-neuigkeiten, Bild 1). */
const KNOPF_BREIT_GRUEN = cn(
  'inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[14px] bg-accent px-4 text-[15px] font-bold text-accent-foreground transition-opacity duration-[250ms] hover:opacity-90 disabled:opacity-60',
  FOKUS_RAHMEN
)

export function AboBestaetigenKarte({
  token,
  hofName,
  hofSlug,
}: {
  token: string
  hofName: string
  hofSlug: string
}): React.JSX.Element {
  const [laedt, starte] = useTransition()
  const [stand, setStand] = useState<'offen' | 'bestaetigt' | { fehler: string }>('offen')
  const ueberschrift = useRef<HTMLHeadingElement>(null)
  const erfolg = useRef<HTMLElement>(null)

  function bestaetigen(): void {
    starte(async () => {
      const antwort = await bestaetigeNeuigkeiten({ token })
      setStand('ok' in antwort ? 'bestaetigt' : { fehler: antwort.error })
      // Der Inhalt wechselt — der Fokus folgt der neuen Überschrift bzw. dem Erfolgskasten, der sie trägt.
      requestAnimationFrame(() => (erfolg.current ?? ueberschrift.current)?.focus())
    })
  }

  if (stand === 'bestaetigt') {
    return (
      // Der Kasten trägt den Fokus (tabIndex -1) und heißt wie seine Überschrift — so liest der Vorleser „Danke, …“.
      <section ref={erfolg} tabIndex={-1} aria-labelledby="abo-titel" className="outline-none">
        <ErfolgKasten titel={<span id="abo-titel">{ABO_TEXT.danke}</span>} className={RUNDUNG.hinweis}>
          <p className="break-words [overflow-wrap:anywhere]">
            {ABO_TEXT.dankeSatz[0]} <strong className="font-semibold">{hofName}</strong> {ABO_TEXT.dankeSatz[1]}
          </p>
          <Link href={`/${hofSlug}`} className={ZU_HOF_LINK}>
            Zu {hofName}
          </Link>
        </ErfolgKasten>
      </section>
    )
  }

  return (
    <section aria-labelledby="abo-titel" className="flex flex-col gap-3">
      <h2 id="abo-titel" ref={ueberschrift} tabIndex={-1} className={TITEL}>
        {ABO_TEXT.offenTitel}
      </h2>
      <p className={SATZ}>
        {ABO_TEXT.offenSatz[0]} <strong className="font-semibold text-foreground">{hofName}</strong> {ABO_TEXT.offenSatz[1]}
      </p>
      {typeof stand === 'object' && <HinweiskarteFehler titel={ABO_TEXT.fehlerTitel}>{stand.fehler}</HinweiskarteFehler>}
      <button type="button" onClick={bestaetigen} disabled={laedt} className={KNOPF_BREIT_GRUEN}>
        {laedt ? (
          <>
            <Loader2 className="size-4 animate-spin" strokeWidth={1.7} aria-hidden="true" />
            Einen Moment …
          </>
        ) : (
          ABO_TEXT.knopf
        )}
      </button>
      {typeof stand === 'object' ? (
        <Link href="/account/profile" className={TEXTLINK}>
          Anmeldungen unter „Mein Konto“ verwalten
        </Link>
      ) : (
        <p className="text-[13px] leading-normal text-muted-foreground">{ABO_TEXT.nichtAngemeldet}</p>
      )}
    </section>
  )
}
