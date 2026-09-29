import Image from 'next/image'
import Link from 'next/link'
import { Eye } from 'lucide-react'
import { MEIN_HOF_REITER, type MeinHofReiterId } from '@/lib/bauern-navigation'
import { hofInitialen } from '@/lib/hof-initialen'
import { titelbildVerlauf } from '@/lib/mein-hof'
import type { MeinHofKopfDaten } from '@/server/queries/farm'
import { AdresseKopierenKnopf } from '@/components/farmer/adresse-kopieren-knopf'
import { HofTeilenKnopf } from '@/components/farmer/hof-teilen-knopf'
import { Schild } from '@/components/farmer/schild'
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

const KNOPF =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-app-ink transition-colors hover:bg-muted/50 outline-none focus-visible:ring-3 focus-visible:ring-ring/50'

export function MeinHofKopf({
  hof,
  aktiv,
  produktZahl,
}: {
  hof: MeinHofKopfDaten | null
  aktiv: MeinHofReiterId
  /** Steht hinter dem Reiter „Produkte" („Produkte · 2"). */
  produktZahl?: number
}): React.JSX.Element | null {
  if (!hof) return null

  return (
    <header className="mb-6 print:hidden">
      <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-border/60 shadow-[0_2px_8px_oklch(0.18_0.03_150_/_0.06)] dark:ring-border">
        {/* Streifen des Titelbilds — Foto oder der gewählte Verlauf.
            Bildersatz, folgt dem Modus bewusst nicht. Mittig ausgeschnitten,
            nicht nach dem Fokus der Hofseite: Der Fokus ist für das hohe
            Titelbild dort gewählt; im flachen Streifen hier zeigte er oft nur
            Himmel oder Boden. */}
        <div className="relative h-24 md:h-28">
          {hof.titelbildUrl ? (
            <Image
              src={hof.titelbildUrl}
              alt=""
              fill
              sizes="(min-width: 1024px) 100vw, (min-width: 768px) 672px, 100vw"
              className="object-cover object-center"
            />
          ) : (
            <div className="absolute inset-0" style={{ background: titelbildVerlauf(hof.bannerValue) }} />
          )}
        </div>

        <div className="px-4 pb-4">
          <div className="flex gap-3">
            {/* relative z-10: Der Streifen darüber ist positioniert (das Bild
                füllt ihn absolut) und malte sich sonst über das Hofbild — es
                lag halb verdeckt HINTER dem Titelbild. Der Rand in der
                Kartenfarbe trennt es von Foto und Verlauf. */}
            <div className="relative z-10 -mt-7 shrink-0">
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
            <div className="min-w-0 flex-1 pt-2">
              {/* Kein h1: Die Überschrift gehört der Seite darunter. */}
              <p className="font-heading text-xl font-semibold leading-snug text-app-ink break-words">{hof.name}</p>
              {/* Die Adresse der Hofseite. Öffentlich: Link in neuem Tab und
                  Kopieren daneben. Nicht öffentlich: reiner Text — ein Link
                  oder eine kopierte Adresse führte Kundinnen auf „nicht
                  gefunden". */}
              <div className="mt-0.5 flex min-w-0 items-center gap-1">
                {hof.zustand.oeffentlich ? (
                  <>
                    <a
                      href={hof.adresse.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 truncate text-[13px] text-app-ink-soft underline-offset-2 hover:text-app-ink hover:underline"
                    >
                      {hof.adresse.anzeige}
                      <span className="sr-only"> (öffnet in neuem Tab)</span>
                    </a>
                    <AdresseKopierenKnopf url={hof.adresse.url} />
                  </>
                ) : (
                  <span className="min-w-0 truncate text-[13px] text-app-ink-soft">{hof.adresse.anzeige}</span>
                )}
              </div>
              {/* Das Schild: grün „Öffentlich", bernstein „Pausiert", grau
                  „Noch nicht freigegeben". Stillgelegt trägt keins — das
                  sagt der Balken über der Seite. */}
              {hof.zustand.schild && (
                <Schild farbe={hof.zustand.schild.farbe} className="mt-1.5">
                  {hof.zustand.schild.text}
                </Schild>
              )}
            </div>
          </div>

          {/* Nur wenn die Hofseite öffentlich ist — ein Link ins Leere wäre
              irreführend. Kundenansicht bleibt neben der Adresse: Der eine
              Knopf ist am Handy leichter zu treffen als eine Textzeile. */}
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
              {reiter.id === 'produkte' && produktZahl != null ? `${reiter.label} · ${produktZahl}` : reiter.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
