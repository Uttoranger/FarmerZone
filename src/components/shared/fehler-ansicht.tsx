'use client'

import { TriangleAlert } from 'lucide-react'
import {
  FEHLER_TEXT,
  FEHLER_TITEL,
  NOCHMAL_VERSUCHEN,
  PROBLEM_MELDEN,
  ZUR_STARTSEITE,
  fehlerKicker,
  meldungLinkMitKennung,
} from '@/lib/fehlerseite'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'

const PILLE = cn('inline-flex h-12 w-full items-center justify-center rounded-full px-5 text-[15px] font-semibold transition-opacity duration-[250ms]', FOKUS_RAHMEN)

/**
 * Die 500 — einmal gebaut, von beiden Fehlergrenzen benutzt.
 *
 * `src/app/error.tsx` fängt einen Fehler innerhalb des Root-Layouts,
 * `src/app/global-error.tsx` einen im Root-Layout selbst. Zwei Dateien mit
 * demselben Aufbau laufen auseinander, sobald jemand einen Satz ändert;
 * deshalb steht er hier einmal.
 *
 * ZWEI BEWUSSTE ENTSCHEIDUNGEN:
 *
 * 1. Keine Kundenkopfzeile. Diese Ansicht erscheint, WEIL etwas gescheitert
 *    ist — war die Kopfzeile selbst die Ursache, risse sie die Fehlerseite mit
 *    und der Mensch sähe gar nichts mehr. Der Weg nach Hause steht als Knopf.
 * 2. Gewöhnliche `<a>` statt `<Link>`. Ein Vollaufbau ist hier das Richtige:
 *    Er lässt den zerbrochenen Baum zurück, statt ihn mitzunehmen — und in
 *    global-error gibt es den Router-Kontext ohnehin nicht verlässlich.
 */
export function FehlerAnsicht({
  fehlernummer,
  nochmal,
  ziel = { href: '/', text: ZUR_STARTSEITE },
  text = FEHLER_TEXT,
  meldenPfad = '/problem-melden',
  imLayout = false,
}: {
  /** `error.digest` — die einzige technische Angabe, die der Mensch sieht. */
  fehlernummer?: string
  /** Nextens `reset()`: baut die Grenze neu auf, ohne die Seite neu zu laden. */
  nochmal: () => void
  /** Der Weg zurück — ohne Angabe die Startseite. */
  ziel?: { href: string; text: string }
  /** Der Satz unter der Überschrift (aus src/lib/fehlerseite.ts). */
  text?: string
  /** Wohin „Problem melden" führt — im Hofbereich dessen eigener Briefkasten. */
  meldenPfad?: '/problem-melden' | '/fehler-melden'
  /** Unter einem Layout mit Unterleiste: nicht die volle Bildschirmhöhe. */
  imLayout?: boolean
}) {
  return (
    <div
      data-design="neu"
      className={cn(
        'flex items-center justify-center bg-background px-6 text-foreground',
        imLayout ? 'min-h-[70dvh] py-12' : 'min-h-dvh py-16'
      )}
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-3.5 text-center">
        <span className="flex size-[76px] items-center justify-center rounded-full border border-border bg-card" aria-hidden="true">
          <TriangleAlert className="size-[34px] text-status-fertig" strokeWidth={1.5} aria-hidden="true" />
        </span>
        {/* Die Fehlernummer ist zum Vorlesen und Abtippen da — nicht zum
            Verstehen. Kein Fehlertext, kein Stapel, kein Dateiname: Das wäre
            für den Menschen ohne Wert und für uns eine offene Flanke. */}
        <p className="text-[12.5px] font-bold tracking-[1.6px] text-muted-foreground uppercase">{fehlerKicker(fehlernummer)}</p>
        <h1 className="font-heading text-[24px] leading-tight font-semibold text-balance">{FEHLER_TITEL}</h1>
        <p className="text-[15px] leading-normal text-muted-foreground">{text}</p>

        <div className="mt-2 flex w-full flex-col gap-2.5">
          <button type="button" onClick={nochmal} className={cn(PILLE, 'bg-primary text-primary-foreground hover:opacity-90')}>
            {NOCHMAL_VERSUCHEN}
          </button>
          {/* Absichtlich ein <a>, kein <Link>: Hier ist der
              Vollaufbau das Ziel, nicht der Umweg: <Link> navigiert im selben,
              gerade zerbrochenen Baum weiter, und in global-error gibt es den
              Router-Kontext ohnehin nicht verlässlich. */}
          <a href={ziel.href} className={cn(PILLE, 'border border-border text-foreground hover:bg-muted')}>
            {ziel.text}
          </a>
          <a
            href={meldungLinkMitKennung(fehlernummer, meldenPfad)}
            className={cn('inline-flex min-h-11 items-center justify-center rounded-full px-4 text-[14px] font-semibold text-brand-text underline-offset-4 hover:underline', FOKUS_RAHMEN)}
          >
            {PROBLEM_MELDEN}
          </a>
        </div>
      </div>
    </div>
  )
}
