import * as React from 'react'
import { WIDERRUF_TEXT, type Belehrung } from '@/lib/widerruf'
import { BelehrungTeil } from './belehrung-teil'
import { Text, Link } from '@react-email/components'
import {
  EmailLayout,
  BestellnummerKasten,
  BetragsZeile,
  HinweisKasten,
  Knopf,
  KnopfReihe,
  TelefonFett,
  Trenner,
  h1,
  bodyText,
  kleinText,
  leiseZeile,
  textLink,
  woZeile,
} from './_layout'
import { formatEuro } from '@/lib/format'
import { inklPlattformgebuehrSatz } from '@/lib/konditionen'
import { formatiereTelefon, telefonLink } from '@/lib/telefon-anzeige'
import { MAIL_AGB_ZEILE } from '@/lib/rechtstexte/agb-einbindung'
import { AGB_BISHER, type AgbKennung } from '@/lib/rechtstexte/agb-fassung'
import { PRODUKTION_ADRESSE } from '@/lib/umgebung'

/** Wie bezahlt wird — entscheidet nur der Satz und die Gesamtzeile, nie der Betrag. */
export type MailZahlart = 'online' | 'bar' | 'karte'

export interface OrderConfirmationProps {
  orderNumber: string
  farmName: string
  farmPhone: string
  farmAddress: string
  farmCity: string
  /** PLZ des Hofs für die Zeile „Wo“; fehlt sie, steht nur der Ort. */
  farmPostalCode?: string
  pickupDate: string
  pickupTime: string
  /** Online bezahlt (Webhook) oder vor Ort bestätigt (Bar-Knopf, alte Karte-Bestellungen). */
  zahlart: MailZahlart
  /** Positionen mit fertig gerechnetem Zeilenbetrag in Euro (src/lib/email.ts, über Decimal). */
  items: Array<{ name: string; betrag: number }>
  /**
   * Die Gebührenzeile im Modell „bisher“ (N38): Wort und Erklärsatz der
   * Bestellung (gebuehrWort, gebuehrHinweisFuer in src/lib/email.ts) und der
   * Betrag in Euro aus dem Snapshot. Fehlt sie, gibt es keine Zeile — im
   * Hofpreis-Modell steckt die Gebühr in den Preisen (`plattformgebuehr`).
   */
  gebuehrZeile?: { wort: string; betrag: number; hinweis: string }
  /** Hofpreis-Modell (N38): die Plattformgebühr in Euro, schon in den Zeilen enthalten; 0 oder fehlend = kein Satz. */
  plattformgebuehr?: number
  /** Was die Kundin zahlt bzw. gezahlt hat: Warenpreis + Gebühr. */
  total: number
  /** Google-Maps-Suche nach der Hofadresse (buildMapsUrl). */
  routeUrl: string
  manageUrl?: string
  /** Der signierte Link zur Bestellseite — der Weg zurück zur Bestellung. */
  orderUrl?: string
  /** „Vertrag widerrufen“ (Nr. 200): signierter Link, nur bei Verbraucherinnen. */
  widerrufUrl?: string
  /**
   * Die Belehrung nach Anhang I FAGG mit den Angaben des Hofs (Nr. 207) —
   * fertig gefüllt (belehrungMitHof), nur bei Verbraucherinnen; bei „Betrieb“
   * fehlt sie, der Anhang mit den AGB bleibt.
   */
  belehrung?: Belehrung
  /** Die Fassung der AGB dieser Bestellung (N45, aus ihrem Snapshot): Link und Anhang zeigen dieselbe. Ohne Angabe 0.9. */
  agbFassung?: AgbKennung
  /** Die Adresse der Seite für den Link auf die AGB; ohne Angabe die echte Seite. */
  appUrl?: string
}

const GESAMT_LABEL: Record<MailZahlart, string> = {
  online: 'Online bezahlt',
  bar: 'Bar bei Abholung',
  karte: 'Karte bei Abholung',
}

/**
 * „Danke für deine Bestellung!" — Mail 1 aus dem Mockup
 * web-k3-e-mails-web-mobil. Geht nach der Online-Zahlung (Webhook) UND nach
 * der Bar-Bestätigung per Knopf (bar-bestaetigung.ts): Satz und Gesamtzeile
 * folgen deshalb der Zahlart — eine bar bestätigte Bestellung ist nicht
 * „bezahlt". Vertragsmail ohne Werbung (S11): kein „Nochmal bestellen".
 */
