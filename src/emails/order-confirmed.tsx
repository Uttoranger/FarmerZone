import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, BestellnummerKasten, BetragsZeile, Knopf, KnopfReihe, Trenner, h1, bodyText, kleinText, TelefonFett } from './_layout'
import { formatEuro } from '@/lib/format'
import { formatiereTelefon, telefonLink } from '@/lib/telefon-anzeige'
import { BAR_OHNE_GEBUEHR_SATZ } from '@/lib/konditionen'

export interface OrderConfirmedProps {
  farmerName: string
  customerName: string
  customerPhone: string
  orderNumber: string
  pickupDate: string
  pickupTime: string
  items: Array<{ name: string; quantity: number }>
  /** Der WARENPREIS — der Anteil des Hofes. */
  total: number
  /** Servicegebühr in Euro; 0 = keine Zeile. */
  serviceFee?: number
  /** Das Wort für die Gebühr (N8): „Servicegebühr“ (Vorgabe) oder im Hofpreis-Modell „Plattformgebühr“. */
  gebuehrWort?: string
  /** Bar zu kassieren: Warenpreis + Servicegebühr. */
  barZuKassieren?: number
  /**
   * Bar vor dem SEPA-Start bestellt (Register B1): keine Gebühr, und eine
   * Gebühr älterer Bestellungen zieht die Monatsabrechnung nicht ein.
   */
  barOhneGebuehr?: boolean
  /** Bar (heute) oder Karte bei Abholung (alte Bestellungen, E5) — nur für Überschrift und Vorschau. */
  zahlart?: 'bar' | 'karte'
  /** Zu Heute im Hofbereich (Wortliste N42 c: „Heute“, nie „Dashboard“). */
  heuteUrl: string
}

/**
 * „Bar-Bestellung bestätigt“ an den Hof (Board s3/w3-mail-hof-bestellung Bild 3):
 * Die Kundin hat bestätigt, der Hof kann packen. Was er kassiert, steht als
 * Summenzeile; der Satz darunter sagt, wem die Gebühr darin gehört.
 */
export function OrderConfirmedEmail(p: OrderConfirmedProps) {
  const mitGebuehr = (p.serviceFee ?? 0) > 0
  const wort = p.gebuehrWort ?? 'Servicegebühr'
  const kassieren = p.barZuKassieren ?? p.total
  // Papier und Mail sagen dasselbe wie der Bildschirm (V57): „Bar-Bestellung bestätigt“.
  const titel = p.zahlart === 'karte' ? 'Bestellung bestätigt (Karte bei Abholung)' : 'Bar-Bestellung bestätigt'
  // Die Sätze zur Gebühr sind Geld-Aussagen mit eigenen Tests (bargebuehr.test.ts, bargebuehr-mail.test.ts) — Wortlaut bleibt.
  const gebuehrSatz = mitGebuehr
    ? `davon ${wort} ${formatEuro(p.serviceFee ?? 0)}${p.barOhneGebuehr ? '' : ' — die schuldest du der Monatsabrechnung'}; Warenpreis ${formatEuro(p.total)} bleibt dir.`
    : p.barOhneGebuehr
      ? `${BAR_OHNE_GEBUEHR_SATZ} Der ganze Betrag bleibt dir.`
      : null
  const anrufen = telefonLink(p.customerPhone)
  return (
    <EmailLayout fuss={{ art: 'plattform' }} previewText={`${p.customerName} hat ihre Bestellung bestätigt.`}>
      <Text style={h1}>{titel}</Text>
      <Text style={bodyText}>{`${p.customerName} hat ihre Bestellung per E-Mail bestätigt. Du kannst packen.`}</Text>

      <BestellnummerKasten nummer={p.orderNumber} />
      <BetragsZeile umbrechen links="Abholung" rechts={`${p.pickupDate}, ${p.pickupTime} Uhr`} />
      <Trenner />
      <BetragsZeile stark links="Bar zu kassieren" rechts={formatEuro(kassieren)} />
      {gebuehrSatz && <Text style={{ ...kleinText, marginTop: '6px' }}>{gebuehrSatz}</Text>}
      {/* Die Nummer der Kundin bleibt (Nr. 81): Der Hof ruft an, wenn etwas fehlt. */}
      <BetragsZeile
        umbrechen
        links="Kundin"
        rechts={
          <>
            {`${p.customerName} · `}
            {/* Telefonnummer fett wie in den Mails an die Kundin (Nr. 280): ein Tippen wählt. */}
            <TelefonFett href={anrufen} nummer={anrufen ? formatiereTelefon(p.customerPhone) : p.customerPhone} />
          </>
        }
      />

      <KnopfReihe>
        <Knopf href={p.heuteUrl}>Bei Heute ansehen →</Knopf>
      </KnopfReihe>
    </EmailLayout>
  )
}
