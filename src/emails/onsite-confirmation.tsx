import * as React from 'react'
import { Text } from '@react-email/components'
import {
  EmailLayout,
  BetragsZeile,
  Knopf,
  KnopfReihe,
  Trenner,
  amberBox,
  h1,
  bodyText,
  kleinText,
  MAIL_FARBE,
} from './_layout'
import { SERVICEGEBUEHR_BEZEICHNUNG, SERVICEGEBUEHR_HINWEIS } from '@/lib/servicegebuehr'
import { formatEuro } from '@/lib/format'

export interface OnsiteConfirmationProps {
  orderNumber: string
  farmName: string
  farmAddress: string
  farmCity: string
  pickupDate: string
  pickupTime: string
  /** Positionen mit fertig gerechnetem Zeilenbetrag in Euro (src/lib/email.ts, über Decimal). */
  items: Array<{ name: string; betrag: number }>
  /** Servicegebühr in Euro aus dem Snapshot; 0 oder fehlend = keine Zeile. */
  serviceFee?: number
  /** Was die Kundin vor Ort bezahlt: Warenpreis + Servicegebühr. */
  total: number
  /** Zur Seite mit dem Knopf (/{hof}/bestaetigen/{token}) — der Link selbst bestätigt nichts. */
  confirmationUrl: string
  /**
   * „Montag, 5. Oktober, 12:12 Uhr" — die Frist aus fristen.ts (fristVon) als
   * fester Tag (zeitpunktFuerMail), wenn der Bestellzeitpunkt bekannt ist.
   * Fehlt sie, bleibt der allgemeine Satz.
   */
  bestaetigenBis?: string
}

/**
 * „Bitte bestätige deine Bestellung" — Barbestellung, vor der Bestätigung.
 * Gleiche Gestalt wie die Bestätigungs-Mail (Mockup web-k3-e-mails-web-mobil),
 * Hauptaktion ist der Knopf zur Bestätigungsseite (H3).
 */
export function OnsiteConfirmationEmail(p: OnsiteConfirmationProps) {
  const mitGebuehr = (p.serviceFee ?? 0) > 0

  return (
    <EmailLayout previewText={`Bestellung bei ${p.farmName} bestätigen – Abholung ${p.pickupDate}`}>
      <Text style={h1}>Bitte bestätige deine Bestellung</Text>
      <Text style={bodyText}>
        {`Du hast bei ${p.farmName} bestellt. Erst mit deiner Bestätigung packt der Hof deine Sachen.`}
      </Text>

      {p.bestaetigenBis && (
        <div style={amberBox}>
          <Text style={{ ...bodyText, color: MAIL_FARBE.text, fontWeight: '600', margin: 0 }}>
            {`Bitte bestätige bis ${p.bestaetigenBis}.`}
          </Text>
          <Text style={{ ...kleinText, margin: '2px 0 0' }}>
            Danach geben wir die Ware wieder frei – ohne Kosten für dich.
          </Text>
        </div>
      )}

      <KnopfReihe>
        <Knopf href={p.confirmationUrl}>Bestellung bestätigen</Knopf>
      </KnopfReihe>

      <BetragsZeile links="Bestellnummer" rechts={p.orderNumber} />
      <BetragsZeile umbrechen links="Abholung" rechts={`${p.pickupDate}, ${p.pickupTime} Uhr`} />
      <BetragsZeile umbrechen links="Adresse" rechts={`${p.farmAddress}, ${p.farmCity}`} />
      <Trenner />
      {p.items.map((item, i) => (
        <BetragsZeile key={i} links={item.name} rechts={formatEuro(item.betrag)} />
      ))}
      {mitGebuehr && <BetragsZeile links={SERVICEGEBUEHR_BEZEICHNUNG} rechts={formatEuro(p.serviceFee ?? 0)} />}
      <BetragsZeile stark links="Bar bei Abholung" rechts={formatEuro(p.total)} />

      {mitGebuehr && (
        <Text style={{ ...kleinText, marginTop: '12px' }}>
          {SERVICEGEBUEHR_BEZEICHNUNG}: {SERVICEGEBUEHR_HINWEIS}
        </Text>
      )}
      <Text style={{ ...kleinText, marginTop: '12px' }}>
        Falls du diese Bestellung nicht aufgegeben hast, ignoriere diese E-Mail einfach.
        Bitte bestätige bald: Unbestätigte Bestellungen geben wir nach spätestens zwei Stunden wieder frei.
      </Text>
    </EmailLayout>
  )
}
