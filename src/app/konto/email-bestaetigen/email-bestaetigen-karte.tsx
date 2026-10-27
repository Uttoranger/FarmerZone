'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { Check, MailCheck, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EMAIL_BESTAETIGEN_TEXT as T } from '@/lib/konto-anfragen'
import { EMAIL_MAX } from '@/lib/eingabegrenzen'
import { bestaetigeEmailAenderung } from '@/server/actions/konto-anfragen'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { FELD, FELD_LABEL, KNOPF_GRUEN } from '@/components/hof-bestellungen/stil'

/*
 * Die Karte der Seite /konto/email-bestaetigen (Nr. 190): vorher Feld und
 * Knopf, nachher „Die neue Adresse gilt“. Zustände ohne eigenes Mockup nach
 * DESIGN_SYSTEM (wie „Das war ich nicht“). Texte aus src/lib/konto-anfragen.ts.
 */

const TITEL = 'font-heading text-[26px] leading-tight font-semibold outline-none'
const SATZ = 'text-[14.5px] leading-relaxed text-muted-foreground'
const TEXTLINK = cn(
  'inline-flex min-h-11 items-center justify-center rounded-full px-3 text-sm font-semibold text-status-fertig hover:underline hover:underline-offset-2',
  FOKUS_RAHMEN
)

type Stand = 'offen' | 'ungueltig' | 'fertig'

export function EmailBestaetigenKarte({ token }: { token: string | null }): React.JSX.Element {
  const [laeuft, starte] = useTransition()
  const [stand, setStand] = useState<Stand>(token ? 'offen' : 'ungueltig')
  const [adresse, setAdresse] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const ueberschrift = useRef<HTMLHeadingElement>(null)

  function bestaetigen(e: React.FormEvent): void {
    e.preventDefault()
    if (token === null) return
    setFehler(null)
    starte(async () => {
      try {
        const antwort = await bestaetigeEmailAenderung({ token, adresse })
        if ('error' in antwort) {
          if (antwort.ungueltig) setStand('ungueltig')
          else setFehler(antwort.error)
          return
        }
        setStand('fertig')
        requestAnimationFrame(() => ueberschrift.current?.focus())
      } catch {
        setFehler(T.fehler)
      }
    })
  }

  if (stand === 'fertig') {
    return (
      <section aria-labelledby="email-bestaetigen-titel" className="flex flex-col gap-4">
        <span className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Check className="size-5" strokeWidth={2.2} aria-hidden="true" />
        </span>
        <h1 id="email-bestaetigen-titel" ref={ueberschrift} tabIndex={-1} className={TITEL}>
          {T.fertigTitel}
        </h1>
        <p className={SATZ}>{T.fertigSatz}</p>
        <Link href="/login" className={cn(KNOPF_GRUEN, 'self-start')}>
          {T.zurAnmeldung}
        </Link>
      </section>
    )
  }

  if (stand === 'ungueltig') {
    return (
      <section aria-labelledby="email-bestaetigen-titel" className="flex flex-col gap-4">
        <span className="flex size-11 items-center justify-center rounded-full bg-muted text-foreground">
          <TriangleAlert className="size-5" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <h1 id="email-bestaetigen-titel" className={TITEL}>
          {T.ungueltigTitel}
        </h1>
        <p className={SATZ}>{T.ungueltigSatz}</p>
        <Link href="/login" className={cn(TEXTLINK, 'self-start px-0')}>
          {T.zurAnmeldung}
        </Link>
      </section>
    )
  }

  return (
    <section aria-labelledby="email-bestaetigen-titel" className="flex flex-col gap-4">
      <span className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <MailCheck className="size-5" strokeWidth={1.8} aria-hidden="true" />
      </span>
      <h1 id="email-bestaetigen-titel" className={TITEL}>
        {T.titel}
      </h1>
      <p className={SATZ}>{T.satz}</p>
      <form onSubmit={bestaetigen} className="flex flex-col gap-3">
        <div>
          <label htmlFor="neue-adresse" className={FELD_LABEL}>
            {T.feld}
          </label>
          <input
            id="neue-adresse"
            type="email"
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            required
            maxLength={EMAIL_MAX}
            value={adresse}
            aria-invalid={fehler !== null || undefined}
            aria-describedby={fehler ? 'neue-adresse-fehler' : undefined}
            onChange={(e) => setAdresse(e.target.value)}
            className={cn(FELD, 'min-h-11')}
          />
          {fehler && (
            <p id="neue-adresse-fehler" role="alert" className="mt-1.5 text-[13.5px] font-medium text-status-offen">
              {fehler}
            </p>
          )}
        </div>
        <button type="submit" disabled={laeuft || adresse.trim() === ''} aria-busy={laeuft || undefined} className={cn(KNOPF_GRUEN, 'self-start')}>
          {laeuft ? 'Einen Moment …' : T.knopf}
        </button>
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">{T.vorab}</p>
      </form>
    </section>
  )
}
