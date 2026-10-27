import * as React from 'react'
import { Text, Link } from '@react-email/components'
import {
  EmailLayout,
  BestellnummerKasten,
  BetragsZeile,
  Knopf,
  KnopfReihe,
  Trenner,
  h1,
  bodyText,
  kleinText,
  textLink,
} from './_layout'
import { SERVICEGEBUEHR_BEZEICHNUNG, SERVICEGEBUEHR_HINWEIS } from '@/lib/servicegebuehr'
import { formatEuro } from '@/lib/format'
import { inklPlattformgebuehrSatz } from '@/lib/konditionen'
import { formatiereTelefon, telefonLink } from '@/lib/telefon-anzeige'
import { MAIL_AGB_ZEILE } from '@/lib/rechtstexte/agb-einbindung'
import { PRODUKTION_ADRESSE } from '@/lib/umgebung'

/** Wie bezahlt wird — entscheidet nur der Satz und die Gesamtzeile, nie der Betrag. */
export type MailZahlart = 'online' | 'bar' | 'karte'

export interface OrderConfirmationProps {
  orderNumber: string
  farmName: string
  farmPhone: string
  farmAddress: string
  farmCity: string
  pickupDate: string
  pickupTime: string
  /** Online bezahlt (Webhook) oder vor Ort bestätigt (Bar-Knopf, alte Karte-Bestellungen). */
  zahlart: MailZahlart
  /** Positionen mit fertig gerechnetem Zeilenbetrag in Euro (src/lib/email.ts, über Decimal). */
  items: Array<{ name: string; betrag: number }>
  /** Servicegebühr in Euro aus dem Snapshot; 0 oder fehlend = keine Zeile. */
  serviceFee?: number
  /** Hofpreis-Modell (N38): die Plattformgebühr in Euro, schon in den Zeilen enthalten; 0 oder fehlend = kein Satz. */
  plattformgebuehr?: number
  /** Was die Kundin zahlt bzw. gezahlt hat: Warenpreis + Servicegebühr. */
  total: number
  /** Google-Maps-Suche nach der Hofadresse (buildMapsUrl). */
  routeUrl: string
  manageUrl?: string
  /** Der signierte Link zur Bestellseite — der Weg zurück zur Bestellung. */
  orderUrl?: string
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
  const mitGebuehr = (p.serviceFee ?? 0) > 0
  const satz =
    p.zahlart === 'online'
      ? `Deine Zahlung ist angekommen – ${p.farmName} packt deine Sachen.`
      : `Deine Bestellung ist bestätigt – ${p.farmName} packt deine Sachen.`

  return (
    <EmailLayout previewText={`Bestellung ${p.orderNumber} – Abholung ${p.pickupDate}, ${p.pickupTime} Uhr`} manageUrl={p.manageUrl}>
      <Text style={h1}>Danke für deine Bestellung!</Text>
      <Text style={bodyText}>{`${satz} Nenn bei der Abholung einfach deine Bestellnummer:`}</Text>

      <BestellnummerKasten nummer={p.orderNumber} />

      <BetragsZeile umbrechen links="Abholung" rechts={`${p.pickupDate}, ${p.pickupTime} Uhr`} />
      <BetragsZeile umbrechen links="Adresse" rechts={`${p.farmAddress}, ${p.farmCity}`} />
      <Trenner />
      {p.items.map((item, i) => (
        <BetragsZeile key={i} links={item.name} rechts={formatEuro(item.betrag)} />
      ))}
      {mitGebuehr && <BetragsZeile links={SERVICEGEBUEHR_BEZEICHNUNG} rechts={formatEuro(p.serviceFee ?? 0)} />}
      <BetragsZeile stark links={GESAMT_LABEL[p.zahlart]} rechts={formatEuro(p.total)} />

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
        {MAIL_AGB_ZEILE.map((stueck, i) =>
          typeof stueck === 'string' ? (
            stueck
          ) : (
            <Link key={i} href={`${p.appUrl ?? PRODUKTION_ADRESSE}${stueck.ziel}`} style={textLink}>
              {stueck.text}
            </Link>
          )
        )}
      </Text>

      {p.zahlart === 'bar' && <Text style={kleinText}>{`Bring bitte ${formatEuro(p.total)} in bar mit.`}</Text>}
      {p.zahlart === 'karte' && <Text style={kleinText}>{`Bitte zahle ${formatEuro(p.total)} bei der Abholung mit Karte.`}</Text>}
      {mitGebuehr && <Text style={kleinText}>{SERVICEGEBUEHR_BEZEICHNUNG}: {SERVICEGEBUEHR_HINWEIS}</Text>}
      {(p.plattformgebuehr ?? 0) > 0 && <Text style={kleinText}>{inklPlattformgebuehrSatz(formatEuro(p.plattformgebuehr ?? 0))}</Text>}
      <Text style={kleinText}>
        Fragen? Ruf direkt beim Hof an:{' '}
        {anrufen ? (
          <Link href={anrufen} style={textLink}>
            {formatiereTelefon(p.farmPhone)}
          </Link>
        ) : (
          p.farmPhone
        )}
      </Text>
    </EmailLayout>
  )
}
