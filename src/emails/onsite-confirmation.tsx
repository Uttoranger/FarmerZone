import * as React from 'react'
import { Link, Text } from '@react-email/components'
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
  textLink,
} from './_layout'
import { SERVICEGEBUEHR_BEZEICHNUNG, SERVICEGEBUEHR_HINWEIS } from '@/lib/servicegebuehr'
import { formatEuro } from '@/lib/format'
import { inklPlattformgebuehrSatz } from '@/lib/konditionen'
import { MAIL_AGB_ZEILE } from '@/lib/rechtstexte/agb-einbindung'
import { PRODUKTION_ADRESSE } from '@/lib/umgebung'
import type { Belehrung } from '@/lib/widerruf'
import { BelehrungTeil } from './belehrung-teil'

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
  /** Hofpreis-Modell (N38): die Plattformgebühr in Euro, schon in den Zeilen enthalten; 0 oder fehlend = kein Satz. */
  plattformgebuehr?: number
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
  /** Die Belehrung nach Anhang I FAGG mit den Angaben des Hofs (Nr. 207) — nur bei Verbraucherinnen. */
  belehrung?: Belehrung
  /** „Vertrag widerrufen“ unter der Belehrung (signiert, Nr. 200) — nur bei Verbraucherinnen. */
  widerrufUrl?: string
  /** Die Adresse der Seite für den Link auf die AGB; ohne Angabe die echte Seite. */
  appUrl?: string
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
      {(p.plattformgebuehr ?? 0) > 0 && (
        <Text style={{ ...kleinText, marginTop: '12px' }}>{inklPlattformgebuehrSatz(formatEuro(p.plattformgebuehr ?? 0))}</Text>
      )}
      <Text style={{ ...kleinText, marginTop: '12px' }}>
        Falls du diese Bestellung nicht aufgegeben hast, ignoriere diese E-Mail einfach.
        Bitte bestätige bald: Unbestätigte Bestellungen geben wir nach spätestens zwei Stunden wieder frei.
      </Text>
      {/* Nr. 207: Die AGB hängen auch dieser Mail als Datei an — derselbe Satz wie in der Bestätigung (Register O4). */}
      <Text style={kleinText}>
        {MAIL_AGB_ZEILE.map((stueck, i) =>
          typeof stueck === 'string' ? (
            stueck
          ) : (
            <Link key={i} href={`${p.appUrl ?? PRODUKTION_ADRESSE}${stueck.ziel}`} style={textLink}>
              {stueck.text}
            </Link>
          )
        )}
      </Text>
      {p.belehrung && <BelehrungTeil belehrung={p.belehrung} widerrufUrl={p.widerrufUrl} />}
    </EmailLayout>
  )
}
