'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { CircleCheck, Loader2, MailCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { bestaetigeEmail } from '@/server/actions/email-bestaetigung'

/*
 * Der Link aus der Mail landet hier (/verify?token=…, S3, Nachtlauf Nr. 17b).
 * Bestätigt wird erst mit dem Knopf — ein Link aus einer Mail ändert nie einen
 * Zustand, Link-Scanner rufen ihn ungefragt auf (ARCHITECTURE §5).
 */

const KNOPF = cn(
  'inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-[18px] text-[14px] font-semibold transition-opacity duration-[250ms] hover:opacity-90 disabled:opacity-60',
  FOKUS_RAHMEN
)
const KNOPF_ORANGE = cn(KNOPF, 'border border-primary-foreground/30 bg-primary text-primary-foreground')
const TEXTLINK = cn('inline-flex min-h-11 items-center rounded-full px-1 text-[14px] font-semibold text-status-fertig hover:underline', FOKUS_RAHMEN)

export function BestaetigenKarte({ token, angemeldet }: { token: string; angemeldet: boolean }): React.JSX.Element {
  const [laedt, starte] = useTransition()
  const [stand, setStand] = useState<'offen' | 'bestaetigt' | { fehler: string }>('offen')
  const ueberschrift = useRef<HTMLHeadingElement>(null)

  function bestaetigen(): void {
    starte(async () => {
      const antwort = await bestaetigeEmail({ token })
      setStand('ok' in antwort ? 'bestaetigt' : { fehler: antwort.error })
      // Der Inhalt wechselt — der Fokus folgt der neuen Überschrift.
      requestAnimationFrame(() => ueberschrift.current?.focus())
    })
  }

  if (stand === 'bestaetigt') {
    return (
      <section aria-labelledby="verify-titel" className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <CircleCheck className="mt-1 size-6 shrink-0 text-status-fertig" strokeWidth={1.7} aria-hidden="true" />
          <div className="min-w-0">
            <h2 id="verify-titel" ref={ueberschrift} tabIndex={-1} className="font-heading text-[22px] leading-tight font-semibold outline-none md:text-2xl">
              Danke, deine E-Mail ist bestätigt
            </h2>
            <p className="mt-1 text-[14px] text-muted-foreground">
              Jetzt kannst du Fotos hochladen, und wir können deinen Hof freischalten.
            </p>
          </div>
        </div>
        <Link href={angemeldet ? '/onboarding' : '/login?von=/verify'} className={KNOPF_ORANGE}>
          {angemeldet ? 'Weiter zum Einrichten' : 'Anmelden'}
        </Link>
      </section>
    )
  }

  return (
    <section aria-labelledby="verify-titel" className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <MailCheck className="mt-1 size-6 shrink-0 text-status-offen" strokeWidth={1.7} aria-hidden="true" />
        <div className="min-w-0">
          <h2 id="verify-titel" ref={ueberschrift} tabIndex={-1} className="font-heading text-[22px] leading-tight font-semibold outline-none md:text-2xl">
            Bestätige deine E-Mail
          </h2>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Tippe auf den Knopf, dann wissen wir, dass die Adresse dir gehört.
          </p>
        </div>
      </div>
      {typeof stand === 'object' && (
        <Hinweiskarte ton="orange" titel="Das hat nicht geklappt">
          <p role="alert">{stand.fehler}</p>
        </Hinweiskarte>
      )}
      <button type="button" onClick={bestaetigen} disabled={laedt} className={KNOPF_ORANGE}>
        {laedt ? (
          <>
            <Loader2 className="size-4 animate-spin" strokeWidth={1.7} aria-hidden="true" />
            Einen Moment …
          </>
        ) : (
          'E-Mail bestätigen'
        )}
      </button>
      {typeof stand === 'object' && (
        <Link href={angemeldet ? '/verify' : '/login?von=/verify'} className={TEXTLINK}>
          {angemeldet ? 'Neuen Link anfordern' : 'Anmelden und neuen Link anfordern'}
        </Link>
      )}
    </section>
  )
}
