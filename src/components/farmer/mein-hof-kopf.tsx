import Image from 'next/image'
import Link from 'next/link'
import { Eye } from 'lucide-react'
import { MEIN_HOF_REITER, type MeinHofReiterId } from '@/lib/bauern-navigation'
import { hofInitialen } from '@/lib/hof-initialen'
import { titelbildVerlauf, type HofZustandArt } from '@/lib/mein-hof'
import type { MeinHofKopfDaten } from '@/server/queries/farm'
import { HofTeilenKnopf } from '@/components/farmer/hof-teilen-knopf'
import { cn } from '@/lib/utils'

/*
 * Der gemeinsame Kopf von „Mein Hof" über drei vorhandenen Seiten: Produkte
 * (/products), Hofseite (/farm-page), Beiträge (/status). Die Seiten selbst
 * bleiben, wie sie sind; jede rendert diesen Kopf mit ihrem Reiter. Die
 * Unterseiten (/status/new usw.) bekommen ihn bewusst nicht — dort wird
 * etwas getan, nicht gewechselt.
 *
 * Die Daten (getMeinHofKopf) lädt die Seite parallel zu ihren eigenen — der
 * Kopf fragt nicht selbst, sonst käme eine Datenbankrunde hinterher.
 */

/** Bedeutungsfarben des Zustandspunkts, in beiden Modi sichtbar. */
const PUNKT_FARBE: Record<HofZustandArt, string> = {
  sichtbar: 'bg-green-600 dark:bg-green-400',
  pausiert: 'bg-amber-500 dark:bg-amber-400',
  wartet: 'bg-sky-600 dark:bg-sky-400',
  aus: 'bg-app-ink-faint',
}

const KNOPF =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-app-ink transition-colors hover:bg-muted/50 outline-none focus-visible:ring-3 focus-visible:ring-ring/50'

export function MeinHofKopf({
  hof,
  aktiv,
}: {
  hof: MeinHofKopfDaten | null
  aktiv: MeinHofReiterId
}): React.JSX.Element | null {
  if (!hof) return null

  return (
    <header className="mb-6 print:hidden">
      <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-border/60 shadow-[0_2px_8px_oklch(0.18_0.03_150_/_0.06)] dark:ring-border">
        {/* Schmaler Streifen des Titelbilds — Foto oder der gewählte Verlauf.
            Bildersatz, folgt dem Modus bewusst nicht. */}
        <div className="relative h-16 md:h-20">
          {hof.titelbildUrl ? (
            <Image
              src={hof.titelbildUrl}
              alt=""
              fill
              sizes="(min-width: 768px) 672px, 100vw"
              className="object-cover"
              style={{ objectPosition: `50% ${hof.bannerFocusY}%` }}
            />
          ) : (
            <div className="absolute inset-0" style={{ background: titelbildVerlauf(hof.bannerValue) }} />
          )}
        </div>

        <div className="px-4 pb-4">
          <div className="flex gap-3">
            <div className="-mt-7 shrink-0">
              {hof.logoUrl ? (
                <Image
                  src={hof.logoUrl}
                  alt=""
                  width={112}
                  height={112}
                  className="size-14 rounded-full object-cover ring-4 ring-card"
                />
              ) : (
                <span
                  className="flex size-14 items-center justify-center rounded-full bg-app-chip font-heading text-lg font-semibold text-app-chip-ink ring-4 ring-card"
                  aria-hidden="true"
                >
                  {hofInitialen(hof.name)}
                </span>
              )}
            </div>
            <div className="min-w-0 pt-2">
              {/* Kein h1: Die Überschrift gehört der Seite darunter. */}
              <p className="font-heading text-xl font-semibold leading-snug text-app-ink break-words">{hof.name}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-app-ink-soft">
                <span className={cn('size-2 shrink-0 rounded-full', PUNKT_FARBE[hof.zustand.art])} aria-hidden="true" />
                {hof.zustand.text}
              </p>
            </div>
          </div>

          {/* Nur wenn die Hofseite öffentlich ist — ein Link ins Leere wäre irreführend. */}
          {hof.zustand.oeffentlich && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link href={`/${hof.slug}`} target="_blank" rel="noopener noreferrer" className={KNOPF}>
                <Eye className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
                Kundenansicht
                <span className="sr-only"> (öffnet in neuem Tab)</span>
              </Link>
              <HofTeilenKnopf name={hof.name} slug={hof.slug} className={KNOPF} />
            </div>
          )}
        </div>
      </div>

      <nav aria-label="Mein Hof" className="mt-3 flex border-b border-border">
        {MEIN_HOF_REITER.map((reiter) => {
          const istAktiv = reiter.id === aktiv
          return (
            <Link
              key={reiter.id}
              href={reiter.href}
              aria-current={istAktiv ? 'page' : undefined}
              className={cn(
                // Fokus als Rahmen, nicht als Fläche: Die Reiter stehen auf dem
                // Seitengrund, eine halbdurchsichtige Fläche sähe man dort kaum.
                '-mb-px flex min-h-11 flex-1 items-center justify-center rounded-t-md border-b-2 px-2 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                istAktiv
                  ? 'border-brand-text font-semibold text-app-ink'
                  : 'border-transparent text-app-ink-soft hover:text-app-ink'
              )}
            >
              {reiter.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
