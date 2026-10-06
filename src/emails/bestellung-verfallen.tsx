import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, Trenner, h1, bodyText, kleinText } from './_layout'

export interface BestellungVerfallenProps {
  customerName: string
  orderNumber: string
  farmName: string
}

/**
 * Eine Vor-Ort-Bestellung wurde nicht rechtzeitig per Link bestätigt und ist
 * verfallen; ihre Ware ist wieder frei (src/server/verwaiste-bestellungen.ts).
 */
export function BestellungVerfallenEmail(p: BestellungVerfallenProps) {
  return (
    <EmailLayout previewText="Deine Bestellung ist verfallen, weil sie nicht bestätigt wurde">
      <Text style={h1}>Bestellung verfallen</Text>
      <Text style={bodyText}>
        Hallo {p.customerName},<br />
        deine Bestellung <strong>{p.orderNumber}</strong> bei <strong>{p.farmName}</strong> ist
        verfallen, weil sie nicht bestätigt wurde. Wir haben die Ware wieder freigegeben – dir
        entstehen keine Kosten.
      </Text>
      <Text style={bodyText}>Wenn du die Sachen noch möchtest, bestell einfach neu.</Text>

      <Trenner />
      <Text style={kleinText}>Bei Fragen wende dich direkt an {p.farmName}.</Text>
    </EmailLayout>
  )
}
