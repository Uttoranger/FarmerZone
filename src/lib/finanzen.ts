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
import { MONAT_KURZ, csvBetrag, formatEuro, mitAnzahl } from '@/lib/format'
import {
  barOhneServicegebuehr,
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
  type Zahlungsart,
} from '@/lib/servicegebuehr'
import { istTestzahlung } from '@/lib/testzahlung'
import type { KennzahlDaten, UnterreiterDaten } from '@/lib/admin-seiten'
import {
  FINANZEN_REITER_IDS,
  FINANZEN_REITER_STANDARD,
  finanzenAdresse,
  finanzenReiterLabel,
  type FinanzenReiterId,
} from '@/lib/admin-finanzen-seite'

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
  paymentMethod: Zahlungsart
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
 *    Ebenso bar vor dem SEPA-Start (`barOhneServicegebuehr`, Register B1):
 *    Neue Barbestellungen tragen dort keine Gebühr, und die Gebühr älterer
 *    Barbestellungen wird nicht eingezogen — die Plattform erwartet aus
 *    ihnen nichts, sie zählen auch nicht als „Bestellung mit Einnahme".
 *    Ebenso eine Testzahlung (`istTestzahlung`, Register Z4): online vor dem
 *    Stichtag der Live-Schaltung — dort floss kein echtes Geld. Ohne
 *    Stichtag (`stripeLiveAb` null) gibt es keine, alles wie vor Nr. 55.
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
 * Die Testzahlungen nimmt dort derselbe Baustein heraus
 * (`ohneTestzahlungenSql`, src/lib/testzahlung.ts).
 */
export function topfVonBestellung(bestellung: BestellungFuerFinanzen, stripeLiveAb: Date | null): EinnahmenTopf {
  if (bestellung.status === 'CANCELLED') return 'keiner'
  if (gebuehrEntfallen(bestellung)) return 'keiner'
  if (barOhneServicegebuehr(bestellung.paymentMethod, bestellung.createdAt)) return 'keiner'
  if (istTestzahlung(bestellung, stripeLiveAb)) return 'keiner'
  if (bestellung.paymentMethod === 'ONLINE' && bestellung.paymentStatus === 'PAID') {
    return 'eingezogen'
  }
  if (istVorOrtZahlung(bestellung.paymentMethod) && bestellung.status === 'PICKED_UP') {
    return 'geschuldet'
  }
  if (bestellung.status === 'NOT_PICKED_UP') return 'keiner'
  return 'erwartet'
}

/**
 * Was ein Monat der Plattform gebracht hat: `gezaehltCents`, `bestellungen`
 * und die Provision in `einnahmenImMonat` — auf der Finanzseite Verlauf,
 * Schnitt und Kacheln, in der Auswertung die „Servicegebühren dieses Monats"
 * (`SERVICEGEBUEHREN_TOEPFE`). Daran misst sich auch die Hinweiszeile
 * (Register Z4): dieselbe Liste, keine zweite.
 */
export const GEZAEHLTE_TOEPFE: readonly EinnahmenTopf[] = ['eingezogen', 'geschuldet']

/** Was die Finanzseite für den gewählten Monat zeigt: dazu „erwartet" (nur dort, nicht im Verlauf). */
export const TOEPFE_IM_GEWAEHLTEN_MONAT: readonly EinnahmenTopf[] = [...GEZAEHLTE_TOEPFE, 'erwartet']

/**
 * Lässt eine gezeigte Zahl eine Testzahlung aus (Register Z4) — gibt es unter
 * diesen Bestellungen eine, die ohne die Regel in einem der gezeigten Töpfe läge?
 * Dann steht leise, dass Testzahlungen nicht mitgezählt sind. Ohne Stichtag
 * nie; eine stornierte Testzahlung allein zählt nicht, die zählte ohnehin nicht.
 * `toepfe`: was die Seite für diese Bestellungen zeigt — ohne Vorgabe, damit
 * jeder Aufrufer sie aus derselben Liste nimmt wie die Anzeige
 * (`GEZAEHLTE_TOEPFE`, `TOEPFE_IM_GEWAEHLTEN_MONAT`, `SERVICEGEBUEHREN_TOEPFE`).
 */
export function testzahlungenBetroffen(
  bestellungen: readonly BestellungFuerFinanzen[],
  stripeLiveAb: Date | null,
  toepfe: readonly EinnahmenTopf[]
): boolean {
  return bestellungen.some((b) => istTestzahlung(b, stripeLiveAb) && toepfe.includes(topfVonBestellung(b, null)))
}

/**
 * Die Hinweiszeile der Finanzseite (Register Z4, Nachbesserung Runde 2):
 * Die Vormonate zeigen nur, was sie gebracht haben (Verlauf und Schnitt aus
 * `gezaehltCents`), der gewählte Monat dazu „erwartet". Eine offene
 * Testzahlung in einem älteren Monat fehlt deshalb in keiner gezeigten Zahl
 * und bringt keine Zeile; eine bezahlte fehlt im Verlauf und bringt sie.
 * `bestellungen`: die der gezeigten Monate, wie `getFinanzen` sie lädt.
 */
