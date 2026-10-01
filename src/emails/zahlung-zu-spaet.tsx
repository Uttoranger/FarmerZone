import * as React from 'react'
import { Text, Hr } from '@react-email/components'
import { EmailLayout, h1, bodyText, mutedText, highlightBox, highlightLabel, highlightValue } from './_layout'
import { formatEuro } from '@/lib/format'

export interface ZahlungZuSpaetProps {
  customerName: string
  orderNumber: string
  farmName: string
  /** Der erstattete Betrag in Euro. */
  erstattet: number
  supportEmail: string
}

/**
 * Die Zahlung kam an, als die Bestellung schon storniert war — das Geld ging
 * sofort zurück (Webhook, payment_intent.succeeded auf CANCELLED).
 */
export function ZahlungZuSpaetEmail(p: ZahlungZuSpaetProps) {
  return (
    <EmailLayout previewText="Deine Zahlung kam zu spät – das Geld ist zurück">
      <Text style={h1}>Zahlung kam zu spät</Text>
      <Text style={bodyText}>
        Hallo {p.customerName},<br />
        deine Zahlung für die Bestellung <strong>{p.orderNumber}</strong> bei{' '}
        <strong>{p.farmName}</strong> ist angekommen – aber erst, nachdem die Bestellung schon
        storniert war. Deshalb haben wir dir das Geld sofort zurückgeschickt.
      </Text>

      <div style={highlightBox}>
        <Text style={highlightLabel}>Zurück an dich</Text>
        <Text style={highlightValue}>{formatEuro(p.erstattet)}</Text>
        <Text style={{ ...mutedText, margin: 0 }}>
          Das Geld ist in 5–10 Werktagen wieder auf deinem Konto.
        </Text>
      </div>

      <Text style={bodyText}>
        Die Bestellung bleibt storniert, für dich wird nichts zurückgelegt. Wenn du die Sachen
        noch möchtest, bestell einfach neu.
      </Text>

      <Hr style={{ margin: '20px 0' }} />
      <Text style={mutedText}>Bei Fragen schreib uns an {p.supportEmail}.</Text>
    </EmailLayout>
  )
}
