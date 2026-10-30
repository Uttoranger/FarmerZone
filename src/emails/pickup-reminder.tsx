import * as React from 'react'
import { WIDERRUF_TEXT } from '@/lib/widerruf'
import { Text, Link } from '@react-email/components'
import { EmailLayout, BetragsZeile, Knopf, KnopfReihe, h1, bodyText, kleinText, textLink } from './_layout'
import { formatiereTelefon, telefonLink } from '@/lib/telefon-anzeige'

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
        {anrufen ? (
          <Link href={anrufen} style={textLink}>
            {/* Ein Textknoten: Die Textfassung der Mail schriebe sonst „Anrufen ( +43 … )“. */}
            {`Anrufen (${formatiereTelefon(p.farmPhone)})`}
          </Link>
        ) : (
          p.farmPhone
        )}
      </Text>

      {/* Nr. 200 (N39): der Weg zum Widerruf online — signiert, ohne Anmeldung. */}
      {p.widerrufUrl && (
        <Text style={kleinText}>
          <Link href={p.widerrufUrl} style={textLink}>
            {WIDERRUF_TEXT.knopfWiderrufen}
          </Link>
        </Text>
      )}

      {/* Leise am Ende statt als Knopf über der Mail. Offene Ausnahme von
          „Vertragsmails ohne Werbung" (S11, DESIGN_SYSTEM „E-Mails"): Ob der
          Link bleibt, entscheidet der Mensch (Bericht Nr. 13). */}
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
