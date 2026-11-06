import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, BestellnummerKasten, BetragsZeile, HinweisKasten, Knopf, KnopfReihe, Trenner, h1, bodyText, kleinText, zwischenTitel } from './_layout'
import { formatEuro } from '@/lib/format'

export interface NewOrderNotificationProps {
  farmerName: string
  customerName: string
  customerPhone: string
  orderNumber: string
  pickupDate: string
  pickupTime: string
  /** Positionen; mit `betrag` (Endpreis der Zeile in Euro, gerechnet in src/lib/email.ts) steht er rechts. */
  items: Array<{ name: string; quantity: number; betrag?: number }>
  /** Der WARENPREIS — das, was dem Hof überwiesen wird. */
  total: number
  /** Servicegebühr in Euro (von der Plattform einbehalten); 0 = keine Zeile. */
  serviceFee?: number
  /** Das Wort für die Gebühr (N8): „Servicegebühr“ (Vorgabe) oder im Hofpreis-Modell „Plattformgebühr“. */
  gebuehrWort?: string
  /** Was die Kundin bezahlt hat: Warenpreis + Servicegebühr. */
  customerTotal?: number
  paymentLabel: string
  isOnline: boolean
  /** Zu Heute im Hofbereich (Wortliste N42 c: „Heute“, nie „Dashboard“). */
  heuteUrl: string
}

/**
 * „Neue bezahlte Bestellung“ an den Hof (Board s3/w3-mail-hof-bestellung Bild 1;
 * Bild 2 ist der Zweig ohne Online-Zahlung). Aufbau wie die Bestellmails der
 * Kundin: Nummer groß, Abholung, Produkte mit Preis, darunter der Anteil des Hofs.
 */
export function NewOrderNotificationEmail(p: NewOrderNotificationProps) {
  const mitGebuehr = (p.serviceFee ?? 0) > 0
  const wort = p.gebuehrWort ?? 'Servicegebühr'
  const kassieren = p.customerTotal ?? p.total
  return (
    <EmailLayout fuss={{ art: 'plattform' }} previewText={p.isOnline ? `${p.customerName} hat bestellt und online bezahlt.` : `${p.customerName} hat bestellt, bar bei Abholung.`}>
      <Text style={h1}>{p.isOnline ? 'Neue bezahlte Bestellung' : 'Neue Bestellung eingegangen'}</Text>
      <Text style={bodyText}>
        {`Hallo ${p.farmerName}, ${p.customerName} hat eine Bestellung aufgegeben.`}
        {p.isOnline ? ' Die Zahlung wurde bereits online abgewickelt.' : ` Die Zahlung (${p.paymentLabel}) erfolgt bei der Abholung.`}
      </Text>

      <BestellnummerKasten nummer={p.orderNumber} />
      <BetragsZeile umbrechen links="Abholung" rechts={`${p.pickupDate}, ${p.pickupTime} Uhr`} />

      {/* Bar: Erst die Bestätigung der Kundin gibt die Bestellung zum Packen frei. */}
      {!p.isOnline && <HinweisKasten art="orange">{`${p.customerName} bestätigt die Bestellung per E-Mail. Erst dann packst du.`}</HinweisKasten>}

      {p.isOnline && <Text style={{ ...zwischenTitel, margin: '12px 0 4px' }}>Bestellte Produkte</Text>}
      {p.items.map((item, i) => (
        <BetragsZeile key={i} links={item.name} rechts={item.betrag !== undefined ? formatEuro(item.betrag) : ''} />
      ))}
      <Trenner />
      {p.isOnline ? (
        <>
          <BetragsZeile stark links={mitGebuehr ? 'Warenpreis (dein Anteil)' : 'Gesamtbetrag'} rechts={formatEuro(p.total)} />
          {mitGebuehr && <BetragsZeile links={wort} rechts={formatEuro(p.serviceFee ?? 0)} />}
          {mitGebuehr && <Text style={{ ...kleinText, marginTop: '6px' }}>{`Die ${wort} behält Stripe gleich ein. Die Kundin hat ${formatEuro(kassieren)} bezahlt.`}</Text>}
        </>
      ) : (
        <BetragsZeile stark links="Bar zu kassieren" rechts={formatEuro(kassieren)} />
      )}

      <KnopfReihe>
        <Knopf href={p.heuteUrl}>Bei Heute ansehen →</Knopf>
      </KnopfReihe>
    </EmailLayout>
  )
}
