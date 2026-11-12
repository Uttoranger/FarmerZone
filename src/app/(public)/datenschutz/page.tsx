import Link from 'next/link'
import type { Metadata } from 'next'
import { INFOSEITE_ABSCHNITT, INFOSEITE_LINK } from '@/components/shared/infoseite-stil'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import { RECHTSTEXT_TEXT, RechtstextVorlage, type RechtstextVerzeichnisDaten } from '@/components/shared/rechtstext-vorlage'
import { ANMELDECODE_GUELTIG_SEKUNDEN, ANMELDECODE_LAENGE } from '@/lib/anmeldecode'
import { BESTELLUNGEN_ANSICHT_SEKUNDEN, BESTELLUNGEN_COOKIE, BESTELLUNGEN_PFAD } from '@/lib/bestellungen-finden'
import { CODES_NACH_ABLAUF_TAGE, MAIL_PROTOKOLL_AUFBEWAHREN_TAGE, SITZUNGEN_NACH_ABLAUF_TAGE } from '@/lib/betrieb'
import { GERAETE_COOKIE, GERAETE_COOKIE_MAX_ALTER_SEKUNDEN } from '@/lib/geraete'
import { SITZUNG_HOECHSTENS_TAGE } from '@/lib/sitzung-dauer'
import { DATENSCHUTZ_EMAIL } from '@/lib/support'
import { MARKE } from '@/lib/marke'
import { WIDERRUF_PFAD } from '@/lib/widerruf'

export const metadata: Metadata = { title: `Datenschutz — ${MARKE}`, alternates: { canonical: '/datenschutz' } }

// Zahlen und Namen, die der Text nennt, kommen aus dem Code, der sie auch setzt —
// ändert sich dort etwas, ändert sich der Text mit (tests/altrouten-datenschutz.test.ts,
// tests/datenschutz-struktur.test.ts).
const GERAETE_COOKIE_TAGE = GERAETE_COOKIE_MAX_ALTER_SEKUNDEN / 86_400
const BESTELLUNGEN_MINUTEN = BESTELLUNGEN_ANSICHT_SEKUNDEN / 60
const ANMELDECODE_MINUTEN = ANMELDECODE_GUELTIG_SEKUNDEN / 60

// = ADMIN_PROTOKOLL_JAHRE (src/server/admin-protokoll.ts). Nicht importiert: Die Datei
// lädt Prisma und Sentry in die öffentliche Seite. tests/datenschutz-struktur.test.ts
// vergleicht beide Zahlen.
const ADMIN_PROTOKOLL_JAHRE_SEITE = 5

/** Wann die Erklärung zuletzt geändert wurde — Stand-Zeile unter dem Titel und Fuß. */
const DATENSCHUTZ_STAND = 'November 2026'

/*
 * Die Abschnitte mit ihren Sprungmarken (seit Nr. 231, Vorlage der
 * Rechtsseiten): Überschrift und Verzeichnis nehmen denselben Eintrag. Titel
 * und Wortlaut kommen von der Projektleitung (A006b); wörtlich nach N43 (4)
 * bleibt nur noch der Absatz zum Rücktritt in Abschnitt 2. Die Anker bleiben
 * stabil, auch der alte „umkreissuche“ (jetzt in Abschnitt 11) — Links von
 * außen springen sonst ins Leere.
 */
const ABSCHNITTE = [
  { anker: 'verantwortliche-stelle', text: '1. Verantwortliche Stelle und Rollen' },
  { anker: 'daten', text: '2. Welche Daten wir verarbeiten' },
  { anker: 'zweck', text: '3. Zweck und Rechtsgrundlage' },
  { anker: 'dienstleister', text: '4. Empfänger und Dienstleister, Übermittlung in Drittländer' },
  { anker: 'speicherdauer', text: '5. Speicherdauer' },
  { anker: 'rechte', text: '6. Deine Rechte (Art. 15–22 DSGVO)' },
  { anker: 'beschwerderecht', text: '7. Beschwerderecht' },
  { anker: 'cookies', text: '8. Cookies' },
  { anker: 'neuigkeiten', text: '9. Newsletter und Neuigkeiten von Höfen' },
  { anker: 'kunden-konto', text: '10. Kunden-Konto (Anmeldung mit Code)' },
  { anker: 'standortsuche', text: '11. Standort, Karte und Umkreissuche' },
  { anker: 'meldungen', text: '12. Fehler- und Wunschmeldungen' },
  { anker: 'postfach', text: '13. Postfach' },
  { anker: 'hof-daten', text: '14. Daten der Höfe' },
  { anker: 'sepa-lastschrift', text: '15. SEPA-Lastschrift und Monatsabrechnung der Höfe' },
  { anker: 'dpmg', text: '16. Meldung an das Finanzamt (DPMG)' },
  { anker: 'admin-protokoll', text: '17. Protokoll im Admin-Bereich' },
  { anker: 'server-logs', text: '18. Server-Logs und Schutz vor Missbrauch' },
] as const

type Abschnitt = (typeof ABSCHNITTE)[number]

const VERZEICHNIS: RechtstextVerzeichnisDaten = {
  kennung: 'datenschutz-inhalt',
  zusammenfassung: RECHTSTEXT_TEXT.abschnitte(ABSCHNITTE.length),
  gruppen: [{ eintraege: ABSCHNITTE }],
}

