import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  bestellungenBisKostendeckung,
  durchschnittsGebuehr,
  einnahmenImMonat,
  kostenImMonat,
  kostenSummeImMonat,
  monatKurz,
  monateBis,
  utcDatumAlsMonat,
  type BestellungFuerFinanzen,
  type EinnahmenMonat,
  type KostenKategorieWert,
  type KostenRhythmusWert,
  type KostenSumme,
} from '@/lib/finanzen'
import {
  monatsAbstand,
  monatVerschoben,
  monatsgrenzenWienFuer,
  monatsschluesselInWien,
  type Monatsschluessel,
} from '@/lib/servicegebuehr'

/**
 * Die Finanzseite des Betreibers liest hier — und NUR hier. Die Rechnung selbst
 * steht in src/lib/finanzen.ts (rein, ohne Datenbank); diese Datei beschafft
 * Zeilen, wandelt Decimal in ganze Cent und gibt ausschließlich Zahlen und
 * Zeichenketten zurück, damit die Client-Bauteile nichts serialisieren müssen
 * (CODING_STANDARDS, Serialisierung).
 *
 * Decimal → Cent läuft über die Decimal-METHODE, nie über `Number(x) * 100`:
 * Aus 19,99 € würde sonst 1998,9999999999998.
 */

function centsAusDecimal(betrag: Prisma.Decimal): number {
  return Math.round(betrag.mul(100).toNumber())
}

/** Ein Kostenposten, wie die Seite ihn zeigt. */
export type KostenpostenZeile = {
  id: string
  name: string
  kategorie: KostenKategorieWert
  /** Der eingetragene Betrag in Cent — bei JAEHRLICH der JAHRESbetrag. */
  betragCents: number
  rhythmus: KostenRhythmusWert
  ab: Monatsschluessel
  bis: Monatsschluessel | null
  notiz: string | null
  /** Was der Posten im angezeigten Monat kostet, in Cent. */
  imMonatCents: number
}

export type FinanzenVerlaufPunkt = {
  monat: Monatsschluessel
  /** „Sep 26" für die Achse. */
  kurz: string
  /** eingezogen + geschuldet. */
  einnahmenCents: number
  kostenCents: number
}

export type FinanzenDaten = {
  monat: Monatsschluessel
  /** „September 2026". */
  bezeichnung: string
  /** Die Nachbarmonate zum Blättern; null heißt „hier ist Schluss". */
  vorigerMonat: Monatsschluessel | null
  naechsterMonat: Monatsschluessel | null
  einnahmen: EinnahmenMonat
  kosten: KostenSumme
  posten: KostenpostenZeile[]
  verlauf: FinanzenVerlaufPunkt[]
  /** Durchschnittliche Servicegebühr je Bestellung in Cent, 0 = keine Daten. */
  schnittCents: number
  /** Bestellungen bis zur Kostendeckung; null = noch keine Daten. */
  brauchtBestellungen: number | null
}

/**
 * Alles, was die Seite für EINEN Monat braucht.
 *
 * Drei Abfragen, unabhängig von der Zahl der Monate: die Kostenposten, die
 * erste Bestellung (für den Anfang des Diagramms) und die Bestellungen des
 * gezeigten Fensters. Die Bestellungen kommen nur mit den Feldern, die die
 * Regel liest — kein Kundenname, keine Adresse, keine E-Mail.
 */
