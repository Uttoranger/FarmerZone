/**
 * Die Finanzregel der Plattform — was sie einnimmt, was sie kostet, und ab
 * wann sie sich trägt.
 *
 * Rein und ohne Abhängigkeiten außer den Monats- und Gebühren-Prädikaten aus
 * servicegebuehr.ts. Kein Prisma, kein Decimal: ARCHITECTURE §1 verbietet den
 * Prisma-Import in einer Fachregel, und `Prisma.Decimal` käme genau von dort.
 *
 * GELD IN GANZEN CENT. Die Einnahmen liegen ohnehin so in der Datenbank
 * (Order.serviceFeeCents), und servicegebuehr.ts rechnet das ganze
 * Gebührenwesen in Cent. Die Decimal-Spalte Kostenposten.betrag wird an der
 * SERVERGRENZE einmal nach Cent gewandelt — über die Decimal-Methode
 * (`betrag.mul(100)`), nie über `Number(betrag) * 100`: aus 19,99 € würde
 * sonst 1998,9999… (CODING_STANDARDS.md, Abschnitt Geld).
 *
 * MONATE SIND KALENDERMONATE, keine Zeitpunkte. Ein Monat heißt hier
 * `2026-09`; welcher Monat ein Zeitpunkt ist, entscheidet WIENER Zeit
 * (monatsschluesselInWien) — eine Bestellung am 30. September um 23:30 Uhr
 * Wien ist 21:30 UTC und gehört in den September.
 */
import { formatEuro } from '@/lib/format'
import {
  centsAlsEuro,
  gebuehrEntfallen,
  istVorOrtZahlung,
  monatsAbstand,
  monatVerschoben,
  monatsgrenzenWienFuer,
  monatsschluessel,
  monatsschluesselInWien,
  zerlegeMonat,
  type Monatsschluessel,
} from '@/lib/servicegebuehr'

// ─── Kosten ──────────────────────────────────────────────────────────────────

export const KOSTEN_KATEGORIEN = [
  'HOSTING',
  'DATENBANK',
  'KI',
  'WERKZEUGE',
  'DOMAIN',
  'EMAIL',
  'SONSTIGES',
] as const
export type KostenKategorieWert = (typeof KOSTEN_KATEGORIEN)[number]

export const KOSTEN_RHYTHMEN = ['MONATLICH', 'JAEHRLICH', 'EINMALIG'] as const
export type KostenRhythmusWert = (typeof KOSTEN_RHYTHMEN)[number]

/** Die Beschriftungen — EINE Quelle, wie in taxonomie.ts. */
export const KOSTEN_KATEGORIE_LABEL: Record<KostenKategorieWert, string> = {
  HOSTING: 'Hosting',
  DATENBANK: 'Datenbank',
  KI: 'KI',
  WERKZEUGE: 'Werkzeuge',
  DOMAIN: 'Domain',
  EMAIL: 'E-Mail',
  SONSTIGES: 'Sonstiges',
}

export const KOSTEN_RHYTHMUS_LABEL: Record<KostenRhythmusWert, string> = {
  MONATLICH: 'monatlich',
  JAEHRLICH: 'jährlich, auf den Monat umgelegt',
  EINMALIG: 'einmalig',
}

/** Die Kurzform für die Chips im Formular — dort ist kein Platz für den Satz. */
export const KOSTEN_RHYTHMUS_KURZ: Record<KostenRhythmusWert, string> = {
  MONATLICH: 'monatlich',
  JAEHRLICH: 'jährlich',
  EINMALIG: 'einmalig',
}

/** Ein Kostenposten, so weit ihn die Rechnung braucht. Betrag in ganzen Cent. */
export type KostenpostenFuerRechnung = {
  betragCents: number
  rhythmus: KostenRhythmusWert
  /** Erster Monat, in dem der Posten zählt. */
  ab: Monatsschluessel
  /** Letzter Monat einschließlich; null = läuft weiter. */
  bis: Monatsschluessel | null
}

