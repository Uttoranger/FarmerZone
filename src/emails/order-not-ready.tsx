import * as React from 'react'
import { Text, Link } from '@react-email/components'
import { EmailLayout, BetragsZeile, Knopf, KnopfReihe, h1, bodyText, kleinText, textLink } from './_layout'

// "Kurzes Update" nach einem Fertig-Rückschritt (bestellungen-undo-2):
// neutral-freundlich, kein Schuld-Ton — die Bestellung ist doch noch nicht
// abholbereit, die nächste Abholbereit-Mail kommt wie gewohnt.
export interface OrderNotReadyProps {
  orderNumber: string
  farmName: string
  farmPhone: string
  farmAddress: string
  farmCity: string
  pickupDate: string
  pickupTime: string
  /** Google-Maps-Suche nach der Hofadresse (buildMapsUrl). */
  routeUrl: string
}

export function OrderNotReadyEmail(p: OrderNotReadyProps) {
  return (
    <EmailLayout previewText={`Kurzes Update zu deiner Bestellung bei ${p.farmName}`}>
      <Text style={h1}>Kurzes Update zu deiner Bestellung</Text>
      <Text style={bodyText}>
        {`Deine Bestellung bei ${p.farmName} ist doch noch nicht abholbereit. Wir melden uns, sobald sie fertig ist – dein Abholtermin bleibt wie geplant.`}
      </Text>

      <BetragsZeile links="Bestellnummer" rechts={p.orderNumber} />
      <BetragsZeile umbrechen links="Abholung" rechts={`${p.pickupDate}, ${p.pickupTime} Uhr`} />
      <BetragsZeile umbrechen links="Adresse" rechts={`${p.farmAddress}, ${p.farmCity}`} />

      <KnopfReihe>
        <Knopf href={p.routeUrl} art="rahmen">
          Route planen
        </Knopf>
      </KnopfReihe>

      <Text style={kleinText}>
        Fragen?{' '}
        <Link href={`tel:${p.farmPhone}`} style={textLink}>
          {p.farmPhone}
        </Link>
      </Text>
    </EmailLayout>
  )
}
