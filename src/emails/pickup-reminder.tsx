import * as React from 'react'
import { Text, Link } from '@react-email/components'
import { EmailLayout, BetragsZeile, Knopf, KnopfReihe, h1, bodyText, kleinText, textLink } from './_layout'

export interface OrderReadyProps {
  orderNumber: string
  farmName: string
  farmPhone: string
  farmAddress: string
  farmCity: string
  pickupDate: string
  pickupTime: string
  /** Google-Maps-Suche nach der Hofadresse (buildMapsUrl). */
  routeUrl: string
  reorderUrl?: string
  /** Der signierte Link zur Bestellseite — der Weg zurück zur Bestellung. */
  orderUrl?: string
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
  return (
    <EmailLayout previewText={`Deine Bestellung bei ${p.farmName} liegt bereit`}>
      <Text style={h1}>Deine Bestellung liegt bereit</Text>
      <Text style={bodyText}>
        Deine Bestellung <strong>{p.orderNumber}</strong> liegt bei {p.farmName} für dich bereit –{' '}
        <strong>{`${p.pickupDate}, ${p.pickupTime} Uhr`}</strong>, {`${p.farmAddress}, ${p.farmCity}`}.
      </Text>

      <BetragsZeile umbrechen links="Abholung" rechts={`${p.pickupDate}, ${p.pickupTime} Uhr`} />
      <BetragsZeile links="Bestellnummer" rechts={p.orderNumber} />

      <KnopfReihe>
        <Knopf href={p.routeUrl}>Route planen</Knopf>
        {/* Positionen, Status und Kalendereintrag — ohne Anmeldung, signiert. */}
        {p.orderUrl && (
          <Knopf href={p.orderUrl} art="rahmen">
            Bestellung ansehen
          </Knopf>
        )}
      </KnopfReihe>

      <Text style={kleinText}>
        Du schaffst es nicht? Gib dem Hof kurz Bescheid:{' '}
        <Link href={`tel:${p.farmPhone}`} style={textLink}>
          Anrufen ({p.farmPhone})
        </Link>
      </Text>

      {/* Leise am Ende statt als Knopf über der Mail: ein Service zur
          Bestellung, keine Werbung (S11). Einziger Weg zur Nachbestellung,
          deshalb nicht gestrichen (Bericht Nr. 13). */}
      {p.reorderUrl && (
        <Text style={kleinText}>
          <Link href={p.reorderUrl} style={textLink}>
            Dieselbe Bestellung nochmal aufgeben
          </Link>
        </Text>
      )}
    </EmailLayout>
  )
}
