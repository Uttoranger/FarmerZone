import Link from 'next/link'
import type { Metadata } from 'next'
import { Search } from 'lucide-react'
import { KundenKopf } from '@/components/shared/kunden-kopf'
import {
  HOEFE_ENTDECKEN,
  HOF_NICHT_GEFUNDEN_TEXT,
  HOF_NICHT_GEFUNDEN_TITEL,
  ZUR_STARTSEITE,
} from '@/lib/fehlerseite'
import { SUCHTEXT_MAX, SUCHTEXT_PARAMETER } from '@/schemas/hoefe-filter'

export const metadata: Metadata = {
  title: 'Hof nicht gefunden — FarmerZone',
  robots: { index: false, follow: false },
}

/**
 * Die 404 unter einer Hof-Adresse. Hier landet mehr als ein Fall, und das ist
 * der Grund für den vorsichtigen Wortlaut:
 *
 * - ein Slug, den es nie gab;
 * - ein STILLGELEGTER Hof (`archivedAt`), ein abgeschalteter (`isActive`) und
 *   ein noch nicht freigeschalteter — alle drei fallen schon aus der Query
 *   (`OEFFENTLICH_SICHTBAR`, src/server/queries/farm.ts), die Seite sieht sie
 *   gar nicht und kann sie deshalb auch nicht verraten;
 * - ein unbekannter Bestell-Link unter /confirm und ein Hof in Pause unter
 *   /checkout, denn deren notFound() fängt ebenfalls diese Datei.
 *
 * Deshalb behauptet der Text keinen Grund („vielleicht … oder …"): Warum ein
 * Hof nicht mehr da ist, ist seine Sache. Der primäre Weg ist hier nicht die
 * Startseite, sondern die Hofübersicht — wer einen Hof sucht, sucht einen Hof.
 */
export default function HofNichtGefunden() {
  return (
    <div className="min-h-screen bg-background">
      <KundenKopf seite={{ art: 'info' }} />

      <main className="mx-auto max-w-xl px-4 py-14 sm:py-20">
        <h1 className="font-heading text-2xl font-semibold text-balance text-foreground sm:text-3xl">
          {HOF_NICHT_GEFUNDEN_TITEL}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {HOF_NICHT_GEFUNDEN_TEXT}
        </p>

        <form action="/hoefe" method="get" role="search" className="mt-8">
          <label htmlFor="hof-nicht-gefunden-suche" className="mb-1.5 block text-sm font-medium text-foreground">
            Hof oder Produkt suchen
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                id="hof-nicht-gefunden-suche"
                type="search"
                name={SUCHTEXT_PARAMETER}
                maxLength={SUCHTEXT_MAX}
                placeholder="z. B. Eier, Heu, Wiesenhof"
                className="min-h-11 w-full rounded-xl border border-border bg-card pr-3 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
            >
              Suchen
            </button>
          </div>
        </form>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/hoefe"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {HOEFE_ENTDECKEN}
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
          >
            {ZUR_STARTSEITE}
          </Link>
        </div>
      </main>
    </div>
  )
}
