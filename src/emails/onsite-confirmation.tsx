import * as React from 'react'
import { Link, Text } from '@react-email/components'
import {
  EmailLayout,
  BestellnummerKasten,
  BetragsZeile,
  HinweisKasten,
  Knopf,
  KnopfReihe,
  Trenner,
  h1,
  bodyText,
  kleinText,
  textLink,
  woZeile,
} from './_layout'
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
  /** PLZ des Hofs für die Zeile „Wo“; fehlt sie, steht nur der Ort. */
  farmPostalCode?: string
  pickupDate: string
  pickupTime: string
  /** Positionen mit fertig gerechnetem Zeilenbetrag in Euro (src/lib/email.ts, über Decimal). */
  items: Array<{ name: string; betrag: number }>
  /**
   * Die Gebührenzeile im Modell „bisher“ (N38): Wort und Erklärsatz der
   * Bestellung (gebuehrWort, gebuehrHinweisFuer in src/lib/email.ts) und der
   * Betrag in Euro aus dem Snapshot. Fehlt sie, gibt es keine Zeile — im
   * Hofpreis-Modell steckt die Gebühr in den Preisen (`plattformgebuehr`).
   */
  gebuehrZeile?: { wort: string; betrag: number; hinweis: string }
  /** Hofpreis-Modell (N38): die Plattformgebühr in Euro, schon in den Zeilen enthalten; 0 oder fehlend = kein Satz. */
  plattformgebuehr?: number
  /** Was die Kundin vor Ort bezahlt: Warenpreis + Gebühr. */
  total: number
  /** Zur Seite mit dem Knopf (/{hof}/bestaetigen/{token}) — der Link selbst bestätigt nichts. */
  confirmationUrl: string
  /**
   * „Montag, 5. Oktober, 12:12 Uhr" — die Frist aus fristen.ts (fristVon) als
   * fester Tag (zeitpunktFuerMail), wenn der Bestellzeitpunkt bekannt ist.
   * Fehlt sie, bleibt ein Satz ohne Dauer (V87: keine zweite, unvollständige Frist).
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
  const gebuehr = p.gebuehrZeile && p.gebuehrZeile.betrag > 0 ? p.gebuehrZeile : null

  return (
    <EmailLayout fuss={{ art: 'hof' }} previewText={`Bestellung bei ${p.farmName} bestätigen – Abholung ${p.pickupDate}`}>
      <Text style={h1}>Bitte bestätige deine Bestellung</Text>
      <Text style={bodyText}>Erst mit deiner Bestätigung packt der Hof deine Sachen.</Text>

      {/* Die Frist mit Tag und Uhrzeit (V87, fristVon) — als orange Karte, denn die Kundin muss handeln. */}
      <HinweisKasten art="orange">
        {p.bestaetigenBis ? (
          <>
            <strong>{`Bitte bestätige bis ${p.bestaetigenBis}.`}</strong>
            <br />
            Danach geben wir die Ware wieder frei – ohne Kosten für dich.
          </>
        ) : (
          <strong>Bitte bestätige bald – sonst geben wir die Ware wieder frei.</strong>
        )}
      </HinweisKasten>

      <KnopfReihe>
        <Knopf href={p.confirmationUrl}>Bestellung bestätigen</Knopf>
      </KnopfReihe>

      <BestellnummerKasten nummer={p.orderNumber} />
      <BetragsZeile umbrechen links="Abholung" rechts={`${p.pickupDate}, ${p.pickupTime} Uhr`} />
      <BetragsZeile umbrechen links="Wo" rechts={woZeile(p.farmName, p.farmAddress, p.farmPostalCode, p.farmCity)} />
      <Trenner />
      {p.items.map((item, i) => (
        <BetragsZeile key={i} links={item.name} rechts={formatEuro(item.betrag)} />
      ))}
      {gebuehr && <BetragsZeile links={gebuehr.wort} rechts={formatEuro(gebuehr.betrag)} />}
      <Trenner />
      <BetragsZeile stark links="Bar bei Abholung" rechts={formatEuro(p.total)} />

      {(p.plattformgebuehr ?? 0) > 0 && <Text style={kleinText}>{inklPlattformgebuehrSatz(formatEuro(p.plattformgebuehr ?? 0))}</Text>}
      {gebuehr && <Text style={kleinText}>{`${gebuehr.wort}: ${gebuehr.hinweis}`}</Text>}
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
