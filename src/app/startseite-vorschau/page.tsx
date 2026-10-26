import type { Metadata } from 'next'
import Link from 'next/link'
import { EyeOff } from 'lucide-react'
import { ladeVorschauZeilen } from '@/server/queries/startseite'
import { leseStartseitenVorschau } from '@/server/startseite-vorschau'
import { ADMIN_STARTSEITE_HREF, STARTSEITE_VORSCHAU_UNGUELTIG, STARTSEITE_VORSCHAU_ZURUECK, zuRendern } from '@/lib/startseite-gestalten'
import { istBrennmaterialSaison } from '@/lib/brennmaterial-saison'
import { cn } from '@/lib/utils'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import { STARTSEITE_TITEL, StartseitenInhalt } from '@/components/startseite/startseiten-inhalt'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'

/*
 * Die Vorschau der Startseite aus Admin › Startseite (Register N16, Ergänzung
 * 25.10.2026; Nr. 182): `/startseite-vorschau?vorschau=…&sig=…` — der Rahmen
 * „So sieht's die Kundin", „Vorschau öffnen" im neuen Tab und am Handy.
 *
 * EIGENE DYNAMISCHE ROUTE statt der Startseite im Draft Mode: Für `/` (ISR,
 * `revalidate`) gibt Vercel keinen Query-Parameter an die Funktion weiter —
 * die Vorschau zeigte in Produktion sonst die Live-Seite. Hier liest die Seite
 * die Anfrage je Aufruf (force-dynamic) und prüft erst Signatur und Ablauf,
 * erst danach die Admin-Sitzung (leseStartseitenVorschau). Den Inhalt rendert
 * derselbe Baustein wie die Startseite (StartseitenInhalt), mit Band.
 *
 * Ungültig, abgelaufen, ohne Sitzung oder ohne Admin-Recht: KEIN Inhalt der
 * Startseite und keine Weiterleitung auf `/` (die ist nicht einbettbar, der
 * Rahmen bliebe leer), sondern der Fehlerzustand mit dem Weg zurück
 * (DESIGN_SYSTEM, „Zustände"). Header (SAMEORIGIN nur mit Link, kein
 * Referrer, no-store) in next.config.ts; robots.txt sperrt den Pfad.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: STARTSEITE_TITEL,
  robots: { index: false, follow: false },
  alternates: { canonical: '/' },
}

/** Der Fehlerzustand: ein Satz, der Weg zurück — ohne Grund (abgelaufen, fremd, keine Sitzung sehen gleich aus). */
function VorschauUngueltig(): React.JSX.Element {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 md:py-16">
      <Hinweiskarte
        ton="orange"
        symbol={EyeOff}
        titel={STARTSEITE_VORSCHAU_UNGUELTIG}
        aktion={
          <Link
            href={ADMIN_STARTSEITE_HREF}
            className={cn('inline-flex h-11 items-center rounded-full border border-border px-4 text-sm font-semibold hover:bg-muted', FOKUS_RAHMEN)}
          >
            {STARTSEITE_VORSCHAU_ZURUECK}
          </Link>
        }
      />
    </div>
  )
}

export default async function StartseitenVorschauSeite({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<React.JSX.Element> {
  const jetzt = new Date()
  const vorschau = await leseStartseitenVorschau(await searchParams, jetzt)
  if (!vorschau) {
    return (
      <KundeShellMitSitzung>
        <VorschauUngueltig />
      </KundeShellMitSitzung>
    )
  }
  // Die Quelle aus dem signierten Link (Entwurf, Live zum Tag, eine Fassung; Nr. 99), zum Tag aus dem Link.
  const eintraege = zuRendern(await ladeVorschauZeilen(vorschau), vorschau.datum, {
    brennmaterialSaison: istBrennmaterialSaison(vorschau.datum),
    blockEntwurfId: vorschau.blockEntwurfId,
  })

  return (
    <KundeShellMitSitzung>
      <StartseitenInhalt eintraege={eintraege} jetzt={vorschau.datum} band={{ quelle: vorschau.quelle, datum: vorschau.datum }} />
    </KundeShellMitSitzung>
  )
}
