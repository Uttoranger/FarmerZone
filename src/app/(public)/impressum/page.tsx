import type { Metadata } from 'next'
import { TriangleAlert } from 'lucide-react'
import { KundenKopf } from '@/components/shared/kunden-kopf'
import { KONTAKT_EMAIL } from '@/lib/support'

export const metadata: Metadata = { title: 'Impressum — FarmerZone' }

export default function ImpressumPage() {
  return (
    <div className="min-h-screen bg-background">
      <KundenKopf seite={{ art: 'info' }} />
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-semibold text-foreground mb-8">Impressum</h1>

        <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">

          <section>
            <h2 className="font-semibold text-foreground text-base mb-3">Angaben gemäß § 5 ECG (Österreich)</h2>
            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-lg px-4 py-3 text-amber-800 dark:text-amber-200 text-xs mb-4">
              <TriangleAlert className="mt-px size-3.5 shrink-0" strokeWidth={1.7} aria-hidden="true" />
              <span>Pilotbetrieb — FarmerZone wird derzeit mit ausgewählten Höfen erprobt. Kein kommerzieller Betrieb.</span>
            </div>
            <p className="mb-1"><strong>Betreiber der Plattform:</strong></p>
            <address className="not-italic text-muted-foreground space-y-0.5">
              <p>Johannes Briewasser</p>
              <p>Freybergstraße 15 Top 11</p>
              <p>5270 Mauerkirchen, Österreich</p>
              <p className="mt-2">E-Mail: <a href={`mailto:${KONTAKT_EMAIL}`} className="text-primary hover:underline break-words">{KONTAKT_EMAIL}</a></p>
            </address>
          </section>

          <section>
            <h2 className="font-semibold text-foreground text-base mb-3">Unternehmensgegenstand</h2>
            <p>
              FarmerZone ist eine digitale Vermittlungsplattform im Pilotbetrieb, die Verbrauchern die
              Möglichkeit bietet, Produkte direkt bei regionalen Landwirtschaftsbetrieben (Höfen) zu
              bestellen und abzuholen.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground text-base mb-3">Haftungsausschluss — Produkte und Inhalte der Höfe</h2>
            <p>
              FarmerZone stellt ausschließlich die technische Plattform zur Verfügung.
              Für die Beschreibung, Qualität, Kennzeichnung und Lieferung der angebotenen Produkte
              sind ausschließlich die jeweiligen Hofbetreiberinnen und Hofbetreiber verantwortlich.
              Diese handeln als eigenständige Verkäuferinnen und Verkäufer und sind selbst
              Vertragsparterinnen bzw. Vertragspartner der Käuferinnen und Käufer.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground text-base mb-3">Urheberrecht</h2>
            <p>
              Die auf dieser Plattform veröffentlichten Inhalte (Texte, Bilder, Grafiken) unterliegen
              dem österreichischen Urheberrecht. Eine Vervielfältigung oder Verwendung bedarf der
              ausdrücklichen schriftlichen Zustimmung.
            </p>
          </section>

          {/* Kein Abschnitt „Online-Streitbeilegung" mehr: Die EU-OS-Plattform
              wurde zum 20.07.2025 eingestellt — ein Hinweis auf eine
              abgeschaltete Stelle wäre irreführend. */}

          <p className="text-xs text-muted-foreground pt-4 border-t border-border">
            Stand: August 2026
          </p>
        </div>
      </div>
    </div>
  )
}
