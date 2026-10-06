import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { MEIN_HOF_HINWEIS, MEIN_HOF_REITER_HOFBEREICH, type MeinHofReiterId } from '@/lib/bauern-navigation'
import { hofInitialen } from '@/lib/hof-initialen'
import { schildTon, titelbildVerlauf } from '@/lib/mein-hof'
import { vorschauLink } from '@/lib/hofseite-vorschau'
import type { MeinHofKopfDaten } from '@/server/queries/farm'
import { AdresseKopierenKnopf } from '@/components/farmer/adresse-kopieren-knopf'
import { HofTeilenKnopf } from '@/components/farmer/hof-teilen-knopf'
import { StatusBadge } from '@/components/ui/status-badge'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'

/*
 * Der Kopf von „Mein Hof" in der HofShell (Nachtlauf Nr. 16; Mockups
 * web-h1-mein-hof-vorschau-handy/-web, mobil-h1-mein-hof): Hofbild, Name,
 * Zustand, Adresse mit Kopieren, „Teilen" und „Kundenansicht"; darunter die
 * Reiter Hofseite | Beiträge als Links (?reiter=, E12).
 *
 * Unter lg mit dem Titelbild-Streifen wie bisher (der Mensch ist damit
 * zufrieden), ab lg als kompakte Zeile. Der Bestandskopf
 * (components/farmer/mein-hof-kopf.tsx) bleibt für /status, das noch im
 * Bestandslayout steht.
 *
 * „Kundenansicht" öffnet die Vorschau der echten Hofseite (?vorschau=1) in
 * einem neuen Tab — sie geht auch vor der Freigabe, nur für den Besitzer
 * (ansichtsModus). Teilen, Adress-Link und Kopieren nur, wenn die Hofseite
 * öffentlich ist (hofZustand) — sonst führte der Link Kundinnen ins Leere.
 */

const KNOPF = cn(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors duration-[250ms] hover:bg-muted',
  FOKUS_RAHMEN
)

function Hofbild({ hof, klasse }: { hof: MeinHofKopfDaten; klasse: string }) {
  return hof.logoUrl ? (
    <Image src={hof.logoUrl} alt="" width={112} height={112} className={cn(klasse, 'shrink-0 rounded-full object-cover')} />
  ) : (
    <span
      aria-hidden="true"
      className={cn(klasse, 'flex shrink-0 items-center justify-center rounded-full bg-muted font-heading font-semibold text-foreground')}
    >
      {hofInitialen(hof.name)}
    </span>
  )
}

function Zustand({ hof }: { hof: MeinHofKopfDaten }) {
  if (!hof.zustand.schild) return null
  return <StatusBadge status={schildTon(hof.zustand.schild.farbe)}>{hof.zustand.schild.text}</StatusBadge>
}

function Adresse({ hof }: { hof: MeinHofKopfDaten }) {
  if (!hof.zustand.oeffentlich) {
    return <span className="block min-w-0 truncate text-[13px] text-muted-foreground">{hof.adresse.anzeige}</span>
  }
  return (
    <span className="flex min-w-0 items-center gap-0.5">
      <a
        href={hof.adresse.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn('min-w-0 truncate rounded-sm text-[13px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline', FOKUS_RAHMEN)}
      >
        {hof.adresse.anzeige}
        <span className="sr-only"> (öffnet in neuem Tab)</span>
      </a>
      <AdresseKopierenKnopf url={hof.adresse.url} className={cn('text-muted-foreground hover:bg-muted hover:text-foreground', FOKUS_RAHMEN)} />
    </span>
  )
}

