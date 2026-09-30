import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, Eye } from 'lucide-react'
import { MEIN_HOF_HINWEIS, MEIN_HOF_REITER, type MeinHofReiterId } from '@/lib/bauern-navigation'
import { hofInitialen } from '@/lib/hof-initialen'
import { titelbildVerlauf } from '@/lib/mein-hof'
import type { MeinHofKopfDaten } from '@/server/queries/farm'
import { AdresseKopierenKnopf } from '@/components/farmer/adresse-kopieren-knopf'
import { HofTeilenKnopf } from '@/components/farmer/hof-teilen-knopf'
import { Schild } from '@/components/farmer/schild'
import { cn } from '@/lib/utils'

/*
 * Der gemeinsame Kopf von „Mein Hof" über zwei vorhandenen Seiten: Hofseite
 * (/farm-page) und Beiträge (/status). Produkte hat seinen eigenen Platz in
 * der Leiste. Die Seiten selbst bleiben, wie sie sind; jede rendert diesen
 * Kopf mit ihrem Reiter. Die
 * Unterseiten (/status/new usw.) bekommen ihn bewusst nicht — dort wird
 * etwas getan, nicht gewechselt.
 *
 * Zwei Fassungen, per CSS gewechselt: Unter lg die Karte mit
 * Titelbild-Streifen (unverändert, der Mensch ist damit zufrieden). Ab lg
 * eine kompakte Zeile ohne Streifen — Hofbild, Name, Adresse, Schild, rechts
 * genau zwei Knöpfe. Der Hof steht damit im Browser nur noch einmal oben;
 * die Hofseite selbst zeigt der Reiter als Liste mit Vorschau.
 *
 * Die Daten (getMeinHofKopf) lädt die Seite parallel zu ihren eigenen — der
 * Kopf fragt nicht selbst, sonst käme eine Datenbankrunde hinterher.
 */

const KNOPF =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-app-ink transition-colors hover:bg-muted/50 outline-none focus-visible:ring-3 focus-visible:ring-ring/50'

/** Der Kartenschatten von „Mein Hof" — auch die Karten des Editors ab lg (hofseite-editor.tsx) tragen ihn. */
export const SCHATTEN = 'shadow-[0_2px_8px_oklch(0.18_0.03_150_/_0.06)]'

/** Hofbild oder Initialen — `groesse` als Tailwind-Klasse, ab lg etwas kleiner. */
function Hofbild({ hof, groesse, className }: { hof: MeinHofKopfDaten; groesse: string; className?: string }) {
  return hof.logoUrl ? (
    <Image
      src={hof.logoUrl}
      alt=""
      width={112}
      height={112}
      className={cn(groesse, 'shrink-0 rounded-full object-cover', className)}
    />
  ) : (
    <span
      className={cn(
        groesse,
        'flex shrink-0 items-center justify-center rounded-full bg-app-chip font-heading font-semibold text-app-chip-ink',
        className
      )}
      aria-hidden="true"
    >
      {hofInitialen(hof.name)}
    </span>
  )
}

/**
 * Die Adresse der Hofseite. Öffentlich: Link in neuem Tab und Kopieren
 * daneben. Nicht öffentlich: reiner Text — ein Link oder eine kopierte
 * Adresse führte Kundinnen auf „nicht gefunden".
 */
function AdresseZeile({ hof }: { hof: MeinHofKopfDaten }) {
  return (
    <div className="flex min-w-0 items-center gap-1">
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
  )
}

/** Das Schild: grün „Öffentlich", bernstein „Pausiert", grau „Noch nicht freigegeben". Stillgelegt trägt keins — das sagt der Balken über der Seite. */
function ZustandSchild({ hof, className }: { hof: MeinHofKopfDaten; className?: string }) {
  return (
    <>
      {hof.zustand.schild && (
        <Schild farbe={hof.zustand.schild.farbe} className={className}>
          {hof.zustand.schild.text}
        </Schild>
      )}
    </>
  )
}

export function MeinHofKopf({
  hof,
  aktiv,
  beitraegeZahl,
}: {
  hof: MeinHofKopfDaten | null
  aktiv: MeinHofReiterId
  /** Steht ab lg hinter dem Reiter „Beiträge" — unter lg bleibt der Reiter, wie er war. */
  beitraegeZahl?: number
}): React.JSX.Element | null {
  if (!hof) return null

  return (
    <header className="mb-6 print:hidden">
      {/* ===== Unter lg: die Karte mit Titelbild-Streifen ===== */}
      <div className={cn('overflow-hidden rounded-2xl bg-card ring-1 ring-border/60 dark:ring-border lg:hidden', SCHATTEN)}>
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
              sizes="(min-width: 768px) 672px, 100vw"
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
              <Hofbild hof={hof} groesse="size-14 text-lg" className="ring-4 ring-card" />
            </div>
            <div className="min-w-0 flex-1 pt-2">
              {/* Kein h1: Die Überschrift gehört der Seite darunter. */}
              <p className="font-heading text-xl font-semibold leading-snug text-app-ink break-words">{hof.name}</p>
              <div className="mt-0.5">
                <AdresseZeile hof={hof} />
              </div>
              <ZustandSchild hof={hof} className="mt-1.5" />
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

      {/* ===== Ab lg: eine kompakte Zeile ohne Streifen ===== */}
      <div className={cn('hidden items-center gap-4 rounded-2xl bg-card px-5 py-4 ring-1 ring-border/60 dark:ring-border lg:flex', SCHATTEN)}>
        <Hofbild hof={hof} groesse="size-12 text-base" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-lg font-semibold leading-snug text-app-ink">{hof.name}</p>
          <div className="mt-0.5 flex min-w-0 items-center gap-2">
            <AdresseZeile hof={hof} />
            <ZustandSchild hof={hof} />
          </div>
        </div>
        {hof.zustand.oeffentlich && (
          <div className="flex shrink-0 gap-2">
            <HofTeilenKnopf name={hof.name} slug={hof.slug} className={KNOPF} label="Teilen" />
            <Link href={`/${hof.slug}`} target="_blank" rel="noopener noreferrer" className={KNOPF}>
              Kundenansicht
              <ArrowUpRight className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
              <span className="sr-only"> (öffnet in neuem Tab)</span>
            </Link>
          </div>
        )}
      </div>

      {/* Die Reiter kompakt links gruppiert, nicht über die Breite verteilt
          (Mockup hof-mein-hof-v2-desktop.html); rechts, sobald die Seitenleiste
          da ist, der Hinweis, wo Produkte jetzt liegen. */}
      <nav aria-label="Mein Hof" className="mt-3 flex items-center gap-6 border-b border-border">
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
                '-mb-px flex min-h-11 items-center rounded-t-md border-b-2 px-0.5 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                istAktiv
                  ? 'border-brand-text font-semibold text-app-ink'
                  : 'border-transparent text-app-ink-soft hover:text-app-ink'
              )}
            >
              {reiter.label}
              {reiter.id === 'beitraege' && beitraegeZahl != null && (
                <span className="hidden lg:inline">
                  {' · '}
                  {beitraegeZahl}
                </span>
              )}
            </Link>
          )
        })}
        <p className="ml-auto hidden text-xs text-app-ink-soft md:block">{MEIN_HOF_HINWEIS}</p>
      </nav>
    </header>
  )
}
