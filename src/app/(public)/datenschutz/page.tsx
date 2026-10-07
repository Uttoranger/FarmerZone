import Link from 'next/link'
import type { Metadata } from 'next'
import { KundenKopf } from '@/components/shared/kunden-kopf'
import { DATENSCHUTZ_EMAIL } from '@/lib/support'
import { BESTELLUNGEN_ANSICHT_SEKUNDEN } from '@/lib/bestellungen-finden'

export const metadata: Metadata = { title: 'Datenschutz — FarmerZone' }

// Aus derselben Konstante wie der Cookie selbst, damit die Erklärung nicht
// von der Laufzeit abweicht (tests/datenschutz-sachstand.test.ts).
const BESTELLUNGEN_COOKIE_MINUTEN = BESTELLUNGEN_ANSICHT_SEKUNDEN / 60

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-semibold text-foreground text-base mb-3">{title}</h2>
      <div className="space-y-2 text-muted-foreground">{children}</div>
    </section>
  )
}

export default function DatenschutzPage() {
  return (
    <div className="min-h-screen bg-background">
      <KundenKopf seite={{ art: 'info' }} />
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-semibold text-foreground mb-2">Datenschutzerklärung</h1>
        <p className="text-sm text-muted-foreground mb-8">Gemäß DSGVO / DSG Österreich</p>

        <div className="space-y-8 text-sm leading-relaxed">

          <Section title="1. Verantwortliche Stelle">
            <p>
              Verantwortlich für die Datenverarbeitung auf dieser Plattform ist der Betreiber von
              FarmerZone (Kontaktdaten siehe Impressum).
            </p>
            <p>
              Kontakt für Datenschutzanfragen:{' '}
              <a href={`mailto:${DATENSCHUTZ_EMAIL}`} className="text-primary hover:underline break-words">
                {DATENSCHUTZ_EMAIL}
              </a>
            </p>
          </Section>

          <Section title="2. Welche Daten wir verarbeiten">
            <p><strong className="text-foreground">Bei einer Bestellung:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Name, E-Mail-Adresse, Telefonnummer</li>
              <li>Bestellte Produkte, Menge, Gesamtbetrag</li>
              <li>Gewählter Abholtermin und Zahlungsart</li>
              <li>Optionale Notiz an den Hof</li>
            </ul>
            <p className="mt-3"><strong className="text-foreground">Zahlungsdaten:</strong></p>
            <p>
              Kreditkarten- und Bankdaten werden ausschließlich von Stripe verarbeitet und gespeichert.
              FarmerZone speichert keine vollständigen Zahlungsdaten — nur die Kennung des
              Zahlungsvorgangs bei Stripe.
            </p>
            <p className="mt-3"><strong className="text-foreground">Technisch notwendige Daten:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Session-Cookies (für Anmeldung und „Bestellungen finden“, technisch notwendig)</li>
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
                <p className="font-medium text-foreground">Stripe (Zahlungsabwicklung)</p>
                <p>Stripe Payments Europe Ltd., 1 Grand Canal Street Lower, Dublin 2, Irland.<br/>
                Stripe verarbeitet Zahlungsdaten als eigenständiger Verantwortlicher gemäß seinem Datenschutz-Rahmenwerk.</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Resend (E-Mail-Versand)</p>
                <p>Resend Inc., USA — für transaktionale E-Mails (Bestellbestätigung, Abholhinweis).</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Supabase (Datenbank)</p>
                <p>Supabase Inc. — Bestelldaten werden in einer PostgreSQL-Datenbank auf europäischen Servern gespeichert.</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Vercel (Hosting)</p>
                <p>Vercel Inc., USA — Hosting der Webanwendung. Angemessenes Schutzniveau durch Standardvertragsklauseln.</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Sentry (Fehlerdiagnose)</p>
                <p>Functional Software, Inc. (Sentry), USA — technische Fehlerberichte der Anwendung
                und Ladezeit-Messungen zu etwa jedem zehnten Seitenaufruf, gespeichert auf Servern
                in der EU. Vor dem Versand werden personenbezogene Inhalte (E-Mail-Adressen,
                Telefonnummern, Cookies, Zugangsdaten, Formularinhalte) automatisch entfernt; es
                gibt keine Aufzeichnung deiner Bildschirmsitzung. Übermittelt wird, was technisch
                schiefging; bei eingeloggten Höfen zusätzlich die interne Kennung des Hofes, nie
                Name oder E-Mail-Adresse.</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Vercel Web Analytics (Reichweitenmessung)</p>
                <p>Vercel Inc., USA — cookielose Zählung von Seitenaufrufen ohne Wiedererkennung:
                Es werden keine Cookies gesetzt, keine Kennungen auf dem Gerät gespeichert und
                keine Profile über den Tag hinaus gebildet.</p>
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
              <li><strong className="text-foreground">Auskunft:</strong> Du kannst jederzeit Auskunft über gespeicherte Daten verlangen.</li>
              <li><strong className="text-foreground">Berichtigung:</strong> Unrichtige Daten werden auf Anfrage korrigiert.</li>
              <li><strong className="text-foreground">Löschung:</strong> Du kannst die Löschung deiner Daten verlangen, soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen.</li>
              <li><strong className="text-foreground">Einschränkung:</strong> Du kannst die Verarbeitung einschränken lassen.</li>
              <li><strong className="text-foreground">Widerspruch:</strong> Du kannst der Verarbeitung widersprechen, wenn sie auf berechtigtem Interesse beruht.</li>
              <li><strong className="text-foreground">Datenübertragbarkeit:</strong> Auf Anfrage erhältst du deine Daten in maschinenlesbarem Format.</li>
            </ul>
            <p className="mt-3">
              Anfragen richten an:{' '}
              <a href={`mailto:${DATENSCHUTZ_EMAIL}`} className="text-primary hover:underline break-words">
                {DATENSCHUTZ_EMAIL}
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
                className="text-primary hover:underline"
              >
                www.dsb.gv.at
              </a>
            </p>
          </Section>

          <Section title="8. Cookies">
            <p>
              Wir verwenden ausschließlich technisch notwendige Cookies und localStorage-Einträge
              (für Warenkorbfunktion und Session-Verwaltung). Es werden keine Tracking-Cookies
              oder Werbe-Cookies eingesetzt; die Reichweitenmessung mit Vercel Web Analytics
              (siehe Abschnitt 4) kommt ohne Cookies aus.
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
                <Link href="/account/profile" className="text-primary hover:underline">
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

          <Section title="10. Kunden-Konto (Anmeldung mit Code)">
            <p>
              Du kannst dich mit einem Code, den wir dir per E-Mail schicken, in dein Kunden-Konto
              einloggen, um deine Benachrichtigungs-Einstellungen zu verwalten. Dabei wird deine
              E-Mail-Adresse gespeichert sowie ein temporärer Sitzungs-Cookie gesetzt (gültig 7
              Tage). Beim Bestellen wird kein Konto angelegt.
            </p>
            <p>
              {`„Bestellungen finden“ läuft ebenfalls über einen Code per E-Mail. Dafür entsteht kein Konto; es wird nur für ${BESTELLUNGEN_COOKIE_MINUTEN} Minuten ein Cookie mit deiner bestätigten E-Mail-Adresse gesetzt.`}
            </p>
            <p>
              Du kannst dein Konto und alle gespeicherten Einwilligungen jederzeit unter{' '}
              <Link href="/account/profile" className="text-primary hover:underline">
                Mein Konto → Konto löschen
              </Link>{' '}
              vollständig löschen. Bestelldaten werden aus steuerrechtlichen Gründen weiterhin
              aufbewahrt (§ 132 BAO, 7 Jahre).
            </p>
          </Section>

          <Section title="Standortsuche und Kartendarstellung">
            <p>
              Sucht ein Hof im Hofprofil seinen Standort, wird die eingegebene Hofadresse
              (Straße, PLZ, Ort) zur Standortsuche an Nominatim (OpenStreetMap Foundation,
              nominatim.openstreetmap.org) übermittelt; schiebt er den Kartenpunkt, wird
              umgekehrt dieser Punkt zur Ermittlung der Adresse dorthin übermittelt — es
              handelt sich jeweils um die Betriebsadresse bzw. den Betriebsstandort des
              Hofes, nicht um Daten von Besucherinnen. Die
              Kartenkacheln der Minikarte werden von OpenStreetMap geladen; dabei wird die
              IP-Adresse des eingeloggten Betreibers an OpenStreetMap übertragen. Auf der
              öffentlichen Hofübersicht wird eine Karte erst geladen, wenn du dort die
              Kartenansicht öffnest — dann wird deine IP-Adresse zum Abruf der Kacheln an
              OpenStreetMap übertragen; darüber hinaus werden keine Daten über dich
              weitergegeben.
            </p>
          </Section>

          <Section title="Umkreissuche auf der Hofübersicht">
            <p>
              Tippst du auf der Hofübersicht „In meiner Nähe“, fragt dein Browser deinen
              Standort ab — und behält ihn: Er wird <strong className="font-medium">nicht an uns
              und an niemanden sonst übertragen</strong>. Die Entfernungen zu den Höfen rechnet
              dein Gerät selbst aus den Hofkoordinaten, die mit der Seite ohnehin geladen
              wurden. Wir speichern deinen Standort nicht, weder auf dem Gerät noch bei uns;
              schließt du die Seite, ist er fort.
            </p>
            <p className="mt-3">
              Gibst du stattdessen eine Postleitzahl oder einen Ort ein, geht diese Eingabe
              an unseren Server und von dort an Nominatim (OpenStreetMap Foundation), um
              daraus einen Kartenpunkt zu machen — deine IP-Adresse erreicht Nominatim dabei
              nicht, und ein gemessener Standort wird nie übermittelt. Die Suche startet
              erst, wenn du sie absendest; die Eingabe speichern wir nicht.
            </p>
          </Section>

          <Section title="Fehler- und Wunschmeldungen">
            <p>
              Über &bdquo;Problem melden&ldquo; bzw. &bdquo;Fehler melden&ldquo; kannst du uns Fehler, Wünsche und Fragen
              zur Plattform schicken. Gespeichert werden dein Text, die Art der Meldung, die
              Adresse der Seite, von der du gemeldet hast, Browser-Kennung (User-Agent) und
              Bildschirmgröße sowie der Zeitpunkt — keine IP-Adresse, keine Cookies. Bei
              eingeloggten Höfen wird die Meldung dem Hof zugeordnet; Höfe können freiwillig ein
              Bildschirmfoto anhängen. Als Kundin kannst du freiwillig eine E-Mail-Adresse
              angeben, ausschließlich für Rückfragen — ohne sie bleibt die Meldung anonym.
            </p>
            <p>
              Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse am Betrieb und
              an der Verbesserung der Plattform), für die freiwillige E-Mail-Adresse lit. a
              (Einwilligung). Erledigte Meldungen werden 90 Tage nach ihrer Bearbeitung samt
              Bildschirmfoto gelöscht.
            </p>
          </Section>

          <p className="text-xs text-muted-foreground pt-4 border-t border-border">
            Stand: Oktober 2026
          </p>
        </div>
      </div>
    </div>
  )
}
