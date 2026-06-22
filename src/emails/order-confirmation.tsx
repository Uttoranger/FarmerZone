import * as React from 'react'
import { Text, Link, Hr } from '@react-email/components'
import { EmailLayout, h1, bodyText, mutedText, highlightBox, highlightLabel, highlightValue } from './_layout'

export interface OrderConfirmationProps {
  customerName: string
  orderNumber: string
  farmName: string
  farmPhone: string
  farmAddress: string
  farmCity: string
  pickupDate: string
  pickupTime: string
  items: Array<{ name: string; quantity: number; unitPrice: number }>
  total: number
}

export function OrderConfirmationEmail(p: OrderConfirmationProps) {
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(`${p.farmAddress}, ${p.farmCity}`)}`

  return (
    <EmailLayout previewText={`Bestellung ${p.orderNumber} bestätigt – Abholung ${p.pickupDate}`}>
      <Text style={h1}>Zahlung erfolgreich ✓</Text>
      <Text style={bodyText}>
        Hallo {p.customerName},<br />
        deine Bestellung bei <strong>{p.farmName}</strong> wurde erfolgreich bezahlt.
      </Text>

      <div style={highlightBox}>
        <Text style={highlightLabel}>Abholtermin</Text>
        <Text style={highlightValue}>{p.pickupDate}</Text>
        <Text style={{ ...highlightValue, fontSize: '15px' }}>{p.pickupTime} Uhr</Text>
        <Link href={mapsUrl} style={{ color: '#15803d', fontSize: '13px' }}>
          📍 {p.farmAddress}, {p.farmCity}
        </Link>
      </div>

      <Text style={{ ...mutedText, fontWeight: '600', color: '#374151', margin: '0 0 8px' }}>
        Deine Bestellung
      </Text>
      {p.items.map((item, i) => (
        <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
          <Text style={{ ...mutedText, margin: 0 }}>
            {item.quantity}× {item.name}
            <span style={{ float: 'right' }}>€ {(item.unitPrice * item.quantity).toFixed(2)}</span>
          </Text>
        </div>
      ))}
      <div style={{ padding: '10px 0 0' }}>
        <Text style={{ ...bodyText, fontWeight: '700', margin: 0 }}>
          Gesamt (bezahlt)
          <span style={{ float: 'right', color: '#15803d' }}>€ {p.total.toFixed(2)}</span>
        </Text>
      </div>

      <Hr style={{ borderColor: '#e2e8f0', margin: '20px 0' }} />
      <Text style={mutedText}><strong>Bestellnummer:</strong> {p.orderNumber}</Text>
      <Text style={mutedText}>
        Fragen? Ruf direkt beim Hof an:{' '}
        <Link href={`tel:${p.farmPhone}`} style={{ color: '#15803d' }}>{p.farmPhone}</Link>
      </Text>
    </EmailLayout>
  )
}
