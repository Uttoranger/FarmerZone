import * as React from 'react'
import { WIDERRUF_TEXT } from '@/lib/widerruf'
import { Text, Link } from '@react-email/components'
import {
  EmailLayout,
  BestellnummerKasten,
  BetragsZeile,
  HinweisKasten,
  Knopf,
  KnopfReihe,
  TelefonFett,
  Trenner,
  h1,
  bodyText,
  kleinText,
  leiseZeile,
  textLink,
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
    <EmailLayout fuss={{ art: 'hof' }} previewText={`Ein Artikel fehlt in deiner Bestellung ${p.orderNumber}`}>
      <Text style={h1}>Ein Artikel fehlt</Text>
      {/* Board s3/w3-mail-kauf Bild 6: ohne Anrede, der Hof als Absender des Satzes. */}
      <Text style={bodyText}>
        {`${p.farmName} hat für dich gepackt, aber es fehlt leider: `}
        <strong>{p.artikel}</strong>. Den Rest bekommst du wie geplant.
      </Text>

      <BestellnummerKasten nummer={p.orderNumber} />
      <Trenner />
      <BetragsZeile links="Neuer Betrag" rechts={formatEuro(p.neu)} stark />

      {p.zahlung === 'vor_ort' ? (
        <>
          <HinweisKasten art="gruen">
            Bring bitte <strong>{formatEuro(p.neu)}</strong>
            {` in bar mit (statt ${formatEuro(p.bisher)}).`}
          </HinweisKasten>
          <Text style={kleinText}>{`Die ${p.gebuehrWort ?? 'Servicegebühr'} gilt nur für das, was du bekommst.`}</Text>
        </>
      ) : (
        <>
          <HinweisKasten art="gruen">
            Wir haben dir <strong>{formatEuro(p.erstattet ?? 0)}</strong> zurückerstattet.
          </HinweisKasten>
          <Text style={kleinText}>
            {`Das ist der Preis des Artikels und die ${p.gebuehrWort ?? 'Servicegebühr'}, die dafür angefallen wäre. Die Rückerstattung erscheint in 5–10 Werktagen auf deinem Konto.`}
          </Text>
        </>
      )}

      <KnopfReihe>
        <Knopf href={p.orderUrl} art="rahmen">
          Bestellung ansehen
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
