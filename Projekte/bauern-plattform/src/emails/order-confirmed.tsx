import * as React from 'react'
import { Text, Link } from '@react-email/components'
import { EmailLayout, h1, bodyText, mutedText, highlightBox, highlightLabel, highlightValue, ctaButton, amberBox } from './_layout'

export interface OrderConfirmedProps {
  farmerName: string
  customerName: string
  customerPhone: string
  orderNumber: string
  pickupDate: string
  pickupTime: string
  items: Array<{ name: string; quantity: number }>
  total: number
  dashboardUrl: string
}

export function OrderConfirmedEmail(p: OrderConfirmedProps) {
  return (
    <EmailLayout previewText={`Vor-Ort-Bestellung ${p.orderNumber} bestätigt – ${p.customerName}`}>
      <Text style={h1}>Vor-Ort-Bestellung bestätigt ✓</Text>
      <Text style={bodyText}>
        Hallo {p.farmerName},<br />
        <strong>{p.customerName}</strong> hat ihre Bestellung per E-Mail bestätigt
        und wird zum gewählten Termin abholen.
      </Text>

      <div style={amberBox}>
        <Text style={{ ...mutedText, margin: 0, fontWeight: '600', color: '#92400e' }}>
          💵 Zahlt vor Ort: € {p.total.toFixed(2)}
        </Text>
      </div>

      <div style={highlightBox}>
        <Text style={highlightLabel}>Abholtermin</Text>
        <Text style={highlightValue}>{p.pickupDate}</Text>
        <Text style={{ ...highlightValue, fontSize: '15px' }}>{p.pickupTime} Uhr</Text>
      </div>

      <Text style={{ ...mutedText, fontWeight: '600', color: '#374151', margin: '0 0 8px' }}>
        Bestellte Produkte
      </Text>
      {p.items.map((item, i) => (
        <Text key={i} style={{ ...mutedText, margin: '2px 0' }}>
          • {item.quantity}× {item.name}
        </Text>
      ))}

      <Text style={{ ...mutedText, marginTop: '12px' }}>
        <strong>Bestellnummer:</strong> {p.orderNumber}
      </Text>
      <Text style={mutedText}>
        <strong>Kunde:</strong> {p.customerName} ·{' '}
        <Link href={`tel:${p.customerPhone}`} style={{ color: '#15803d' }}>{p.customerPhone}</Link>
      </Text>

      <Link href={p.dashboardUrl} style={ctaButton}>Im Dashboard ansehen →</Link>
    </EmailLayout>
  )
}