// Grundlage für Dienste mit Sitz in den USA, solange keiner von ihnen im
// Data-Privacy-Framework-Register bestätigt ist (Bestätigung B2 der Projektleitung).
const SCC = 'Standardvertragsklauseln der EU-Kommission (Art. 46 Abs. 2 lit. c DSGVO)'

// data-abschnitt und data-dienstleister markieren die Stellen für die Prüfliste Recht
// und für spätere Läufe, die einen Abschnitt finden müssen, ohne Text zu suchen.
function Section({ abschnitt, children }: { abschnitt: Abschnitt; children: React.ReactNode }) {
  return (
    <section aria-labelledby={abschnitt.anker} data-abschnitt={abschnitt.anker}>
      <h2 id={abschnitt.anker} className={`${INFOSEITE_ABSCHNITT} scroll-mt-20`}>
        {abschnitt.text}
      </h2>
      <div className="space-y-2 text-muted-foreground">{children}</div>
    </section>
  )
}

function Dienstleister({
  kennung,
  titel,
  scc = false,
  children,
}: {
  kennung: 'hoefe' | 'stripe' | 'supabase' | 'vercel' | 'resend' | 'sentry' | 'cloudflare' | 'osm' | 'behoerden'
  titel: string
  scc?: boolean
  children: React.ReactNode
}) {
  return (
    <div data-dienstleister={kennung} data-drittland-grundlage={scc ? 'scc' : undefined}>
      <p className="font-medium text-foreground">{titel}</p>
      <p>{children}</p>
    </div>
  )
}

const LISTE = 'list-disc list-inside space-y-1 ml-2'
const FETT = 'text-foreground'

