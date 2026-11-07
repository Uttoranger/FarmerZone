import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, BestellnummerKasten, ErstattungKasten, h1, bodyText, leiseZeile } from './_layout'
import { formatEuro } from '@/lib/format'
import { ZAHLUNG_ZU_SPAET_TEXT as T } from './texte/zahlung-zu-spaet'

export interface ZahlungZuSpaetProps {
  customerName: string
  orderNumber: string
  farmName: string
  /** Der erstattete Betrag in Euro. */
  erstattet: number
  supportEmail: string
}

/**
 * Die Zahlung kam an, als die Bestellung schon storniert war — das Geld ging
 * sofort zurück (Webhook, payment_intent.succeeded auf CANCELLED). Ohne Aufruf
 * zur nächsten Bestellung (S11, Board s3/w3-mail-storno Bild 4). Für die Kundin heißt das „abgelaufen“
 * (B-Zeile Nr. 255): Sie hat nichts storniert, ihr Zeitfenster zum Bezahlen ist vorbei.
 */
export function ZahlungZuSpaetEmail(p: ZahlungZuSpaetProps) {
  return (
    <EmailLayout fuss={{ art: 'hof' }} previewText={T.vorschauzeile(formatEuro(p.erstattet))}>
      <Text style={h1}>{T.titel}</Text>
      <Text style={bodyText}>
        {T.satz(p.farmName)}
      </Text>
      <BestellnummerKasten nummer={p.orderNumber} />
      <ErstattungKasten betrag={formatEuro(p.erstattet)} zeile={T.erstattungZeile} />
      <Text style={leiseZeile}>{T.fragen(p.supportEmail)}</Text>
    </EmailLayout>
  )
}