export function OrderConfirmationEmail(p: OrderConfirmationProps): React.JSX.Element {
  const anrufen = telefonLink(p.farmPhone)
  const gebuehr = p.gebuehrZeile && p.gebuehrZeile.betrag > 0 ? p.gebuehrZeile : null
  const satz =
    p.zahlart === 'online'
      ? `Deine Zahlung ist angekommen – ${p.farmName} packt deine Sachen.`
      : `Deine Bestellung ist bestätigt – ${p.farmName} packt deine Sachen.`

  return (
    <EmailLayout fuss={{ art: 'hof' }} previewText={`Bestellung ${p.orderNumber} – Abholung ${p.pickupDate}, ${p.pickupTime} Uhr`} manageUrl={p.manageUrl}>
      <Text style={h1}>Danke für deine Bestellung!</Text>
      <Text style={bodyText}>{`${satz} Nenn bei der Abholung einfach deine Bestellnummer:`}</Text>

      <BestellnummerKasten nummer={p.orderNumber} />

      <BetragsZeile umbrechen links="Abholung" rechts={`${p.pickupDate}, ${p.pickupTime} Uhr`} />
      <BetragsZeile umbrechen links="Wo" rechts={woZeile(p.farmName, p.farmAddress, p.farmPostalCode, p.farmCity)} />
      <Trenner />
      {p.items.map((item, i) => (
        <BetragsZeile key={i} links={item.name} rechts={formatEuro(item.betrag)} />
      ))}
      {gebuehr && <BetragsZeile links={gebuehr.wort} rechts={formatEuro(gebuehr.betrag)} />}
      <Trenner />
      <BetragsZeile stark links={GESAMT_LABEL[p.zahlart]} rechts={formatEuro(p.total)} />

      {/* Board s3/w3-mail-kauf Bild 3: was die Kundin mitbringt, als grüne Karte direkt unter dem Betrag. */}
      {p.zahlart === 'bar' && (
        <HinweisKasten art="gruen">
          Bring bitte <strong>{formatEuro(p.total)}</strong> in bar mit.
        </HinweisKasten>
      )}
      {p.zahlart === 'karte' && (
        <HinweisKasten art="gruen">
          Bitte zahle <strong>{formatEuro(p.total)}</strong> bei der Abholung mit Karte.
        </HinweisKasten>
      )}
      {(p.plattformgebuehr ?? 0) > 0 && <Text style={kleinText}>{inklPlattformgebuehrSatz(formatEuro(p.plattformgebuehr ?? 0))}</Text>}
      {gebuehr && <Text style={kleinText}>{`${gebuehr.wort}: ${gebuehr.hinweis}`}</Text>}

      <KnopfReihe>
        {/* Der Weg zurück zur Bestellung, wenn der Tab längst zu ist: Status,
            Abholzeit, Positionen und Kalendereintrag — ohne Anmeldung. */}
        {p.orderUrl && <Knopf href={p.orderUrl}>Bestellung ansehen</Knopf>}
        <Knopf href={p.routeUrl} art={p.orderUrl ? 'rahmen' : 'gruen'}>
          Route planen
        </Knopf>
      </KnopfReihe>

      {/* Register O4: Die AGB gehören zum Vertragstext (§ 11 ECG). Satz und Link als Stücke,
          die abwechselnd Text und Link sind — nebeneinander stehende Textteile trennt
          react-email mit Kommentaren. */}
      <Text style={kleinText}>
        {MAIL_AGB_ZEILE(p.agbFassung ?? AGB_BISHER).map((stueck, i) =>
          typeof stueck === 'string' ? (
            stueck
          ) : (
            <Link key={i} href={`${p.appUrl ?? PRODUKTION_ADRESSE}${stueck.ziel}`} style={textLink}>
              {stueck.text}
            </Link>
          )
        )}
      </Text>
      <Text style={leiseZeile}>
        Fragen? Ruf direkt beim Hof an: <TelefonFett href={anrufen} nummer={anrufen ? formatiereTelefon(p.farmPhone) : p.farmPhone} />
      </Text>
      {/* Nr. 200 (N39): der Weg zum Widerruf online — signiert, ohne Anmeldung. Mit Belehrung steht er unter ihr. */}
      {p.widerrufUrl && !p.belehrung && (
        <Text style={kleinText}>
          <Link href={p.widerrufUrl} style={textLink}>
            {WIDERRUF_TEXT.knopfWiderrufen}
          </Link>
        </Text>
      )}
      {/* Nr. 207: Teil A, Teil B, Hinweis zur Rückgabe am Hof und der Link zum Widerruf. */}
      {p.belehrung && <BelehrungTeil belehrung={p.belehrung} widerrufUrl={p.widerrufUrl} />}
    </EmailLayout>
  )
}
