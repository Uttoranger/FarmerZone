import * as React from 'react'
import { Link, Text } from '@react-email/components'
import {
  EmailLayout,
  BestellnummerKasten,
  BetragsZeile,
  GebuehrBetragsZeile,
  type MailGebuehrZeile,
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
import { AGB_BISHER, type AgbKennung } from '@/lib/rechtstexte/agb-fassung'
import { PRODUKTION_ADRESSE } from '@/lib/umgebung'
import type { Belehrung } from '@/lib/widerruf'
import { BelehrungTeil } from './belehrung-teil'
import { BITTE_BESTAETIGE_TEXT as T } from './texte/bitte-bestaetige'

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
  gebuehrZeile?: MailGebuehrZeile
  /** Hofpreis-Modell (N38): die Plattformgebühr in Euro, schon in den Zeilen enthalten; 0 oder fehlend = kein Satz. */
  plattformgebuehr?: number
  /** Das „Gesamt“: Warenpreis + Gebühr; ist die Gebühr entfallen bzw. erstattet, nur der Warenpreis (anzeigeGesamtCents in src/lib/email.ts, Nr. 255). */
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
  /** Die Fassung der AGB dieser Bestellung (N45, aus ihrem Snapshot): Link und Anhang zeigen dieselbe. Ohne Angabe 0.9. */
  agbFassung?: AgbKennung
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
    <EmailLayout fuss={{ art: 'hof' }} previewText={T.vorschauzeile(p.farmName, p.pickupDate)}>
      <Text style={h1}>{T.titel}</Text>
      <Text style={bodyText}>{T.einleitung}</Text>

      {/* Die Frist mit Tag und Uhrzeit (V87, fristVon) — als orange Karte, denn die Kundin muss handeln. */}
      <HinweisKasten art="orange">
        {p.bestaetigenBis ? (
          <>
            <strong>{T.fristBis(p.bestaetigenBis)}</strong>
            <br />
            {T.fristFolge}
          </>
        ) : (
          <strong>{T.fristOhneZeit}</strong>
        )}
      </HinweisKasten>

      <KnopfReihe>
        <Knopf href={p.confirmationUrl}>{T.knopf}</Knopf>
      </KnopfReihe>

      <BestellnummerKasten nummer={p.orderNumber} />
      <BetragsZeile umbrechen links="Abholung" rechts={`${p.pickupDate}, ${p.pickupTime} Uhr`} />
      <BetragsZeile umbrechen links="Wo" rechts={woZeile(p.farmName, p.farmAddress, p.farmPostalCode, p.farmCity)} />
      <Trenner />
      {p.items.map((item, i) => (
        <BetragsZeile key={i} links={item.name} rechts={formatEuro(item.betrag)} />
      ))}
      {gebuehr && <GebuehrBetragsZeile zeile={gebuehr} betrag={formatEuro(gebuehr.betrag)} />}
      <Trenner />
      <BetragsZeile stark links={T.gesamt} rechts={formatEuro(p.total)} />

      {(p.plattformgebuehr ?? 0) > 0 && <Text style={kleinText}>{inklPlattformgebuehrSatz(formatEuro(p.plattformgebuehr ?? 0))}</Text>}
      {gebuehr && <Text style={kleinText}>{`${gebuehr.wort}: ${gebuehr.hinweis}`}</Text>}
      {/* Nr. 207: Die AGB hängen auch dieser Mail als Datei an — derselbe Satz wie in der Bestätigung (Register O4). */}
      <Text style={kleinText}>
        {MAIL_AGB_ZEILE(p.agbFassung ?? AGB_BISHER).map((stueck, i) =>
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
