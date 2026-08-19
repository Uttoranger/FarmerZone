import * as React from 'react'
import { Link, Text } from '@react-email/components'
import { EmailLayout, h1, bodyText, mutedText, ctaButton } from './_layout'

export interface FreischaltungProps {
  farmName: string
  /** Vollständige Adresse der öffentlichen Hofseite (mit Ursprung). */
  farmUrl: string
}

/**
 * Die Zusage an den Hof: freigeschaltet, ab sofort öffentlich.
 *
 * Das automatische Glied der Aufnahme — alle Wartetexte der App
 * (farm-approval.ts, erste-schritte.ts, gruendungshof.ts) versprechen genau
 * diese Mail. Ändert sich hier der Ton, gehören die Versprechen mitgeprüft.
 */
export function FreischaltungEmail({ farmName, farmUrl }: FreischaltungProps) {
  return (
    <EmailLayout previewText={`${farmName} ist jetzt öffentlich erreichbar`}>
      <Text style={h1}>Dein Hof ist freigeschaltet 🎉</Text>
      <Text style={bodyText}>
        <strong>{farmName}</strong> ist ab sofort öffentlich erreichbar — Kundinnen können
        deine Hofseite besuchen und bestellen.
      </Text>

      <Link href={farmUrl} style={ctaButton}>
        Zur Hofseite
      </Link>

      <Text style={mutedText}>
        Nächster Schritt: Teile den Link deiner Hofseite — per WhatsApp, am Marktstand oder
        als Aushang. Er lautet {farmUrl}
      </Text>
    </EmailLayout>
  )
}
