import type { Metadata } from 'next'
import { ZurueckLink } from '@/components/shared/zurueck-link'
import { KONTAKT_EMAIL } from '@/lib/support'
import {
  MAX_GRUENDUNGSHOEFE,
  GRUENDUNGSPHASE_ENDE_TEXT,
  GRUENDUNGS_PROVISION_PROZENT,
  GRUENDUNGS_ANGEBOT,
  GRUENDUNGS_KEINE_ZUGANGSGRENZE,
  GRUENDUNGS_ZAHLUNGSGEBUEHREN,
  GRUENDUNGS_AUFNAHME_SCHRITTE,
} from '@/lib/gruendungshof'

export const metadata: Metadata = {
  title: 'Konditionen für Höfe — FarmerZone',
  description:
    `Was FarmerZone kostet: Die ersten ${MAX_GRUENDUNGSHOEFE} freigeschalteten Höfe zahlen bis ` +
    `${GRUENDUNGSPHASE_ENDE_TEXT} keine Plattformgebühr, danach dauerhaft ` +
    `${GRUENDUNGS_PROVISION_PROZENT} % pro Online-Bestellung.`,
}

const CTA_MAILTO = `mailto:${KONTAKT_EMAIL}?subject=${encodeURIComponent('Mein Hof auf FarmerZone')}`

// Der Startseiten-CTA verspricht das Gründungshof-Angebot — bisher konnte man
// es nirgends nachlesen. Diese Seite ist die Nachlese-Stelle.
//
// Aufbau und Klassen bewusst wie Impressum und Datenschutz (gleicher Container,
// gleiche Zurück-Navigation, gleiche Abschnitts-Typografie): eine Seite über
// Geld soll aussehen wie die anderen verbindlichen Seiten, nicht wie Werbung.
//
// ALLE Zahlen und das Datum kommen aus src/lib/gruendungshof.ts. Steht hier
// eine Zahl im Text, ist das ein Fehler.
export default function KonditionenPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Bewusst NICHT der `javascript:history.back()`-Link der Rechtsseiten:
            React blockiert solche URLs, der Link dort tut nichts. Gleiche
            Optik, funktionierendes Verhalten (siehe zurueck-link.tsx). */}
        <ZurueckLink />

        {/* Kicker im Stil der Startseite */}
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: '#4F6F57' }}>
          Was es kostet
        </p>
        <h1 className="text-2xl font-semibold text-slate-800 mb-8">Konditionen für Höfe</h1>

        <div className="space-y-8 text-sm text-slate-700 leading-relaxed">

          <section>
            <h2 className="font-semibold text-slate-800 text-base mb-3">Das Gründungshof-Angebot</h2>
            <p>{GRUENDUNGS_ANGEBOT}</p>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
              <p className="text-slate-700">{GRUENDUNGS_KEINE_ZUGANGSGRENZE}</p>
            </div>
          </section>

          <section>
            <h2 className="font-semibold text-slate-800 text-base mb-3">Zahlungsgebühren</h2>
            <p>{GRUENDUNGS_ZAHLUNGSGEBUEHREN}</p>
          </section>

          <section>
            <h2 className="font-semibold text-slate-800 text-base mb-3">So läuft die Aufnahme</h2>
            <ol className="space-y-3">
              {GRUENDUNGS_AUFNAHME_SCHRITTE.map((schritt, i) => (
                <li key={schritt.titel} className="flex gap-3">
                  <span
                    className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                    style={{ background: '#E8F0E2', color: '#2D5F3F' }}
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <strong className="font-semibold text-slate-800">{schritt.titel}</strong>
                    <span className="block text-slate-700">{schritt.text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h2 className="font-semibold text-slate-800 text-base mb-3">Interesse?</h2>
            <p className="mb-4">
              Schreib uns kurz, worum es bei deinem Hof geht — wir melden uns persönlich.
            </p>
            {/* Kein Orange: der eine Akzent der Startseite bleibt dort. Hier
                genügt der Primärton der Rechtsseiten. */}
            <a
              href={CTA_MAILTO}
              className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Hof anmelden
            </a>
            <p className="mt-3 text-xs text-muted-foreground break-words">
              oder direkt an{' '}
              <a href={CTA_MAILTO} className="text-primary hover:underline break-all">
                {KONTAKT_EMAIL}
              </a>
            </p>
          </section>

          <p className="text-xs text-muted-foreground pt-4 border-t border-border">
            Stand: August 2026
          </p>
        </div>
      </div>
    </div>
  )
}