export async function getFinanzen(
  monat: Monatsschluessel,
  jetzt: Date = new Date()
): Promise<FinanzenDaten> {
  const [postenZeilen, ersteBestellung] = await Promise.all([
    prisma.kostenposten.findMany({
      select: {
        id: true,
        name: true,
        kategorie: true,
        betrag: true,
        rhythmus: true,
        ab: true,
        bis: true,
        notiz: true,
      },
      orderBy: [{ kategorie: 'asc' }, { name: 'asc' }],
    }),
    prisma.order.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
  ])

  const allePosten = postenZeilen.map((p) => ({
    id: p.id,
    name: p.name,
    kategorie: p.kategorie,
    betragCents: centsAusDecimal(p.betrag),
    rhythmus: p.rhythmus,
    ab: utcDatumAlsMonat(p.ab),
    bis: p.bis === null ? null : utcDatumAlsMonat(p.bis),
    notiz: p.notiz,
  }))

  const ersterBestellmonat =
    ersteBestellung === null ? null : monatsschluesselInWien(ersteBestellung.createdAt)
  const monate = monateBis(monat, ersterBestellmonat)

  // Ein Fenster über alle gezeigten Monate: [Anfang des ersten, Ende des
  // gewählten). Eine Abfrage je Monat wäre ein N+1 über zwölf Monate.
  // `!` ist hier sicher: monateBis gibt immer mindestens einen Monat zurück
  // (der gewählte), und die Reihenfolge ist ältester zuerst.
  const fensterVon = monatsgrenzenWienFuer(monate[0]!).von
  const fensterBis = monatsgrenzenWienFuer(monat).bis

  const bestellungen = await prisma.order.findMany({
    where: { createdAt: { gte: fensterVon, lt: fensterBis } },
    select: {
      createdAt: true,
      status: true,
      paymentMethod: true,
      paymentStatus: true,
      serviceFeeCents: true,
      serviceFeeRefundedAt: true,
      platformFeeAmount: true,
    },
  })

  const fuerRegel: BestellungFuerFinanzen[] = bestellungen.map((b) => ({
    createdAt: b.createdAt,
    status: b.status,
    paymentMethod: b.paymentMethod,
    paymentStatus: b.paymentStatus,
    serviceFeeCents: b.serviceFeeCents,
    serviceFeeRefundedAt: b.serviceFeeRefundedAt,
    provisionCents: centsAusDecimal(b.platformFeeAmount),
  }))

  const einnahmenJeMonat = monate.map((m) => einnahmenImMonat(fuerRegel, m))
  // `!` sicher: einnahmenJeMonat ist die Abbildung von `monate` und damit
  // genauso lang — der letzte Eintrag ist der gewählte Monat.
  const einnahmen = einnahmenJeMonat[einnahmenJeMonat.length - 1]!
  const kosten = kostenSummeImMonat(allePosten, monat)

  const verlauf: FinanzenVerlaufPunkt[] = monate.map((m, i) => ({
    monat: m,
    kurz: monatKurz(m),
    // `!` sicher: gleiche Länge wie `monate`, über deren Index hier gelaufen wird.
    einnahmenCents: einnahmenJeMonat[i]!.gezaehltCents,
    kostenCents: kostenSummeImMonat(allePosten, m).cents,
  }))

  const schnittCents = durchschnittsGebuehr(einnahmenJeMonat)

  return {
    monat,
    bezeichnung: monatsgrenzenWienFuer(monat).bezeichnung,
    vorigerMonat: vorigerMonatOderNull(monat, ersterBestellmonat, allePosten),
    naechsterMonat: monatsAbstand(monat, monatsschluesselInWien(jetzt)) > 0
      ? monatVerschoben(monat, 1)
      : null,
    einnahmen,
    kosten,
    posten: allePosten
      .map((p) => ({ ...p, imMonatCents: kostenImMonat(p, monat) }))
      // Nur was im Monat tatsächlich kostet: Ein beendeter Posten gehört in die
      // Monate, in denen er lief, nicht in alle folgenden.
      .filter((p) => p.imMonatCents > 0),
    verlauf,
    schnittCents,
    brauchtBestellungen: bestellungenBisKostendeckung(kosten.cents, schnittCents),
  }
}

/**
 * Zurückblättern nur, solange es davor etwas zu sehen gibt — die erste
 * Bestellung oder der früheste Kostenposten. Ohne beides gibt es keine
 * Vergangenheit, und ein Pfeil, der in leere Monate führt, ist ein Angebot,
 * sich zu verlaufen.
 */
function vorigerMonatOderNull(
  monat: Monatsschluessel,
  ersterBestellmonat: Monatsschluessel | null,
  posten: readonly { ab: Monatsschluessel }[]
): Monatsschluessel | null {
  const anfaenge = [ersterBestellmonat, ...posten.map((p) => p.ab)].filter(
    (m): m is Monatsschluessel => m !== null
  )
  if (anfaenge.length === 0) return null
  const frueheste = anfaenge.reduce((a, b) => (monatsAbstand(a, b) < 0 ? b : a))
  return monatsAbstand(frueheste, monat) > 0 ? monatVerschoben(monat, -1) : null
}

/** Der Monat, den die Seite ohne Parameter zeigt. */
export function aktuellerFinanzMonat(jetzt: Date = new Date()): Monatsschluessel {
  return monatsschluesselInWien(jetzt)
}