/**
 * Was dieser Posten im gegebenen Monat kostet — in Cent.
 *
 * MONATLICH: der Betrag.
 * EINMALIG:  der Betrag, aber nur im Monat von `ab`.
 * JAEHRLICH: der Jahresbetrag EXAKT auf zwölf Monate verteilt. Nicht gerundet:
 *   Der Rest (Jahresbetrag mod 12) wird auf die ersten Monate jedes Abo-Jahres
 *   verteilt, je einen Cent. 100 € ergeben vier Monate mit 8,34 € und acht mit
 *   8,33 € — zusammen genau 100 €. Zwölfmal kaufmännisch gerundet wären es
 *   99,96 €, und die fehlenden vier Cent stünden dann in keinem Monat.
 *
 * Außerhalb von ab…bis: 0. `bis` zählt EINSCHLIESSLICH — es ist der letzte
 * Monat, in dem der Posten lief, nicht der erste danach.
 */
export function kostenImMonat(
  posten: KostenpostenFuerRechnung,
  monat: Monatsschluessel
): number {
  const seitAb = monatsAbstand(posten.ab, monat)
  if (seitAb < 0) return 0
  if (posten.bis !== null && monatsAbstand(monat, posten.bis) < 0) return 0

  const betrag = Math.max(0, Math.round(posten.betragCents))

  switch (posten.rhythmus) {
    case 'MONATLICH':
      return betrag
    case 'EINMALIG':
      return seitAb === 0 ? betrag : 0
    case 'JAEHRLICH': {
      const grundbetrag = Math.floor(betrag / 12)
      const rest = betrag % 12
      // Der Platz im Abo-Jahr, gezählt ab `ab` — nicht ab Jänner: Ein Abo, das
      // im September beginnt, verteilt seinen Rest auf September und die
      // folgenden Monate, nicht auf ein Kalenderjahr, das es nie gab.
      const platzImAbojahr = seitAb % 12
      return grundbetrag + (platzImAbojahr < rest ? 1 : 0)
    }
  }
}

export type KostenSumme = {
  /** Die Kosten des Monats in Cent. */
  cents: number
  /** Wie viele Posten im Monat überhaupt etwas kosten. */
  anzahl: number
}

/** Alle Posten eines Monats zusammengelegt. */
export function kostenSummeImMonat(
  posten: readonly KostenpostenFuerRechnung[],
  monat: Monatsschluessel
): KostenSumme {
  let cents = 0
  let anzahl = 0
  for (const p of posten) {
    const betrag = kostenImMonat(p, monat)
    if (betrag > 0) {
      cents += betrag
      anzahl++
    }
  }
  return { cents, anzahl }
}

// ─── Einnahmen ───────────────────────────────────────────────────────────────

/** Eine Bestellung, so weit sie die Einnahmenregel braucht. */
export type BestellungFuerFinanzen = {
  createdAt: Date
  status: string
  paymentMethod: string
  paymentStatus: string
  /** Die Servicegebühr aus dem Snapshot, in Cent. */
  serviceFeeCents: number
  serviceFeeRefundedAt: Date | string | null
  /** Provision (Order.platformFeeAmount) in Cent — im Pilot 0. */
  provisionCents: number
}

/**
 * Die vier Töpfe. Sie schließen sich GEGENSEITIG AUS — dasselbe Geld darf nie
 * zweimal auf der Seite stehen:
 *   eingezogen  liegt auf dem Plattformkonto (online bezahlt, Gebühr nicht
 *               entfallen). Ein BRUTTO: Stripes Gebühren sind davon schon
 *               abgegangen, stehen aber nirgends in der Datenbank.
 *   geschuldet  der Hof hat sie vor Ort mitkassiert und schuldet sie der
 *               Abrechnung (abgeholt, Gebühr nicht entfallen).
 *   erwartet    kann noch in einen der beiden ersten Töpfe wandern.
 *   keiner      storniert oder Gebühr entfallen.
 */
export type EinnahmenTopf = 'eingezogen' | 'geschuldet' | 'erwartet' | 'keiner'

