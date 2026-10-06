import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, h1, bodyText, mutedText, highlightBox, highlightLabel, highlightValue } from './_layout'

export interface ErstattungOffenProps {
  /** Was passiert ist — ein Satz. */
  was: string
  bestellnummer: string | null
  bestellId: string | null
  hofName: string | null
  /** Schon formatierte Beträge („€ 5,00"). */
  betraege: Array<{ label: string; wert: string }>
  handanweisung: string
  /** Die Kennung der Erstattung bei Stripe (re_…), falls bekannt. */
  stripeKennung: string | null
}

/**
 * Betreiber-Meldung: Geld an eine Kundin steht aus (Storno ohne Erstattung,
 * später gescheiterte Erstattung). Bewusst ohne Name und Adresse der Kundin —
 * die Bestellnummer genügt zum Wiederfinden.
 */
export function ErstattungOffenEmail(p: ErstattungOffenProps) {
  return (
    <EmailLayout previewText={`Erstattung offen${p.bestellnummer ? ` – Bestellung ${p.bestellnummer}` : ''}`}>
      <Text style={h1}>Erstattung offen</Text>
      <Text style={bodyText}>{p.was}</Text>

      <div style={highlightBox}>
        <Text style={highlightLabel}>Bestellung</Text>
        <Text style={highlightValue}>{p.bestellnummer ?? 'unbekannt'}</Text>

        {p.bestellId && (
          <>
            <Text style={{ ...highlightLabel, marginTop: '14px' }}>Bestell-ID</Text>
            <Text style={{ ...highlightValue, fontFamily: 'monospace' }}>{p.bestellId}</Text>
          </>
        )}

        {p.hofName && (
          <>
            <Text style={{ ...highlightLabel, marginTop: '14px' }}>Hof</Text>
            <Text style={highlightValue}>{p.hofName}</Text>
          </>
        )}

        {p.stripeKennung && (
          <>
            <Text style={{ ...highlightLabel, marginTop: '14px' }}>Erstattung bei Stripe</Text>
            <Text style={{ ...highlightValue, fontFamily: 'monospace' }}>{p.stripeKennung}</Text>
          </>
        )}

        {p.betraege.map((b) => (
          <React.Fragment key={b.label}>
            <Text style={{ ...highlightLabel, marginTop: '14px' }}>{b.label}</Text>
            <Text style={highlightValue}>{b.wert}</Text>
          </React.Fragment>
        ))}
      </div>

      <Text style={bodyText}>
        <strong>Was zu tun ist:</strong> {p.handanweisung}
      </Text>
      <Text style={mutedText}>Erstatten kann nur das Plattformkonto – der Hof hat dort keinen Zugang.</Text>
    </EmailLayout>
  )
}
