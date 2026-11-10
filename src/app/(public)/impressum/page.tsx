import type { Metadata } from 'next'
import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import { KONTAKT_EMAIL } from '@/lib/support'
import { PILOTBETRIEB } from '@/lib/pilotbetrieb'
import { PROBLEM_MELDEN } from '@/lib/fehlerseite'
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

// Name wie im Gewerberegister eingetragen; steht als Betreiber (ECG) und als
// Medieninhaber (MedienG) — einmal hier, damit beide Stellen gleich bleiben.
const BETREIBER = 'Dipl.-Ing. Johannes Franz Briewasser, BSc'

/** Bezeichnung vor einer Pflichtangabe („UID-Nummer:"). */
const ANGABE_NAME = 'font-medium text-foreground'

/**
 * Impressum in der KundeShell (seit Nr. 54, kein Mockup — Formen aus
 * infoseite-stil.ts wie /konditionen). Statisch: Die Sitzung für den Kopf
 * liest der Browser (KundeShellMitSitzung), die Seite liest keine Anfrage
 * (tests/hof-anmeldung.test.ts). Die Pflichtangaben tragen je ein
 * `data-angabe`, damit tests/impressum-seite.test.ts die Struktur prüft,
 * ohne die Werte ins öffentliche Repository zu schreiben. Hinweiskarte und
 * „im Pilotbetrieb" hängen an PILOTBETRIEB (AGB 1.0 schaltet um).
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
            {PILOTBETRIEB && (
              <Hinweiskarte ton="orange" symbol={TriangleAlert} className="mb-4">
                Pilotbetrieb — {MARKE} wird derzeit mit ausgewählten Höfen erprobt. Kein kommerzieller Betrieb.
              </Hinweiskarte>
            )}
            <p className="mb-1 text-foreground"><strong className="font-semibold">Betreiber der Plattform:</strong></p>
            <address data-angabe="anschrift" className="not-italic text-muted-foreground space-y-0.5">
              <p>{BETREIBER}</p>
              <p data-angabe="rechtsform"><span className={ANGABE_NAME}>Rechtsform:</span> Einzelunternehmen</p>
              <p>Freybergstraße 15 Top 11</p>
              <p>5270 Mauerkirchen, Österreich</p>
              <p data-angabe="email" className="mt-2">E-Mail: <a href={`mailto:${KONTAKT_EMAIL}`} className={INFOSEITE_LINK}>{KONTAKT_EMAIL}</a></p>
              <p data-angabe="kontaktformular">
                Oder schreib uns über das <Link href="/problem-melden" className={INFOSEITE_LINK}>Kontaktformular ({PROBLEM_MELDEN})</Link>.
              </p>
            </address>
            <div className="mt-4 space-y-0.5">
              <p data-angabe="uid"><span className={ANGABE_NAME}>UID-Nummer:</span> ATU79564605</p>
              <p data-angabe="gisa">
                <span className={ANGABE_NAME}>Gewerbe:</span> Dienstleistungen in der automatischen
                Datenverarbeitung und Informationstechnik (freies Gewerbe), GISA-Zahl 34231975
              </p>
              <p data-angabe="behoerde"><span className={ANGABE_NAME}>Gewerbebehörde:</span> Bezirkshauptmannschaft Braunau am Inn</p>
              <p data-angabe="kammer">
                <span className={ANGABE_NAME}>Kammer:</span> Wirtschaftskammer Oberösterreich, Fachgruppe
                Unternehmensberatung, Buchhaltung und Informationstechnologie
              </p>
              <p data-angabe="rechtsvorschriften">
                <span className={ANGABE_NAME}>Anwendbare Rechtsvorschriften:</span> Gewerbeordnung (
                <a href="https://www.ris.bka.gv.at" target="_blank" rel="noopener noreferrer" className={INFOSEITE_LINK}>www.ris.bka.gv.at</a>)
              </p>
            </div>
          </section>

          <section>
            <h2 className={INFOSEITE_ABSCHNITT}>Offenlegung nach § 25 MedienG</h2>
            <div className="space-y-2">
              <p data-angabe="medieninhaber">
                <span className={ANGABE_NAME}>Medieninhaber:</span> {BETREIBER}, Anschrift wie oben
              </p>
              <p data-angabe="gegenstand">
                <span className={ANGABE_NAME}>Unternehmensgegenstand:</span> Betrieb der Online-Plattform {MARKE}
                {PILOTBETRIEB && ' im Pilotbetrieb'}, einer digitalen Vermittlungsplattform, über die Verbraucher
                Produkte direkt bei regionalen Landwirtschaftsbetrieben (Höfen) bestellen und abholen.
              </p>
              <p data-angabe="richtung">
                <span className={ANGABE_NAME}>Grundlegende Richtung:</span> Information über regionale Höfe und
                ihre Produkte sowie Vermittlung von Bestellungen bei diesen Höfen.
              </p>
            </div>
          </section>

          <section>
            <h2 className={INFOSEITE_ABSCHNITT}>Kontaktstelle nach Art. 11 und 12 DSA</h2>
            <p>
              Behörden, die EU-Kommission und Nutzerinnen und Nutzer erreichen unsere zentrale Kontaktstelle
              nach Art. 11 und 12 Verordnung (EU) 2022/2065 per E-Mail an{' '}
              <a href={`mailto:${KONTAKT_EMAIL}`} className={INFOSEITE_LINK}>{KONTAKT_EMAIL}</a>, auf Deutsch
              oder Englisch.
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
            Stand: November 2026
          </p>
        </div>
      </div>
    </KundeShellMitSitzung>
  )
}