/**
 * In welchen Topf gehört diese Bestellung?
 *
 * Die REIHENFOLGE der Prüfungen ist die Regel, nicht Zufall:
 *
 * 1. Storniert oder Gebühr entfallen → nichts. Das sticht alles andere.
 * 2. Online UND bezahlt → eingezogen. Nicht `status = 'PAID'`: Der
 *    Bestellstatus wandert weiter (CONFIRMED → READY → PICKED_UP), der
 *    Zahlungsstatus bleibt PAID.
 * 3. Vor Ort UND abgeholt → geschuldet. Abgeholt heißt bei Vor-Ort-Zahlung
 *    „abgeholt und bezahlt".
 * 4. Nicht abgeholt → nichts. Da kommt nichts mehr, auch wenn die Gebühr
 *    (noch) nicht als entfallen vermerkt ist.
 * 5. Sonst → erwartet.
 *
 * Grenzfall, absichtlich so: Scheitert bei „nicht abgeholt" die
 * Stripe-Erstattung, bleibt serviceFeeRefundedAt null. Dann greift Schritt 2
 * vor Schritt 4 und die Bestellung zählt weiter als EINGEZOGEN — sachlich
 * richtig, das Geld liegt bis zur geglückten Erstattung bei der Plattform
 * (gebuehrErstattungOffen in servicegebuehr.ts nennt genau diesen Zustand).
 *
 * Dieselbe Zuordnung rechnet die Admin-Hofliste in rohem SQL
 * (src/server/queries/admin.ts, monatsSpaltenJeHof) — rohes SQL kann keine
 * TypeScript-Funktion rufen. Wer hier etwas ändert, ändert es dort mit, sonst
 * zeigen /admin und /admin/finanzen für denselben Monat verschiedene Zahlen.
 */
export function topfVonBestellung(bestellung: BestellungFuerFinanzen): EinnahmenTopf {
  if (bestellung.status === 'CANCELLED') return 'keiner'
  if (gebuehrEntfallen(bestellung)) return 'keiner'
  if (bestellung.paymentMethod === 'ONLINE' && bestellung.paymentStatus === 'PAID') {
    return 'eingezogen'
  }
  if (istVorOrtZahlung(bestellung.paymentMethod) && bestellung.status === 'PICKED_UP') {
    return 'geschuldet'
  }
  if (bestellung.status === 'NOT_PICKED_UP') return 'keiner'
  return 'erwartet'
}

export type EinnahmenMonat = {
  eingezogenCents: number
  geschuldetCents: number
  erwartetCents: number
  /** Provision aus den gezählten Bestellungen — im Pilot 0. */
  provisionCents: number
  /** Bestellungen, die etwas eingebracht haben (eingezogen + geschuldet). */
  bestellungen: number
  /** Bestellungen im Topf „erwartet". */
  offeneBestellungen: number
  /** eingezogen + geschuldet: was der Monat der Plattform gebracht hat. */
  gezaehltCents: number
}

const EINNAHMEN_LEER: EinnahmenMonat = {
  eingezogenCents: 0,
  geschuldetCents: 0,
  erwartetCents: 0,
  provisionCents: 0,
  bestellungen: 0,
  offeneBestellungen: 0,
  gezaehltCents: 0,
}

/**
 * Die Einnahmen eines Monats. Stichtag ist der BESTELLEINGANG (createdAt) in
 * Wiener Zeit — nicht der Abholtag und nicht der Zahltag: Nur so bleibt eine
 * Bestellung für immer in demselben Monat, egal was später mit ihr passiert.
 *
 * Gezählt wird ausschließlich die Servicegebühr aus dem Snapshot; die
 * Provision läuft daneben mit, weil sie im Pilot 0 ist und die Seite sie nur
 * zeigt, wenn etwas drinsteht.
 */
