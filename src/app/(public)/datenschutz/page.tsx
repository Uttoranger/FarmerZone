import Link from 'next/link'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { ExternalLink, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import { DATENSCHUTZ_EMAIL } from '@/lib/support'
import { BESTELLUNGEN_ANSICHT_SEKUNDEN } from '@/lib/bestellungen-finden'
import { ABO_BESTAETIGUNG_GUELTIG_TAGE, ABO_TEXT, NEUIGKEITEN_TEXT } from '@/lib/abo-bestaetigung'
import { SUCHFELD_TEXT } from '@/lib/hoefe-entdecken'
import { PROBLEM_MELDEN } from '@/lib/fehlerseite'
import { HILFE_UND_RUECKMELDUNG, MEIN_KONTO, ZAEHLER_STUNDEN } from '@/lib/datenschutz'

export const metadata: Metadata = { title: 'Datenschutz — FarmerZone' }

/*
 * Die Datenschutzerklärung sagt, was der Code tut — jede Aussage ist in
 * tests/datenschutz-sachstand.test.ts an ihre Stelle im Code gebunden
 * (Nachtlauf Nr. 33 und 57). Zahlen und Knopfnamen kommen deshalb aus den
 * Quellen, die auch der Rest der App liest, nie als zweite Abschrift.
 *
 * Seit Nr. 57 in der KundeShell wie die übrigen öffentlichen Seiten. Die
 * Seite bleibt statisch: KundeShellMitSitzung liest die Sitzung im Browser.
 * Für /datenschutz gibt es kein Mockup; gebaut nach DESIGN_SYSTEM (Tokens,
 * Fraunces für Überschriften, Links mit 44 px Trefferfläche).
 */

// Aus derselben Konstante wie der Cookie selbst, damit die Erklärung nicht
// von der Laufzeit abweicht.
const BESTELLUNGEN_COOKIE_MINUTEN = BESTELLUNGEN_ANSICHT_SEKUNDEN / 60

// Die Lesespalte hat die Maße der gemeinsamen Ladeansicht der Infoseiten
// ((public)/loading.tsx: höchstens 672 px, 16 px Rand) — beim Wechsel springt nichts.
const SPALTE = 'mx-auto w-full max-w-2xl px-4 pt-8 pb-12 md:pt-10'
const TITEL = 'font-heading text-[28px] leading-tight font-semibold text-balance md:text-[34px]'
const ABSCHNITT_TITEL = 'font-heading text-[19px] leading-snug font-semibold text-balance md:text-[21px]'
const LISTE = 'flex list-disc flex-col gap-1.5 pl-5 marker:text-muted-foreground'
const DIENST = 'flex flex-col gap-1 rounded-2xl border border-border bg-card p-4 md:px-[18px]'
// Links stehen auf eigener Zeile: im Fließtext hätten sie nur die Zeilenhöhe als Trefferfläche.
const LINK = cn(
  'inline-flex min-h-11 w-fit max-w-full items-center gap-2 rounded-md font-medium text-status-fertig underline underline-offset-4',
  FOKUS_RAHMEN
)

function Abschnitt({ id, titel, children }: { id: string; titel: string; children: ReactNode }): React.JSX.Element {
  return (
    <section aria-labelledby={id} className="flex scroll-mt-20 flex-col gap-3 border-t border-border pt-6">
      <h2 id={id} className={ABSCHNITT_TITEL}>
        {titel}
      </h2>
      {children}
    </section>
  )
}

function Dienst({ name, children }: { name: string; children: ReactNode }): React.JSX.Element {
  return (
    <li className={DIENST}>
      <h3 className="font-heading text-[16px] font-semibold">{name}</h3>
      {children}
    </li>
  )
}

/** Ein Name aus der Oberfläche in Anführungszeichen — bricht nicht mitten im Namen um („E-“ / „Mail“). */
function Name({ children }: { children: string }): React.JSX.Element {
  return <span className="whitespace-nowrap">„{children}“</span>
}

function DatenschutzMail(): React.JSX.Element {
  return (
    // E-Mail-Adressen haben keine Leerzeichen — am Handy darf sie überall umbrechen.
    <a href={`mailto:${DATENSCHUTZ_EMAIL}`} className={cn(LINK, '[overflow-wrap:anywhere]')}>
      <Mail className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
      {DATENSCHUTZ_EMAIL}
    </a>
  )
}

export default function DatenschutzPage(): React.JSX.Element {
  return (
    <KundeShellMitSitzung>
      <div className={SPALTE}>
        <header className="flex flex-col gap-1.5">
          <h1 className={TITEL}>Datenschutzerklärung</h1>
          <p className="text-[14px] text-muted-foreground">Gemäß DSGVO / DSG Österreich</p>
        </header>

        <div className="mt-8 flex flex-col gap-8 text-[15px] leading-relaxed text-foreground">
          <Abschnitt id="verantwortliche-stelle" titel="1. Verantwortliche Stelle">
            <p>
              Verantwortlich für die Datenverarbeitung auf dieser Plattform ist der Betreiber von FarmerZone
              (Kontaktdaten siehe Impressum).
            </p>
            <div>
              <p>Kontakt für Datenschutzanfragen:</p>
              <DatenschutzMail />
            </div>
          </Abschnitt>

          <Abschnitt id="daten" titel="2. Welche Daten wir verarbeiten">
            <p>
              <strong className="font-semibold">Bei einer Bestellung:</strong>
            </p>
            <ul className={LISTE}>
              <li>Name, E-Mail-Adresse, Telefonnummer</li>
              <li>Bestellte Produkte, Menge, Gesamtbetrag</li>
              <li>Gewählter Abholtermin und Zahlungsart</li>
              <li>Optionale Notiz an den Hof</li>
            </ul>
            <p>
              <strong className="font-semibold">Zahlungsdaten:</strong>
            </p>
            <p>
              Kreditkarten- und Bankdaten werden ausschließlich von Stripe verarbeitet und gespeichert. FarmerZone
              speichert keine vollständigen Zahlungsdaten — nur die Kennung des Zahlungsvorgangs bei Stripe.
            </p>
            <p>
              <strong className="font-semibold">Technisch notwendige Daten:</strong>
            </p>
            <ul className={LISTE}>
              <li>
                Session-Cookies (für Anmeldung und <Name>Bestellungen finden</Name>, technisch notwendig)
              </li>
              <li>Server-Logs (IP-Adresse, Zeitstempel) für Betrieb und Sicherheit</li>
            </ul>
            <p>
              <strong className="font-semibold">Schutz vor Missbrauch:</strong>
            </p>
            <p>
              Damit niemand unsere Formulare mit massenhaften Anfragen lahmlegt, zählen wir, wie oft etwas versucht
              wird: bei der Anmeldung mit Code und bei <Name>Bestellungen finden</Name> je IP-Adresse und je E-Mail-Adresse, beim
              Bestellen je IP-Adresse und je Warenkorb-Kennung deines Browsers, beim Registrieren eines Hofes und bei
              <Name>{PROBLEM_MELDEN}</Name> ohne Hof-Anmeldung je IP-Adresse, bei der Anmeldung zu Neuigkeiten je
              Bestellung.
              Gespeichert wird dafür nur ein Prüfwert, den unser Server mit einem geheimen Schlüssel aus dieser Angabe
              berechnet, dazu Zählerstand und Zeitfenster — nie die Adresse oder Kennung selbst. Eine tägliche
              Aufräumarbeit löscht die Einträge, sobald ihr Zeitfenster vorbei ist: nach höchstens etwa{' '}
              {ZAEHLER_STUNDEN.person} Stunden, bei der Anmeldung zu Neuigkeiten nach höchstens etwa{' '}
              {ZAEHLER_STUNDEN.bestellung} Stunden.
            </p>
          </Abschnitt>

          <Abschnitt id="zweck" titel="3. Zweck der Datenverarbeitung">
            <ul className={LISTE}>
              <li>Abwicklung und Bestätigung von Bestellungen</li>
              <li>Kommunikation zwischen Hofbetreiber und Kunden (E-Mail-Bestätigungen)</li>
              <li>Erfüllung steuerrechtlicher Aufbewahrungspflichten</li>
              <li>Betrieb und Sicherheit der Plattform</li>
            </ul>
            <p>Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) und lit. c (rechtliche Verpflichtung).</p>
          </Abschnitt>

          <Abschnitt id="dienstleister" titel="4. Externe Dienstleister">
            <ul className="flex flex-col gap-3">
              <Dienst name="Stripe (Zahlungsabwicklung)">
                <p>
                  Stripe Payments Europe Ltd., 1 Grand Canal Street Lower, Dublin 2, Irland. Stripe verarbeitet
                  Zahlungsdaten als eigenständiger Verantwortlicher gemäß seinem Datenschutz-Rahmenwerk.
                </p>
              </Dienst>
              <Dienst name="Resend (E-Mail-Versand)">
                <p>
                  Resend Inc., USA — für transaktionale E-Mails (Bestellbestätigung, Abholhinweis) sowie die
                  Bestätigungsmail und die Neuigkeiten der Höfe (Abschnitt 9).
                </p>
              </Dienst>
              <Dienst name="Supabase (Datenbank)">
                <p>Supabase Inc. — Bestelldaten werden in einer PostgreSQL-Datenbank auf europäischen Servern gespeichert.</p>
              </Dienst>
              <Dienst name="Vercel (Hosting)">
                <p>Vercel Inc., USA — Hosting der Webanwendung. Angemessenes Schutzniveau durch Standardvertragsklauseln.</p>
              </Dienst>
              <Dienst name="Sentry (Fehlerdiagnose)">
                <p>
                  Functional Software, Inc. (Sentry), USA — technische Fehlerberichte der Anwendung,
                  Ladezeit-Messungen zu etwa jedem zehnten Seitenaufruf und aus deinem Browser bei jedem Seitenaufruf
                  eine kurze Sitzungsmeldung (ob die Seite ohne Fehler lief), gespeichert auf Servern in der EU. Vor
                  dem Versand werden aus Fehlerberichten und Messungen personenbezogene Inhalte (IP-Adressen,
                  E-Mail-Adressen, Telefonnummern, Cookies, Zugangsdaten, Formularinhalte) automatisch entfernt;
                  Fehlerberichte und Messungen aus deinem Browser bitten Sentry zudem ausdrücklich, deine IP-Adresse
                  auch nicht aus der Verbindung zu übernehmen. Die Sitzungsmeldungen enthalten selbst keine
                  IP-Adresse, tragen diese Bitte aber nicht mit. Fehlerberichte, Messungen und Sitzungsmeldungen
                  enthalten die Kennung deines Browsers (User-Agent). Es gibt keine Aufzeichnung deiner
                  Bildschirmsitzung.
                  Übermittelt wird, was technisch schiefging; bei eingeloggten Höfen zusätzlich die interne Kennung
                  des Hofes, nie Name oder E-Mail-Adresse.
                </p>
              </Dienst>
              <Dienst name="Vercel Web Analytics (Reichweitenmessung)">
                <p>
                  Vercel Inc., USA — cookielose Zählung von Seitenaufrufen ohne Wiedererkennung: Es werden keine
                  Cookies gesetzt, keine Kennungen auf dem Gerät gespeichert und keine Profile über den Tag hinaus
                  gebildet.
                </p>
              </Dienst>
            </ul>
          </Abschnitt>

          <Abschnitt id="speicherdauer" titel="5. Speicherdauer">
            <ul className={LISTE}>
              <li>Bestelldaten: 7 Jahre (steuerrechtliche Aufbewahrungspflicht gemäß § 132 BAO)</li>
              <li>Server-Logs: 30 Tage</li>
              <li>Warenkorbdaten im Browser (localStorage): bis zur Löschung durch den Nutzer</li>
              <li>
                Zähler zum Schutz vor Missbrauch: höchstens etwa {ZAEHLER_STUNDEN.person} Stunden, bei der Anmeldung
                zu Neuigkeiten etwa {ZAEHLER_STUNDEN.bestellung} Stunden (Abschnitt 2)
              </li>
            </ul>
          </Abschnitt>

          <Abschnitt id="rechte" titel="6. Deine Rechte (Art. 15–22 DSGVO)">
            <ul className={LISTE}>
              <li>
                <strong className="font-semibold">Auskunft:</strong> Du kannst jederzeit Auskunft über gespeicherte
                Daten verlangen.
              </li>
              <li>
                <strong className="font-semibold">Berichtigung:</strong> Unrichtige Daten werden auf Anfrage korrigiert.
              </li>
              <li>
                <strong className="font-semibold">Löschung:</strong> Du kannst die Löschung deiner Daten verlangen,
                soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen.
              </li>
              <li>
                <strong className="font-semibold">Einschränkung:</strong> Du kannst die Verarbeitung einschränken lassen.
              </li>
              <li>
                <strong className="font-semibold">Widerspruch:</strong> Du kannst der Verarbeitung widersprechen, wenn
                sie auf berechtigtem Interesse beruht.
              </li>
              <li>
                <strong className="font-semibold">Datenübertragbarkeit:</strong> Auf Anfrage erhältst du deine Daten in
                maschinenlesbarem Format.
              </li>
            </ul>
            <div>
              <p>Anfragen richten an:</p>
              <DatenschutzMail />
            </div>
          </Abschnitt>

          <Abschnitt id="beschwerde" titel="7. Beschwerderecht">
            <div>
              <p>Du hast das Recht, bei der Österreichischen Datenschutzbehörde Beschwerde einzulegen:</p>
              <a href="https://www.dsb.gv.at" target="_blank" rel="noopener noreferrer" className={LINK}>
                www.dsb.gv.at
                <ExternalLink className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
                <span className="sr-only"> (öffnet in neuem Tab)</span>
              </a>
            </div>
          </Abschnitt>

          <Abschnitt id="cookies" titel="8. Cookies">
            <p>
              Wir verwenden ausschließlich technisch notwendige Cookies und localStorage-Einträge (für
              Warenkorbfunktion und Session-Verwaltung). Es werden keine Tracking-Cookies oder Werbe-Cookies
              eingesetzt; die Reichweitenmessung mit Vercel Web Analytics (siehe Abschnitt 4) kommt ohne Cookies aus.
            </p>
          </Abschnitt>

          <Abschnitt id="neuigkeiten" titel="9. Newsletter und Neuigkeiten von Höfen">
            <p>
              Nach einer Bestellung kannst du auf der Bestätigungsseite Neuigkeiten des Hofes über frische Produkte und
              Aktionen per E-Mail bestellen, mit dem Knopf <Name>{NEUIGKEITEN_TEXT.knopf}</Name>. Angemeldet wird die
              E-Mail-Adresse, die du bei der Bestellung angegeben hast. Beim Bestellen selbst fragen wir nicht danach.
            </p>
            <p>
              Bei einer neuen Anmeldung schicken wir dir zuerst eine E-Mail mit einem Link. Erst wenn du ihn öffnest
              und dort auf <Name>{ABO_TEXT.knopf}</Name> tippst, bist du angemeldet; vorher bekommst du keine Neuigkeiten. Der
              Link gilt {ABO_BESTAETIGUNG_GUELTIG_TAGE} Tage.
            </p>
            <p>
              Diese Einwilligung ist freiwillig und hat keinen Einfluss auf deine Bestellung. Du kannst sie jederzeit
              widerrufen:
            </p>
            <ul className={LISTE}>
              <li>
                Über den Link <Name>Abmelden</Name> in jeder Neuigkeiten-Mail. Bietet dein E-Mail-Programm selbst{' '}
                <Name>Abmelden</Name> an, genügt dort ein Klick, ohne weitere Rückfrage. Abgemeldet wirst du damit für diesen Hof per E-Mail und
                per WhatsApp.
              </li>
              <li>
                <Link href="/account/profile" className={LINK}>
                  In deinem Kunden-Profil unter <Name>{MEIN_KONTO}</Name>
                </Link>
              </li>
            </ul>
            <p>
              Neuigkeiten per WhatsApp lassen sich nicht mehr neu bestellen. Wer sie früher beim Bestellen mit seiner
              Telefonnummer bestellt hat, kann sie unter <Name>{MEIN_KONTO}</Name> weiter ein- und ausschalten.
            </p>
            <p>
              Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO (ausdrückliche Einwilligung). Gespeichert werden deine
              E-Mail-Adresse, der Hof, wann wir dir den Bestätigungslink geschickt und wann du bestätigt hast, bei
              früheren WhatsApp-Anmeldungen auch deine Telefonnummer. Meldest du dich ab, löschen wir den Eintrag
              nicht, sondern schalten ihn aus; die Zeitpunkte einer bestätigten Anmeldung bleiben als Nachweis. Ganz
              löschen kannst du ihn mit deinem Kunden-Konto (Abschnitt 10).
            </p>
          </Abschnitt>

          <Abschnitt id="kunden-konto" titel="10. Kunden-Konto (Anmeldung mit Code)">
            <p>
              Du kannst dich mit einem Code, den wir dir per E-Mail schicken, in dein Kunden-Konto einloggen, um deine
              Benachrichtigungs-Einstellungen zu verwalten. Dabei wird deine E-Mail-Adresse gespeichert sowie ein
              temporärer Sitzungs-Cookie gesetzt (gültig 7 Tage). Beim Bestellen wird kein Konto angelegt.
            </p>
            <p>
              {`„Bestellungen finden“ läuft ebenfalls über einen Code per E-Mail. Dafür entsteht kein Konto; es wird nur für ${BESTELLUNGEN_COOKIE_MINUTEN} Minuten ein Cookie mit deiner bestätigten E-Mail-Adresse gesetzt.`}
            </p>
            <div>
              <p>
                Du kannst dein Konto und alle gespeicherten Einwilligungen jederzeit unter <Name>{MEIN_KONTO}</Name>{' '}
                vollständig löschen. Bestelldaten werden aus steuerrechtlichen Gründen weiterhin aufbewahrt (§ 132 BAO,
                7 Jahre).
              </p>
              <Link href="/account/profile" className={LINK}>
                Zu <Name>{MEIN_KONTO}</Name>
              </Link>
            </div>
          </Abschnitt>

          <Abschnitt id="karten" titel="Standortsuche und Kartendarstellung">
            <p>
              Sucht ein Hof im Hofprofil seinen Standort, wird die eingegebene Hofadresse (Straße, PLZ, Ort) zur
              Standortsuche an Nominatim (OpenStreetMap Foundation, nominatim.openstreetmap.org) übermittelt; schiebt er
              den Kartenpunkt, wird umgekehrt dieser Punkt zur Ermittlung der Adresse dorthin übermittelt — es handelt
              sich jeweils um die Betriebsadresse bzw. den Betriebsstandort des Hofes, nicht um Daten von
              Besucherinnen.
            </p>
            <p>
              Die Kartenkacheln, also die Bilder der Karte, lädt dein Browser direkt von der OpenStreetMap Foundation
              (tile.openstreetmap.org). Dabei erhält sie deine IP-Adresse und, wie bei jedem Abruf, die Kennung deines
              Browsers (User-Agent) sowie als Herkunft nur die Adresse unserer Website ohne Seitenpfad; an den
              geladenen Kacheln ist zu erkennen, welchen Kartenausschnitt du ansiehst. Weitere Angaben über dich
              schickt die Karte nicht mit. Karten mit solchen Kacheln gibt es an drei Stellen:
            </p>
            <ul className={LISTE}>
              <li>
                auf der Hofübersicht: Im Browserfenster ab 1024 Pixel Breite steht die Karte neben der Liste und lädt
                gleich mit der Seite; auf schmaleren Bildschirmen lädt sie erst in der Kartenansicht — nach{' '}
                <Name>Karte öffnen</Name> oder über einen Link, der direkt dorthin führt;
              </li>
              <li>im Hofbereich die Minikarte im Hofprofil, mit der ein Hof seinen Standort setzt; sie lädt mit der Seite;</li>
              <li>
                im Hofbereich die Karte unter <Name>Region</Name>, sobald dort die Kartenansicht offen ist — auch über
                einen Link, der direkt dorthin führt.
              </li>
            </ul>
          </Abschnitt>

          <Abschnitt id="umkreissuche" titel="Umkreissuche auf der Hofübersicht">
            <p>
              Tippst du auf der Hofübersicht auf <Name>{SUCHFELD_TEXT.standort}</Name>, fragt die Seite deinen Browser nach deinem
              Standort — ob er ihn herausgibt, entscheidest du in seiner Abfrage. Gibst du ihn frei, bleibt er in
              deinem Browser: Er wird nicht an uns und an niemanden sonst übertragen, steht nicht in der Adresse der
              Seite und wird nicht gespeichert, weder auf deinem Gerät noch bei uns. Die Entfernungen zu den Höfen
              rechnet dein Gerät selbst aus den Hofkoordinaten, die mit der Seite ohnehin geladen wurden. Tippst du
              <Name>{SUCHFELD_TEXT.ortAendern}</Name> oder schließt du die Seite, ist er fort. Nach dem Standort fragen darf nur
              die Hofübersicht; alle anderen Seiten sperren die Abfrage.
            </p>
            <p>
              Wählst du dazu einen Umkreis, zeigt auch die Karte nur noch die Höfe darin; ihre Kacheln kommen dann für
              diese Gegend (siehe „Standortsuche und Kartendarstellung“).
            </p>
            <p>
              Gibst du stattdessen eine Postleitzahl oder einen Ort ein, geht diese Eingabe an unseren Server und von
              dort an Nominatim (OpenStreetMap Foundation), um daraus einen Kartenpunkt zu machen — deine IP-Adresse
              erreicht Nominatim dabei nicht, und ein gemessener Standort wird nie übermittelt. Die Suche startet erst,
              wenn du sie absendest; die Eingabe speichern wir nicht.
            </p>
          </Abschnitt>

          <Abschnitt id="meldungen" titel="Fehler- und Wunschmeldungen">
            <p>
              Über <Name>{PROBLEM_MELDEN}</Name> bzw. <Name>{HILFE_UND_RUECKMELDUNG}</Name> kannst du uns Fehler,
              Wünsche und Fragen zur Plattform
              schicken. Gespeichert werden dein Text, die Art der Meldung, die Adresse der Seite, von der du gemeldet
              hast, Browser-Kennung (User-Agent) und Bildschirmgröße sowie der Zeitpunkt — keine IP-Adresse, keine
              Cookies. Bei eingeloggten Höfen wird die Meldung dem Hof zugeordnet; Höfe können freiwillig ein
              Bildschirmfoto anhängen. Als Kundin kannst du freiwillig eine E-Mail-Adresse angeben, ausschließlich für
              Rückfragen — ohne sie bleibt die Meldung anonym.
            </p>
            <p>
              Damit niemand das Formular überflutet, zählen wir die Meldungen ohne Hof-Anmeldung zusätzlich je
              IP-Adresse (Abschnitt 2, „Schutz vor Missbrauch“); dieser Zähler hängt nicht an deiner Meldung.
            </p>
            <p>
              Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse am Betrieb und an der Verbesserung
              der Plattform), für die freiwillige E-Mail-Adresse lit. a (Einwilligung). Erledigte Meldungen werden 90
              Tage nach ihrer Bearbeitung samt Bildschirmfoto gelöscht.
            </p>
          </Abschnitt>

          <p className="border-t border-border pt-6 text-[13px] text-muted-foreground">Stand: Oktober 2026</p>
        </div>
      </div>
    </KundeShellMitSitzung>
  )
}
