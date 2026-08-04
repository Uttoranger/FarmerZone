import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, h1, bodyText, mutedText, highlightBox, highlightLabel, highlightValue } from './_layout'

export interface NewFarmNotificationProps {
  farmName: string
  farmId: string
  farmSlug: string
  ownerEmail: string
  registeredAt: string
}

/** Betreiber-Benachrichtigung: ein neuer Hof wartet auf Freischaltung. */
export function NewFarmNotificationEmail({
  farmName,
  farmId,
  farmSlug,
  ownerEmail,
  registeredAt,
}: NewFarmNotificationProps) {
  return (
    <EmailLayout previewText={`Neuer Hof wartet auf Freischaltung: ${farmName}`}>
      <Text style={h1}>Neuer Hof registriert 🌱</Text>
      <Text style={bodyText}>
        <strong>{farmName}</strong> hat sich registriert und wartet auf die Freischaltung.
        Bis dahin ist die Hofseite öffentlich nicht erreichbar.
      </Text>

      <div style={highlightBox}>
        <Text style={highlightLabel}>Hof-ID</Text>
        <Text style={{ ...highlightValue, fontFamily: 'monospace' }}>{farmId}</Text>

        <Text style={{ ...highlightLabel, marginTop: '14px' }}>Adresse der Hofseite</Text>
        <Text style={highlightValue}>/{farmSlug}</Text>

        <Text style={{ ...highlightLabel, marginTop: '14px' }}>Inhaber</Text>
        <Text style={highlightValue}>{ownerEmail}</Text>

        <Text style={{ ...highlightLabel, marginTop: '14px' }}>Registriert am</Text>
        <Text style={highlightValue}>{registeredAt}</Text>
      </div>

      <Text style={mutedText}>
        Freischalten im Admin-Bereich unter /admin.
      </Text>
    </EmailLayout>
  )
}
