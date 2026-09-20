import * as React from 'react'
import { Text, Link, Button, Hr } from '@react-email/components'
import { EmailLayout, h1, bodyText, mutedText, highlightBox, highlightLabel, highlightValue, ctaButton } from './_layout'

export interface NewOrderNotificationProps {
  farmerName: string
  customerName: string
  customerPhone: string
  orderNumber: string
  pickupDate: string
  pickupTime: string
  items: Array<{ name: string; quantity: number }>
  /** Der WARENPREIS — das, was dem Hof überwiesen wird. */
  total: number
  /** Servicegebühr in Euro (von der Plattform einbehalten); 0 = keine Zeile. */
  serviceFee?: number
  /** Was die Kundin bezahlt hat: Warenpreis + Servicegebühr. */
  customerTotal?: number
  paymentLabel: string
  isOnline: boolean
  dashboardUrl: string
}

export function NewOrderNotificationEmail(p: NewOrderNotificationProps) {
  const mitGebuehr = (p.serviceFee ?? 0) > 0
  return (
    <EmailLayout previewText={`Neue Bestellung ${p.orderNumber} – ${p.customerName}`}>
      <Text style={h1}>
        {p.isOnline ? '💳 Neue bezahlte Bestellung' : '🛒 Neue Bestellung eingegangen'}
      </Text>
      <Text style={bodyText}>
        Hallo {p.farmerName},<br />
        <strong>{p.customerName}</strong> hat eine Bestellung aufgegeben.
        {p.isOnline
          ? ' Die Zahlung wurde bereits online abgewickelt.'
          : ` Die Zahlung (${p.paymentLabel}) erfolgt bei der Abholung.`}
      </Text>

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
          • {item.name}
        </Text>
      ))}

      <Hr style={{ borderColor: '#e2e8f0', margin: '16px 0' }} />
      <Text style={{ ...bodyText, margin: '0 0 4px' }}>
        <strong>{mitGebuehr ? 'Warenpreis (dein Anteil):' : 'Gesamtbetrag:'}</strong> € {p.total.toFixed(2)}
      </Text>
      {mitGebuehr && (
        <Text style={{ ...mutedText, margin: '0 0 4px' }}>
          <strong>Servicegebühr:</strong> € {(p.serviceFee ?? 0).toFixed(2)} — von der Plattform
          einbehalten, dir wird der Warenpreis überwiesen. Die Kundin hat €{' '}
          {(p.customerTotal ?? p.total).toFixed(2)} bezahlt.
        </Text>
      )}
      <Text style={{ ...mutedText, margin: '0 0 4px' }}>
        <strong>Zahlung:</strong> {p.paymentLabel}
      </Text>
      <Text style={mutedText}>
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
