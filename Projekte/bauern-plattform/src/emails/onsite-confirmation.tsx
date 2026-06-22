import * as React from 'react'
import { Text, Link, Hr } from '@react-email/components'
import { EmailLayout, h1, bodyText, mutedText, highlightBox, highlightLabel, highlightValue, ctaButton, amberBox } from './_layout'

export interface OnsiteConfirmationProps {
  customerName: string
  orderNumber: string
  farmName: string
  farmAddress: string
  farmCity: string
  pickupDate: string
  pickupTime: string
  items: Array<{ name: string; quantity: number; unitPrice: number }>
  total: number
  confirmationUrl: string
}

export function OnsiteConfirmationEmail(p: OnsiteConfirmationProps) {
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(`${p.farmAddress}, ${p.farmCity}`)}`

  return (
    <EmailLayout previewText={`Bestellung bei ${p.farmName} bestätigen – Abholung ${p.pickupDate}`}>
      <Text style={h1}>Bestellung verbindlich bestätigen</Text>
      <Text style={bodyText}>
        Hallo {p.customerName},<br />
        du hast eine Bestellung bei <strong>{p.farmName}</strong> aufgegeben.
        Bitte bestätige sie mit einem Klick, damit der Hof sie vorbereiten kann.
      </Text>

      <Link href={p.confirmationUrl} style={ctaButton}>
        Bestellung bestätigen →
      </Link>

      <div style={amberBox}>
        <Text style={{ ...mutedText, margin: 0, fontWeight: '600', color: '#92400e' }}>
          💵 Du bezahlst {`€ ${p.total.toFixed(2)}`} bei der Abholung vor Ort.
        </Text>
      </div>

      <div style={highlightBox}>
        <Text style={highlightLabel}>Abholtermin</Text>
        <Text style={highlightValue}>{p.pickupDate}</Text>
        <Text style={{ ...highlightValue, fontSize: '15px' }}>{p.pickupTime} Uhr</Text>
        <Link href={mapsUrl} style={{ color: '#15803d', fontSize: '13px' }}>
          📍 {p.farmAddress}, {p.farmCity}
        </Link>
      </div>

      <Text style={{ ...mutedText, fontWeight: '600', color: '#374151', margin: '0 0 8px' }}>
        Bestellübersicht
      </Text>
      {p.items.map((item, i) => (
        <Text key={i} style={{ ...mutedText, margin: '2px 0' }}>
          {item.quantity}× {item.name}
          <span style={{ float: 'right' }}>€ {(item.unitPrice * item.quantity).toFixed(2)}</span>
        </Text>
      ))}

      <Hr style={{ borderColor: '#e2e8f0', margin: '16px 0' }} />
      <Text style={mutedText}><strong>Bestellnummer:</strong> {p.orderNumber}</Text>
      <Text style={{ ...mutedText, color: '#94a3b8', fontSize: '12px', marginTop: '16px' }}>
        Falls du diese Bestellung nicht aufgegeben hast, ignoriere diese E-Mail einfach.
        Der Link ist 48 Stunden gültig.
      </Text>
    </EmailLayout>
  )
}
