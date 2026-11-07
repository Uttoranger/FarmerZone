import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, BetragsZeile, Knopf, KnopfReihe, h1 } from './_layout'

export interface NewFarmNotificationProps {
  farmName: string
  farmId: string
  farmSlug: string
  ownerEmail: string
  registeredAt: string
  /** „5230 Mattighofen“ hinter dem Namen (Board Bild 1); fehlt er, nur der Name. */
  farmOrt?: string
  /** Was zum Verkaufen noch fehlt; leer = keine Zeile „Fehlt noch“. */
  fehlt?: string[]
  /** Admin › Höfe — dort wird freigeschaltet. Fehlt die Adresse, bleibt der Knopf weg. */
  pruefenUrl?: string
}

/**
 * Betreiber-Benachrichtigung: ein neuer Hof wartet auf Freischaltung (Board
 * s3/w3-mail-betrieb Bild 1) — Zeilen statt Kasten, der Weg in die Höfe als Knopf.
 * Die Anmelde-Adresse steht nicht in der Mail: Wer freischaltet, sieht sie in der Akte.
 */
export function NewFarmNotificationEmail({ farmName, farmOrt, registeredAt, fehlt, pruefenUrl }: NewFarmNotificationProps) {
  return (
    <EmailLayout fuss={{ art: 'betrieb' }} previewText={`${farmName} hat sich registriert.`}>
      <Text style={h1}>Neuer Hof registriert</Text>
      <BetragsZeile umbrechen links="Hof" rechts={farmOrt ? `${farmName}, ${farmOrt}` : farmName} />
      <BetragsZeile umbrechen links="Angemeldet" rechts={registeredAt} />
      {fehlt && fehlt.length > 0 && <BetragsZeile umbrechen links="Fehlt noch" rechts={fehlt.join(', ')} />}
      {pruefenUrl && (
        <KnopfReihe>
          <Knopf href={pruefenUrl}>In Höfe prüfen →</Knopf>
        </KnopfReihe>
      )}
    </EmailLayout>
  )
}
