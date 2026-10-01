'use client'

import {
  FEHLER_TEXT,
  FEHLER_TITEL,
  NOCHMAL_VERSUCHEN,
  PROBLEM_MELDEN,
  ZUR_STARTSEITE,
  meldungLinkMitKennung,
} from '@/lib/fehlerseite'

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
}: {
  /** `error.digest` — die einzige technische Angabe, die der Mensch sieht. */
  fehlernummer?: string
  /** Nextens `reset()`: baut die Grenze neu auf, ohne die Seite neu zu laden. */
  nochmal: () => void
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center">
        <h1 className="font-heading text-xl font-semibold text-balance text-foreground sm:text-2xl">
          {FEHLER_TITEL}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{FEHLER_TEXT}</p>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={nochmal}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {NOCHMAL_VERSUCHEN}
          </button>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Hier ist der
              Vollaufbau das Ziel, nicht der Umweg: <Link> navigiert im selben,
              gerade zerbrochenen Baum weiter, und in global-error gibt es den
              Router-Kontext ohnehin nicht verlässlich. */}
          <a
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
          >
            {ZUR_STARTSEITE}
          </a>
        </div>

        {/* Die Fehlernummer ist zum Vorlesen und Abtippen da — nicht zum
            Verstehen. Kein Fehlertext, kein Stapel, kein Dateiname: Das wäre
            für den Menschen ohne Wert und für uns eine offene Flanke. */}
        {fehlernummer ? (
          <p className="mt-6 text-xs text-muted-foreground">
            Fehlernummer <span className="font-mono">{fehlernummer}</span>
          </p>
        ) : null}
        <a
          href={meldungLinkMitKennung(fehlernummer)}
          className="mt-2 inline-block text-xs font-medium text-brand-text underline-offset-4 hover:underline"
        >
          {PROBLEM_MELDEN}
        </a>
      </div>
    </div>
  )
}
