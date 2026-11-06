'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { HinweiskarteFehler } from '@/components/ui/hinweiskarte'
import { bestaetigeNeuigkeiten } from '@/server/actions/subscriptions'
import { ABO_TEXT } from '@/lib/abo-bestaetigung'
import { TEXTLINK } from '@/components/anmelden/stil'

/*
 * Der Link aus der Bestätigungsmail landet hier (/account/neuigkeiten-bestaetigen,
 * Double-Opt-in, S11, Nr. 38). Bestätigt wird erst mit dem Knopf — ein Link
 * aus einer Mail ändert nie einen Zustand, Link-Scanner rufen ihn ungefragt
 * auf (ARCHITECTURE §5). In Grün: Kundensache. Seit Nr. 239 nach Board
 * s2-/w2-neuigkeiten ohne Symbol und ohne Karte, Fehler als Fehlerkasten.
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

  function bestaetigen(): void {
    starte(async () => {
      const antwort = await bestaetigeNeuigkeiten({ token })
      setStand('ok' in antwort ? 'bestaetigt' : { fehler: antwort.error })
      // Der Inhalt wechselt — der Fokus folgt der neuen Überschrift.
      requestAnimationFrame(() => ueberschrift.current?.focus())
    })
  }

  if (stand === 'bestaetigt') {
    return (
      <section aria-labelledby="abo-titel" className="flex flex-col gap-3">
        <h2 id="abo-titel" ref={ueberschrift} tabIndex={-1} className={TITEL}>
          {ABO_TEXT.danke}
        </h2>
        <p className={SATZ}>
          {ABO_TEXT.dankeSatz[0]} <strong className="font-semibold text-foreground">{hofName}</strong> {ABO_TEXT.dankeSatz[1]}
        </p>
        {/* „Zu <Hof>“ (Wortliste N42 c). */}
        <Link href={`/${hofSlug}`} className={KNOPF_BREIT_GRUEN}>
          Zu {hofName}
        </Link>
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
