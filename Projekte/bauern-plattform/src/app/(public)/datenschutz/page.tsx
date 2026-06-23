import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Datenschutz — FarmerZone' }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-semibold text-slate-800 text-base mb-3">{title}</h2>
      <div className="space-y-2 text-slate-600">{children}</div>
    </section>
  )
}

export default function DatenschutzPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link href="javascript:history.back()" className="text-sm text-green-700 hover:underline mb-6 inline-block">
          ← Zurück
        </Link>
        <h1 className="text-2xl font-semibold text-slate-800 mb-2">Datenschutzerklärung</h1>
        <p className="text-sm text-slate-500 mb-8">Gemäß DSGVO / DSG Österreich</p>

        <div className="space-y-8 text-sm leading-relaxed">

          <Section title="1. Verantwortliche Stelle">
            <p>
              Verantwortlich für die Datenverarbeitung auf dieser Plattform ist der Betreiber von
              FarmerZone (Kontaktdaten siehe Impressum).
            </p>
            <p>
              Kontakt für Datenschutzanfragen:{' '}
              <a href="mailto:[datenschutz@farmerzone.at]" className="text-green-700 hover:underline">
                [datenschutz@farmerzone.at]
              </a>
            </p>
          </Section>

          <Section title="2. Welche Daten wir verarbeiten">
            <p><strong className="text-slate-700">Bei einer Bestellung:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Name, E-Mail-Adresse, Telefonnummer</li>
              <li>Bestellte Produkte, Menge, Gesamtbetrag</li>
              <li>Gewählter Abholtermin und Zahlungsart</li>
              <li>Optionale Notiz an den Hof</li>
            </ul>
            <p className="mt-3"><strong className="text-slate-700">Zahlungsdaten:</strong></p>
            <p>
              Kreditkarten- und Bankdaten werden ausschließlich von Stripe verarbeitet und gespeichert.
              FarmerZone speichert keine vollständigen Zahlungsdaten — nur eine anonymisierte
              Bestätigungs-ID.
            </p>
            <p className="mt-3"><strong className="text-slate-700">Technisch notwendige Daten:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Session-Cookies (für Warenkorbfunktion, technisch notwendig)</li>
              <li>Server-Logs (IP-Adresse, Zeitstempel) für Betrieb und Sicherheit</li>
            </ul>
          </Section>

          <Section title="3. Zweck der Datenverarbeitung">
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Abwicklung und Bestätigung von Bestellungen</li>
              <li>Kommunikation zwischen Hofbetreiber und Kunden (E-Mail-Bestätigungen)</li>
              <li>Erfüllung steuerrechtlicher Aufbewahrungspflichten</li>
              <li>Betrieb und Sicherheit der Plattform</li>
            </ul>
            <p>Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) und lit. c (rechtliche Verpflichtung).</p>
          </Section>

          <Section title="4. Externe Dienstleister">
            <div className="space-y-3">
              <div>
                <p className="font-medium text-slate-700">Stripe (Zahlungsabwicklung)</p>
                <p>Stripe Payments Europe Ltd., 1 Grand Canal Street Lower, Dublin 2, Irland.<br/>
                Stripe verarbeitet Zahlungsdaten als eigenständiger Verantwortlicher gemäß seinem Datenschutz-Rahmenwerk.</p>
              </div>
              <div>
                <p className="font-medium text-slate-700">Resend (E-Mail-Versand)</p>
                <p>Resend Inc., USA — für transaktionale E-Mails (Bestellbestätigung, Abholhinweis).</p>
              </div>
              <div>
                <p className="font-medium text-slate-700">Supabase (Datenbank)</p>
                <p>Supabase Inc. — Bestelldaten werden in einer PostgreSQL-Datenbank auf europäischen Servern gespeichert.</p>
              </div>
              <div>
                <p className="font-medium text-slate-700">Vercel (Hosting)</p>
                <p>Vercel Inc., USA — Hosting der Webanwendung. Angemessenes Schutzniveau durch Standardvertragsklauseln.</p>
              </div>
            </div>
          </Section>

          <Section title="5. Speicherdauer">
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Bestelldaten: 7 Jahre (steuerrechtliche Aufbewahrungspflicht gemäß § 132 BAO)</li>
              <li>Server-Logs: 30 Tage</li>
              <li>Warenkorbdaten im Browser (localStorage): bis zur Löschung durch den Nutzer</li>
            </ul>
          </Section>

          <Section title="6. Deine Rechte (Art. 15–22 DSGVO)">
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong className="text-slate-700">Auskunft:</strong> Du kannst jederzeit Auskunft über gespeicherte Daten verlangen.</li>
              <li><strong className="text-slate-700">Berichtigung:</strong> Unrichtige Daten werden auf Anfrage korrigiert.</li>
              <li><strong className="text-slate-700">Löschung:</strong> Du kannst die Löschung deiner Daten verlangen, soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen.</li>
              <li><strong className="text-slate-700">Einschränkung:</strong> Du kannst die Verarbeitung einschränken lassen.</li>
              <li><strong className="text-slate-700">Widerspruch:</strong> Du kannst der Verarbeitung widersprechen, wenn sie auf berechtigtem Interesse beruht.</li>
              <li><strong className="text-slate-700">Datenübertragbarkeit:</strong> Auf Anfrage erhältst du deine Daten in maschinenlesbarem Format.</li>
            </ul>
            <p className="mt-3">
              Anfragen richten an:{' '}
              <a href="mailto:[datenschutz@farmerzone.at]" className="text-green-700 hover:underline">
                [datenschutz@farmerzone.at]
              </a>
            </p>
          </Section>

          <Section title="7. Beschwerderecht">
            <p>
              Du hast das Recht, bei der Österreichischen Datenschutzbehörde Beschwerde einzulegen:{' '}
              <a
                href="https://www.dsb.gv.at"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-700 hover:underline"
              >
                www.dsb.gv.at
              </a>
            </p>
          </Section>

          <Section title="8. Cookies">
            <p>
              Wir verwenden ausschließlich technisch notwendige Cookies und localStorage-Einträge
              (für Warenkorbfunktion und Session-Verwaltung). Es werden keine Tracking-Cookies,
              Werbe-Cookies oder Analyse-Tools eingesetzt.
            </p>
          </Section>

          <Section title="9. Newsletter und Neuigkeiten von Höfen">
            <p>
              Beim Abschluss einer Bestellung kannst du optional zustimmen, dass du vom jeweiligen
              Hof über frische Produkte und Neuigkeiten informiert wirst — per E-Mail und/oder
              WhatsApp.
            </p>
            <p>
              Diese Einwilligung ist freiwillig und hat keinen Einfluss auf deine Bestellung. Du
              kannst sie jederzeit widerrufen:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Über den Abmelde-Link in jeder Nachricht</li>
              <li>
                In deinem{' '}
                <Link href="/account/profile" className="text-green-700 hover:underline">
                  Kunden-Profil
                </Link>{' '}
                unter „Mein Konto"
              </li>
            </ul>
            <p>
              Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO (ausdrückliche Einwilligung).
              Gespeichert werden ausschließlich deine E-Mail-Adresse, ggf. Telefonnummer und
              die erteilten Einwilligungen.
            </p>
          </Section>

          <Section title="10. Kunden-Konto (Magic-Link-Login)">
            <p>
              Du kannst dich per einmaligem Login-Link (Magic Link) in dein Kunden-Konto einloggen,
              um deine Benachrichtigungs-Einstellungen zu verwalten. Dabei wird deine E-Mail-Adresse
              gespeichert sowie ein temporärer Sitzungs-Cookie gesetzt (gültig 7 Tage).
            </p>
            <p>
              Du kannst dein Konto und alle gespeicherten Einwilligungen jederzeit unter{' '}
              <Link href="/account/profile" className="text-green-700 hover:underline">
                Mein Konto → Konto löschen
              </Link>{' '}
              vollständig löschen. Bestelldaten werden aus steuerrechtlichen Gründen weiterhin
              aufbewahrt (§ 132 BAO, 7 Jahre).
            </p>
          </Section>

          <p className="text-xs text-slate-400 pt-4 border-t border-slate-100">
            Stand: Juni 2026
          </p>
        </div>
      </div>
    </div>
  )
}
