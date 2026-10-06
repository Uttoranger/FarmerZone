import * as React from 'react'
import { Text, Link } from '@react-email/components'
import { EmailLayout, h1, bodyText, mutedText, highlightBox, highlightLabel, highlightValue, ctaButton, amberBox, textLink, MAIL_FARBE } from './_layout'
import { formatEuro } from '@/lib/format'

export interface OrderConfirmedProps {
  farmerName: string
  customerName: string
  customerPhone: string
  orderNumber: string
  pickupDate: string
  pickupTime: string
  items: Array<{ name: string; quantity: number }>
  /** Der WARENPREIS — der Anteil des Hofes. */
  total: number
  /** Servicegebühr in Euro; 0 = keine Zeile. */
  serviceFee?: number
  /** Bar zu kassieren: Warenpreis + Servicegebühr. */
  barZuKassieren?: number
  dashboardUrl: string
}

export function OrderConfirmedEmail(p: OrderConfirmedProps) {
  const mitGebuehr = (p.serviceFee ?? 0) > 0
  const kassieren = p.barZuKassieren ?? p.total
  return (
    <EmailLayout previewText={`Vor-Ort-Bestellung ${p.orderNumber} bestätigt – ${p.customerName}`}>
      <Text style={h1}>Vor-Ort-Bestellung bestätigt</Text>
      <Text style={bodyText}>
        Hallo {p.farmerName},<br />
        <strong>{p.customerName}</strong> hat ihre Bestellung per E-Mail bestätigt
        und wird zum gewählten Termin abholen.
      </Text>

      <div style={amberBox}>
        <Text style={{ ...mutedText, margin: 0, fontWeight: '600', color: MAIL_FARBE.orangeText }}>
          Bar zu kassieren: {formatEuro(kassieren)}
        </Text>
        {mitGebuehr && (
          <Text style={{ ...mutedText, margin: '4px 0 0', color: MAIL_FARBE.orangeText }}>
            davon Servicegebühr {formatEuro(p.serviceFee ?? 0)} — die schuldest du der
            Monatsabrechnung; Warenpreis {formatEuro(p.total)} bleibt dir.
          </Text>
        )}
      </div>

      <div style={highlightBox}>
        <Text style={highlightLabel}>Abholtermin</Text>
        <Text style={highlightValue}>{p.pickupDate}</Text>
        <Text style={{ ...highlightValue, fontSize: '15px' }}>{p.pickupTime} Uhr</Text>
      </div>

      <Text style={{ ...mutedText, fontWeight: '600', color: MAIL_FARBE.text, margin: '0 0 8px' }}>
        Bestellte Produkte
      </Text>
      {p.items.map((item, i) => (
        <Text key={i} style={{ ...mutedText, margin: '2px 0' }}>
          • {item.name}
        </Text>
      ))}

      <Text style={{ ...mutedText, marginTop: '12px' }}>
        <strong>Bestellnummer:</strong> {p.orderNumber}
      </Text>
      <Text style={mutedText}>
        <strong>Kunde:</strong> {p.customerName} ·{' '}
        <Link href={`tel:${p.customerPhone}`} style={textLink}>{p.customerPhone}</Link>
      </Text>

      <Link href={p.dashboardUrl} style={ctaButton}>Im Dashboard ansehen →</Link>
    </EmailLayout>
  )
}