export default function DatenschutzPage() {
  return (
    <KundeShellMitSitzung>
      <RechtstextVorlage
        titel="Datenschutzerklärung"
        stand={`Gemäß DSGVO / DSG Österreich · ${RECHTSTEXT_TEXT.stand(DATENSCHUTZ_STAND)}`}
        drucken
        verzeichnis={VERZEICHNIS}
        fussStand={DATENSCHUTZ_STAND}
      >

        <Section abschnitt={ABSCHNITTE[0]}>
          <p>
            Verantwortlich für die Datenverarbeitung auf dieser Plattform ist der Betreiber von{' '}
            {MARKE} (Kontaktdaten siehe Impressum).
          </p>
          <p>
            Kontakt für Datenschutzanfragen:{' '}
            <a href={`mailto:${DATENSCHUTZ_EMAIL}`} className={INFOSEITE_LINK}>
              {DATENSCHUTZ_EMAIL}
            </a>
          </p>
          <p className="mt-3"><strong className={FETT}>Wer wofür verantwortlich ist:</strong></p>
          <ul className={LISTE}>
            <li>
              {MARKE} ist verantwortlich für den Betrieb der Plattform: Konten, Bestellabwicklung auf der
              Plattform, E-Mails, Sicherheit und die Abrechnung mit den Höfen.
            </li>
            <li>
              Der Hof, bei dem du bestellst, bekommt deine Bestelldaten (Name, E-Mail-Adresse,
              Telefonnummer, Bestellung, Abholtermin, Notiz). Für ihre Nutzung, etwa zur Übergabe, für
              seine Buchhaltung oder bei einer Reklamation, ist er selbst verantwortlich. Dein Kaufvertrag
              ist mit dem Hof.
            </li>
            <li>
              Neuigkeiten von Höfen per E-Mail verschicken wir im Auftrag des Hofs. Hier ist der Hof
              verantwortlich, und wir verarbeiten deine Daten nur nach seinen Vorgaben. Per WhatsApp
              schickt der Hof sie selbst (Abschnitt 9).
            </li>
            <li>
              Stripe wickelt Zahlungen ab und ist dabei für einen Teil der Verarbeitung selbst
              verantwortlich (Abschnitt 4).
            </li>
          </ul>
        </Section>

        <Section abschnitt={ABSCHNITTE[1]}>
          <p><strong className="text-foreground">Bei einer Bestellung:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Name, E-Mail-Adresse, Telefonnummer</li>
            <li>Bestellte Produkte, Menge, Gesamtbetrag</li>
            <li>Gewählter Abholtermin und Zahlungsart</li>
            <li>Optionale Notiz an den Hof</li>
            <li>
              Käuferart (privat oder Betrieb) und, wenn du als Betrieb Futter kaufst, die
              Betriebsnummer, die du angibst
            </li>
          </ul>
          {/* Nr. 200 (N39): nur die Fakten des Widerrufs online — Zweck, Daten, Frist.
              Der Absatz bleibt wörtlich (N43 (4)); nur die Zwischenüberschrift ist neu (A006b). */}
          <p className="mt-3"><strong className="text-foreground">Bei einem Rücktritt (Widerruf):</strong></p>
          <p>
            Widerrufst du einen Kauf über {WIDERRUF_PFAD}, speichern wir deinen Namen, deine E-Mail-Adresse,
            die Bestellung (bzw. die Bestellnummer, die du angibst) und deine Nachricht. Zweck: den Widerruf an
            den Hof weiterzuleiten, dir den Eingang zu bestätigen und die Erstattung abzuwickeln. Wir bewahren
            diese Daten so lange auf wie die Daten der Bestellung.
          </p>
          <p className="mt-3"><strong className="text-foreground">Zahlungsdaten:</strong></p>
          <p>
            Karten- und Kontodaten gibst du direkt in ein Formular von Stripe ein. Stripe verarbeitet und
            speichert sie. {MARKE} speichert keine Karten- oder Kontonummern, sondern nur die Kennung der
            Zahlung bei Stripe, den Betrag und den Stand (bezahlt, erstattet). Mit der Kennung können wir
            eine Zahlung bei Stripe wiederfinden, etwa für eine Erstattung.
          </p>
          <p className="mt-3"><strong className="text-foreground">Technisch notwendige Daten:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Session-Cookies (für Warenkorbfunktion, technisch notwendig)</li>
            <li>
              Server-Logs (IP-Adresse, Zeitpunkt, aufgerufene Adresse) für Betrieb und Sicherheit –
              Näheres in Abschnitt 18
            </li>
            <li>
              Meldest du dich an, speichern wir zur Sitzung deine IP-Adresse. Sie gehört zur
              Sitzung: Abgelaufene Sitzungen löschen wir {SITZUNGEN_NACH_ABLAUF_TAGE} Tage nach ihrem
              Ablauf.
            </li>
          </ul>
          <p className="mt-3"><strong className="text-foreground">Weitere Cookies:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>
              Cookie zur Wiedererkennung des Geräts (<span className="whitespace-nowrap">{GERAETE_COOKIE}</span>, {GERAETE_COOKIE_TAGE} Tage):
              nur bei Hof- und Betreiber-Konten. Es enthält eine zufällige Kennung und dient dazu,
              dir eine E-Mail zu schicken, wenn sich jemand auf einem neuen Gerät anmeldet.
            </li>
            <li>
              Cookie für „Bestellungen finden“ (<span className="whitespace-nowrap">{BESTELLUNGEN_COOKIE}</span>, {BESTELLUNGEN_MINUTEN} Minuten,
              nur für die Seite {BESTELLUNGEN_PFAD}): Es merkt sich, dass du deine E-Mail-Adresse mit
              dem Code bestätigt hast, solange die Liste deiner Bestellungen offen ist.
            </li>
            <li>
              Cookies von Stripe (etwa __stripe_mid, __stripe_sid): nur wenn du online bezahlst oder als
              Hof die Lastschrift einrichtest. Stripe setzt sie zur Betrugsabwehr; Näheres in der
              Datenschutzerklärung von Stripe.
            </li>
          </ul>
        </Section>

        <Section abschnitt={ABSCHNITTE[2]}>
          <ul className={LISTE}>
            <li>
              Abwicklung und Bestätigung von Bestellungen, Kommunikation zwischen Hof und Kundschaft,
              Konten der Höfe und Abrechnung mit den Höfen. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO
              (Vertrag).
            </li>
            <li>
              Erfüllung gesetzlicher Pflichten, etwa Aufbewahrung nach § 132 BAO oder Meldungen nach dem
              DPMG (Abschnitt 16). Rechtsgrundlage: Art. 6 Abs. 1 lit. c DSGVO (rechtliche Verpflichtung).
            </li>
            <li>
              Betrieb und Sicherheit der Plattform, Schutz vor Missbrauch, Fehlersuche und
              Nachvollziehbarkeit von Eingriffen des Teams. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO
              (berechtigtes Interesse an einem sicheren, funktionierenden Dienst).
            </li>
            {/* Steht nur da, solange der Code Web Analytics einbindet (src/app/layout.tsx);
                tests/datenschutz-struktur.test.ts koppelt beides. */}
            <li>
              Reichweitenmessung mit Vercel Web Analytics: Wir zählen, wie oft welche Seite aufgerufen
              wird, ohne Cookies und ohne dich wiederzuerkennen, um zu sehen, was genutzt wird.
              Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einer
              Reichweitenmessung ohne Cookies).
            </li>
            <li>
              Neuigkeiten von Höfen: Rechtsgrundlage des Hofs ist deine Einwilligung (Art. 6 Abs. 1 lit. a
              DSGVO); wir handeln dabei in seinem Auftrag (Abschnitt 9).
            </li>
            <li>Die freiwillige E-Mail-Adresse bei Meldungen: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung).</li>
          </ul>
          <p>Bei einzelnen Funktionen steht die Rechtsgrundlage zusätzlich im jeweiligen Abschnitt.</p>
        </Section>

        <Section abschnitt={ABSCHNITTE[3]}>
          <p>
            Wir geben Daten nur weiter, soweit es für den jeweiligen Zweck nötig ist. Dienstleister, die in
            unserem Auftrag arbeiten, haben mit uns einen Vertrag zur Auftragsverarbeitung (Art. 28 DSGVO).
            Sitzt ein Dienstleister außerhalb der EU bzw. des EWR oder greift er von dort zu, nennen wir
            unten die Grundlage dafür.
          </p>
          <div className="space-y-3">
            <Dienstleister kennung="hoefe" titel="Höfe">
              Der Hof, bei dem du bestellst, bekommt die Daten deiner Bestellung (Abschnitt 1).
            </Dienstleister>
            <Dienstleister kennung="stripe" titel="Stripe (Zahlungsabwicklung)" scc>
              Stripe Payments Europe Ltd., 1 Grand Canal Street Lower, Dublin 2, Irland. Stripe verarbeitet
              Zahlungen der Kundschaft, die Lastschrift und die Rechnungen der Höfe sowie die Stripe-Konten
              der Höfe. Stripe verarbeitet diese Daten teils als eigener Verantwortlicher, teils in unserem
              Auftrag; Näheres in der Datenschutzerklärung von Stripe. Stripe kann Daten an Stripe, Inc. in
              den USA übermitteln. Grundlage: {SCC}.
            </Dienstleister>
            <Dienstleister kennung="supabase" titel="Supabase (Datenbank)" scc>
              Supabase, Inc., USA. Die Datenbank liegt auf Servern in Frankfurt am Main (EU). Für einen
              Zugriff aus den USA, etwa durch den Support, gelten Standardvertragsklauseln der
              EU-Kommission (Art. 46 Abs. 2 lit. c DSGVO).
            </Dienstleister>
            {/* Mit Reichweitenmessung, solange der Code Web Analytics einbindet (Weiche W1, A006b). */}
            <Dienstleister kennung="vercel" titel="Vercel (Hosting, Bild-Speicher, Reichweitenmessung)" scc>
              Vercel Inc., USA. Hosting der Webanwendung, Speicher für Fotos der Höfe und Bildschirmfotos aus
              Meldungen, technische Protokolle (Abschnitt 18). Vercel Web Analytics zählt Seitenaufrufe ohne
              Cookies: Es werden keine Kennungen auf deinem Gerät gespeichert und keine Profile über den Tag
              hinaus gebildet. Grundlage für die Übermittlung in die USA: {SCC}.
            </Dienstleister>
            <Dienstleister kennung="resend" titel="Resend (E-Mail-Versand)" scc>
              Resend, Inc., USA. Versand der E-Mails der Plattform, etwa Bestellbestätigung,
              Bestätigungslink bei Barzahlung, Abholhinweis und andere Nachrichten zum Stand deiner
              Bestellung, Anmeldecode, Neuigkeiten von Höfen sowie Nachrichten und Rechnungshinweise an Höfe.
              Dabei gehen die Empfänger-Adresse und der Inhalt der E-Mail an Resend. Versendet wird über
              Server in Irland (EU); Versandprotokolle kann Resend auch in den USA speichern. Grundlage für
              einen Zugriff aus den USA: {SCC}.
            </Dienstleister>
            <Dienstleister kennung="sentry" titel="Sentry (Fehlerdiagnose)" scc>
              Functional Software, Inc., USA. Technische Fehlerberichte, gespeichert auf Servern in der EU
              (Frankfurt am Main). Vor dem Versand entfernen wir personenbezogene Inhalte (IP-Adressen,
              E-Mail-Adressen, Telefonnummern, Cookies, Zugangsdaten). Übermittelt wird, was technisch
              schiefging, nicht wer betroffen war. Grundlage für einen Zugriff aus den USA: {SCC}.
            </Dienstleister>
            <Dienstleister kennung="cloudflare" titel="Cloudflare (DNS und E-Mail-Empfang)" scc>
              Cloudflare, Inc., USA. DNS der Domain und Empfang der E-Mails an unsere Kontaktadressen, mit
              Weiterleitung an den Betreiber. Grundlage: {SCC}.
            </Dienstleister>
            <Dienstleister kennung="osm" titel="OpenStreetMap Foundation (Karten und Ortssuche)">
              Vereinigtes Königreich. Kartenkacheln und Ortssuche (Abschnitt 11).
            </Dienstleister>
            <Dienstleister kennung="behoerden" titel="Finanzverwaltung">
              Soweit ein Gesetz es verlangt, geben wir Daten an Behörden, etwa an das Finanzamt
              (Abschnitt 16).
            </Dienstleister>
          </div>
        </Section>

        <Section abschnitt={ABSCHNITTE[4]}>
          <ul className={LISTE}>
            <li>
              Bestellungen und die Daten dazu (auch ein Rücktritt vom Kauf): 7 Jahre ab Ende des
              Kalenderjahres, wegen der Aufbewahrungspflicht nach § 132 BAO. Darüber hinaus nur, solange ein
              Streit über die Bestellung offen ist.
            </li>
            <li>Monatsabrechnungen und Rechnungen der Höfe: 7 Jahre ab Ende des Kalenderjahres (§ 132 BAO).</li>
            <li>Hofkonto: solange es besteht. Nach dem Schließen gilt Abschnitt 14.</li>
            <li>Postfach eines Hofs: solange das Hofkonto besteht (Abschnitt 13).</li>
            <li>
              Anmeldung zu Neuigkeiten (E-Mail-Adresse und, wenn angegeben, Telefonnummer): solange du
              angemeldet bist. Meldest du dich ab, bleibt der Eintrag ausgeschaltet gespeichert, bis du dein
              Kunden-Konto löschst (Abschnitt 10) oder uns bittest, ihn zu löschen.
            </li>
            <li>Kunden-Konto: bis du es löschst (Abschnitt 10) oder uns bittest, es zu löschen.</li>
            <li>Sitzungen samt IP-Adresse: bis {SITZUNGEN_NACH_ABLAUF_TAGE} Tage nach ihrem Ablauf.</li>
            <li>Anmeldecodes: {CODES_NACH_ABLAUF_TAGE} Tag nach Ablauf.</li>
            <li>
              Versandprotokoll der E-Mails (Empfänger nur als Prüfwert, dazu ob die Mail zugestellt,
              abgewiesen oder als Spam gemeldet wurde): {MAIL_PROTOKOLL_AUFBEWAHREN_TAGE} Tage.
            </li>
            <li>Protokoll im Admin-Bereich: {ADMIN_PROTOKOLL_JAHRE_SEITE} Jahre (Abschnitt 17).</li>
            <li>Erledigte Fehler- und Wunschmeldungen: 90 Tage nach ihrer Bearbeitung (Abschnitt 12).</li>
            <li>
              Server-Logs: so lange, wie unser Hosting-Dienstleister sie für den Betrieb vorhält, in der Regel
              wenige Tage (Abschnitt 18).
            </li>
            <li>Warenkorb im Browser (localStorage): bis du ihn löschst.</li>
          </ul>
        </Section>

        <Section abschnitt={ABSCHNITTE[5]}>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong className="text-foreground">Auskunft:</strong> Du kannst jederzeit Auskunft über gespeicherte Daten verlangen.</li>
            <li><strong className="text-foreground">Berichtigung:</strong> Unrichtige Daten werden auf Anfrage korrigiert.</li>
            <li><strong className="text-foreground">Löschung:</strong> Du kannst die Löschung deiner Daten verlangen, soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen.</li>
            <li><strong className="text-foreground">Einschränkung:</strong> Du kannst die Verarbeitung einschränken lassen.</li>
            <li><strong className="text-foreground">Widerspruch:</strong> Du kannst der Verarbeitung widersprechen, wenn sie auf berechtigtem Interesse beruht.</li>
            <li><strong className="text-foreground">Datenübertragbarkeit:</strong> Auf Anfrage erhältst du deine Daten in maschinenlesbarem Format.</li>
            <li><strong className="text-foreground">Widerruf einer Einwilligung:</strong> Eine Einwilligung kannst du jederzeit für die Zukunft widerrufen. Was bis dahin geschehen ist, bleibt rechtmäßig.</li>
          </ul>
          <p className="mt-3">
            Anfragen richten an:{' '}
            <a href={`mailto:${DATENSCHUTZ_EMAIL}`} className={INFOSEITE_LINK}>
              {DATENSCHUTZ_EMAIL}
            </a>
          </p>
        </Section>

        <Section abschnitt={ABSCHNITTE[6]}>
          <p>
            Du hast das Recht, bei der Österreichischen Datenschutzbehörde Beschwerde einzulegen:{' '}
            <a
              href="https://www.dsb.gv.at"
              target="_blank"
              rel="noopener noreferrer"
              className={INFOSEITE_LINK}
            >
              www.dsb.gv.at
            </a>
          </p>
        </Section>

        <Section abschnitt={ABSCHNITTE[7]}>
          <p>
            Für Warenkorbfunktion und Session-Verwaltung verwenden wir technisch notwendige
            Cookies und localStorage-Einträge. Es werden keine Tracking-Cookies oder
            Werbe-Cookies eingesetzt. Die weiteren Cookies stehen mit Zweck und Dauer in
            Abschnitt 2.
          </p>
        </Section>

        <Section abschnitt={ABSCHNITTE[8]}>
          <p>
            Beim Abschluss einer Bestellung kannst du optional zustimmen, dass du vom jeweiligen
            Hof über frische Produkte und Neuigkeiten informiert wirst — per E-Mail und/oder
            WhatsApp.
          </p>
          <p>
            Verantwortlich für die Neuigkeiten ist der Hof. Per E-Mail verschicken wir sie in seinem
            Auftrag und verwalten deine Anmeldung und Abmeldung nach seinen Vorgaben. Hast du Neuigkeiten
            per WhatsApp gewählt, sieht der Hof deinen Namen und deine Telefonnummer und schickt die
            Neuigkeiten selbst über sein WhatsApp. Wird eine Neuigkeiten-Mail abgewiesen oder als Spam
            gemeldet, melden wir die Adresse ab.
          </p>
          <p>
            Diese Einwilligung ist freiwillig und hat keinen Einfluss auf deine Bestellung. Du
            kannst sie jederzeit widerrufen:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Über den Abmelde-Link in jeder E-Mail</li>
            <li>
              In deinem{' '}
              <Link href="/account/profile" className={INFOSEITE_LINK}>
                Kunden-Profil
              </Link>{' '}
              unter „Mein Konto&ldquo;
            </li>
          </ul>
          <p>
            Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO (ausdrückliche Einwilligung).
            Gespeichert werden ausschließlich deine E-Mail-Adresse, ggf. Telefonnummer und
            die erteilten Einwilligungen.
          </p>
        </Section>

        <Section abschnitt={ABSCHNITTE[9]}>
          <p>
            Du kannst dich mit einem Code, den wir dir per E-Mail schicken, in dein Kunden-Konto
            einloggen, um deine Benachrichtigungs-Einstellungen zu verwalten. Der Code hat{' '}
            {ANMELDECODE_LAENGE} Stellen und gilt {ANMELDECODE_MINUTEN} Minuten. Dabei wird deine
            E-Mail-Adresse gespeichert sowie ein Sitzungs-Cookie gesetzt. Er gilt 7 Tage und verlängert
            sich, solange du die Seite nutzt, höchstens aber {SITZUNG_HOECHSTENS_TAGE} Tage ab der Anmeldung.
          </p>
          <p>
            Du kannst dein Konto und alle gespeicherten Einwilligungen jederzeit unter{' '}
            <Link href="/account/profile" className={INFOSEITE_LINK}>
              Mein Konto → Konto löschen
            </Link>{' '}
            vollständig löschen. Bestelldaten werden aus steuerrechtlichen Gründen weiterhin
            aufbewahrt (§ 132 BAO, 7 Jahre).
          </p>
        </Section>

        <Section abschnitt={ABSCHNITTE[10]}>
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
          {/* Alter Anker des früheren Abschnitts „Umkreissuche auf der Hofübersicht“ — bleibt als Sprungziel. */}
          <span id="umkreissuche" className="block scroll-mt-20" aria-hidden="true" />
          <p>
            Tippst du auf der Hofübersicht „In meiner Nähe“, fragt dein Browser deinen
            Standort ab — und behält ihn: Er wird <strong className="font-medium">nicht an uns
            und an niemanden sonst übertragen</strong>. Die Entfernungen zu den Höfen rechnet
            dein Gerät selbst aus den Hofkoordinaten, die mit der Seite ohnehin geladen
            wurden. Wir speichern deinen Standort nicht, weder auf dem Gerät noch bei uns;
            schließt du die Seite, ist er fort.
          </p>
          <p className="mt-3">
            Sendest du eine Suche ab, geht dein Suchtext an unseren Server und von dort an
            Nominatim (OpenStreetMap Foundation), um zu prüfen, ob es ein Ort ist, und
            daraus einen Kartenpunkt zu machen — deine IP-Adresse erreicht Nominatim dabei
            nicht, und ein gemessener Standort wird nie übermittelt. Die Suche startet
            erst, wenn du sie absendest; die Eingabe speichern wir nicht.
          </p>
          <p className="mt-3">
            Die Karten und die Ortssuche kommen von der OpenStreetMap Foundation (Vereinigtes Königreich),
            die für die Auslieferung der Kacheln Dienstleister einsetzen kann. Rechtsgrundlage ist Art. 6
            Abs. 1 lit. f DSGVO: Wir haben ein berechtigtes Interesse daran, Höfe auf einer Karte zu zeigen,
            ohne einen Kartendienst mit Werbung oder Konto zu verwenden. Auf der öffentlichen Hofübersicht
            lädt die Karte erst, wenn du die Kartenansicht öffnest. Auf deinem Gerät wird dabei nichts
            gespeichert.
          </p>
        </Section>

        <Section abschnitt={ABSCHNITTE[11]}>
          <p>
            Über &bdquo;Problem melden&ldquo; kannst du uns Fehler, Wünsche und Fragen
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

        {/* Zusagen nach Register N12 und AGB 20.2 (Fassung 0.9); Mail-Regel aus Nr. 87.
            Ändert sich eine davon, ändert sich dieser Abschnitt mit. */}
        <Section abschnitt={ABSCHNITTE[12]}>
          <p>
            Wir schreiben Höfen über das Postfach in der App, zum Beispiel zur Abrechnung oder zu
            Änderungen der AGB. Der Hof kann jede Nachricht beantworten. Gespeichert werden der
            Text der Nachricht und der Antwort, der Zeitpunkt und ob der Hof die Nachricht
            gelesen hat.
          </p>
          <p>
            Die Nachrichten bleiben gespeichert, solange das Hofkonto besteht; nach dem Schließen gilt
            Abschnitt 14. Wir durchsuchen das Postfach nicht nach Inhalten; wir lesen nur, was
            ein Hof uns schreibt. Betrifft eine Nachricht den Betrieb des Hofs, können wir sie
            zusätzlich per E-Mail an die Adresse des Hofkontos schicken. Werbung für Dritte
            schicken wir nie.
          </p>
          <p>Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).</p>
        </Section>

        <Section abschnitt={ABSCHNITTE[13]}>
          <p>Für Höfe, die {MARKE} nutzen, verarbeiten wir zusätzlich:</p>
          <ul className={LISTE}>
            <li>
              <strong className={FETT}>Konto:</strong> E-Mail-Adresse zur Anmeldung, Name,
              Telefonnummer, Passwort (nur als Prüfwert (Hash), nie im Klartext), auf Wunsch ein Passkey
              (nur der öffentliche Schlüssel), die angemeldeten Geräte (Gerät und Browser, nie Ort oder
              IP-Adresse) und die Sitzungen (mit IP-Adresse, Abschnitt 5).
            </li>
            <li>
              <strong className={FETT}>Hofprofil:</strong> Hofname, Name der Inhaberin oder des
              Inhabers, Anschrift, Standort auf der Karte, Telefon, E-Mail-Adresse des Hofs, Texte, Fotos,
              Produkte, Abholzeiten und, wenn du sie angibst, die LFBIS- bzw. BAES-Nummer. Was auf der
              Hofseite steht, ist öffentlich. Name, Anschrift und E-Mail-Adresse des Hofs stehen außerdem in
              den Bestellbestätigungen an die Kundschaft, weil das Gesetz diese Angaben verlangt.
            </li>
            <li>
              <strong className={FETT}>Zustimmung zu den AGB:</strong> welche Fassung du angenommen
              hast und wann.
            </li>
            <li>
              <strong className={FETT}>Online-Zahlung:</strong> Dein Stripe-Konto für Auszahlungen
              richtest du bei Stripe ein. Beim Anlegen geben wir Stripe das Land, die E-Mail-Adresse des
              Hofs und die Adresse deiner Hofseite. Welche weiteren Angaben nötig sind (etwa zu deiner
              Person und deinem Konto für Auszahlungen), gibt Stripe dir vor und verarbeitet sie selbst.
              Wir speichern nur die Kennung des Kontos und den Stand der Einrichtung (etwa ob es fertig
              eingerichtet ist). Ohne Stripe-Konto können wir deinen Hof nicht freischalten.
            </li>
            <li>
              <strong className={FETT}>Verwaltung:</strong> Freischaltung, Gründungsplatz,
              Konditionen (etwa Prozentsatz der Plattformgebühr, Abrechnungstag), eine Sperre durch das Team
              mit Grund sowie das Pausieren, Stilllegen und Schließen.
            </li>
            <li>Nachrichten im Postfach (Abschnitt 13) und deine Meldungen (Abschnitt 12).</li>
          </ul>
          <p>
            Zweck: dein Hofkonto führen, deinen Hof zeigen, Bestellungen vermitteln und mit dir abrechnen.
            Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertrag). Für die Aufbewahrung von Abrechnungen
            gilt lit. c (§ 132 BAO), für Sicherheit, Geräte-Hinweise und das Protokoll lit. f.
          </p>
          {/* Fassung B (E2 der Projektleitung): Stufe 2 läuft noch nicht
              (ENDGUELTIG_FREIGEGEBEN = false, src/lib/konto-schliessen.ts). */}
          <p>
            <strong className={FETT}>Konto schließen:</strong> Schließt du dein Hofkonto, ist deine
            Hofseite sofort offline, die Anmeldung ist gesperrt und Neuigkeiten-Abos enden. 30 Tage lang
            kannst du das rückgängig machen. Danach sollen Kontakt, Fotos, Texte, Beiträge, Nachrichten,
            Geräte und Anmeldedaten des Hofs gelöscht oder unkenntlich gemacht werden; Bestellungen, Beträge
            und Abrechnungen bleiben, solange die Aufbewahrungspflicht gilt (Abschnitt 5). Dieses Löschen
            läuft noch nicht von selbst. Bis dahin bleiben die Daten gespeichert; wir verwenden sie weiter
            für die Schlussabrechnung und für gesetzliche Pflichten. Möchtest du die Löschung vorher,
            schreib an{' '}
            <a href={`mailto:${DATENSCHUTZ_EMAIL}`} className={INFOSEITE_LINK}>
              {DATENSCHUTZ_EMAIL}
            </a>
            . Wir bearbeiten deine Anfrage von Hand und antworten dir innerhalb eines Monats.
          </p>
        </Section>

        <Section abschnitt={ABSCHNITTE[14]}>
          <p>
            Für Barbestellungen ziehen wir die Plattformgebühr einmal im Monat per SEPA-Lastschrift ein, ab
            dem Einzugsbeginn deines Hofs (AGB Punkt 19).
          </p>
          <ul className={LISTE}>
            <li>
              <strong className={FETT}>Lastschrift einrichten:</strong> Den Auftrag (Mandat) erteilst
              du in einem Formular von Stripe in der App. Deine IBAN, Name und E-Mail-Adresse des
              Kontoinhabers und die Bestätigung des Mandats nimmt Stripe direkt auf. Zur Bestätigung gehören
              Zeitpunkt, IP-Adresse und Browser, als Nachweis für die Bank. Stripe speichert diese Daten.
            </li>
            <li>
              <strong className={FETT}>Was wir speichern:</strong> keine IBAN und keine Kontodaten,
              nur die Kennung deines Hofs als Kunde bei Stripe und die Kennung des Zahlungsmittels, den
              Zeitpunkt, zu dem das Mandat gültig wurde, und je Monat die Beträge, die Zahl der Bestellungen,
              den Stand der Abrechnung (offen, bezahlt, gescheitert, zurückgebucht) und die Kennungen der
              Rechnungen. Unter „Deine Konditionen“ zeigen wir Bank und letzte vier Stellen deiner IBAN.
              Diese Angaben holen wir beim Öffnen der Seite bei Stripe und speichern sie nicht.
            </li>
            <li>
              An Stripe geben wir dafür den Namen deines Hofs, die E-Mail-Adresse deines Kontos und je
              Rechnung die Bestellnummern mit der Gebühr.
            </li>
            <li>
              <strong className={FETT}>Rechnung und Ankündigung:</strong> Stripe erstellt die
              Monatsrechnungen; du findest sie unter „Deine Konditionen“. Vor dem ersten Einzug bekommst du
              eine Nachricht im Postfach und eine E-Mail.
            </li>
            {/* Der Satz zur Rückbuchung (Wortlaut von Recht, Lauf 34 Nr. 290) steht auf einer Zeile —
                tests/datenschutz-struktur.test.ts sucht ihn dort. */}
            <li>
              <strong className={FETT}>Wenn der Einzug scheitert:</strong> Stripe versucht es erneut,
              und du bekommst eine Nachricht. Bleibt ein Betrag länger offen, als in deinen Konditionen
              steht (Vorgabe 14 Tage), nimmt dein Hof keine Barbestellungen mehr an, bis der Betrag bezahlt
              ist; danach geht es von selbst wieder.
              Bucht deine Bank eine Lastschrift zurück, nimmt dein Hof sofort keine Barbestellungen mehr an, bis der zurückgebuchte Betrag bezahlt ist; danach geht es von selbst wieder. Das entscheidet die App nach einer festen Regel (AGB Punkt 19.6). Hast du anders bezahlt oder war die Rückbuchung nicht berechtigt, schreib uns – dann prüft ein Mensch und kann die Sperre aufheben.
              Beides geschieht nach dieser festen Regel automatisch. Wir bewerten dabei nicht deine Person
              oder deine Zahlungsfähigkeit und fragen keine Auskunftei. Schreibst du uns, sieht sich ein
              Mensch die Sperre an.
            </li>
            <li>
              Ohne Mandat bietet die Kasse bei deinem Hof ab dem Einzugsbeginn nur Online-Bezahlen an, außer
              deine Konditionen sehen eine Überweisung vor. Das Mandat ist also nicht gesetzlich
              vorgeschrieben, aber Bedingung für Barbestellungen.
            </li>
          </ul>
          <p>
            Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Abrechnung nach den AGB), für die Aufbewahrung der
            Rechnungen lit. c (§ 132 BAO). Die Kennungen bewahren wir auf, solange das Mandat gilt, und
            danach so lange wie die Rechnungen, die damit eingezogen wurden (Abschnitt 5).
          </p>
        </Section>

        <Section abschnitt={ABSCHNITTE[15]}>
          <p>
            Als Betreiber einer Plattform müssen wir nach dem Digitale Plattformen-Meldepflichtgesetz (DPMG)
            einmal im Jahr Angaben zu Höfen, die über {MARKE} verkaufen, und zu ihren Umsätzen an das
            Finanzamt melden. Ausgenommen sind Höfe mit weniger als 30 Verkäufen und höchstens 2.000 € Umsatz
            über die Plattform im Kalenderjahr.
          </p>
          <p>
            Gemeldet werden insbesondere Name, Anschrift, Steuernummer bzw. UID, bei natürlichen Personen das
            Geburtsdatum, bei Unternehmen die Firmenbuchnummer, die Umsätze und die Gebühren je Quartal
            sowie das Konto für Auszahlungen, soweit das Gesetz es verlangt.
          </p>
          <p>
            Diese Angaben erheben wir noch nicht. Wir fragen dich rechtzeitig vor Ende des ersten
            Kalenderjahres, für das wir melden müssen, danach und sagen dir vorher, was wir melden.
          </p>
          <p>
            Rechtsgrundlage: Art. 6 Abs. 1 lit. c DSGVO in Verbindung mit dem DPMG. Die Angaben sind
            gesetzlich vorgeschrieben. Fehlen sie trotz zweier Erinnerungen, müssen wir dein Hofkonto sperren
            oder Auszahlungen zurückhalten, bis sie vorliegen (AGB 27.3). Speicherdauer: so lange, wie das
            DPMG es vorschreibt.
          </p>
        </Section>

        <Section abschnitt={ABSCHNITTE[16]}>
          <p>
            Wir halten Eingriffe des Teams fest: etwa das Anzeigen der vollen E-Mail-Adresse einer Kundin,
            das Sperren eines Hofs, einen Storno im Namen eines Hofs oder eine geänderte Kondition. Ebenso
            halten wir Ereignisse fest, die Geld oder den Zustand eines Hofs ändern, etwa ein gültiges
            Mandat oder eine zurückgebuchte Lastschrift.
          </p>
          <p>
            Gespeichert werden: wer es war (oder „System“), was geschah, auf welchen Hof oder welche
            Bestellung es sich bezieht (nur als Kennung), ein kurzer Grund und ob mit Passkey bestätigt
            wurde. Adressen, Telefonnummern und Inhalte speichern wir dort nicht.
          </p>
          <p>
            Zweck: Eingriffe nachvollziehbar machen und Missbrauch erkennen. Rechtsgrundlage: Art. 6 Abs. 1
            lit. f DSGVO. Wir ändern die Einträge nicht und löschen sie nach {ADMIN_PROTOKOLL_JAHRE_SEITE}{' '}
            Jahren.
          </p>
        </Section>

        <Section abschnitt={ABSCHNITTE[17]}>
          <p>
            Bei jedem Aufruf entstehen bei unserem Hosting-Dienstleister technische Protokolle: IP-Adresse,
            Zeitpunkt, aufgerufene Adresse, Browser-Kennung und ob die Anfrage geklappt hat. Wir nutzen sie
            nur, um Fehler zu finden und Angriffe abzuwehren. Speicherdauer siehe Abschnitt 5.
          </p>
          <p>
            Um Anmeldungen, Codes, Bestellungen und Meldungen vor Missbrauch zu schützen, zählen wir Anfragen
            je Absender für kurze Zeit. Dafür speichern wir deine IP-Adresse oder E-Mail-Adresse nicht im
            Klartext, sondern nur als gekürzten Prüfwert, den wir mit einem geheimen Schlüssel bilden. Wir
            löschen ihn täglich, sobald das Zeitfenster vorbei ist.
          </p>
          <p>
            Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einem sicheren Betrieb).
            Du kannst dem widersprechen (Abschnitt 6). Ohne diese Protokolle können wir die Plattform aber
            nicht sicher betreiben.
          </p>
        </Section>
      </RechtstextVorlage>
    </KundeShellMitSitzung>
  )
}
