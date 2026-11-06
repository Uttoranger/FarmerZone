import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, Knopf, KnopfReihe, h1, bodyText } from './_layout'

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
    <EmailLayout fuss={{ art: 'plattform' }} previewText={`${farmName} ist ab sofort öffentlich erreichbar.`}>
      <Text style={h1}>Dein Hof ist freigeschaltet</Text>
      <Text style={bodyText}>{`${farmName} ist ab sofort öffentlich erreichbar und kann Bestellungen entgegennehmen.`}</Text>
      <KnopfReihe>
        <Knopf href={farmUrl}>Zur Hofseite</Knopf>
      </KnopfReihe>
      <Text style={bodyText}>Nächster Schritt: Teile den Link zu deiner Hofseite mit deiner Kundschaft – zum Beispiel per WhatsApp oder als QR-Plakat.</Text>
    </EmailLayout>
  )
}
