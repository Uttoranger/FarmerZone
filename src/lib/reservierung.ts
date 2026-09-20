/**
 * Reservierungsfrist — die Regeln, ohne Datenbank (Bug-Report Befund 3).
 *
 * WIE RESERVIERUNGEN HIER FUNKTIONIEREN — wichtig, weil es die Aufgabe prägt:
 * Eine Reservierung bucht KEINEN Bestand ab. `Product.stock` sinkt erst beim
 * Kauf. Ein Eintrag in `StockReservation` ist ein weicher Halt: Er zieht die
 * Menge nur von dem ab, was ANDERE Sitzungen sehen. Es gibt deshalb nichts
 * „zurückzubuchen", wenn eine Reservierung verfällt — sie hört schlicht auf,
 * andere zu blockieren.
 *
 * Durchgesetzt wird die Frist beim LESEN: Jede Abfrage der fremden Reservierungen
 * filtert auf `expiresAt > jetzt`. Damit ist die Frist auf die Sekunde genau
 * wirksam, unabhängig davon, wann ein Cron aufräumt. Der Cron
 * (api/cron/cleanup-reservations) löscht nur noch verfallene Zeilen — er ist
 * Aufräumer, nicht die Wahrheit. Genau deshalb schadet es auch nicht, dass er
 * im Hobby-Tarif nur einmal täglich läuft.
 *
 * Was bis zu diesem Sprint fehlte: Die Kundin ERFUHR nie, dass ihr Halt
 * verfallen war. Sie sah ihren Warenkorb unverändert und bekam im Checkout
 * bestenfalls eine Bestandsmeldung, die den Grund verschwieg. Die Funktionen
 * hier beantworten für einen Warenkorb: Was gilt noch, was wurde weniger, was
 * ist weg — und war die eigene Reservierung daran schuld.
 */

export const RESERVIERUNG_TTL_MS = 15 * 60 * 1000

/** Die eine Meldung, die die Kundin bei verfallener Reservierung liest. */
export const RESERVIERUNG_ABGELAUFEN =
  'Deine Reservierung ist abgelaufen. Wir haben die Verfügbarkeit neu geprüft.'

/** Maschinenlesbar, damit der Browser die Meldung von einem Bestandsfehler unterscheiden kann. */
export const CODE_RESERVIERUNG_ABGELAUFEN = 'RESERVIERUNG_ABGELAUFEN'

export type WarenkorbPosition = {
  productId: string
  /** Was die Kundin im Warenkorb hat. */
  quantity: number
}

export type EigeneReservierung = {
  productId: string
  quantity: number
  expiresAt: Date
}

export type Bestandslage = {
  productId: string
  /**
   * Was dieser Sitzung offensteht: Lagerbestand minus die noch GÜLTIGEN
   * Reservierungen ANDERER Sitzungen. Die eigene zählt nicht dagegen.
   */
  verfuegbar: number
  /** Produkt gelöscht oder auf „nicht verfügbar" gestellt. */
  verkaeuflich: boolean
}

export type PositionsZustand = 'ok' | 'gekuerzt' | 'weg'

export type PositionsBefund = {
  productId: string
  gewuenscht: number
  /** Was jetzt noch geht — 0 heißt: raus aus dem Warenkorb. */
  moeglich: number
  /** Die eigene Reservierung fehlte oder war verfallen. */
  abgelaufen: boolean
  zustand: PositionsZustand
}

export type WarenkorbBefund = {
  positionen: PositionsBefund[]
  /** Mindestens eine eigene Reservierung war verfallen oder fehlte. */
  etwasAbgelaufen: boolean
  /** Mindestens eine Position muss gekürzt oder entfernt werden. */
  etwasGeaendert: boolean
}

/** Gilt die eigene Reservierung für diese Position noch? */
export function istGueltig(reservierung: EigeneReservierung | undefined, jetzt: Date): boolean {
  if (!reservierung) return false
  return reservierung.expiresAt.getTime() > jetzt.getTime()
}

/**
 * Der Abgleich: Warenkorb gegen eigene Reservierungen und echte Verfügbarkeit.
 * Rein — dieselbe Funktion entscheidet beim Laden des Warenkorbs, beim Öffnen
 * des Checkouts und im POST /api/checkout, damit alle drei dasselbe sagen.
 */
export function pruefeWarenkorb(
  positionen: readonly WarenkorbPosition[],
  reservierungen: readonly EigeneReservierung[],
  lage: readonly Bestandslage[],
  jetzt: Date
): WarenkorbBefund {
  const meine = new Map(reservierungen.map((r) => [r.productId, r]))
  const bestand = new Map(lage.map((l) => [l.productId, l]))

  const befunde = positionen.map((p): PositionsBefund => {
    const reservierung = meine.get(p.productId)
    const abgelaufen = !istGueltig(reservierung, jetzt)
    const b = bestand.get(p.productId)

    // Produkt weg oder abgeschaltet: die Position fällt, unabhängig von der Frist.
    if (!b || !b.verkaeuflich) {
      return { productId: p.productId, gewuenscht: p.quantity, moeglich: 0, abgelaufen, zustand: 'weg' }
    }

    const moeglich = Math.max(0, Math.min(p.quantity, b.verfuegbar))
    const zustand: PositionsZustand = moeglich === 0 ? 'weg' : moeglich < p.quantity ? 'gekuerzt' : 'ok'
    return { productId: p.productId, gewuenscht: p.quantity, moeglich, abgelaufen, zustand }
  })

  return {
    positionen: befunde,
    etwasAbgelaufen: befunde.some((b) => b.abgelaufen),
    etwasGeaendert: befunde.some((b) => b.zustand !== 'ok'),
  }
}

/**
 * Was die Kundin lesen soll. Der Grund steht vorn (verfallene Reservierung),
 * die Folge dahinter (gekürzt oder entfernt) — und wenn sich nichts geändert
 * hat, sagt die Meldung genau das, statt Sorge zu machen.
 */
export function befundMeldung(befund: WarenkorbBefund): string | null {
  if (!befund.etwasAbgelaufen && !befund.etwasGeaendert) return null

  const weg = befund.positionen.filter((p) => p.zustand === 'weg').length
  const gekuerzt = befund.positionen.filter((p) => p.zustand === 'gekuerzt').length

  const teile: string[] = []
  if (befund.etwasAbgelaufen) teile.push(RESERVIERUNG_ABGELAUFEN)
  if (weg > 0) {
    teile.push(weg === 1 ? 'Eine Position ist nicht mehr verfügbar und wurde entfernt.' : `${weg} Positionen sind nicht mehr verfügbar und wurden entfernt.`)
  }
  if (gekuerzt > 0) {
    teile.push(gekuerzt === 1 ? 'Eine Menge wurde an den verfügbaren Bestand angepasst.' : `${gekuerzt} Mengen wurden an den verfügbaren Bestand angepasst.`)
  }
  if (teile.length === 0) teile.push(RESERVIERUNG_ABGELAUFEN)
  return teile.join(' ')
}

/** Der neue Zeitpunkt, bis zu dem ein frisch gesetzter Halt gilt. */
export function neueFrist(jetzt: Date): Date {
  return new Date(jetzt.getTime() + RESERVIERUNG_TTL_MS)
}
