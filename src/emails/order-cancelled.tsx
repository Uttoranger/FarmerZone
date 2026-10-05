import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, Trenner, gruenBox, h1, bodyText, mutedText, kleinText, MAIL_FARBE } from './_layout'
import { formatEuro } from '@/lib/format'

export interface OrderCancelledProps {
  customerName: string
  orderNumber: string
  farmName: string
  total: number
  /** Erstattet in Euro (stornoBetraege); null = vor Ort bezahlt, nichts zu erstatten. */
  refundAmount: number | null
  cancelReason?: string
}

export function OrderCancelledEmail(p: OrderCancelledProps) {
  const wasOnline = p.refundAmount !== null

  return (
    <EmailLayout previewText={`Deine Bestellung ${p.orderNumber} wurde storniert`}>
      <Text style={h1}>Bestellung storniert</Text>
      <Text style={bodyText}>
        Hallo {p.customerName},<br />
        deine Bestellung <strong>{p.orderNumber}</strong> bei <strong>{p.farmName}</strong> wurde storniert.
        {p.cancelReason ? ` Grund: ${p.cancelReason}` : ''}
      </Text>

      {wasOnline && p.refundAmount !== null && p.refundAmount > 0 && (
        <div style={gruenBox}>
          <Text style={{ ...bodyText, margin: 0, color: MAIL_FARBE.text, fontWeight: '600' }}>
            {`Wir haben dir ${formatEuro(p.refundAmount)} zurückerstattet.`}
          </Text>
          <Text style={{ ...mutedText, margin: '6px 0 0' }}>
            Die Rückerstattung erscheint in 5–10 Werktagen auf deinem Konto.
          </Text>
        </div>
      )}

      {wasOnline && p.refundAmount === 0 && (
        <Text style={bodyText}>Da noch keine Zahlung erfolgt ist, entstehen dir keine Kosten.</Text>
      )}

      {!wasOnline && <Text style={bodyText}>Da du vor Ort bezahlst, entstehen dir keine Kosten.</Text>}

      <Trenner />
      <Text style={kleinText}>Bei Fragen wende dich direkt an {p.farmName}.</Text>
    </EmailLayout>
  )
}