function Knoepfe({ hof, breit }: { hof: MeinHofKopfDaten; breit: boolean }) {
  return (
    <div className={cn('flex gap-2', breit ? 'shrink-0' : 'mt-3 grid grid-cols-2')}>
      {hof.zustand.oeffentlich && <HofTeilenKnopf name={hof.name} slug={hof.slug} className={KNOPF} label="Teilen" />}
      <a
        href={vorschauLink(hof.slug)}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(KNOPF, !hof.zustand.oeffentlich && !breit && 'col-span-2')}
      >
        Kundenansicht
        <ArrowUpRight className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
        <span className="sr-only"> (öffnet in neuem Tab)</span>
      </a>
    </div>
  )
}

export function MeinHofSeitenkopf({
  hof,
  aktiv,
  beitraegeZahl,
}: {
  hof: MeinHofKopfDaten | null
  aktiv: MeinHofReiterId
  beitraegeZahl: number
}): React.JSX.Element | null {
  if (!hof) return null

  return (
    <header className="mb-6 print:hidden">
      {/* ===== Unter lg: Karte mit Titelbild-Streifen ===== */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card lg:hidden">
        {/* Bildersatz, folgt dem Modus bewusst nicht; mittig ausgeschnitten —
            der Fokus der Hofseite gilt dem hohen Titelbild dort. */}
        <div className="relative h-24 md:h-28">
          {hof.titelbildUrl ? (
            <Image src={hof.titelbildUrl} alt="" fill sizes="(min-width: 768px) 720px, 100vw" className="object-cover object-center" />
          ) : (
            <div className="absolute inset-0" style={{ background: titelbildVerlauf(hof.bannerValue) }} />
          )}
        </div>
        <div className="px-4 pb-4">
          <div className="flex gap-3">
            <div className="relative z-10 -mt-7 shrink-0">
              <Hofbild hof={hof} klasse="size-14 text-lg ring-4 ring-card" />
            </div>
            <div className="min-w-0 flex-1 pt-2">
              {/* Kein h1: Die Überschrift gehört der Seite darunter. */}
              <p className="font-heading text-xl leading-snug font-semibold break-words text-foreground line-clamp-2" title={hof.name}>
                {hof.name}
              </p>
              <div className="mt-0.5">
                <Adresse hof={hof} />
              </div>
              <div className="mt-1.5">
                <Zustand hof={hof} />
              </div>
            </div>
          </div>
          <Knoepfe hof={hof} breit={false} />
        </div>
      </div>

      {/* ===== Ab lg: kompakte Zeile ===== */}
      <div className="hidden items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 lg:flex">
        <Hofbild hof={hof} klasse="size-12 text-base" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2.5">
            <p className="min-w-0 truncate font-heading text-lg leading-snug font-semibold text-foreground" title={hof.name}>
              {hof.name}
            </p>
            <Zustand hof={hof} />
          </div>
          <div className="mt-0.5">
            <Adresse hof={hof} />
          </div>
        </div>
        <Knoepfe hof={hof} breit />
      </div>

      {/* Reiter links gruppiert (Mockup), rechts der Hinweis, wo Produkte liegen. */}
      <nav aria-label="Mein Hof" className="mt-4 flex items-center gap-7 border-b border-border">
        {MEIN_HOF_REITER_HOFBEREICH.map((reiter) => {
          const istAktiv = reiter.id === aktiv
          return (
            <Link
              key={reiter.id}
              href={reiter.href}
              scroll={false}
              aria-current={istAktiv ? 'page' : undefined}
              className={cn(
                '-mb-px inline-flex min-h-12 items-center border-b-2 px-0.5 text-[15px] whitespace-nowrap transition-colors duration-[250ms]',
                istAktiv ? 'border-foreground font-semibold text-foreground' : 'border-transparent font-medium text-muted-foreground hover:text-foreground',
                FOKUS_RAHMEN,
                'focus-visible:-outline-offset-2'
              )}
            >
              {reiter.label}
              {reiter.id === 'beitraege' && ` · ${beitraegeZahl}`}
            </Link>
          )
        })}
        <p className="ml-auto hidden text-[13px] text-muted-foreground md:block">{MEIN_HOF_HINWEIS}</p>
      </nav>
    </header>
  )
}