export function einnahmenImMonat(
  bestellungen: readonly BestellungFuerFinanzen[],
  monat: Monatsschluessel
): EinnahmenMonat {
  const ergebnis: EinnahmenMonat = { ...EINNAHMEN_LEER }

  for (const b of bestellungen) {
    if (monatsschluesselInWien(b.createdAt) !== monat) continue
    const gebuehr = Math.max(0, Math.round(b.serviceFeeCents))

    switch (topfVonBestellung(b)) {
      case 'eingezogen':
        ergebnis.eingezogenCents += gebuehr
        ergebnis.bestellungen++
        ergebnis.provisionCents += Math.max(0, Math.round(b.provisionCents))
        break
      case 'geschuldet':
        ergebnis.geschuldetCents += gebuehr
        ergebnis.bestellungen++
        ergebnis.provisionCents += Math.max(0, Math.round(b.provisionCents))
        break
      case 'erwartet':
        ergebnis.erwartetCents += gebuehr
        ergebnis.offeneBestellungen++
        break
      case 'keiner':
        break
    }
  }

  ergebnis.gezaehltCents = ergebnis.eingezogenCents + ergebnis.geschuldetCents
  return ergebnis
}

// ─── Kostendeckung ───────────────────────────────────────────────────────────

/**
 * Die durchschnittliche Servicegebühr je Bestellung in Cent — über ALLE
 * übergebenen Monate mit mindestens einer gezählten Bestellung, nicht nur über
 * den gewählten. Ein einzelner schwacher Monat soll die Schwelle nicht
 * verschieben.
 *
 * Monate ohne gezählte Bestellung fallen heraus, statt den Schnitt zu drücken:
 * Ein Monat ohne Bestellung sagt nichts über die Höhe einer Gebühr.
 * Kein gezählter Monat → 0, und 0 heißt für die Seite „noch keine Daten".
 */
export function durchschnittsGebuehr(monate: readonly EinnahmenMonat[]): number {
  let summe = 0
  let anzahl = 0
  for (const m of monate) {
    if (m.bestellungen === 0) continue
    summe += m.gezaehltCents
    anzahl += m.bestellungen
  }
  if (anzahl === 0) return 0
  return Math.round(summe / anzahl)
}

/**
 * Wie viele Bestellungen im Monat es braucht, damit die Kosten gedeckt sind —
 * aufgerundet, denn eine halbe Bestellung deckt nichts.
 *
 * Ohne Schnitt (noch keine gezählte Bestellung) null: „noch keine Daten" ist
 * eine andere Aussage als „0 Bestellungen genügen". Ohne Kosten 0.
 */
export function bestellungenBisKostendeckung(
  kostenCents: number,
  schnittCents: number
): number | null {
  if (schnittCents <= 0) return null
  if (kostenCents <= 0) return 0
  return Math.ceil(kostenCents / schnittCents)
}

// ─── Die Monate der Seite ────────────────────────────────────────────────────

/** Wie viele Monate das Diagramm höchstens zeigt. */
export const DIAGRAMM_MONATE = 12

/**
 * Die Monate des Diagramms: seit der ersten Bestellung bis zum gewählten
 * Monat, höchstens `hoechstens` — der jüngste zuletzt.
 *
 * Ohne erste Bestellung (oder wenn sie nach dem gewählten Monat liegt, weil
 * jemand einen älteren Monat aufruft) bleibt es der gewählte Monat allein.
 */
export function monateBis(
  bis: Monatsschluessel,
  erster: Monatsschluessel | null,
  hoechstens: number = DIAGRAMM_MONATE
): Monatsschluessel[] {
  const spanne = Math.max(1, Math.floor(hoechstens))
  const abstand = erster === null ? 0 : monatsAbstand(erster, bis)
  const anzahl = Math.min(spanne, Math.max(1, abstand + 1))
  const monate: Monatsschluessel[] = []
  for (let i = anzahl - 1; i >= 0; i--) monate.push(monatVerschoben(bis, -i))
  return monate
}

// ─── Monat ↔ DATE-Spalte ─────────────────────────────────────────────────────

