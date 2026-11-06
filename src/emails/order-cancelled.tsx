import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, BestellnummerKasten, HinweisKasten, TelefonFett, h1, bodyText, leiseZeile } from './_layout'
import { formatEuro } from '@/lib/format'
import { formatiereTelefon, telefonLink } from '@/lib/telefon-anzeige'

export interface OrderCancelledProps {
  customerName: string
  orderNumber: string
  farmName: string
  /** Telefon des Hofs für „Fragen? Ruf direkt beim Hof an“; fehlt es, bleibt die Zeile weg. */
  farmPhone?: string
  total: number
  /** Erstattet in Euro (stornoBetraege); null = vor Ort bezahlt, nichts zu erstatten. */
  refundAmount: number | null
  cancelReason?: string
}

/** „Deine Bestellung wurde storniert“ (Board s3/w3-mail-storno Bild 1 und 2): Grund, Nummer, Geld, Telefon des Hofs. */
export function OrderCancelledEmail(p: OrderCancelledProps) {
  const wasOnline = p.refundAmount !== null
  const anrufen = p.farmPhone ? telefonLink(p.farmPhone) : null

  return (
    <EmailLayout fuss={{ art: 'hof' }} previewText={`Deine Bestellung ${p.orderNumber} wurde storniert`}>
      <Text style={h1}>Deine Bestellung wurde storniert</Text>
      <Text style={bodyText}>
        {`Hallo ${p.customerName}, deine Bestellung bei ${p.farmName} wurde storniert.`}
        {p.cancelReason ? ` Grund: ${p.cancelReason}` : ''}
      </Text>

      <BestellnummerKasten nummer={p.orderNumber} />

      {wasOnline && p.refundAmount !== null && p.refundAmount > 0 && (
        <HinweisKasten art="gruen">
          Wir haben dir <strong>{formatEuro(p.refundAmount)}</strong> zurückerstattet.
          <br />
          Die Rückerstattung erscheint in 5–10 Werktagen auf deinem Konto.
        </HinweisKasten>
      )}

      {wasOnline && p.refundAmount === 0 && <Text style={bodyText}>Da noch keine Zahlung erfolgt ist, entstehen dir keine Kosten.</Text>}

      {!wasOnline && <Text style={bodyText}>Du hättest bar bezahlt – es ist nichts zu erstatten.</Text>}

      {p.farmPhone ? (
        <Text style={leiseZeile}>
          Fragen? Ruf direkt beim Hof an: <TelefonFett href={anrufen} nummer={anrufen ? formatiereTelefon(p.farmPhone) : p.farmPhone} />
        </Text>
      ) : (
        <Text style={leiseZeile}>{`Bei Fragen wende dich direkt an ${p.farmName}.`}</Text>
      )}
    </EmailLayout>
  )
}
