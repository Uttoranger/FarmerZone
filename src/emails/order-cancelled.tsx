import * as React from 'react'
import { Text, Hr } from '@react-email/components'
import { EmailLayout, h1, bodyText, mutedText } from './_layout'

export interface OrderCancelledProps {
  customerName: string
  orderNumber: string
  farmName: string
  total: number
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
        deine Bestellung <strong>{p.orderNumber}</strong> bei{' '}
        <strong>{p.farmName}</strong> wurde storniert.
        {p.cancelReason ? ` Grund: ${p.cancelReason}` : ''}
      </Text>

      {wasOnline && p.refundAmount !== null && p.refundAmount > 0 && (
        <div style={{
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '10px',
          padding: '16px 20px',
          margin: '20px 0',
        }}>
          <Text style={{ ...bodyText, margin: 0, color: '#15803d', fontWeight: '600' }}>
            💰 Wir haben dir € {p.refundAmount.toFixed(2)} zurückerstattet.
          </Text>
          <Text style={{ ...mutedText, margin: '6px 0 0' }}>
            Die Rückerstattung erscheint in 5–10 Werktagen auf deinem Konto.
          </Text>
        </div>
      )}

      {wasOnline && p.refundAmount === 0 && (
        <Text style={bodyText}>
          Da noch keine Zahlung erfolgt ist, entstehen dir keine Kosten.
        </Text>
      )}

      {!wasOnline && (
        <Text style={bodyText}>
          Da du vor Ort bezahlst, entstehen dir keine Kosten.
        </Text>
      )}

      <Hr style={{ borderColor: '#e2e8f0', margin: '20px 0' }} />
      <Text style={mutedText}>
        Bei Fragen wende dich direkt an {p.farmName}.
      </Text>
    </EmailLayout>
  )
}
