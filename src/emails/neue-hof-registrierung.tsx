import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, h1, bodyText, mutedText } from './_layout'

export interface NeueHofRegistrierungProps {
  farmName: string
  farmId: string
  farmSlug: string
  ownerEmail: string
  registriertAm: string
}

/**
 * Betreiber-Benachrichtigung: ein neuer Hof wartet auf die Freischaltung.
 * Geht ausschließlich an die Support-Adresse des Betreibers, nie an Kundinnen —
 * deshalb steht hier die Inhaber-Adresse bewusst im Klartext.
 */
export function NeueHofRegistrierungEmail({
  farmName,
  farmId,
  farmSlug,
  ownerEmail,
  registriertAm,
}: NeueHofRegistrierungProps) {
  return (
    <EmailLayout previewText={`Neuer Hof wartet auf Freischaltung: ${farmName}`}>
      <Text style={h1}>Neuer Hof wartet auf Freischaltung 🌱</Text>
      <Text style={bodyText}>
        Ein Hof hat sich registriert und wartet auf deine Freigabe im Admin-Bereich.
      </Text>

      <Text style={bodyText}>
        <strong>Hof:</strong> {farmName}
        <br />
        <strong>Hof-ID:</strong> {farmId}
        <br />
        <strong>Slug:</strong> {farmSlug}
        <br />
        <strong>Inhaber-E-Mail:</strong> {ownerEmail}
        <br />
        <strong>Registriert am:</strong> {registriertAm}
      </Text>

      <Text style={mutedText}>
        Solange der Hof nicht freigeschaltet ist, ist seine Hofseite nicht erreichbar und es sind
        keine Bestellungen möglich. Der Bauer kann seinen Hof in der Zwischenzeit vollständig
        einrichten.
      </Text>
    </EmailLayout>
  )
}
