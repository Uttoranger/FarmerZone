import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, BetragsZeile, Knopf, KnopfReihe, h1 } from './_layout'

export interface NewFarmNotificationProps {
  farmName: string
  farmId: string
  farmSlug: string
  ownerEmail: string
  registeredAt: string
  /** Admin › Höfe — dort wird freigeschaltet. Fehlt die Adresse, bleibt der Knopf weg. */
  pruefenUrl?: string
}

/**
 * Betreiber-Benachrichtigung: ein neuer Hof wartet auf Freischaltung (Board
 * s3/w3-mail-betrieb Bild 1) — Zeilen statt Kasten, der Weg in die Höfe als Knopf.
 * Die Anmelde-Adresse steht nicht in der Mail: Wer freischaltet, sieht sie in der Akte.
 */
export function NewFarmNotificationEmail({ farmName, registeredAt, pruefenUrl }: NewFarmNotificationProps) {
  return (
    <EmailLayout fuss={{ art: 'betrieb' }} previewText={`${farmName} hat sich registriert.`}>
      <Text style={h1}>Neuer Hof registriert</Text>
      <BetragsZeile umbrechen links="Hof" rechts={farmName} />
      <BetragsZeile umbrechen links="Angemeldet" rechts={registeredAt} />
      {pruefenUrl && (
        <KnopfReihe>
          <Knopf href={pruefenUrl}>In Höfe prüfen →</Knopf>
        </KnopfReihe>
      )}
    </EmailLayout>
  )
}
