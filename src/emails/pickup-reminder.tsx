import * as React from 'react'
import { WIDERRUF_TEXT } from '@/lib/widerruf'
import { Text, Link } from '@react-email/components'
import { EmailLayout, BestellnummerKasten, BetragsZeile, Knopf, KnopfReihe, h1, bodyText, leiseZeile, textLink, woZeile } from './_layout'
import { formatiereTelefon, telefonLink } from '@/lib/telefon-anzeige'
import { ABHOLBEREIT_TEXT as T } from './texte/abholbereit'

export interface OrderReadyProps {
  orderNumber: string
  farmName: string
  farmPhone: string
  farmAddress: string
  farmCity: string
  /** PLZ des Hofs für die Zeile „Wo“; fehlt sie, steht nur der Ort. */
  farmPostalCode?: string
  pickupDate: string
  pickupTime: string
  /** Google-Maps-Suche nach der Hofadresse (buildMapsUrl). */
  routeUrl: string
  /** Der signierte Link zur Bestellseite — der Weg zurück zur Bestellung. */
  orderUrl?: string
  /** „Vertrag widerrufen“ (Nr. 200): signierter Link, nur bei Verbraucherinnen. */
  widerrufUrl?: string
}

/**
 * „Deine Bestellung liegt bereit" — die Abholerinnerung aus dem Mockup
 * web-k3-e-mails-web-mobil (Mail 2). Der Dateiname ist älter: Verschickt wird
 * sie, wenn der Hof die Bestellung als abholbereit markiert (sendOrderReady,
 * src/server/actions/orders.ts) — einen eigenen Versand am Abholtag um 9 Uhr
 * gibt es nicht (Bericht Nr. 13). Deshalb nennt sie den Tag ausdrücklich,
 * statt „heute" zu sagen.
 */
export function OrderReadyEmail(p: OrderReadyProps) {
  const anrufen = telefonLink(p.farmPhone)
  return (
    <EmailLayout fuss={{ art: 'hof' }} previewText={T.vorschauzeile(p.farmName)}>
      <Text style={h1}>{T.titel}</Text>
      {/* Board s3/w3-mail-kauf Bild 4: kein Einleitungssatz — Abholung, Ort und die Nummer zum Nennen. */}
      <BetragsZeile umbrechen links="Abholung" rechts={`${p.pickupDate}, ${p.pickupTime} Uhr`} />
      <BetragsZeile umbrechen links="Wo" rechts={woZeile(p.farmName, p.farmAddress, p.farmPostalCode, p.farmCity)} />
      <BestellnummerKasten nummer={p.orderNumber} />

      <KnopfReihe>
        <Knopf href={p.routeUrl}>{T.knopfRoute}</Knopf>
        {/* Positionen, Status und Kalendereintrag — ohne Anmeldung, signiert. */}
        {p.orderUrl && (
          <Knopf href={p.orderUrl} art="rahmen">
            {T.knopfBestellung}
          </Knopf>
        )}
      </KnopfReihe>

      <Text style={bodyText}>
        {T.schaffstDuNicht}{' '}
        {anrufen ? (
          <Link href={anrufen} style={textLink}>
            {T.anrufen(formatiereTelefon(p.farmPhone))}
          </Link>
        ) : (
          p.farmPhone
        )}
      </Text>

      {/* Nr. 200 (N39): der Weg zum Widerruf online — signiert, ohne Anmeldung. */}
      {p.widerrufUrl && (
        <Text style={leiseZeile}>
          <Link href={p.widerrufUrl} style={textLink}>
            {WIDERRUF_TEXT.knopfWiderrufen}
          </Link>
        </Text>
      )}
    </EmailLayout>
  )
}
