import * as React from 'react'
import { WIDERRUF_TEXT } from '@/lib/widerruf'
import { Text, Link } from '@react-email/components'
import { EmailLayout, BestellnummerKasten, BetragsZeile, Knopf, KnopfReihe, TelefonFett, h1, bodyText, leiseZeile, textLink, woZeile } from './_layout'
import { formatiereTelefon, telefonLink } from '@/lib/telefon-anzeige'

// "Kurzes Update" nach einem Fertig-Rückschritt (bestellungen-undo-2):
// neutral-freundlich, kein Schuld-Ton — die Bestellung ist doch noch nicht
// abholbereit, die nächste Abholbereit-Mail kommt wie gewohnt.
export interface OrderNotReadyProps {
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
  /** „Vertrag widerrufen“ (Nr. 200): signierter Link, nur bei Verbraucherinnen. */
  widerrufUrl?: string
}

export function OrderNotReadyEmail(p: OrderNotReadyProps) {
  const anrufen = telefonLink(p.farmPhone)
  return (
    <EmailLayout fuss={{ art: 'hof' }} previewText={`Kurzes Update zu deiner Bestellung bei ${p.farmName}`}>
      <Text style={h1}>Kurzes Update zu deiner Bestellung</Text>
      <Text style={bodyText}>
        {`${p.farmName} hat gemeldet: Deine Bestellung ist doch noch nicht abholbereit. Du bekommst eine neue Mail, sobald sie bereit liegt. Die Abholzeit bleibt.`}
      </Text>

      <BestellnummerKasten nummer={p.orderNumber} />
      <BetragsZeile umbrechen links="Abholung" rechts={`${p.pickupDate}, ${p.pickupTime} Uhr`} />
      <BetragsZeile umbrechen links="Wo" rechts={woZeile(p.farmName, p.farmAddress, p.farmPostalCode, p.farmCity)} />

      <KnopfReihe>
        <Knopf href={p.routeUrl} art="rahmen">
          Route planen
        </Knopf>
      </KnopfReihe>

      <Text style={leiseZeile}>
        Fragen? Ruf direkt beim Hof an: <TelefonFett href={anrufen} nummer={anrufen ? formatiereTelefon(p.farmPhone) : p.farmPhone} />
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
