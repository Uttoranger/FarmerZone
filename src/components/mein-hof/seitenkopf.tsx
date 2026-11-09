import type { MeinHofReiterId } from '@/lib/bauern-navigation'
import { schildTon, MEIN_HOF_KOPF_TEXT } from '@/lib/mein-hof'
import { vorschauLink } from '@/lib/hofseite-vorschau'
import { MEIN_HOF_ANSICHT_TEXT } from '@/lib/mein-hof-ansicht'
import type { MeinHofKopfDaten } from '@/server/queries/farm'
import type { MeinHofZustand } from '@/server/mein-hof-zustand'
import { AdresseKopierenKnopf } from '@/components/farmer/adresse-kopieren-knopf'
import { HofTeilenKnopf } from '@/components/farmer/hof-teilen-knopf'
import { StatusBadge } from '@/components/ui/status-badge'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { MeinHofReiterLeiste } from '@/components/mein-hof/reiter-leiste'
import { MeinHofKopf, MeinHofZustandsKarte } from '@/components/mein-hof/mein-hof-kopf'
import { cn } from '@/lib/utils'

/*
 * Der Kopf von „Mein Hof" in der HofShell (Nachtlauf Nr. 16; Mockups
 * web-h1-mein-hof-vorschau-handy/-web, mobil-h1-mein-hof): Hofbild, Name,
 * Zustand, Adresse mit Kopieren, „Teilen" und „Kundenansicht"; darunter die
 * Reiter Hofseite | Beiträge als Links (?reiter=, E12).
 *
 * Unter lg seit Nr. 143 der Kopf am Handy (mein-hof-kopf.tsx, Register N3,
 * Ergänzung 22.10.2026; seit der Ergänzung 5.11.2026 Titel „Mein Hof“ mit
 * Schild statt Titelbild-Streifen, dann Reiter und Zustandskarte — derselbe wie
 * auf /products unter md). Ab lg seit Lauf 31 (Nr. 238, Board w1-mein-hof) die
 * sichtbare h1 „Mein Hof“, darunter Schild · Hofname · Adresse, rechts Teilen und
 * Kundenansicht, darunter breite Reiter und dieselbe Zustandskarte wie am Handy.
 * Je Breite steht genau eine h1 sichtbar (die andere Fassung ist ausgeblendet). Seit
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

function Zustand({ hof }: { hof: MeinHofKopfDaten }) {
  // Vorsatz „Öffentlich ·“ für eine öffentliche Hofseite ohne Schild (Board w1-mein-hof, Liste Lauf 32 mein-hof).
  if (!hof.zustand.schild) {
    return hof.zustand.oeffentlich ? (
      <span className="flex items-center gap-2.5 text-[15px] font-semibold text-status-fertig">
        Öffentlich
        <span aria-hidden="true" className="font-normal text-muted-foreground">
          ·
        </span>
      </span>
    ) : null
  }
  return <StatusBadge status={schildTon(hof.zustand.schild.farbe)}>{hof.zustand.schild.text}</StatusBadge>
}

function Adresse({ hof }: { hof: MeinHofKopfDaten }) {
  if (!hof.zustand.oeffentlich) {
    return <span className="block min-w-0 truncate text-[15px] text-muted-foreground">{hof.adresse.anzeige}</span>
  }
  return (
    <span className="flex min-w-0 items-center gap-0.5">
      {/* Der Link selbst ist 44 px hoch (WCAG 2.5.8); gekürzt wird nur das Wort darin. */}
      <a
        href={hof.adresse.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn('inline-flex min-h-11 min-w-0 items-center rounded-sm text-[15px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline', FOKUS_RAHMEN)}
      >
        <span className="min-w-0 truncate">{hof.adresse.anzeige}</span>
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
      {/* Ohne Pfeil wie im Board w1-mein-hof; den neuen Tab nennt der Screenreader-Zusatz. */}
      <a href={vorschauLink(hof.slug)} target="_blank" rel="noopener noreferrer" className={KNOPF}>
        {MEIN_HOF_ANSICHT_TEXT.kundenansicht}
        <span className="sr-only">{MEIN_HOF_ANSICHT_TEXT.neuerTabHinweis}</span>
      </a>
    </div>
  )
}

export function MeinHofSeitenkopf({
  hof,
  aktiv,
  zustand,
  jetzt,
}: {
  hof: MeinHofKopfDaten | null
  aktiv: MeinHofReiterId
  /** Für die Zustandskarte (ladeMeinHofZustand) — am Handy und ab lg unter den Reitern. */
  zustand: MeinHofZustand | null
  /** Der Zeitpunkt der Seite — für „Stand …“ im Kopf am Handy. */
  jetzt: Date
}): React.JSX.Element | null {
  if (!hof) return null

  return (
    // Unter lg folgt direkt der Inhalt des Reiters (mein-hof-ansicht.tsx), ab lg mit 24 px Abstand (der Kopf hat keinen eigenen Außenabstand).
    <header className="print:hidden lg:mb-6">
      {/* ===== Unter lg: der Kopf am Handy, mit den Reitern ===== */}
      <div className="lg:hidden">
        {/* Die Zustandskarte steht unter lg im Inhalt (farm-page/page.tsx): Titel und Reiter kleben, die Karte scrollt. */}
        <MeinHofKopf hof={hof} zustand={zustand} aktiv={aktiv} jetzt={jetzt} titelAlsH1 ohneKarte />
      </div>

      {/* ===== Ab lg: Überschrift „Mein Hof“ wie im Board w1-mein-hof ===== */}
      <div className="hidden lg:block">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-[30px] leading-tight font-semibold text-foreground">{MEIN_HOF_KOPF_TEXT.titel}</h1>
            {/* Schild, Hofname und Adresse in einer Zeile (Board: „Öffentlich · Hof Müller · Adresse“). */}
            <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2.5">
              <Zustand hof={hof} />
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="max-w-[24rem] truncate text-[15px] text-muted-foreground" title={hof.name}>
                  {hof.name}
                </span>
                <span aria-hidden="true" className="text-muted-foreground">
                  ·
                </span>
                <Adresse hof={hof} />
              </span>
            </div>
          </div>
          <Knoepfe hof={hof} />
        </div>

        {/* Breite Reiter wie im Board, darunter die Zustandskarte (nicht auf Beiträge). */}
        <MeinHofReiterLeiste aktiv={aktiv} breit className="mt-3" />
        {aktiv !== 'beitraege' && <MeinHofZustandsKarte hof={hof} zustand={zustand} className="mt-4 max-w-[760px]" />}
      </div>
    </header>
  )
}