export function finanzseiteLaesstTestzahlungenAus(
  bestellungen: readonly BestellungFuerFinanzen[],
  gewaehlterMonat: Monatsschluessel,
  stripeLiveAb: Date | null
): boolean {
  const imGewaehlten = bestellungen.filter((b) => monatsschluesselInWien(b.createdAt) === gewaehlterMonat)
  const davor = bestellungen.filter((b) => monatsschluesselInWien(b.createdAt) !== gewaehlterMonat)
  return (
    testzahlungenBetroffen(imGewaehlten, stripeLiveAb, TOEPFE_IM_GEWAEHLTEN_MONAT) ||
    testzahlungenBetroffen(davor, stripeLiveAb, GEZAEHLTE_TOEPFE)
  )
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
 * zeigt, wenn etwas drinsteht. Testzahlungen (online vor `stripeLiveAb`,
 * Register Z4) zählen nirgends.
 */
export function einnahmenImMonat(
  bestellungen: readonly BestellungFuerFinanzen[],
  monat: Monatsschluessel,
  stripeLiveAb: Date | null
): EinnahmenMonat {
  const ergebnis: EinnahmenMonat = { ...EINNAHMEN_LEER }

  for (const b of bestellungen) {
    if (monatsschluesselInWien(b.createdAt) !== monat) continue
    const gebuehr = Math.max(0, Math.round(b.serviceFeeCents))
    const topf = topfVonBestellung(b, stripeLiveAb)

    switch (topf) {
      case 'eingezogen':
        ergebnis.eingezogenCents += gebuehr
        break
      case 'geschuldet':
        ergebnis.geschuldetCents += gebuehr
        break
      case 'erwartet':
        ergebnis.erwartetCents += gebuehr
        ergebnis.offeneBestellungen++
        break
      case 'keiner':
        break
    }
    // Was der Monat gebracht hat — aus derselben Liste, an der die Hinweiszeile misst.
    if (GEZAEHLTE_TOEPFE.includes(topf)) {
      ergebnis.gezaehltCents += gebuehr
      ergebnis.bestellungen++
      ergebnis.provisionCents += Math.max(0, Math.round(b.provisionCents))
    }
  }

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

/**
 * Die Achse am Handy (seit Nr. 54): nur der Monat, „Sep". Bei bis zu zwölf
 * Säulenpaaren in 390 px passt „Sep. 26" nicht unter eine Säule. Eindeutig
 * bleibt er trotzdem — das Diagramm zeigt höchstens zwölf Monate, jeder Name
 * kommt darin höchstens einmal vor; das Jahr steht im Kopf der Seite.
 * Fester Wortlaut (MONAT_KURZ aus format.ts) statt Intl „short": Je nach
 * ICU-Stand stünde dort „Sep" oder „Sep.", „Jul" oder „Juli". Der Schlüssel
 * ist schon der Kalendermonat — keine Zeitzone im Spiel.
 */
export function monatOhneJahr(monat: Monatsschluessel): string {
  return MONAT_KURZ[Number(monat.slice(5, 7)) - 1] ?? monat
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

// ─── Das Jahr (Register N15, Ergänzung Nr. 100) ──────────────────────────────

/**
 * Das Jahr ist die SUMME SEINER MONATE — aus denselben Funktionen wie der
 * Monat (`einnahmenImMonat`, `kostenImMonat`, `kostenSummeImMonat`), keine
 * zweite Rechnung. Das laufende Jahr zählt bis heute: Monate nach dem
 * heutigen sind `null` („noch offen"), nicht 0 — eine 0 behauptete, dass nichts
 * eingenommen wurde. Der heutige Monat zählt so, wie ihn die Monatsansicht
 * zeigt: die Einnahmen bis jetzt, die Kosten des ganzen Monats.
 *
 * Alles in ganzen Cent. Wo hier gerundet wird, ist es Anzeige (Anteil in
 * Prozent, die Hochrechnung in ganzen Euro), nie ein Betrag, der in eine
 * Summe zurückfließt.
 */

/** Ein Kostenposten, so weit ihn die Jahresrechnung braucht (zusätzlich Name und Art für die Tabelle). */
export type KostenpostenFuerJahr = KostenpostenFuerRechnung & {
  id: string
  name: string
  kategorie: KostenKategorieWert
}

export type JahrMonatZahlen = {
  servicegebuehrCents: number
  kostenCents: number
  ergebnisCents: number
  bestellungen: number
  /** Der größte einmalige Posten des Monats — für die Beschriftung am Balken. */
  einmalig: { name: string; cents: number } | null
}

export type JahrMonat = {
  monat: Monatsschluessel
  /** null = noch offen: der Monat liegt nach heute. */
  zahlen: JahrMonatZahlen | null
}

export type KostenImJahrZeile = {
  id: string
  name: string
  kategorie: KostenKategorieWert
  rhythmus: KostenRhythmusWert
  /** Der eingetragene Betrag in Cent — bei JAEHRLICH der Jahresbetrag. */
  betragCents: number
  /** In wie vielen gezählten Monaten des Jahres der Posten etwas kostet. */
  monate: number
  /** Nur bei einmaligen Posten: ihr Monat. */
  einmaligImMonat: Monatsschluessel | null
  imJahrCents: number
  /** Anteil an den Kosten des Jahres in ganzen Prozent; null bei Kosten 0. */
  anteilProzent: number | null
}

export type Hochrechnung = {
  /** Das Ergebnis am Jahresende, wenn die offenen Monate so laufen wie der Schnitt — in Cent. */
  ergebnisCents: number
  /** Der Schnitt des Ergebnisses je vollem Monat. */
  schnittCents: number
  offeneMonate: number
  /** Die Monate, aus denen der Schnitt kommt (bis zu drei volle Monate vor dem heutigen). */
  von: Monatsschluessel
  bis: Monatsschluessel
}

export type JahrRechnung = {
  jahr: number
  /** Immer zwölf, Jänner zuerst. */
  monate: JahrMonat[]
  /** Der letzte gezählte Monat (bis heute); null, wenn das Jahr noch nicht begonnen hat. */
  zaehltBis: Monatsschluessel | null
  servicegebuehrenCents: number
  bestellungen: number
  kostenCents: number
  /** Die Kosten nach Rhythmus: laufend (monatlich) · jährlich · einmalig — zusammen genau `kostenCents`. */
  kostenNachRhythmus: Record<KostenRhythmusWert, number>
  ergebnisCents: number
  /** Nur Posten, die im Jahr etwas kosten, in der Reihenfolge der Eingabe. */
  posten: KostenImJahrZeile[]
  /** Nur im laufenden Jahr, solange noch Monate offen sind und es volle Monate zum Mitteln gibt. */
  hochrechnung: Hochrechnung | null
  /** Lässt eine Zahl DIESES Jahres eine Testzahlung aus (Register Z4)? Nur dann gilt der Hinweis für das Jahr. */
  testzahlungAusgelassen: boolean
}

/** Wie viele volle Monate in den Schnitt der Hochrechnung gehen. */
export const HOCHRECHNUNG_MONATE = 3

/**
 * Das Jahr aus den Bestellungen und Kostenposten. `bestellungen`: die des
 * Jahres, wie `getFinanzenJahr` sie lädt (mehr schadet nicht — jeder Monat
 * nimmt nur seine eigenen). `heute`: der Monat von „jetzt" in Wiener Zeit.
 */
export function rechneJahr(eingabe: {
  jahr: number
  heute: Monatsschluessel
  bestellungen: readonly BestellungFuerFinanzen[]
  posten: readonly KostenpostenFuerJahr[]
  stripeLiveAb: Date | null
}): JahrRechnung {
  const { jahr, heute, posten, stripeLiveAb } = eingabe

  // Einmal nach Monat sortieren, statt zwölfmal alle Bestellungen zu lesen;
  // gerechnet wird dann je Monat mit derselben Funktion wie in der Monatsansicht.
  const jeMonat = new Map<Monatsschluessel, BestellungFuerFinanzen[]>()
  for (const b of eingabe.bestellungen) {
    const m = monatsschluesselInWien(b.createdAt)
    const liste = jeMonat.get(m)
    if (liste) liste.push(b)
    else jeMonat.set(m, [b])
  }

  const monate: JahrMonat[] = []
  const nachRhythmus: Record<KostenRhythmusWert, number> = { MONATLICH: 0, JAEHRLICH: 0, EINMALIG: 0 }
  const jePosten = new Map<string, { cents: number; monate: number; einmaligImMonat: Monatsschluessel | null }>()
  let servicegebuehrenCents = 0
  let bestellungen = 0
  let kostenCents = 0
  let zaehltBis: Monatsschluessel | null = null
  let testzahlungAusgelassen = false

  for (let n = 1; n <= 12; n++) {
    const monat = monatsschluessel(jahr, n)
    if (monatsAbstand(monat, heute) < 0) {
      monate.push({ monat, zahlen: null })
      continue
    }
    zaehltBis = monat
    const einnahmen = einnahmenImMonat(jeMonat.get(monat) ?? [], monat, stripeLiveAb)
    testzahlungAusgelassen ||= testzahlungenBetroffen(jeMonat.get(monat) ?? [], stripeLiveAb, GEZAEHLTE_TOEPFE)
    const kosten = kostenSummeImMonat(posten, monat)

    let einmalig: JahrMonatZahlen['einmalig'] = null
    for (const p of posten) {
      const betrag = kostenImMonat(p, monat)
      if (betrag <= 0) continue
      nachRhythmus[p.rhythmus] += betrag
      const bisher = jePosten.get(p.id) ?? { cents: 0, monate: 0, einmaligImMonat: null }
      bisher.cents += betrag
      bisher.monate++
      if (p.rhythmus === 'EINMALIG') {
        bisher.einmaligImMonat = monat
        if (einmalig === null || betrag > einmalig.cents) einmalig = { name: p.name, cents: betrag }
      }
      jePosten.set(p.id, bisher)
    }

    servicegebuehrenCents += einnahmen.gezaehltCents
    bestellungen += einnahmen.bestellungen
    kostenCents += kosten.cents
    monate.push({
      monat,
      zahlen: {
        servicegebuehrCents: einnahmen.gezaehltCents,
        kostenCents: kosten.cents,
        ergebnisCents: einnahmen.gezaehltCents - kosten.cents,
        bestellungen: einnahmen.bestellungen,
        einmalig,
      },
    })
  }

  const postenZeilen: KostenImJahrZeile[] = []
  for (const p of posten) {
    const summe = jePosten.get(p.id)
    if (!summe) continue
    postenZeilen.push({
      id: p.id,
      name: p.name,
      kategorie: p.kategorie,
      rhythmus: p.rhythmus,
      betragCents: p.betragCents,
      monate: summe.monate,
      einmaligImMonat: summe.einmaligImMonat,
      imJahrCents: summe.cents,
      anteilProzent: kostenCents > 0 ? Math.round((summe.cents * 100) / kostenCents) : null,
    })
  }

  const ergebnisCents = servicegebuehrenCents - kostenCents
  return {
    jahr,
    monate,
    zaehltBis,
    servicegebuehrenCents,
    bestellungen,
    kostenCents,
    kostenNachRhythmus: nachRhythmus,
    ergebnisCents,
    posten: postenZeilen,
    hochrechnung: hochrechnungBisJahresende(jahr, heute, monate, ergebnisCents),
    testzahlungAusgelassen,
  }
}

/**
 * Der Hinweis „Testzahlungen … nicht mitgezählt" in Finanzen › Jahr: für das
 * gezeigte Jahr, wenn eine seiner Zahlen eine auslässt; für das Vorjahr nur,
 * solange „mit <Vorjahr> vergleichen" an ist — sonst steht keine Zahl des
 * Vorjahrs auf der Seite (Nacharbeit 100). `hinweis`: der Satz aus der
 * Abfrage (null ohne Stichtag oder ohne Testzahlung im geladenen Fenster).
 */
export function testzahlungenHinweisImJahr(
  hinweis: string | null,
  jahr: Pick<JahrRechnung, 'testzahlungAusgelassen'>,
  vorjahr: Pick<JahrRechnung, 'testzahlungAusgelassen'> | null,
  mitVergleich: boolean
): string | null {
  return jahr.testzahlungAusgelassen || (mitVergleich && vorjahr?.testzahlungAusgelassen === true) ? hinweis : null
}

/**
 * „Bis Jahresende ≈": der Schnitt des Ergebnisses der letzten drei VOLLEN
 * Monate (die vor dem heutigen, ab dem ersten Monat mit Zahlen — vorher gab es
 * die Plattform nicht) mal die offenen Monate, auf das Ergebnis bis heute
 * gelegt. Nur im laufenden Jahr, und nur ein Hinweis: Die Zahl steht in keiner
 * Summe und in keiner CSV.
 */
function hochrechnungBisJahresende(
  jahr: number,
  heute: Monatsschluessel,
  monate: readonly JahrMonat[],
  ergebnisBisHeute: number
): Hochrechnung | null {
  if (zerlegeMonat(heute)?.jahr !== jahr) return null
  const offeneMonate = monate.filter((m) => m.zahlen === null).length
  if (offeneMonate === 0) return null

  const ersterMitZahlen = monate.findIndex((m) => m.zahlen !== null && (m.zahlen.bestellungen > 0 || m.zahlen.kostenCents > 0))
  if (ersterMitZahlen < 0) return null
  const volle = monate
    .slice(ersterMitZahlen)
    .filter((m): m is JahrMonat & { zahlen: JahrMonatZahlen } => m.zahlen !== null && m.monat !== heute)
    .slice(-HOCHRECHNUNG_MONATE)
  const erster = volle[0]
  const letzter = volle[volle.length - 1]
  if (!erster || !letzter) return null

  const schnittCents = Math.round(volle.reduce((summe, m) => summe + m.zahlen.ergebnisCents, 0) / volle.length)
  return {
    ergebnisCents: ergebnisBisHeute + schnittCents * offeneMonate,
    schnittCents,
    offeneMonate,
    von: erster.monat,
    bis: letzter.monat,
  }
}

/**
 * Das erste Jahr, für das es etwas zu sehen gibt: das der ersten Bestellung
 * oder des frühesten Kostenpostens. Ohne beides das laufende.
 */
export function ersteDatenJahr(
  ersterBestellmonat: Monatsschluessel | null,
  postenAb: readonly Monatsschluessel[],
  heute: Monatsschluessel
): number {
  const jahre = [ersterBestellmonat, ...postenAb]
    .filter((m): m is Monatsschluessel => m !== null)
    .map((m) => zerlegeMonat(m)?.jahr)
    .filter((j): j is number => j !== undefined)
  return Math.min(zerlegeMonat(heute)?.jahr ?? Infinity, ...jahre)
}

/** Ein gewünschtes Jahr, das vor den ersten Daten oder nach dem laufenden liegt, ist das laufende. */
export function jahrImBereich(gewuenscht: number, ersteJahr: number, laufendesJahr: number): number {
  return gewuenscht < ersteJahr || gewuenscht > laufendesJahr ? laufendesJahr : gewuenscht
}

// ─── Texte, Adressen und Kennzahlen des Jahres ───────────────────────────────

/** „Jän–Okt" — die gezählten Monate; ein einzelner Monat steht allein. */
export function monatsSpanne(von: Monatsschluessel, bis: Monatsschluessel): string {
  return von === bis ? monatOhneJahr(von) : `${monatOhneJahr(von)}–${monatOhneJahr(bis)}`
}

/** Ein Ergebnis mit Vorzeichen: „+ € 185,50" · „− € 203,10" · „€ 0,00". */
export function ergebnisText(cents: number, stellen: 0 | 2 = 2): string {
  const betrag = formatEuro(centsAlsEuro(stellen === 0 ? Math.round(Math.abs(cents) / 100) * 100 : Math.abs(cents)), stellen)
  if (cents > 0) return `+ ${betrag}`
  if (cents < 0) return `− ${betrag}`
  return betrag
}

export const FINANZEN_JAHR_TEXT = {
  umschalter: 'Zeitraum der Finanzen',
  monat: 'Monat',
  jahr: 'Jahr',
  jahrWaehlen: 'Jahr wählen',
  vorigesJahr: 'Voriges Jahr',
  naechstesJahr: 'Nächstes Jahr',
  uebersicht: 'Übersicht',
  csv: (jahr: number) => `CSV ${jahr}`,
  csvHerunterladen: 'herunterladen',
  satz: (jahr: number, laufend: boolean) =>
    laufend
      ? `Was die Plattform ${jahr} einnimmt und was sie kostet — von Jänner bis heute, Testzahlungen zählen nicht.`
      : `Was die Plattform ${jahr} eingenommen hat und was sie gekostet hat — Testzahlungen zählen nicht.`,
  diagrammTitel: (jahr: number) => `${jahr} nach Monaten`,
  diagrammBeschriftung: (jahr: number) => `Servicegebühren und Kosten je Monat ${jahr}`,
  monatFuerMonat: 'Monat für Monat',
  kostenImJahr: 'Kosten im Jahr',
  summe: (jahr: number) => `Summe ${jahr}`,
  vergleichen: (vorjahr: number) => `mit ${vorjahr} vergleichen`,
  vergleichAb: (jahr: number) => `ab ${jahr}`,
  vergleichSpalte: 'Vorjahr',
  nochOffen: 'noch offen',
  legendeServicegebuehren: 'Servicegebühren',
  legendeKosten: 'Kosten',
  legendeVorjahr: (vorjahr: number) => `Servicegebühren ${vorjahr}`,
  leerTitel: 'Für dieses Jahr gibt es keine Zahlen',
  leer: 'Sobald Bestellungen eingehen oder Kosten eingetragen sind, stehen hier die Monate nebeneinander.',
  einmaligZusatz: 'einmalig',
  hochrechnungSatz: (von: Monatsschluessel, bis: Monatsschluessel) =>
    `Hochrechnung mit dem Schnitt ${monatsSpanne(von, bis)}, nur als Hinweis`,
  keineKosten: 'keine Kosten im Jahr',
  keineKostenTitel: (jahr: number) => `Für ${jahr} sind keine Kosten eingetragen`,
  keineKostenSatz: 'Kostenposten trägst du in der Monatsansicht ein.',
  keineKostenLink: 'Kostenposten eintragen',
  bisHeute: 'bis heute',
  ganzesJahr: 'im ganzen Jahr',
  /**
   * Die Regel-Zeile unter dem Jahr (Mockup admin-finanzen-jahr). Eine
   * Abweichung vom Wortlaut des Mockups, und sie ist Absicht: Dort stünde
   * „jährliche … in ihrem Monat", gerechnet wird aber wie im Monat — ein
   * Jahresposten ist auf zwölf Monate umgelegt (`kostenImMonat`). Die Zeile
   * sagt, was die Zahlen tun.
   */
  regel:
    'Jahr = Summe der Monate (Wiener Zeit). Monatliche Posten zählen je Monat, in dem sie liefen; jährliche sind auf die zwölf Monate umgelegt, einmalige zählen in ihrem Monat. Ein Klick auf einen Balken oder eine Zeile öffnet den Monat. „CSV“ lädt alle Monate und Posten für die Steuerberatung.',
} as const

/** Die Adresse der Jahresansicht: Zeitraum und Jahr immer, der Reiter nur, wenn er nicht der Standard ist. */
export function finanzenJahrAdresse(ansicht: { jahr: number; reiter: FinanzenReiterId }): string {
  const parameter = new URLSearchParams({ zeitraum: 'jahr', jahr: String(ansicht.jahr) })
  if (ansicht.reiter !== FINANZEN_REITER_STANDARD) parameter.set('reiter', ansicht.reiter)
  // Seit Nr. 193 direkt auf Geld (N32) — /admin/finanzen leitet nur noch um.
  return `/admin/geld?${parameter.toString()}`
}

/** Die Adresse der CSV — eine Route, kein Seitenaufruf. */
export function finanzenExportAdresse(jahr: number): string {
  return `/admin/finanzen/export?jahr=${jahr}`
}

/** Unterreiter der Jahresansicht: Übersicht · Kosten (mit der Zahl der Posten) · Auszahlungen · Entfallene Gebühren. */
export function finanzenJahrUnterreiter(jahr: number, anzahlPosten: number): UnterreiterDaten[] {
  return FINANZEN_REITER_IDS.map((id) => ({
    id,
    label: id === 'monat' ? FINANZEN_JAHR_TEXT.uebersicht : finanzenReiterLabel(id),
    href: finanzenJahrAdresse({ jahr, reiter: id }),
    ...(id === 'kosten' ? { zahl: String(anzahlPosten) } : {}),
  }))
}

/**
 * Die Kennzahlen des Jahres: Servicegebühren (mit Zahl der Bestellungen und
 * Monatsspanne) · Kosten (laufend · jährlich · einmalig) · Ergebnis · im
 * laufenden Jahr „Bis Jahresende ≈" als Hinweis. Der Ton des Ergebnisses ist
 * grün nur bei einem Plus, orange bei einem Minus — kein Rot (Register O1).
 */
export function jahrKennzahlen(rechnung: JahrRechnung, laufendesJahr: number): KennzahlDaten[] {
  const { jahr } = rechnung
  const text = FINANZEN_JAHR_TEXT
  const spanne = rechnung.zaehltBis === null ? null : monatsSpanne(monatsschluessel(jahr, 1), rechnung.zaehltBis)
  const rhythmus = rechnung.kostenNachRhythmus
  const euro = (cents: number) => formatEuro(centsAlsEuro(cents))

  const kennzahlen: KennzahlDaten[] = [
    {
      id: 'servicegebuehren',
      titel: `Servicegebühren ${jahr}`,
      titelKurz: 'Gebühren',
      wert: euro(rechnung.servicegebuehrenCents),
      satz: [spanne, mitAnzahl(rechnung.bestellungen, 'Bestellung', 'Bestellungen')].filter((s) => s !== null).join(' · '),
    },
    {
      id: 'kosten',
      titel: `Kosten ${jahr}`,
      titelKurz: 'Kosten',
      wert: euro(rechnung.kostenCents),
      satz:
        rechnung.kostenCents === 0
          ? text.keineKosten
          : `laufend ${euro(rhythmus.MONATLICH)} · jährlich ${euro(rhythmus.JAEHRLICH)} · einmalig ${euro(rhythmus.EINMALIG)}`,
    },
    {
      id: 'ergebnis',
      titel: `Ergebnis ${jahr}`,
      titelKurz: 'Ergebnis',
      wert: ergebnisText(rechnung.ergebnisCents),
      satz: jahr === laufendesJahr ? text.bisHeute : text.ganzesJahr,
      ton: rechnung.ergebnisCents > 0 ? 'laeuft' : rechnung.ergebnisCents < 0 ? 'tun' : 'neutral',
    },
  ]
  if (rechnung.hochrechnung) {
    kennzahlen.push({
      id: 'jahresende',
      titel: 'Bis Jahresende',
      wert: `≈ ${ergebnisText(rechnung.hochrechnung.ergebnisCents, 0)}`,
      satz: text.hochrechnungSatz(rechnung.hochrechnung.von, rechnung.hochrechnung.bis),
      // Am Handy höchstens drei Kacheln; eine Schätzung gehört nicht zu den ersten dreien.
      amHandy: false,
    })
  }
  return kennzahlen
}

/** Ein Monat, wie das Diagramm und die Tabelle der Jahresansicht ihn zeigen — mit dem Ziel, das der Klick öffnet. */
export type JahrMonatAnzeige = {
  monat: Monatsschluessel
  /** „Okt 2026" für die Tabelle. */
  bezeichnung: string
  /** Die Monatsansicht dieses Monats. */
  href: string
  zahlen: Pick<JahrMonatZahlen, 'servicegebuehrCents' | 'kostenCents' | 'ergebnisCents' | 'bestellungen'> | null
  /** Der Posten, der den Monat aus der Reihe bringt (einmalig und mehr als die Hälfte der Kosten) — sein Name steht am Balken. */
  ausreisser: string | null
  /** Die Servicegebühren desselben Monats im Vorjahr; null ohne Vergleich. */
  vorjahrCents: number | null
}

/**
 * Der Ausreißer eines Monats: ein einmaliger Posten, der mehr als die Hälfte
 * der Kosten des Monats ausmacht (die Markenanmeldung im Mai, nicht die
 * Domain im Okt neben zwölf laufenden Posten). Sein Name steht direkt am Balken.
 */
export function ausreisserImMonat(zahlen: JahrMonatZahlen): string | null {
  const { einmalig, kostenCents } = zahlen
  return einmalig !== null && einmalig.cents * 2 > kostenCents ? einmalig.name : null
}

/** Die zwölf Monate für Diagramm und Tabelle; `vorjahr` füllt die Vergleichsspalte, sonst bleibt sie null. */
export function jahrMonateFuerAnzeige(rechnung: JahrRechnung, vorjahr: JahrRechnung | null): JahrMonatAnzeige[] {
  return rechnung.monate.map((m, i) => {
    const teile = zerlegeMonat(m.monat)
    return {
      monat: m.monat,
      bezeichnung: `${monatOhneJahr(m.monat)} ${teile?.jahr ?? rechnung.jahr}`,
      href: finanzenAdresse({ monat: m.monat, reiter: FINANZEN_REITER_STANDARD }),
      zahlen: m.zahlen
        ? {
            servicegebuehrCents: m.zahlen.servicegebuehrCents,
            kostenCents: m.zahlen.kostenCents,
            ergebnisCents: m.zahlen.ergebnisCents,
            bestellungen: m.zahlen.bestellungen,
          }
        : null,
      ausreisser: m.zahlen ? ausreisserImMonat(m.zahlen) : null,
      vorjahrCents: vorjahr?.monate[i]?.zahlen?.servicegebuehrCents ?? null,
    }
  })
}

// ─── CSV für die Steuerberatung ──────────────────────────────────────────────

export const FINANZEN_CSV = {
  monate: ['Monat', 'Servicegebühren (€)', 'Kosten (€)', 'Ergebnis (€)', 'Bestellungen'],
  posten: ['Kostenposten', 'Rhythmus', 'Betrag (€)', 'Monate im Jahr', 'Im Jahr (€)'],
} as const

/**
 * Ein Textfeld der CSV. Mit Semikolon, Anführungszeichen oder Zeilenumbruch in
 * Anführungszeichen; beginnt es mit einem Zeichen, das Excel als Formel liest
 * (= + - @), steht ein Hochkomma davor — die Namen der Kostenposten tippt der
 * Betreiber selbst, aber eine Tabelle, die sich beim Öffnen von selbst
 * ausführt, soll es nie geben.
 */
export function csvFeld(text: string): string {
  const entschaerft = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return /[;"\r\n]/.test(entschaerft) ? `"${entschaerft.replace(/"/g, '""')}"` : entschaerft
}

/**
 * Das Jahr als CSV: UTF-8 mit BOM (Excel in Österreich erkennt sonst keine
 * Umlaute), Semikolon, Euro mit Komma, Zeilenende CRLF. Zwei Blöcke mit je
 * eigener Kopfzeile: eine Zeile je Monat (offene Monate mit leeren Zahlen,
 * nicht mit 0) und eine je Kostenposten, jeweils mit Summenzeile. Die Zahlen
 * sind die der Jahresansicht — nur Beträge, Bestellungen als Zahl, die Namen der
 * Kostenposten (Betriebsdaten der Plattform); keine Hof- und keine
 * Kundinnendaten.
 */
export function jahrAlsCsv(rechnung: JahrRechnung): string {
  // Textfelder gehen durch csvFeld, Zahlen nie: ein Minus vor einem Betrag ist keine Formel.
  const zeilen: string[][] = []
  zeilen.push(FINANZEN_CSV.monate.map(csvFeld))
  for (const m of rechnung.monate) {
    const name = csvFeld(monatsgrenzenWienFuer(m.monat).bezeichnung)
    zeilen.push(
      m.zahlen === null
        ? [name, '', '', '', '']
        : [
            name,
            csvBetrag(m.zahlen.servicegebuehrCents),
            csvBetrag(m.zahlen.kostenCents),
            csvBetrag(m.zahlen.ergebnisCents),
            String(m.zahlen.bestellungen),
          ]
    )
  }
  const summe = csvFeld(FINANZEN_JAHR_TEXT.summe(rechnung.jahr))
  zeilen.push([
    summe,
    csvBetrag(rechnung.servicegebuehrenCents),
    csvBetrag(rechnung.kostenCents),
    csvBetrag(rechnung.ergebnisCents),
    String(rechnung.bestellungen),
  ])
  zeilen.push([])
  zeilen.push(FINANZEN_CSV.posten.map(csvFeld))
  for (const p of rechnung.posten) {
    zeilen.push([
      csvFeld(p.name),
      csvFeld(KOSTEN_RHYTHMUS_KURZ[p.rhythmus]),
      csvBetrag(p.betragCents),
      csvFeld(p.einmaligImMonat !== null ? monatsgrenzenWienFuer(p.einmaligImMonat).bezeichnung : String(p.monate)),
      csvBetrag(p.imJahrCents),
    ])
  }
  zeilen.push([summe, '', '', '', csvBetrag(rechnung.kostenCents)])
  return `\uFEFF${zeilen.map((z) => z.join(';')).join('\r\n')}\r\n`
}

// ─── Geld: Abgleich, Stripe-Gebühren, Monatsabschluss (Register N37, Nr. 191) ─

/**
 * Die Stripe-Gebühren eines Monats in Cent: die Summe der Tageszeilen
 * (BetriebMessung `stripeGebuehrCents`, je UTC-Tag), deren Tag im Monat liegt.
 * Der Monat zählt hier nach dem UTC-Kalendertag der Buchung, nicht nach
 * Wiener Mitternacht — eine Buchung zwischen 0 und 2 Uhr Wien am Monatsersten
 * steht im Vormonat. Für eine Kostenzeile ist das genau genug; gerechnet wird
 * nichts daraus.
 */
export function stripeGebuehrenImMonat(tage: readonly { tag: string; cents: number }[], monat: Monatsschluessel): number {
  return tage.reduce((summe, t) => (t.tag.slice(0, 7) === monat ? summe + Math.max(0, Math.round(t.cents)) : summe), 0)
}

/** Die Kosten des Monats auf der Seite Geld: Stripe-Gebühren (trägt die Plattform, N37) und Betrieb (die Kostenposten). */
export type GeldKosten = { stripeCents: number; betriebCents: number; cents: number }

export function geldKosten(stripeCents: number, betriebCents: number): GeldKosten {
  return { stripeCents, betriebCents, cents: stripeCents + betriebCents }
}

/** Ergebnis des Monats: was die Servicegebühr gebracht hat (eingezogen + geschuldet) minus alle Kosten. */
export function geldErgebnisCents(gezaehltCents: number, kosten: GeldKosten): number {
  return gezaehltCents - kosten.cents
}

/** Eine Online-Bestellung des Monats, so weit die Erstattungen sie brauchen (Erwartung laut Datenbank wie im Abgleich). */
export type BestellungFuerErstattung = { erstattetCents: number; erstattungOffen: boolean }

export type ErstattungenMonat = { cents: number; anzahl: number; offen: number }

/**
 * Die Erstattungen eines Monats: Summe und Zahl der Bestellungen, bei denen
 * etwas zurückging (`erstattetCents` aus `erwartetLautDatenbank`,
 * src/lib/geld-abgleich.ts — dieselbe Regel wie der Abgleich), und wie viele
 * noch offen sind (`erstattungOffenSeit`).
 */
export function erstattungenImMonat(bestellungen: readonly BestellungFuerErstattung[]): ErstattungenMonat {
  return bestellungen.reduce<ErstattungenMonat>(
    (e, b) => ({
      cents: e.cents + Math.max(0, b.erstattetCents),
      anzahl: e.anzahl + (b.erstattetCents > 0 || b.erstattungOffen ? 1 : 0),
      offen: e.offen + (b.erstattungOffen ? 1 : 0),
    }),
    { cents: 0, anzahl: 0, offen: 0 }
  )
}

export const MONATSABSCHLUSS_PUNKTE = ['abgleich', 'erstattung', 'kosten', 'csv'] as const
export type MonatsabschlussPunktId = (typeof MONATSABSCHLUSS_PUNKTE)[number]

export type MonatsabschlussPunkt = { id: MonatsabschlussPunktId; text: string; erledigt: boolean; offen: string }

export type MonatsabschlussEingabe = {
  /** Ein erfolgreicher Lauf des Abgleichs NACH dem Monatsende — sonst ist „ohne Abweichung“ nur nicht geprüft. */
  abgleichNachMonatsende: boolean
  /** Offene Abweichungen zu Bestellungen dieses Monats. */
  abweichungen: number
  /** Offene Erstattungen zu Bestellungen dieses Monats. */
  erstattungenOffen: number
  /** Kostenposten, die im Monat zählen. */
  kostenPosten: number
  /** Die CSV des Jahres wurde nach dem Monatsende geladen (Protokoll `finanzen_export`). */
  csvGeladen: boolean
}

/** Die Prüfliste des Monatsabschlusses (N37, Mockup admin-geld) — je Punkt, ob erledigt, und sonst warum nicht. */
export function monatsabschlussPruefliste(e: MonatsabschlussEingabe): MonatsabschlussPunkt[] {
  return [
    {
      id: 'abgleich',
      text: 'Abgleich mit Stripe ohne ungeklärte Abweichung',
      erledigt: e.abgleichNachMonatsende && e.abweichungen === 0,
      offen: !e.abgleichNachMonatsende
        ? 'der Abgleich ist nach dem Monatsende noch nicht gelaufen'
        : `${mitAnzahl(e.abweichungen, 'Abweichung', 'Abweichungen')} ungeklärt`,
    },
    {
      id: 'erstattung',
      text: 'Keine Erstattung offen',
      erledigt: e.erstattungenOffen === 0,
      offen: `${mitAnzahl(e.erstattungenOffen, 'Erstattung', 'Erstattungen')} offen`,
    },
    { id: 'kosten', text: 'Kosten des Monats erfasst', erledigt: e.kostenPosten > 0, offen: 'noch keine Kosten eingetragen' },
    { id: 'csv', text: 'CSV für die Buchhaltung geladen', erledigt: e.csvGeladen, offen: 'die CSV ist nach dem Monatsende noch nicht geladen' },
  ]
}

/** Ob der Monat abgeschlossen werden kann — sonst der Grund, ein Satz aus den offenen Punkten. */
export function monatsabschlussMoeglich(punkte: readonly MonatsabschlussPunkt[]): { moeglich: true } | { moeglich: false; grund: string } {
  const offen = punkte.filter((p) => !p.erledigt)
  if (offen.length === 0) return { moeglich: true }
  const liste = offen.map((p) => p.offen)
  return { moeglich: false, grund: `Geht erst, wenn alles erledigt ist: ${liste.join(', ')}.` }
}

/** „2 von 4 erledigt“. */
export function monatsabschlussZeile(punkte: readonly MonatsabschlussPunkt[]): string {
  return `${punkte.filter((p) => p.erledigt).length} von ${punkte.length} erledigt`
}

/**
 * Welche abgeschlossenen Monate eine Änderung an Kosten berührt: alle in
 * [von, bis] (bis null = ohne Ende). Nach dem Abschluss verlangen die
 * Kostenposten-Actions für diese Monate einen Grund (N37).
 */
export function abgeschlosseneMonateBetroffen(
  abgeschlossen: readonly Monatsschluessel[],
  von: Monatsschluessel,
  bis: Monatsschluessel | null
): Monatsschluessel[] {
  return abgeschlossen.filter((m) => monatsAbstand(von, m) >= 0 && (bis === null || monatsAbstand(m, bis) >= 0)).sort()
}

/**
 * Die Monate, die sich ändern, wenn ein Posten statt bis `alt` künftig bis
 * `neu` läuft (null = ohne Ende): genau die zwischen beiden Enden — vor dem
 * früheren Ende bleibt alles, wie es war.
 */
export function monateZwischenEnden(alt: Monatsschluessel | null, neu: Monatsschluessel | null): { von: Monatsschluessel; bis: Monatsschluessel | null } | null {
  if (alt === neu) return null
  if (alt === null) return neu === null ? null : { von: monatVerschoben(neu, 1), bis: null }
  if (neu === null) return { von: monatVerschoben(alt, 1), bis: null }
  return monatsAbstand(alt, neu) > 0 ? { von: monatVerschoben(alt, 1), bis: neu } : { von: monatVerschoben(neu, 1), bis: alt }
}

/** Der Satz, wenn ein abgeschlossener Monat betroffen ist und der Grund fehlt. */
export function kostenGrundFehlt(monate: readonly Monatsschluessel[]): string {
  const namen = monate.map((m) => monatsgrenzenWienFuer(m).bezeichnung)
  return `${namen.length === 1 ? `${namen[0]} ist` : `${namen.join(', ')} sind`} abgeschlossen. Schreib dazu, warum du die Kosten änderst.`
}
