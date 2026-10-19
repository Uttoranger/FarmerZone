import type { Metadata } from 'next'
import { TriangleAlert } from 'lucide-react'
import { KONTAKT_EMAIL } from '@/lib/support'
import { cn } from '@/lib/utils'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import {
  INFOSEITE_ABSCHNITT,
  INFOSEITE_LINK,
  INFOSEITE_SPALTE,
  INFOSEITE_STAND,
  INFOSEITE_TEXT,
  INFOSEITE_TITEL,
} from '@/components/shared/infoseite-stil'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import { MARKE } from '@/lib/marke'

export const metadata: Metadata = { title: `Impressum — ${MARKE}`, alternates: { canonical: '/impressum' } }

/**
 * Impressum in der KundeShell (seit Nr. 54, kein Mockup — Formen aus
 * infoseite-stil.ts wie /konditionen). Statisch: Die Sitzung für den Kopf
 * liest der Browser (KundeShellMitSitzung), die Seite liest keine Anfrage
 * (tests/hof-anmeldung.test.ts).
 */
export default function ImpressumPage() {
  return (
    <KundeShellMitSitzung>
      <div className={INFOSEITE_SPALTE}>
        <h1 className={cn(INFOSEITE_TITEL, 'mb-8')}>Impressum</h1>

        <div className={INFOSEITE_TEXT}>

          <section>
            <h2 className={INFOSEITE_ABSCHNITT}>Angaben gemäß § 5 ECG (Österreich)</h2>
            {/* Orange Hinweiskarte statt der alten Bernstein-Fläche: Im neuen
                Design gibt es für „Achtung" nur die Hinweiskarte (DESIGN_SYSTEM). */}
            <Hinweiskarte ton="orange" symbol={TriangleAlert} className="mb-4">
              Pilotbetrieb — {MARKE} wird derzeit mit ausgewählten Höfen erprobt. Kein kommerzieller Betrieb.
            </Hinweiskarte>
            <p className="mb-1 text-foreground"><strong className="font-semibold">Betreiber der Plattform:</strong></p>
            <address className="not-italic text-muted-foreground space-y-0.5">
              <p>Johannes Briewasser</p>
              <p>Freybergstraße 15 Top 11</p>
              <p>5270 Mauerkirchen, Österreich</p>
              <p className="mt-2">E-Mail: <a href={`mailto:${KONTAKT_EMAIL}`} className={INFOSEITE_LINK}>{KONTAKT_EMAIL}</a></p>
            </address>
          </section>

          <section>
            <h2 className={INFOSEITE_ABSCHNITT}>Unternehmensgegenstand</h2>
            <p>
              {MARKE} ist eine digitale Vermittlungsplattform im Pilotbetrieb, die Verbrauchern die
              Möglichkeit bietet, Produkte direkt bei regionalen Landwirtschaftsbetrieben (Höfen) zu
              bestellen und abzuholen.
            </p>
          </section>

          <section>
            <h2 className={INFOSEITE_ABSCHNITT}>Haftungsausschluss — Produkte und Inhalte der Höfe</h2>
            <p>
              {MARKE} stellt ausschließlich die technische Plattform zur Verfügung.
              Für die Beschreibung, Qualität, Kennzeichnung und Lieferung der angebotenen Produkte
              sind ausschließlich die jeweiligen Hofbetreiberinnen und Hofbetreiber verantwortlich.
              Diese handeln als eigenständige Verkäuferinnen und Verkäufer und sind selbst
              Vertragspartnerinnen bzw. Vertragspartner der Käuferinnen und Käufer.
            </p>
          </section>

          <section>
            <h2 className={INFOSEITE_ABSCHNITT}>Urheberrecht</h2>
            <p>
              Die auf dieser Plattform veröffentlichten Inhalte (Texte, Bilder, Grafiken) unterliegen
              dem österreichischen Urheberrecht. Eine Vervielfältigung oder Verwendung bedarf der
              ausdrücklichen schriftlichen Zustimmung.
            </p>
          </section>

          {/* Kein Abschnitt „Online-Streitbeilegung" mehr: Die EU-OS-Plattform
              wurde zum 20.07.2025 eingestellt — ein Hinweis auf eine
              abgeschaltete Stelle wäre irreführend. */}

          <p className={INFOSEITE_STAND}>
            Stand: August 2026
          </p>
        </div>
      </div>
    </KundeShellMitSitzung>
  )
}
