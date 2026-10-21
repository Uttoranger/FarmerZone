'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Mail, MessageCircle, Plus } from 'lucide-react'
import { BEITRAG_ANLASS } from '@/lib/beitrag-anlass'
import { DEIN_BEITRAG_TEXT, anstossLinks, deinBeitragZeile, neuerBeitragHref, versandZeilen, type DeinBeitrag } from '@/lib/heute'
import { beitragLink } from '@/lib/teilen-fenster'
import { bildStil } from '@/lib/bild-ausschnitt'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { BeitragTeilenKnopf } from '@/components/teilen/beitrag-teilen'

/*
 * „Dein Beitrag“ in Heute (Register E12, Ergänzung Nr. 129; Board
 * system-k2-beitraege-v2, Abschnitt 5): der laufende Beitrag mit Anlass, seit
 * wann, wie lange noch, E-Mail- und WhatsApp-Zahl (nur Zahlen, die es gibt,
 * nur über null), „Teilen“ (das Teilen-Fenster im Beitrag-Modus, derselbe Weg
 * wie in Mein Hof › Beiträge, T5), „Ansehen“ (der Beitrag auf der Hofseite)
 * und „Neuer Beitrag“. Ohne laufenden Beitrag der ruhige Anstoß mit den vier
 * Anlässen. Was erscheint, entscheidet beitragBlock (src/lib/heute.ts).
 */

const KARTE = 'rounded-2xl border border-border bg-card'
const KNOPF = 'inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-[13.5px] font-semibold transition-colors duration-[250ms]'
// Orange gefüllte Pille = Hof-Aktion (Farbrollen), wie die Teilen-Zeile.
const KNOPF_ORANGE = cn(KNOPF, 'border border-primary-foreground/25 bg-primary text-primary-foreground hover:opacity-90', FOKUS_RAHMEN)
const KNOPF_RAHMEN = cn(KNOPF, 'border border-border text-foreground hover:bg-muted', FOKUS_RAHMEN)

export function DeinBeitragKarte({ beitrag, hofSlug, jetzt }: { beitrag: DeinBeitrag; hofSlug: string; jetzt: string }): React.JSX.Element {
  const [fehler, setFehler] = useState<string | null>(null)
  const anlass = BEITRAG_ANLASS[beitrag.anlass]
  const Symbol = anlass.symbol
  const versand = versandZeilen(beitrag)
  return (
    <section aria-labelledby="heute-dein-beitrag" className={cn(KARTE, 'flex flex-col gap-3 px-4 py-3.5 md:px-[18px]')}>
      {/* h2 wie die übrigen Karten von Heute (Packliste, Braucht dich); der Zusatz steht daneben, nicht in der Überschrift. */}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h2 id="heute-dein-beitrag" className="text-[15px] font-semibold">
          {DEIN_BEITRAG_TEXT.titel}
        </h2>
        <span className="text-[12.5px] text-muted-foreground">{DEIN_BEITRAG_TEXT.wo}</span>
      </div>
      <div className="flex items-start gap-3">
        <span className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-muted">
          {beitrag.foto ? (
            // Mit Fokus, Zoom und Filter wie in „Aktuell vom Hof“ — sonst zeigte Heute einen anderen Ausschnitt als die Hofseite.
            <Image src={beitrag.foto} alt="" fill sizes="56px" className="object-cover" style={bildStil(beitrag.fotoAusschnitt)} />
          ) : (
            <Symbol className="size-6 text-status-fertig" strokeWidth={1.7} aria-hidden="true" />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[14.5px] font-semibold break-words">{beitrag.titel}</span>
          <span className="text-[12.5px] text-muted-foreground">{deinBeitragZeile(beitrag, anlass.wort, new Date(jetzt))}</span>
        </span>
      </div>
      {versand.length > 0 && (
        <ul className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-[12.5px] text-muted-foreground">
          {versand.map((zeile) => {
            const VersandSymbol = zeile.art === 'email' ? Mail : MessageCircle
            return (
              <li key={zeile.art} className="inline-flex items-center gap-1.5">
                <VersandSymbol className="size-3.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                {zeile.text}
              </li>
            )
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <BeitragTeilenKnopf beitragId={beitrag.id} titel={beitrag.titel} className={KNOPF_ORANGE} onFehler={setFehler} />
        <Link href={beitragLink(`/${hofSlug}`, beitrag.id)} className={KNOPF_RAHMEN}>
          {DEIN_BEITRAG_TEXT.ansehen}
        </Link>
        <span className="flex-1" />
        <Link
          href={neuerBeitragHref()}
          className={cn('inline-flex min-h-11 items-center gap-1.5 rounded-md text-[13.5px] font-semibold text-status-fertig hover:underline underline-offset-2', FOKUS_RAHMEN)}
        >
          <Plus className="size-4" strokeWidth={1.8} aria-hidden="true" />
          {DEIN_BEITRAG_TEXT.neu}
        </Link>
      </div>
      {fehler && (
        <p role="alert" className="text-[13px] font-medium text-destructive">
          {fehler}
        </p>
      )}
    </section>
  )
}

/** Der ruhige Anstoß ohne laufenden Beitrag: vier Anlässe als Links (44 px), kein Punkt, kein Zähler, kein „Nicht jetzt“. */
export function BeitragAnstoss(): React.JSX.Element {
  return (
    <section aria-labelledby="heute-anstoss" className={cn(KARTE, 'flex flex-col gap-2.5 p-3.5 md:px-[18px]')}>
      <h2 id="heute-anstoss" className="text-[15px] font-semibold">
        {DEIN_BEITRAG_TEXT.anstossTitel}
      </h2>
      <p className="text-[13px] leading-snug text-muted-foreground">{DEIN_BEITRAG_TEXT.anstossSatz}</p>
      <ul className="flex flex-wrap gap-2">
        {anstossLinks().map(({ anlass, href }) => {
          const { wort, symbol: Symbol } = BEITRAG_ANLASS[anlass]
          return (
            <li key={anlass}>
              <Link href={href} className={cn('inline-flex h-11 items-center gap-1.5 rounded-full border border-border px-3 text-[13px] font-semibold text-foreground hover:bg-muted', FOKUS_RAHMEN)}>
                <Symbol className="size-4 shrink-0 text-status-fertig" strokeWidth={1.8} aria-hidden="true" />
                {wort}
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
