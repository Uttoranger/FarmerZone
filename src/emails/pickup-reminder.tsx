import * as React from 'react'
import { Text, Link } from '@react-email/components'
import { EmailLayout, h1, bodyText, mutedText, highlightBox, highlightLabel, highlightValue, ctaButton } from './_layout'

export interface OrderReadyProps {
  customerName: string
  orderNumber: string
  farmName: string
  farmPhone: string
  farmAddress: string
  farmCity: string
  pickupDate: string
  pickupTime: string
  reorderUrl?: string
}

export function OrderReadyEmail(p: OrderReadyProps) {
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(`${p.farmAddress}, ${p.farmCity}`)}`

  return (
    <EmailLayout previewText={`Deine Bestellung bei ${p.farmName} ist bereit zur Abholung!`}>
      <Text style={h1}>Deine Bestellung ist bereit! 🎉</Text>
      <Text style={bodyText}>
        Hallo {p.customerName},<br />
        deine Bestellung bei <strong>{p.farmName}</strong> ist abholbereit.
        Wir freuen uns auf deinen Besuch!
      </Text>

      <div style={highlightBox}>
        <Text style={highlightLabel}>Abholtermin</Text>
        <Text style={highlightValue}>{p.pickupDate}</Text>
        <Text style={{ ...highlightValue, fontSize: '15px' }}>{p.pickupTime} Uhr</Text>
        <Link href={mapsUrl} style={{ color: '#15803d', fontSize: '13px' }}>
          📍 {p.farmAddress}, {p.farmCity}
        </Link>
      </div>

      <Text style={mutedText}><strong>Bestellnummer:</strong> {p.orderNumber}</Text>
      <Text style={mutedText}>
        Fragen?{' '}
        <Link href={`tel:${p.farmPhone}`} style={{ color: '#15803d' }}>{p.farmPhone}</Link>
      </Text>

      {p.reorderUrl && (
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <Link href={p.reorderUrl} style={{ ...ctaButton, backgroundColor: '#1a4f30', fontSize: '14px', padding: '12px 24px' }}>
            🔁 Nochmal bestellen
          </Link>
        </div>
      )}
    </EmailLayout>
  )
}
