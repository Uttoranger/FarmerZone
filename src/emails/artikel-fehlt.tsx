import * as React from 'react'
import { WIDERRUF_TEXT } from '@/lib/widerruf'
import { Text, Link } from '@react-email/components'
import {
  EmailLayout,
  BetragsZeile,
  Knopf,
  KnopfReihe,
  Trenner,
  amberBox,
  gruenBox,
  h1,
  bodyText,
  mutedText,
  kleinText,
  textLink,
  MAIL_FARBE,
} from './_layout'
import { formatEuro } from '@/lib/format'
import { formatiereTelefon, telefonLink } from '@/lib/telefon-anzeige'

/*
 * „Artikel fehlt" (E14, Nachtlauf Nr. 19): Der Hof hat eine Position als
 * fehlend gemeldet. Die Mail geht sofort raus, damit die Kundin den neuen
 * Betrag kennt, bevor sie losfährt. Vertragsmail, ohne Werbung (S11); Tage
 * fest geschrieben (Wochentag, Datum), nie „heute".
 */
export interface ArtikelFehltProps {
  customerName: string
  orderNumber: string
  farmName: string
  farmPhone: string
  /** Die fehlende Position in der gemeinsamen Schreibweise („Bauernbrot · 1 × 1 kg"). */
  artikel: string
  pickupDate: string
  pickupTime: string
  zahlung: 'online' | 'vor_ort'
  /** Was die Kundin vorher gezahlt hätte bzw. bei Abholung bezahlt hätte, in Euro. */
  bisher: number
  /** Der neue Gesamtbetrag (Warenpreis + neue Servicegebühr), in Euro. */
  neu: number
  /** Online: was wir zurückerstatten, in Euro. */
  erstattet: number | null
  /** Das Wort für die Gebühr (N8): „Servicegebühr“ (Vorgabe) oder im Hofpreis-Modell „Plattformgebühr“. */
  gebuehrWort?: string
  /** Signierter Link zur Bestellung (bestellungPfad). */
  orderUrl: string
  /** „Vertrag widerrufen“ (Nr. 200): signierter Link, nur bei Verbraucherinnen. */
  widerrufUrl?: string
}

export function ArtikelFehltEmail(p: ArtikelFehltProps) {
  const anrufen = telefonLink(p.farmPhone)
  return (
    <EmailLayout previewText={`Ein Artikel fehlt in deiner Bestellung ${p.orderNumber}`}>
      <Text style={h1}>Ein Artikel fehlt</Text>
      <Text style={bodyText}>
        Hallo {p.customerName},<br />
        bei deiner Bestellung <strong>{p.orderNumber}</strong> bei <strong>{p.farmName}</strong> fehlt leider:{' '}
        <strong>{p.artikel}</strong>. Den Rest bekommst du wie geplant.
      </Text>

      {p.zahlung === 'vor_ort' ? (
        <div style={amberBox}>
          <Text style={{ ...bodyText, margin: 0, color: MAIL_FARBE.text, fontWeight: '600' }}>
            {`Bring bitte ${formatEuro(p.neu)} in bar mit (statt ${formatEuro(p.bisher)}).`}
          </Text>
          <Text style={{ ...mutedText, margin: '6px 0 0' }}>
            {`Die ${p.gebuehrWort ?? 'Servicegebühr'} gilt nur für das, was du bekommst.`}
          </Text>
        </div>
      ) : (
        <div style={gruenBox}>
          <Text style={{ ...bodyText, margin: 0, color: MAIL_FARBE.text, fontWeight: '600' }}>
            {`Wir haben dir ${formatEuro(p.erstattet ?? 0)} zurückerstattet.`}
          </Text>
          <Text style={{ ...mutedText, margin: '6px 0 0' }}>
            {`Das ist der Preis des Artikels und die ${p.gebuehrWort ?? 'Servicegebühr'}, die dafür angefallen wäre. Die Rückerstattung erscheint in 5–10 Werktagen auf deinem Konto.`}
          </Text>
        </div>
      )}

      <BetragsZeile links="Bestellnummer" rechts={p.orderNumber} />
      <BetragsZeile umbrechen links="Abholung" rechts={`${p.pickupDate}, ${p.pickupTime} Uhr`} />
      <BetragsZeile links="Neuer Betrag" rechts={formatEuro(p.neu)} stark />

      <KnopfReihe>
        <Knopf href={p.orderUrl} art="rahmen">
          Bestellung ansehen
        </Knopf>
      </KnopfReihe>

      <Trenner />
      <Text style={kleinText}>
        Fragen?{' '}
        {anrufen ? (
          <Link href={anrufen} style={textLink}>
            {formatiereTelefon(p.farmPhone)}
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
    </EmailLayout>
  )
}
