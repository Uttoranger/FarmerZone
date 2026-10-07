'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { CircleCheck, Loader2, MailCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { KNOPF_GRUEN } from '@/components/bestaetigung/bestaetigung-teile'
import { bestaetigeNeuigkeiten } from '@/server/actions/subscriptions'

/*
 * Der Link aus der Bestätigungsmail landet hier (/account/neuigkeiten-bestaetigen,
 * Double-Opt-in, S11, Nr. 38). Bestätigt wird erst mit dem Knopf — ein Link
 * aus einer Mail ändert nie einen Zustand, Link-Scanner rufen ihn ungefragt
 * auf (ARCHITECTURE §5). Aufbau wie /verify (BestaetigenKarte), in Grün:
 * Kundensache.
 */

const TITEL = 'font-heading text-[22px] leading-tight font-semibold outline-none md:text-2xl'
const TEXTLINK = cn('inline-flex min-h-11 items-center rounded-full px-1 text-[14px] font-semibold text-status-fertig hover:underline', FOKUS_RAHMEN)

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
      <section aria-labelledby="abo-titel" className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <CircleCheck className="mt-1 size-6 shrink-0 text-status-fertig" strokeWidth={1.7} aria-hidden="true" />
          <div className="min-w-0">
            <h2 id="abo-titel" ref={ueberschrift} tabIndex={-1} className={TITEL}>
              Danke, du bist angemeldet
            </h2>
            <p className="mt-1 text-[14px] break-words text-muted-foreground [overflow-wrap:anywhere]">
              Ab jetzt bekommst du Neuigkeiten von <strong className="font-semibold text-foreground">{hofName}</strong> per E-Mail.
              Abmelden kannst du dich jederzeit über den Link in jeder Mail.
            </p>
          </div>
        </div>
        <Link href={`/${hofSlug}`} className={cn(KNOPF_GRUEN, 'h-12 w-full')}>
          Zum Hof
        </Link>
      </section>
    )
  }

  return (
    <section aria-labelledby="abo-titel" className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <MailCheck className="mt-1 size-6 shrink-0 text-status-fertig" strokeWidth={1.7} aria-hidden="true" />
        <div className="min-w-0">
          <h2 id="abo-titel" ref={ueberschrift} tabIndex={-1} className={TITEL}>
            Bestätige deine Anmeldung
          </h2>
          <p className="mt-1 text-[14px] break-words text-muted-foreground [overflow-wrap:anywhere]">
            Du möchtest Neuigkeiten von <strong className="font-semibold text-foreground">{hofName}</strong> per E-Mail
            bekommen? Tippe auf den Knopf, dann ist es erledigt.
          </p>
        </div>
      </div>
      {typeof stand === 'object' && (
        <Hinweiskarte ton="orange" titel="Das hat nicht geklappt">
          <p role="alert">{stand.fehler}</p>
        </Hinweiskarte>
      )}
      <button type="button" onClick={bestaetigen} disabled={laedt} className={cn(KNOPF_GRUEN, 'h-12 w-full gap-2 disabled:opacity-60')}>
        {laedt ? (
          <>
            <Loader2 className="size-4 animate-spin" strokeWidth={1.7} aria-hidden="true" />
            Einen Moment …
          </>
        ) : (
          'Anmeldung bestätigen'
        )}
      </button>
      {typeof stand === 'object' ? (
        <Link href="/account/profile" className={TEXTLINK}>
          Anmeldungen unter „Mein Konto“ verwalten
        </Link>
      ) : (
        <p className="text-[13px] leading-normal text-muted-foreground">
          Du hast dich nicht angemeldet? Dann schließ diese Seite einfach – ohne Bestätigung schicken wir dir nichts.
        </p>
      )}
    </section>
  )
}
