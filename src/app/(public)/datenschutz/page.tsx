import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Datenschutz â€” FarmerZone' }

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
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link href="javascript:history.back()" className="text-sm text-primary hover:underline mb-6 inline-block">
          â† ZurÃ¼ck
        </Link>
        <h1 className="text-2xl font-semibold text-slate-800 mb-2">DatenschutzerklÃ¤rung</h1>
        <p className="text-sm text-slate-500 mb-8">GemÃ¤ÃŸ DSGVO / DSG Ã–sterreich</p>

        <div className="space-y-8 text-sm leading-relaxed">

          <Section title="1. Verantwortliche Stelle">
            <p>
              Verantwortlich fÃ¼r die Datenverarbeitung auf dieser Plattform ist der Betreiber von
              FarmerZone (Kontaktdaten siehe Impressum).
            </p>
            <p>
              Kontakt fÃ¼r Datenschutzanfragen:{' '}
              <a href="mailto:[datenschutz@farmerzone.at]" className="text-primary hover:underline">
                [datenschutz@farmerzone.at]
              </a>
            </p>
          </Section>

          <Section title="2. Welche Daten wir verarbeiten">
            <p><strong className="text-slate-700">Bei einer Bestellung:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Name, E-Mail-Adresse, Telefonnummer</li>
              <li>Bestellte Produkte, Menge, Gesamtbetrag</li>
              <li>GewÃ¤hlter Abholtermin und Zahlungsart</li>
              <li>Optionale Notiz an den Hof</li>
            </ul>
            <p className="mt-3"><strong className="text-slate-700">Zahlungsdaten:</strong></p>
            <p>
              Kreditkarten- und Bankdaten werden ausschlieÃŸlich von Stripe verarbeitet und gespeichert.
              FarmerZone speichert keine vollstÃ¤ndigen Zahlungsdaten â€” nur eine anonymisierte
              BestÃ¤tigungs-ID.
            </p>
            <p className="mt-3"><strong className="text-slate-700">Technisch notwendige Daten:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Session-Cookies (fÃ¼r Warenkorbfunktion, technisch notwendig)</li>
              <li>Server-Logs (IP-Adresse, Zeitstempel) fÃ¼r Betrieb und Sicherheit</li>
            </ul>
          </Section>

          <Section title="3. Zweck der Datenverarbeitung">
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Abwicklung und BestÃ¤tigung von Bestellungen</li>
              <li>Kommunikation zwischen Hofbetreiber und Kunden (E-Mail-BestÃ¤tigungen)</li>
              <li>ErfÃ¼llung steuerrechtlicher Aufbewahrungspflichten</li>
              <li>Betrieb und Sicherheit der Plattform</li>
            </ul>
            <p>Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (VertragserfÃ¼llung) und lit. c (rechtliche Verpflichtung).</p>
          </Section>

          <Section title="4. Externe Dienstleister">
            <div className="space-y-3">
              <div>
                <p className="font-medium text-slate-700">Stripe (Zahlungsabwicklung)</p>
                <p>Stripe Payments Europe Ltd., 1 Grand Canal Street Lower, Dublin 2, Irland.<br/>
                Stripe verarbeitet Zahlungsdaten als eigenstÃ¤ndiger Verantwortlicher gemÃ¤ÃŸ seinem Datenschutz-Rahmenwerk.</p>
              </div>
              <div>
                <p className="font-medium text-slate-700">Resend (E-Mail-Versand)</p>
                <p>Resend Inc., USA â€” fÃ¼r transaktionale E-Mails (BestellbestÃ¤tigung, Abholhinweis).</p>
              </div>
              <div>
                <p className="font-medium text-slate-700">Supabase (Datenbank)</p>
                <p>Supabase Inc. â€” Bestelldaten werden in einer PostgreSQL-Datenbank auf europÃ¤ischen Servern gespeichert.</p>
              </div>
              <div>
                <p className="font-medium text-slate-700">Vercel (Hosting)</p>
                <p>Vercel Inc., USA â€” Hosting der Webanwendung. Angemessenes Schutzniveau durch Standardvertragsklauseln.</p>
              </div>
            </div>
          </Section>

          <Section title="5. Speicherdauer">
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Bestelldaten: 7 Jahre (steuerrechtliche Aufbewahrungspflicht gemÃ¤ÃŸ Â§ 132 BAO)</li>
              <li>Server-Logs: 30 Tage</li>
              <li>Warenkorbdaten im Browser (localStorage): bis zur LÃ¶schung durch den Nutzer</li>
            </ul>
          </Section>

          <Section title="6. Deine Rechte (Art. 15â€“22 DSGVO)">
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong className="text-slate-700">Auskunft:</strong> Du kannst jederzeit Auskunft Ã¼ber gespeicherte Daten verlangen.</li>
              <li><strong className="text-slate-700">Berichtigung:</strong> Unrichtige Daten werden auf Anfrage korrigiert.</li>
              <li><strong className="text-slate-700">LÃ¶schung:</strong> Du kannst die LÃ¶schung deiner Daten verlangen, soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen.</li>
              <li><strong className="text-slate-700">EinschrÃ¤nkung:</strong> Du kannst die Verarbeitung einschrÃ¤nken lassen.</li>
              <li><strong className="text-slate-700">Widerspruch:</strong> Du kannst der Verarbeitung widersprechen, wenn sie auf berechtigtem Interesse beruht.</li>
              <li><strong className="text-slate-700">DatenÃ¼bertragbarkeit:</strong> Auf Anfrage erhÃ¤ltst du deine Daten in maschinenlesbarem Format.</li>
            </ul>
            <p className="mt-3">
              Anfragen richten an:{' '}
              <a href="mailto:[datenschutz@farmerzone.at]" className="text-primary hover:underline">
                [datenschutz@farmerzone.at]
              </a>
            </p>
          </Section>

          <Section title="7. Beschwerderecht">
            <p>
              Du hast das Recht, bei der Ã–sterreichischen DatenschutzbehÃ¶rde Beschwerde einzulegen:{' '}
              <a
                href="https://www.dsb.gv.at"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                www.dsb.gv.at
              </a>
            </p>
          </Section>

          <Section title="8. Cookies">
            <p>
              Wir verwenden ausschlieÃŸlich technisch notwendige Cookies und localStorage-EintrÃ¤ge
              (fÃ¼r Warenkorbfunktion und Session-Verwaltung). Es werden keine Tracking-Cookies,
              Werbe-Cookies oder Analyse-Tools eingesetzt.
            </p>
          </Section>

          <Section title="9. Newsletter und Neuigkeiten von HÃ¶fen">
            <p>
              Beim Abschluss einer Bestellung kannst du optional zustimmen, dass du vom jeweiligen
              Hof Ã¼ber frische Produkte und Neuigkeiten informiert wirst â€” per E-Mail und/oder
              WhatsApp.
            </p>
            <p>
              Diese Einwilligung ist freiwillig und hat keinen Einfluss auf deine Bestellung. Du
              kannst sie jederzeit widerrufen:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Ãœber den Abmelde-Link in jeder Nachricht</li>
              <li>
                In deinem{' '}
                <Link href="/account/profile" className="text-primary hover:underline">
                  Kunden-Profil
                </Link>{' '}
                unter â€žMein Konto"
              </li>
            </ul>
            <p>
              Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO (ausdrÃ¼ckliche Einwilligung).
              Gespeichert werden ausschlieÃŸlich deine E-Mail-Adresse, ggf. Telefonnummer und
              die erteilten Einwilligungen.
            </p>
          </Section>

          <Section title="10. Kunden-Konto (Magic-Link-Login)">
            <p>
              Du kannst dich per einmaligem Login-Link (Magic Link) in dein Kunden-Konto einloggen,
              um deine Benachrichtigungs-Einstellungen zu verwalten. Dabei wird deine E-Mail-Adresse
              gespeichert sowie ein temporÃ¤rer Sitzungs-Cookie gesetzt (gÃ¼ltig 7 Tage).
            </p>
            <p>
              Du kannst dein Konto und alle gespeicherten Einwilligungen jederzeit unter{' '}
              <Link href="/account/profile" className="text-primary hover:underline">
                Mein Konto â†’ Konto lÃ¶schen
              </Link>{' '}
              vollstÃ¤ndig lÃ¶schen. Bestelldaten werden aus steuerrechtlichen GrÃ¼nden weiterhin
              aufbewahrt (Â§ 132 BAO, 7 Jahre).
            </p>
          </Section>

          <p className="text-xs text-muted-foreground pt-4 border-t border-border">
            Stand: Juni 2026
          </p>
        </div>
      </div>
    </div>
  )
}
