import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, BestellnummerKasten, ErstattungKasten, h1, bodyText, leiseZeile } from './_layout'
import { formatEuro } from '@/lib/format'

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
 * zur nächsten Bestellung (S11, Board s3/w3-mail-storno Bild 4).
 */
export function ZahlungZuSpaetEmail(p: ZahlungZuSpaetProps) {
  return (
    <EmailLayout fuss={{ art: 'hof' }} previewText={`Zurück an dich ${formatEuro(p.erstattet)}.`}>
      <Text style={h1}>Zahlung kam zu spät</Text>
      <Text style={bodyText}>
        {`Deine Zahlung für deine Bestellung bei ${p.farmName} ist erst angekommen, als die Bestellung schon storniert war. Wir haben dir das Geld sofort zurückgeschickt.`}
      </Text>
      <BestellnummerKasten nummer={p.orderNumber} />
      <ErstattungKasten betrag={formatEuro(p.erstattet)} zeile="erscheint in 5–10 Werktagen auf deinem Konto" />
      <Text style={leiseZeile}>{`Bei Fragen schreib uns an ${p.supportEmail}.`}</Text>
    </EmailLayout>
  )
}