/**
 * Ein Monat → der Erste dieses Monats als UTC-Mitternacht, für die
 * DATE-Spalten `Kostenposten.ab` und `.bis`.
 *
 * OHNE Zeitzonen-Umrechnung, und das ist der Grund für DATE: Eine DATE-Spalte
 * hält ein Kalenderdatum ohne Zeitpunkt. Würde hier Wiener Mitternacht
 * geschrieben (= 22:00 UTC am Vortag), landete in der Spalte der letzte Tag des
 * VORmonats.
 */
export function monatAlsUtcDatum(monat: Monatsschluessel): Date {
  const teile = zerlegeMonat(monat)
  if (!teile) throw new Error('Kein Monatsschlüssel')
  return new Date(Date.UTC(teile.jahr, teile.monat - 1, 1))
}

/** Der Rückweg: eine DATE-Spalte → ihr Monat. UTC-Getter, siehe oben. */
export function utcDatumAlsMonat(datum: Date): Monatsschluessel {
  return monatsschluessel(datum.getUTCFullYear(), datum.getUTCMonth() + 1)
}

// ─── Texte der Seite ─────────────────────────────────────────────────────────

/** Kurzform für die Achse des Diagramms: „Sep 26". */
export function monatKurz(monat: Monatsschluessel): string {
  return monatsgrenzenWienFuer(monat).von.toLocaleDateString('de-AT', {
    month: 'short',
    year: '2-digit',
    timeZone: 'Europe/Vienna',
  })
}

export const EINNAHMEN_ONLINE_LABEL = 'Servicegebühr, online'
export const EINNAHMEN_VOR_ORT_LABEL = 'Servicegebühr, vor Ort bezahlt'
export const EINNAHMEN_PROVISION_LABEL = 'Provision'

/**
 * Warum dieser Satz auf der Seite steht: „eingezogen" ist ein BRUTTO. Die
 * Zahlung entsteht als Destination Charge ohne `on_behalf_of` auf dem
 * Plattformkonto (src/app/api/checkout/route.ts), Stripe zieht seine Gebühren
 * dort ab — gespeichert wird davon nichts. Auf einer Seite, die „ab wann trägt
 * sich die Plattform?" beantwortet, wäre das Verschweigen einer Lücke von
 * einigen Prozent irreführend.
 */
export const STRIPE_HINWEIS = 'Stripe-Gebühren sind hier noch nicht abgezogen.'

export const FINANZEN_FUSSZEILE =
  'Ein Überblick für dich, keine Buchhaltung — steuerlich zählt, was dein Steuerberater bucht.'

/**
 * Die Antwort auf „Wann trägt sich die Plattform?" als ein Satz.
 *
 * Drei Fälle, die verschieden klingen müssen:
 *  - keine Daten (noch keine gezählte Bestellung) → erklären, nicht rechnen.
 *    Eine 0 stünde sonst da, als wäre nichts zu tun.
 *  - keine Kosten eingetragen → auffordern, statt „0 Bestellungen genügen".
 *  - sonst die Schwelle und der Stand des Monats.
 */
export function kostendeckungSatz(stand: {
  schnittCents: number
  brauchtBestellungen: number | null
  /** Der Monat im Klartext, z. B. „September 2026". */
  bezeichnung: string
  /** Gezählte Bestellungen des Monats. */
  bestellungen: number
}): string {
  if (stand.brauchtBestellungen === null) {
    return 'Sobald die ersten Bestellungen mit Servicegebühr da sind, steht hier, wie viele es im Monat braucht.'
  }
  if (stand.brauchtBestellungen === 0) {
    return `Für ${stand.bezeichnung} sind keine Kosten eingetragen. Trag deine laufenden Kosten ein, dann steht hier die Schwelle.`
  }
  return (
    `Bei durchschnittlich ${formatEuro(centsAlsEuro(stand.schnittCents))} Servicegebühr je ` +
    `Bestellung brauchst du rund ${stand.brauchtBestellungen} Bestellungen im Monat, damit die ` +
    `Kosten gedeckt sind. Im ${stand.bezeichnung} waren es ${stand.bestellungen}.`
  )
}
