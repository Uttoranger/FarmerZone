import * as React from 'react'
import { Link, Text } from '@react-email/components'
import { EmailLayout, BestellnummerKasten, BetragsZeile, HinweisKasten, Knopf, KnopfReihe, Trenner, Ueberschrift, bodyText, kleinText, textLink, zwischenTitel } from './_layout'
import { formatEuro } from '@/lib/format'
import { formatiereTelefon, telefonLink } from '@/lib/telefon-anzeige'

type GemeinsameProps = {
  farmerName: string
  customerName: string
  /**
   * Nur online (Nr. 81): Der Hof ruft an, wenn etwas fehlt. Fehlt sie, steht
   * in der Zeile „Kundin“ nur der Name — so die Bar-Mail (Nr. 256): kein
   * tel:-Link, keine Nummer der Kundin vor ihrer Bestätigung.
   */
  customerPhone?: string
  orderNumber: string
  pickupDate: string
  pickupTime: string
  /** Positionen; mit `betrag` (Endpreis der Zeile in Euro, gerechnet in src/lib/email.ts) steht er rechts. */
  items: Array<{ name: string; quantity: number; betrag?: number }>
  paymentLabel: string
  /** Zu Heute im Hofbereich (Wortliste N42 c: „Heute“, nie „Dashboard“). */
  heuteUrl: string
}

type OnlineProps = {
  isOnline: true
  /** Der WARENPREIS — das, was dem Hof überwiesen wird. */
  total: number
  /** Servicegebühr in Euro (von der Plattform einbehalten); 0 = keine Zeile. */
  serviceFee?: number
  /** Das Wort für die Gebühr (N8): „Servicegebühr“ (Vorgabe) oder im Hofpreis-Modell „Plattformgebühr“. */
  gebuehrWort?: string
  /** Was die Kundin bezahlt hat: Warenpreis + Servicegebühr. */
  customerTotal?: number
}

type BarProps = {
  isOnline: false
  /**
   * „Bar zu kassieren“ in Euro — allein aus `barZuKassierenCents` der
   * Bestellung (Nr. 256). Pflicht und ohne Rückfall auf den Warenpreis: Ein
   * fehlender Betrag soll beim Bauen auffallen, nicht als zu kleine Summe beim Hof.
   */
  barZuKassieren: number
  /** „Mittwoch, 3. März, 09:40 Uhr“ — bis dahin bestätigt die Kundin (fristVon, zeitpunktFuerMail); fehlt er, der allgemeine Satz. */
  bestaetigenBis?: string
}

export type NewOrderNotificationProps = GemeinsameProps & (OnlineProps | BarProps)

/**
 * „Neue bezahlte Bestellung“ an den Hof (Board s3/w3-mail-hof-bestellung Bild 1;
 * Bild 2 ist der Zweig ohne Online-Zahlung, Art 'bestellung-bar-hof', Nr. 256).
 * Aufbau wie die Bestellmails der Kundin: Nummer groß, Abholung, Produkte mit
 * Preis, darunter der Anteil des Hofs bzw. was bar zu kassieren ist.
 */
export function NewOrderNotificationEmail(p: NewOrderNotificationProps) {
  const anrufen = p.customerPhone === undefined ? null : telefonLink(p.customerPhone)
  return (
    <EmailLayout fuss={{ art: 'plattform' }} previewText={p.isOnline ? `${p.customerName} hat bestellt und online bezahlt.` : `${p.customerName} hat bestellt, bar bei Abholung.`}>
      <Ueberschrift>{p.isOnline ? 'Neue bezahlte Bestellung' : 'Neue Bestellung eingegangen'}</Ueberschrift>
      <Text style={bodyText}>
        {`Hallo ${p.farmerName}, ${p.customerName} hat eine Bestellung aufgegeben.`}
        {p.isOnline ? ' Die Zahlung wurde bereits online abgewickelt.' : ` Die Zahlung (${p.paymentLabel}) erfolgt bei der Abholung.`}
      </Text>

      <BestellnummerKasten nummer={p.orderNumber} />
      <BetragsZeile umbrechen links="Abholung" rechts={`${p.pickupDate}, ${p.pickupTime} Uhr`} />
      {/* Board s3/w3-mail-hof-bestellung: Linie unter „Abholung“, wie in „Bar-Bestellung bestätigt“. */}
      <Trenner />

      {/* Bar: Erst die Bestätigung der Kundin gibt die Bestellung zum Packen frei. */}
      {!p.isOnline && (
        <HinweisKasten art="orange">
          {p.bestaetigenBis ? `${p.customerName} bestätigt bis ${p.bestaetigenBis}. Erst dann packst du.` : `${p.customerName} bestätigt die Bestellung per E-Mail. Erst dann packst du.`}
        </HinweisKasten>
      )}

      {p.isOnline && <Text style={{ ...zwischenTitel, margin: '12px 0 4px' }}>Bestellte Produkte</Text>}
      {p.items.map((item, i) => (
        <BetragsZeile key={i} links={item.name} rechts={item.betrag !== undefined ? formatEuro(item.betrag) : ''} />
      ))}
      <Trenner />
      {p.isOnline ? <OnlineBetraege {...p} /> : <BetragsZeile stark links="Bar zu kassieren" rechts={formatEuro(p.barZuKassieren)} />}

      {/* Die Nummer der Kundin bleibt online (Nr. 81): Der Hof ruft an, wenn etwas fehlt. Ohne Nummer nur der Name. */}
      <BetragsZeile
        umbrechen
        links="Kundin"
        rechts={
          p.customerPhone === undefined ? (
            p.customerName
          ) : (
            <>
              {`${p.customerName} · `}
              {anrufen ? (
                <Link href={anrufen} style={textLink}>
                  {formatiereTelefon(p.customerPhone)}
                </Link>
              ) : (
                p.customerPhone
              )}
            </>
          )
        }
      />

      <KnopfReihe>
        <Knopf href={p.heuteUrl}>Bei Heute ansehen →</Knopf>
      </KnopfReihe>
    </EmailLayout>
  )
}

/** Online: Warenpreis (Anteil des Hofs), Gebühr und was die Kundin bezahlt hat (Board Bild 1). */
function OnlineBetraege(p: OnlineProps) {
  const mitGebuehr = (p.serviceFee ?? 0) > 0
  const wort = p.gebuehrWort ?? 'Servicegebühr'
  const bezahlt = p.customerTotal ?? p.total
  return (
    <>
      <BetragsZeile stark links={mitGebuehr ? 'Warenpreis (dein Anteil)' : 'Gesamtbetrag'} rechts={formatEuro(p.total)} />
      {mitGebuehr && <BetragsZeile links={wort} rechts={formatEuro(p.serviceFee ?? 0)} />}
      {mitGebuehr && <Text style={{ ...kleinText, marginTop: '6px' }}>{`Die ${wort} behält Stripe gleich ein. Die Kundin hat ${formatEuro(bezahlt)} bezahlt.`}</Text>}
    </>
  )
}
