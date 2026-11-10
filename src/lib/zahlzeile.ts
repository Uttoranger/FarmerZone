/**
 * Die Zahlzeile unter den Positionen einer Bestellung — EINE Quelle für Bestätigung (/{hof}/confirm/…),
 * Bestellseite (/{hof}/bestellung/…) und Bar-Bestätigen (/{hof}/bestaetigen/…), Liste Lauf 32 (bestaetigung,
 * bestellung-link, Nr. 253):
 *
 * - Modell „hofpreis“ (N38): „Online bezahlt · inkl. Plattformgebühr (6 %)“ bzw. „Bar bei Abholung · inkl.
 *   Plattformgebühr (6 %)“, auf der Bestellseite mit dem Betrag davor („Online bezahlt · € 19,12 inkl. …“).
 * - Modell „bisher“ bzw. `gebuehrModell` null: die bisherige Zeile („Online · Bezahlt · inkl. Servicegebühr“).
 *
 * Wort und Satz kommen nur aus der Bestellung: das Wort über `gebuehrBezeichnungFuer`, der Satz aus dem Snapshot
 * `Order.serviceFeePercentApplied` — nie aus der heutigen Hofeinstellung, nie als fester Text. Ist die Gebühr
 * entfallen bzw. erstattet, steht kein „inkl.“ (die durchgestrichene Zeile darüber sagt es), und der Betrag ist
 * `anzeigeGesamtCents`.
 *
 * NUR ANZEIGE (wie `anzeigeGesamtCents`, das sie nutzt): nie für Buchung, Erstattung, Abrechnung — darum unter
 * derselben Import-Wache (tests/geldanzeige-gesamt-wache.test.ts).
 */
import { formatEuro } from '@/lib/format'
import { zahlungsAnzeige } from '@/lib/bestellstatus'
import { anzeigeGesamtCents, bestellSummen, centsAlsEuro, gebuehrEntfallen, type BestellungMitGebuehr } from '@/lib/servicegebuehr'
import { gebuehrBezeichnungFuer, istHofpreisBestellung, satzText } from '@/lib/plattformgebuehr'

/** Was die Zahlzeile aus der gespeicherten Bestellung liest — nur Snapshots. */
export type ZahlzeilenBestellung = BestellungMitGebuehr & {
  serviceFeeRefundedAt: Date | string | null
  paymentMethod: string
  paymentStatus: string
  /** null = bisher (Servicegebühr), 'hofpreis' = N38. */
  gebuehrModell?: string | null
  /** Order.serviceFeePercentApplied (Decimal, „6.00“): der angewendete Satz; null bei 0 Cent. */
  serviceFeePercentApplied?: { toString(): string } | null
}

/** Die Zahlart im Wortlaut der Boards (Modell „hofpreis“): „Online bezahlt“, „Bar bei Abholung“. */
function zahlartHofpreis(paymentMethod: string, paymentStatus: string): string {
  const { art, zustand } = zahlungsAnzeige(paymentMethod, paymentStatus)
  if (paymentMethod === 'ONLINE') return paymentStatus === 'PAID' ? 'Online bezahlt' : `${art} · ${zustand}`
  // Vor Ort: Der Stand („Noch offen“) steht schon in Marke und Fristkarte; das Board nennt nur die Zahlart.
  return art
}

/**
 * Der gespeicherte Satz als Hundertstel-Prozent über die Ziffern („6.50“ → 650), nie über eine Gleitkommazahl.
 * Unlesbares ergibt null. Absichtlich NICHT `satzHundertstel`: das fällt bei Unlesbarem auf die Vorgabe
 * (PLATTFORMGEBUEHR_PROZENT) zurück — die Zahlzeile darf nur den Snapshot der Bestellung nennen (Freigabe §36).
 */
function snapshotHundertstel(wert: { toString(): string } | null | undefined): number | null {
  if (wert === null || wert === undefined) return null
  const treffer = /^(\d{1,3})(?:\.(\d{1,2})\d*)?$/.exec(wert.toString().trim())
  if (!treffer) return null
  return Number.parseInt(treffer[1], 10) * 100 + Number.parseInt((treffer[2] ?? '').padEnd(2, '0'), 10)
}

/** „ (6 %)“ aus dem Snapshot der Bestellung; ohne gespeicherten oder lesbaren Satz nichts (nie die Vorgabe einsetzen). */
function satzKlammer(b: ZahlzeilenBestellung): string {
  const hundertstel = snapshotHundertstel(b.serviceFeePercentApplied)
  if (hundertstel === null) return ''
  // Festes Leerzeichen vor „%“: Die Klammer bricht nie zwischen Zahl und Zeichen um.
  return ` (${satzText(hundertstel)}\u00a0%)`
}

/**
 * Die Zahlzeile einer Bestellung (siehe Kopf). `mitBetrag`: der Betrag (`anzeigeGesamtCents`) steht in der Zeile,
 * weil die Seite kein eigenes „Gesamt“ zeigt (Bestellseite). Nur Anzeige.
 */
export function zahlzeileFuer(b: ZahlzeilenBestellung, { mitBetrag = false }: { mitBetrag?: boolean } = {}): string {
  const hofpreis = istHofpreisBestellung({ gebuehrModell: b.gebuehrModell ?? null })
  const gilt = bestellSummen(b).gebuehrCents > 0 && !gebuehrEntfallen(b)
  const wort = gebuehrBezeichnungFuer(b)
  const inkl = gilt ? `inkl. ${wort}${hofpreis ? satzKlammer(b) : ''}` : null
  const betrag = mitBetrag ? formatEuro(centsAlsEuro(anzeigeGesamtCents(b))) : null
  const betragZeile = [betrag, inkl].filter(Boolean).join(' ')
  const { art, zustand } = zahlungsAnzeige(b.paymentMethod, b.paymentStatus)
  const zahlart = hofpreis ? zahlartHofpreis(b.paymentMethod, b.paymentStatus) : `${art} · ${zustand}`
  return [zahlart, betragZeile].filter(Boolean).join(' · ')
}

/**
 * Die Zahlzeile auf Bar-Bestätigen (/{hof}/bestaetigen/…). Modell „hofpreis“: dieselbe Zeile wie Bestätigung und
 * Bestellseite. Modell „bisher“ bzw. null: die bisherige Zeile dieser Seite — nur die Zahlart („Bar bei Abholung“),
 * wie vor Nr. 253 (Freigabe §36 „Seiten“: „bisher“ behält seine alte Zeile).
 */
export function barBestaetigenZahlzeile(b: ZahlzeilenBestellung): string {
  if (istHofpreisBestellung({ gebuehrModell: b.gebuehrModell ?? null })) return zahlzeileFuer(b)
  return zahlungsAnzeige(b.paymentMethod, 'PENDING').art
}
