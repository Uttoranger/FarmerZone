import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Impressum — FarmerZone' }

export default function ImpressumPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link href="javascript:history.back()" className="text-sm text-green-700 hover:underline mb-6 inline-block">
          ← Zurück
        </Link>
        <h1 className="text-2xl font-semibold text-slate-800 mb-8">Impressum</h1>

        <div className="space-y-8 text-sm text-slate-700 leading-relaxed">

          <section>
            <h2 className="font-semibold text-slate-800 text-base mb-3">Angaben gemäß § 5 ECG (Österreich)</h2>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-amber-800 text-xs mb-4">
              ⚠ Pilotbetrieb — FarmerZone wird derzeit mit ausgewählten Höfen erprobt. Kein kommerzieller Betrieb.
            </div>
            <p className="mb-1"><strong>Betreiber der Plattform:</strong></p>
            <address className="not-italic text-slate-600 space-y-0.5">
              <p>[Vor- und Nachname des Betreibers]</p>
              <p>[Straße und Hausnummer]</p>
              <p>[PLZ] [Ort], Österreich</p>
              <p className="mt-2">E-Mail: <a href="mailto:[betreiber@farmerzone.at]" className="text-green-700 hover:underline">[betreiber@farmerzone.at]</a></p>
              <p>Telefon: [+43 …]</p>
            </address>
          </section>

          <section>
            <h2 className="font-semibold text-slate-800 text-base mb-3">Unternehmensgegenstand</h2>
            <p>
              FarmerZone ist eine digitale Vermittlungsplattform im Pilotbetrieb, die Verbrauchern die
              Möglichkeit bietet, Produkte direkt bei regionalen Landwirtschaftsbetrieben (Höfen) zu
              bestellen und abzuholen.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-slate-800 text-base mb-3">Haftungsausschluss — Produkte und Inhalte der Höfe</h2>
            <p>
              FarmerZone stellt ausschließlich die technische Plattform zur Verfügung.
              Für die Beschreibung, Qualität, Kennzeichnung und Lieferung der angebotenen Produkte
              sind ausschließlich die jeweiligen Hofbetreiberinnen und Hofbetreiber verantwortlich.
              Diese handeln als eigenständige Verkäuferinnen und Verkäufer und sind selbst
              Vertragsparterinnen bzw. Vertragspartner der Käuferinnen und Käufer.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-slate-800 text-base mb-3">Urheberrecht</h2>
            <p>
              Die auf dieser Plattform veröffentlichten Inhalte (Texte, Bilder, Grafiken) unterliegen
              dem österreichischen Urheberrecht. Eine Vervielfältigung oder Verwendung bedarf der
              ausdrücklichen schriftlichen Zustimmung.
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
                className="text-green-700 hover:underline"
              >
                https://ec.europa.eu/consumers/odr
              </a>
            </p>
          </section>

          <p className="text-xs text-slate-400 pt-4 border-t border-slate-100">
            Stand: Juni 2026
          </p>
        </div>
      </div>
    </div>
  )
}
