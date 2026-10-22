import Image from 'next/image'
import { ArrowUpRight } from 'lucide-react'
import type { MeinHofReiterId } from '@/lib/bauern-navigation'
import { hofInitialen } from '@/lib/hof-initialen'
import { schildTon } from '@/lib/mein-hof'
import { vorschauLink } from '@/lib/hofseite-vorschau'
import { MEIN_HOF_ANSICHT_TEXT } from '@/lib/mein-hof-ansicht'
import type { MeinHofKopfDaten } from '@/server/queries/farm'
import type { MeinHofZustand } from '@/server/mein-hof-zustand'
import { AdresseKopierenKnopf } from '@/components/farmer/adresse-kopieren-knopf'
import { HofTeilenKnopf } from '@/components/farmer/hof-teilen-knopf'
import { StatusBadge } from '@/components/ui/status-badge'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { MeinHofReiterLeiste } from '@/components/mein-hof/reiter-leiste'
import { MeinHofKopf } from '@/components/mein-hof/mein-hof-kopf'
import { bildStil } from '@/lib/bild-ausschnitt'
import { cn } from '@/lib/utils'

/*
 * Der Kopf von „Mein Hof" in der HofShell (Nachtlauf Nr. 16; Mockups
 * web-h1-mein-hof-vorschau-handy/-web, mobil-h1-mein-hof): Hofbild, Name,
 * Zustand, Adresse mit Kopieren, „Teilen" und „Kundenansicht"; darunter die
 * Reiter Hofseite | Beiträge als Links (?reiter=, E12).
 *
 * Unter lg seit Nr. 143 der Kopf am Handy (mein-hof-kopf.tsx, Register N3,
 * Ergänzung 22.10.2026: Titelbild-Streifen, Zustandszeile, Reiter — derselbe
 * wie auf /products unter md), ab lg die kompakte Zeile wie bisher. Seit
 * Nr. 22e der einzige Kopf von Mein Hof (der Bestandskopf fiel mit der
 * Umleitung von /status weg).
 *
 * „Kundenansicht" zeigt die Vorschau der echten Hofseite (?vorschau=1) — sie
 * geht auch vor der Freigabe, nur für den Besitzer (ansichtsModus). Unter lg
 * schaltet der Knopf seit Nr. 49 (Register N4) auf „So sieht’s die Kundin"
 * (kundenansicht-knopf.tsx, Vollbild kundenansicht-vollbild.tsx), ab lg öffnet er
 * sie in einem neuen Tab. Teilen, Adress-Link und Kopieren nur, wenn die
 * Hofseite öffentlich ist (hofZustand) — sonst führte der Link Kundinnen ins
 * Leere. Die Reiter sind seit Nr. 49 ein eigener Baustein (reiter-leiste.tsx),
 * den auch /products unter md trägt.
 */

const KNOPF = cn(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors duration-[250ms] hover:bg-muted',
  FOKUS_RAHMEN
)

/** Logo oder Initialen, rund — auch für den Kopf am Handy (mein-hof-kopf.tsx). */
export function Hofbild({ hof, klasse }: { hof: MeinHofKopfDaten; klasse: string }): React.JSX.Element {
  return hof.logoUrl ? (
    // Rund geschnitten im Kasten: Mit Zoom ragte das Logo sonst über den Kreis; ohne Filter (Register N17, Nr. 98).
    <span className={cn(klasse, 'block shrink-0 overflow-hidden rounded-full')}>
      <Image src={hof.logoUrl} alt="" width={112} height={112} className="size-full object-cover" style={bildStil(hof.logoAusschnitt, { filter: false })} />
    </span>
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
        <span className="sr-only">{MEIN_HOF_ANSICHT_TEXT.neuerTabHinweis}</span>
      </a>
      <AdresseKopierenKnopf url={hof.adresse.url} className={cn('text-muted-foreground hover:bg-muted hover:text-foreground', FOKUS_RAHMEN)} />
    </span>
  )
}

function Knoepfe({ hof }: { hof: MeinHofKopfDaten }) {
  return (
    <div className="flex shrink-0 gap-2">
      {hof.zustand.oeffentlich && <HofTeilenKnopf name={hof.name} slug={hof.slug} className={KNOPF} label="Teilen" />}
      <a href={vorschauLink(hof.slug)} target="_blank" rel="noopener noreferrer" className={KNOPF}>
        {MEIN_HOF_ANSICHT_TEXT.kundenansicht}
        <ArrowUpRight className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
        <span className="sr-only">{MEIN_HOF_ANSICHT_TEXT.neuerTabHinweis}</span>
      </a>
    </div>
  )
}

export function MeinHofSeitenkopf({
  hof,
  aktiv,
  zustand,
}: {
  hof: MeinHofKopfDaten | null
  aktiv: MeinHofReiterId
  /** Für die Zustandszeile am Handy (ladeMeinHofZustand); ab lg zeigt die Zeile weiter das Schild. */
  zustand: MeinHofZustand | null
}): React.JSX.Element | null {
  if (!hof) return null

  return (
    // Unter lg folgt direkt der Inhalt des Reiters (mein-hof-ansicht.tsx), ab lg mit 24 px Abstand (der Kopf hat keinen eigenen Außenabstand).
    <header className="print:hidden lg:mb-6">
      {/* ===== Unter lg: der Kopf am Handy, mit den Reitern ===== */}
      <div className="lg:hidden">
        <MeinHofKopf hof={hof} zustand={zustand} aktiv={aktiv} />
      </div>

      {/* ===== Ab lg: kompakte Zeile ===== */}
      <div className="hidden lg:block">
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4">
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
          <Knoepfe hof={hof} />
        </div>

        {/* Reiter links gruppiert (Mockup). */}
        <MeinHofReiterLeiste aktiv={aktiv} className="mt-4" />
      </div>
    </header>
  )
}
