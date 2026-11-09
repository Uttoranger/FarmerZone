'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RUNDUNG } from '@/components/ui/rundung'
import { EMAIL_BESTAETIGEN_TEXT as T } from '@/lib/konto-anfragen'
import { EMAIL_MAX } from '@/lib/eingabegrenzen'
import { bestaetigeEmailAenderung } from '@/server/actions/konto-anfragen'
import { FELD, FELD_LABEL, KNOPF_GRUEN } from '@/components/hof-bestellungen/stil'
import { KNOPF_UMRISS } from '@/components/anmelden/stil'

/*
 * Die Karte der Seite /konto/email-bestaetigen (Nr. 190): vorher Feld und
 * Knopf, nachher „Die neue Adresse gilt“. Zustände ohne eigenes Mockup nach
 * DESIGN_SYSTEM (wie „Das war ich nicht“). Texte aus src/lib/konto-anfragen.ts.
 * Seit Lauf 30 nach Board s2/w2-systemseiten: Karte auf der Fläche, das
 * Ergebnis als grüne Karte — die Farbe der KundeShell (V52).
 * Seit Nr. 239 wie „Das war ich nicht“ (Board s2-/w2-systemseiten, Bild 5):
 * Karte 520 px links in der Inhaltsspalte, Text in voller Textfarbe, der
 * ungültige Link ohne Symbol mit Warnfarbe und Umriss-Knopf.
 */
// Ecken 12 px (G8) und engere Zeilen wie im Board s2-/w2-systemseiten (Liste Lauf 32, systemseiten „Karte zu rund, Zeilenabstand größer“).
const KARTE = cn(RUNDUNG.karte, 'flex max-w-[520px] flex-col gap-2.5 border border-border bg-card p-[18px]')
const KARTE_GRUEN = cn(RUNDUNG.hinweis, 'flex max-w-[520px] flex-col gap-2.5 border border-accent/45 bg-accent/12 p-[18px]')

const TITEL = 'font-heading text-[22px] leading-tight font-semibold outline-none'
const SATZ = 'text-[15px] leading-snug text-foreground'

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
      <section aria-labelledby="email-bestaetigen-titel" className={KARTE_GRUEN}>
        <span className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Check className="size-5" strokeWidth={2.2} aria-hidden="true" />
        </span>
        <h1 id="email-bestaetigen-titel" ref={ueberschrift} tabIndex={-1} className={TITEL}>
          {T.fertigTitel}
        </h1>
        <p className={SATZ}>{T.fertigSatz}</p>
        <Link href="/login" className={cn(KNOPF_GRUEN, 'h-[50px] w-full rounded-[14px] text-[15px] font-bold')}>
          {T.zurAnmeldung}
        </Link>
      </section>
    )
  }

  if (stand === 'ungueltig') {
    return (
      <section aria-labelledby="email-bestaetigen-titel" className={KARTE}>
        <h1 id="email-bestaetigen-titel" className={cn(TITEL, 'text-status-offen')}>
          {T.ungueltigTitel}
        </h1>
        <p className={SATZ}>{T.ungueltigSatz}</p>
        <Link href="/login" className={KNOPF_UMRISS}>
          {T.zurAnmeldung}
        </Link>
      </section>
    )
  }

  return (
    <section aria-labelledby="email-bestaetigen-titel" className={KARTE}>
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
        <button type="submit" disabled={laeuft || adresse.trim() === ''} aria-busy={laeuft || undefined} className={cn(KNOPF_GRUEN, 'h-[50px] w-full rounded-[14px] text-[15px] font-bold')}>
          {laeuft ? 'Einen Moment …' : T.knopf}
        </button>
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">{T.vorab}</p>
      </form>
    </section>
  )
}
