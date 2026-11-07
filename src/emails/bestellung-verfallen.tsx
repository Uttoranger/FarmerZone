import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, BestellnummerKasten, h1, bodyText } from './_layout'
import { VERFALLEN_TEXT as T } from './texte/verfallen'

export interface BestellungVerfallenProps {
  customerName: string
  orderNumber: string
  farmName: string
  /** „Mittwoch, 3. März, 09:40 Uhr“ — die verstrichene Frist (fristVon, zeitpunktFuerMail); fehlt sie, „nicht rechtzeitig“. */
  bestaetigenBis?: string
}

/**
 * Eine Vor-Ort-Bestellung wurde nicht rechtzeitig per Link bestätigt und ist
 * verfallen; ihre Ware ist wieder frei (src/server/verwaiste-bestellungen.ts).
 * Vertragsmail ohne Aufruf zur nächsten Bestellung (S11, Board s3/w3-mail-storno
 * Bild 3: ohne „bestell einfach neu“).
 */
export function BestellungVerfallenEmail(p: BestellungVerfallenProps) {
  return (
    <EmailLayout fuss={{ art: 'hof' }} previewText={T.vorschauzeile}>
      <Text style={h1}>{T.titel}</Text>
      <Text style={bodyText}>
        {T.satz(p.farmName, p.bestaetigenBis)}
      </Text>
      <BestellnummerKasten nummer={p.orderNumber} />
    </EmailLayout>
  )
}
