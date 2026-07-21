import * as React from 'react'
import { Text, Link } from '@react-email/components'
import { EmailLayout, h1, bodyText, mutedText, highlightBox, highlightLabel, highlightValue } from './_layout'

// "Kurzes Update" nach einem Fertig-Rückschritt (bestellungen-undo-2):
// neutral-freundlich, kein Schuld-Ton — die Bestellung ist doch noch nicht
// abholbereit, die nächste Abholbereit-Mail kommt wie gewohnt.
export interface OrderNotReadyProps {
  customerName: string
  orderNumber: string
  farmName: string
  farmPhone: string
  farmAddress: string
  farmCity: string
  pickupDate: string
  pickupTime: string
}

export function OrderNotReadyEmail(p: OrderNotReadyProps) {
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(`${p.farmAddress}, ${p.farmCity}`)}`

  return (
    <EmailLayout previewText={`Kurzes Update zu deiner Bestellung bei ${p.farmName}`}>
      <Text style={h1}>Kurzes Update zu deiner Bestellung</Text>
      <Text style={bodyText}>
        Hallo {p.customerName},<br />
        deine Bestellung bei <strong>{p.farmName}</strong> ist doch noch nicht
        abholbereit. Wir melden uns, sobald sie fertig ist — dein Abholtermin
        bleibt wie geplant.
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
    </EmailLayout>
  )
}
