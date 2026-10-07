'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { MailCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'

const KNOPF_ORANGE = cn(
  'inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-primary-foreground/30 bg-primary px-[18px] text-[14px] font-semibold text-primary-foreground transition-opacity duration-[250ms] hover:opacity-90',
  FOKUS_RAHMEN
)

/**
 * Nach dem Absenden der Registrierung (Register F6 „19b", Nachtlauf Nr. 27):
 * IMMER dieser Hinweis — ob die Adresse neu war oder schon ein Konto hatte.
 * Das Formular meldet deshalb nicht mehr selbst an (eine scheiternde
 * Anmeldung verriete die vergebene Adresse); angemeldet wird nach der
 * Bestätigung über den Link aus der Mail (/verify → Anmelden).
 *
 * Kein Mockup für diesen Zustand — gebaut wie die Karten auf /verify
 * (Symbol, Überschrift, Satz, ein Hauptknopf). Der Fokus springt auf die
 * Überschrift, weil das Formular, in dem er stand, verschwindet.
 */
export function PostfachHinweis({ email }: { email: string }): React.JSX.Element {
  const titel = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    titel.current?.focus()
  }, [])

  return (
    <section aria-labelledby="postfach-titel" className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <MailCheck className="mt-1 size-6 shrink-0 text-status-offen" strokeWidth={1.7} aria-hidden="true" />
        <div className="min-w-0">
          <h2
            id="postfach-titel"
            ref={titel}
            tabIndex={-1}
            className={cn('font-heading text-[22px] leading-tight font-semibold md:text-2xl', 'rounded-sm', FOKUS_RAHMEN)}
          >
            Schau in dein Postfach
          </h2>
          <div className="mt-1 text-[14px] leading-normal text-muted-foreground">
            <p>
              Wir haben dir eine E-Mail geschickt – an{' '}
              <strong className="font-semibold break-all text-foreground">{email}</strong>. Öffne den Link darin und bestätige
              deine Adresse. Danach meldest du dich an und richtest deinen Hof ein.
            </p>
            <p className="mt-2">Keine E-Mail da? Schau auch im Spam-Ordner nach.</p>
          </div>
        </div>
      </div>
      <Link href="/login" className={KNOPF_ORANGE}>
        Zur Anmeldung
      </Link>
    </section>
  )
}
