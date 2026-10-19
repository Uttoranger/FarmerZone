'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { Check, Info, Loader2, LogOut, ShieldAlert, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GERAETE_TEXT, NICHT_ICH_TEXT } from '@/lib/geraete'
import { meldungLinkMitKennung } from '@/lib/fehlerseite'
import { meldeAllesAbNichtIch } from '@/server/actions/geraete'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { KNOPF_ORANGE } from '@/components/hof-bestellungen/stil'

/*
 * Die Seite „Das war ich nicht" nach Mockup system-h1-angemeldete-geraete
 * (Schritte 5 und 6): vorher Knopf, nachher „Alle Geräte sind abgemeldet".
 * Texte aus src/lib/geraete.ts. Abgemeldet wird nur über den Knopf (POST).
 */

const TITEL = 'font-heading text-[26px] leading-tight font-semibold outline-none'
const SATZ = 'text-[14.5px] leading-relaxed text-muted-foreground'
const TEXTLINK = cn(
  'inline-flex min-h-11 items-center justify-center rounded-full px-3 text-sm font-semibold text-status-fertig hover:underline hover:underline-offset-2',
  FOKUS_RAHMEN
)

type Stand = 'offen' | 'ungueltig' | { passwortMail: boolean }

export function NichtIchKarte({
  token,
  anmeldung,
}: {
  /** null: Der Link gilt nicht (mehr) — ungültig, benutzt oder abgelaufen. */
  token: string | null
  /** Wann und auf welchem Gerät — null, wenn das Gerät nicht mehr zu finden ist. */
  anmeldung: { wann: string; geraet: string } | null
}): React.JSX.Element {
  const [laeuft, starte] = useTransition()
  const [stand, setStand] = useState<Stand>('offen')
  const [fehler, setFehler] = useState<string | null>(null)
  const ueberschrift = useRef<HTMLHeadingElement>(null)

  function abmelden(): void {
    if (token === null) return
    setFehler(null)
    starte(async () => {
      try {
        const antwort = await meldeAllesAbNichtIch({ token })
        if ('error' in antwort && antwort.error === 'zu-viele') {
          setFehler(NICHT_ICH_TEXT.zuViele)
          return
        }
        setStand('ok' in antwort ? { passwortMail: antwort.passwortMail } : 'ungueltig')
        // Der Inhalt wechselt — der Fokus folgt der neuen Überschrift.
        requestAnimationFrame(() => ueberschrift.current?.focus())
      } catch {
        // Netz weg: nichts ist passiert oder alles — ein zweiter Druck klärt es
        // (ein verbrauchter Link sagt dann „gilt nicht mehr").
        setFehler(GERAETE_TEXT.fehler)
      }
    })
  }

  if (stand !== 'offen' && stand !== 'ungueltig') {
    return (
      <section aria-labelledby="nicht-ich-titel" className="flex flex-col gap-4">
        <span className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Check className="size-5" strokeWidth={2.2} aria-hidden="true" />
        </span>
        <h1 id="nicht-ich-titel" ref={ueberschrift} tabIndex={-1} className={TITEL}>
          {NICHT_ICH_TEXT.fertigTitel}
        </h1>
        <p className={SATZ}>{stand.passwortMail ? NICHT_ICH_TEXT.fertigSatz : NICHT_ICH_TEXT.fertigOhneMail}</p>
        <div className="flex gap-2.5 rounded-xl border border-border bg-card px-3.5 py-3 text-[13px] leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
          <p>
            {NICHT_ICH_TEXT.fertigHinweis} „
            <Link href={meldungLinkMitKennung()} className="font-semibold text-status-fertig underline underline-offset-2">
              {NICHT_ICH_TEXT.problemMelden}
            </Link>
            “.
          </p>
        </div>
      </section>
    )
  }

  if (stand === 'ungueltig' || token === null) return <NichtIchUngueltig ueberschrift={ueberschrift} />

  return (
    <section aria-labelledby="nicht-ich-titel" className="flex flex-col gap-4">
      <span className="flex size-11 items-center justify-center rounded-xl border border-primary/45 bg-primary/12 text-status-offen">
        <ShieldAlert className="size-5" strokeWidth={1.7} aria-hidden="true" />
      </span>
      <h1 id="nicht-ich-titel" ref={ueberschrift} tabIndex={-1} className={TITEL}>
        {NICHT_ICH_TEXT.titel}
      </h1>
      {anmeldung && (
        <p className={SATZ}>
          {NICHT_ICH_TEXT.anmeldung} {anmeldung.wann} {NICHT_ICH_TEXT.auf}{' '}
          <strong className="font-semibold break-words text-foreground">{anmeldung.geraet}</strong>.
        </p>
      )}
      <p className={SATZ}>{NICHT_ICH_TEXT.erklaerung}</p>
      {fehler && (
        <p role="alert" className="rounded-xl border border-primary/45 bg-primary/12 px-3 py-2.5 text-sm leading-relaxed text-foreground">
          {fehler}
        </p>
      )}
      <button type="button" onClick={abmelden} disabled={laeuft} className={cn(KNOPF_ORANGE, 'h-12 w-full disabled:opacity-60')}>
        {laeuft ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <LogOut className="size-4" strokeWidth={1.7} aria-hidden="true" />}
        {laeuft ? GERAETE_TEXT.einenMoment : NICHT_ICH_TEXT.knopf}
      </button>
      <Link href="/" className={TEXTLINK}>
        {NICHT_ICH_TEXT.doch}
      </Link>
      <p className="text-[12.5px] leading-relaxed text-muted-foreground">{NICHT_ICH_TEXT.vorab}</p>
    </section>
  )
}

function NichtIchUngueltig({ ueberschrift }: { ueberschrift?: React.Ref<HTMLHeadingElement> }): React.JSX.Element {
  return (
    <section aria-labelledby="nicht-ich-titel" className="flex flex-col gap-4">
      <TriangleAlert className="size-8 text-status-offen" strokeWidth={1.6} aria-hidden="true" />
      <h1 id="nicht-ich-titel" ref={ueberschrift} tabIndex={-1} className={TITEL}>
        {NICHT_ICH_TEXT.ungueltigTitel}
      </h1>
      <p className={SATZ}>{NICHT_ICH_TEXT.ungueltigSatz}</p>
      <Link href="/login" className={cn(TEXTLINK, 'self-start px-1')}>
        {NICHT_ICH_TEXT.zurAnmeldung}
      </Link>
    </section>
  )
}
