import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Impressum â€” FarmerZone' }

export default function ImpressumPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link href="javascript:history.back()" className="text-sm text-primary hover:underline mb-6 inline-block">
          â† ZurÃ¼ck
        </Link>
        <h1 className="text-2xl font-semibold text-slate-800 mb-8">Impressum</h1>

        <div className="space-y-8 text-sm text-slate-700 leading-relaxed">

          <section>
            <h2 className="font-semibold text-slate-800 text-base mb-3">Angaben gemÃ¤ÃŸ Â§ 5 ECG (Ã–sterreich)</h2>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-amber-800 text-xs mb-4">
              âš  Pilotbetrieb â€” FarmerZone wird derzeit mit ausgewÃ¤hlten HÃ¶fen erprobt. Kein kommerzieller Betrieb.
            </div>
            <p className="mb-1"><strong>Betreiber der Plattform:</strong></p>
            <address className="not-italic text-slate-600 space-y-0.5">
              <p>[Vor- und Nachname des Betreibers]</p>
              <p>[StraÃŸe und Hausnummer]</p>
              <p>[PLZ] [Ort], Ã–sterreich</p>
              <p className="mt-2">E-Mail: <a href="mailto:[betreiber@farmerzone.at]" className="text-primary hover:underline">[betreiber@farmerzone.at]</a></p>
              <p>Telefon: [+43 â€¦]</p>
            </address>
          </section>

          <section>
            <h2 className="font-semibold text-slate-800 text-base mb-3">Unternehmensgegenstand</h2>
            <p>
              FarmerZone ist eine digitale Vermittlungsplattform im Pilotbetrieb, die Verbrauchern die
              MÃ¶glichkeit bietet, Produkte direkt bei regionalen Landwirtschaftsbetrieben (HÃ¶fen) zu
              bestellen und abzuholen.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-slate-800 text-base mb-3">Haftungsausschluss â€” Produkte und Inhalte der HÃ¶fe</h2>
            <p>
              FarmerZone stellt ausschlieÃŸlich die technische Plattform zur VerfÃ¼gung.
              FÃ¼r die Beschreibung, QualitÃ¤t, Kennzeichnung und Lieferung der angebotenen Produkte
              sind ausschlieÃŸlich die jeweiligen Hofbetreiberinnen und Hofbetreiber verantwortlich.
              Diese handeln als eigenstÃ¤ndige VerkÃ¤uferinnen und VerkÃ¤ufer und sind selbst
              Vertragsparterinnen bzw. Vertragspartner der KÃ¤uferinnen und KÃ¤ufer.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-slate-800 text-base mb-3">Urheberrecht</h2>
            <p>
              Die auf dieser Plattform verÃ¶ffentlichten Inhalte (Texte, Bilder, Grafiken) unterliegen
              dem Ã¶sterreichischen Urheberrecht. Eine VervielfÃ¤ltigung oder Verwendung bedarf der
              ausdrÃ¼cklichen schriftlichen Zustimmung.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-slate-800 text-base mb-3">Online-Streitbeilegung</h2>
            <p>
              Die EU-Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{' '}
              <a
                href="https://ec.europa.eu/consumers/odr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                https://ec.europa.eu/consumers/odr
              </a>
            </p>
          </section>

          <p className="text-xs text-muted-foreground pt-4 border-t border-border">
            Stand: Juni 2026
          </p>
        </div>
      </div>
    </div>
  )
}
