import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { RUNDUNG } from '@/components/ui/rundung'
import { INFOSEITE_KICKER, INFOSEITE_STAND, INFOSEITE_TEXT, INFOSEITE_TITEL } from '@/components/shared/infoseite-stil'
import { SeiteDrucken } from '@/components/rechtstexte/seite-drucken'
import { RechtstextVerzeichnis, type VerzeichnisGruppe } from '@/components/shared/rechtstext-verzeichnis'
import { AGB_SEITE_TEXT } from '@/lib/rechtstexte/agb-einbindung'

/*
 * Die Vorlage der Rechtsseiten /agb, /datenschutz und /konditionen (V62,
 * Lauf 30, Nr. 231; Boards s3/w3-rechtstexte): Kicker, h1, Stand-Zeile direkt
 * unter dem Titel (mit der Kennzeichnung „Entwurf“, wo es eine gibt),
 * „Drucken/Speichern“, Inhaltsverzeichnis — ab 1024 px als Spalte links, am
 * Handy aufklappbar „Inhalt“ —, Abschnitte und der Fuß „Stand: …“.
 *
 * Neben infoseite-stil.ts, nicht darin: Dessen Exporte bleiben unverändert,
 * weil /impressum sie nutzt (A001). Die Vorlage nimmt sie nur auf. Den
 * Wortlaut der Rechtstexte zeichnen die Seiten selbst (children) — die
 * Vorlage ist nur der Rahmen.
 *
 * Statisch (keine Anfrage gelesen); nur das Verzeichnis läuft im Browser, um
 * den gewählten Sprung zu zeigen. Auf dem Papier fehlen Verzeichnis und Knopf
 * (print:hidden): Dort steht der Text fortlaufend.
 */

/** Die Wörter der Vorlage — „Inhalt“ und „Drucken/Speichern“ wie bisher aus der AGB-Einbindung. */
export const RECHTSTEXT_TEXT = {
  kicker: 'Rechtliches',
  inhalt: AGB_SEITE_TEXT.inhalt,
  drucken: AGB_SEITE_TEXT.drucken,
  stand: (stand: string) => `Stand: ${stand}`,
  /** Die Zeile unter „Inhalt“ am Handy: „4 Teile · 29 Punkte · Anhang“. */
  teileUndPunkte: (teile: number, punkte: number, anhang: boolean) =>
    [`${teile} Teile`, `${punkte} Punkte`, ...(anhang ? ['Anhang'] : [])].join(' · '),
  /** Dasselbe für eine Seite ohne Teile: „14 Abschnitte“. */
  abschnitte: (anzahl: number) => (anzahl === 1 ? '1 Abschnitt' : `${anzahl} Abschnitte`),
} as const

/** Die Kennzeichnung neben der Stand-Zeile bzw. über einem Abschnitt („Entwurf – die Anwältin prüft den Wortlaut“). */
export function EntwurfMarke({ children, className }: { children: React.ReactNode; className?: string }): React.JSX.Element {
  return <span className={cn('text-[12.5px] font-semibold text-status-offen', className)}>{children}</span>
}

export type RechtstextVerzeichnisDaten = {
  /** Kennung für die Überschriften „Inhalt“ (am Handy `<kennung>`, in der Spalte `<kennung>-spalte`). */
  kennung: string
  /** Die Zeile unter „Inhalt“ im zugeklappten Zustand. */
  zusammenfassung: string
  gruppen: readonly VerzeichnisGruppe[]
}

export function RechtstextVorlage({
  kicker = RECHTSTEXT_TEXT.kicker,
  titel,
  stand,
  marke,
  drucken = false,
  verzeichnis,
  fussStand,
  children,
}: {
  kicker?: string
  titel: string
  /** Die Stand-Zeile direkt unter dem Titel (Fassung, Gesetz, Datum). */
  stand: string
  /** Kennzeichnung neben der Stand-Zeile, etwa ein Entwurf. */
  marke?: string
  /** Knopf „Drucken/Speichern“ (§ 11 ECG: abrufen, speichern, ausdrucken). */
  drucken?: boolean
  verzeichnis?: RechtstextVerzeichnisDaten
  /** Der Fuß „Stand: …“ — nur das Datum. */
  fussStand?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div
      className={cn(
        // Seit Nr. 254 (Liste Lauf 32, rechtstexte Z. 850): die Spalte der Shell (1000 px wie der Seitenfuß), der
        // Text links darin statt mittig — auch ohne Verzeichnis (Impressum-Form, Konditionen) beginnt er an der Kante des Fußes.
        'mx-auto w-full max-w-[1032px] px-4 pt-8 pb-12 md:pt-10',
        // Ab 1024 px: links die Spalte des Verzeichnisses (260 px), rechts der Text (Board w3-rechtstexte Bild 1).
        verzeichnis && 'lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-x-6'
      )}
    >
      <div className={cn('min-w-0 lg:col-start-2 lg:row-start-1', !verzeichnis && 'max-w-2xl')}>
        <p className={INFOSEITE_KICKER}>{kicker}</p>
        <h1 className={INFOSEITE_TITEL}>{titel}</h1>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-[13.5px] text-muted-foreground">
          <span>{stand}</span>
          {marke && <EntwurfMarke>{marke}</EntwurfMarke>}
        </p>
        {drucken && (
          <div className="mt-4">
            <SeiteDrucken>{RECHTSTEXT_TEXT.drucken}</SeiteDrucken>
          </div>
        )}

        {verzeichnis && (
          <details className={cn(RUNDUNG.karte, 'group mt-5 border border-border bg-card lg:hidden print:hidden')}>
            <summary
              className={cn(
                RUNDUNG.karte,
                'flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden',
                FOKUS_RAHMEN
              )}
            >
              <span className="flex flex-col">
                <span id={verzeichnis.kennung} className="text-[14.5px] font-semibold text-foreground">
                  {RECHTSTEXT_TEXT.inhalt}
                </span>
                <span className="text-[12.5px] text-muted-foreground">{verzeichnis.zusammenfassung}</span>
              </span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" strokeWidth={1.7} aria-hidden="true" />
            </summary>
            <nav aria-labelledby={verzeichnis.kennung} className="border-t border-border px-3 py-2 print:hidden">
              <RechtstextVerzeichnis gruppen={verzeichnis.gruppen} />
            </nav>
          </details>
        )}

        <div className={cn(INFOSEITE_TEXT, 'mt-8')}>
          {children}
          {fussStand && <p className={INFOSEITE_STAND}>{RECHTSTEXT_TEXT.stand(fussStand)}</p>}
        </div>
      </div>

      {verzeichnis && (
        <aside className="hidden lg:col-start-1 lg:row-start-1 lg:block print:hidden">
          {/* Eine geschlossene Karte ohne sichtbaren Rollbalken (Z. 854); ist sie höher als das Fenster, rollt sie
              innen, und das Verzeichnis holt den gelesenen Eintrag selbst ins Bild (Z. 847). */}
          <nav
            aria-labelledby={`${verzeichnis.kennung}-spalte`}
            className={cn(
              RUNDUNG.karte,
              'sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto border border-border bg-card p-3.5 [scrollbar-width:none] print:hidden'
            )}
          >
            <p id={`${verzeichnis.kennung}-spalte`} className={cn(INFOSEITE_KICKER, 'mb-1 px-1')}>
              {RECHTSTEXT_TEXT.inhalt}
            </p>
            <RechtstextVerzeichnis gruppen={verzeichnis.gruppen} />
          </nav>
        </aside>
      )}
    </div>
  )
}
