import * as Sentry from '@sentry/nextjs'
import type Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { utcTagesbeginn } from '@/lib/betrieb'
import {
  GELD_ABGLEICH_FENSTER_MS,
  KUNDENSTREIT_ART,
  STRIPE_GEBUEHR_ART,
  abweichungArt,
  abweichungCents,
  gleicheAb,
  kundenstreitAnfang,
  kundenstreitArt,
  kundenstreitArtVonStand,
  kundenstreitOffen,
  leseAbweichungArt,
  leseKundenstreitArt,
  stripeGebuehrenJeTag,
  type SaldoBuchung,
  type StripeZahlung,
} from '@/lib/geld-abgleich'
import { ladeAbweichungZeilen, ladeBestellungenFuerAbgleich } from '@/server/queries/geld'

/*
 * Der Geld-Abgleich mit Stripe (Register N37, Nr. 191) — die Servergrenze.
 * Der Ablauf `geld-abgleich` (täglich 06:30 UTC, /api/cron/geld-abgleich)
 * liest bei Stripe NUR LESEND: PaymentIntents, Erstattungen und Buchungen im
 * Saldo des Plattformkontos (Balance Transactions) der letzten 48 Stunden —
 * mit `expand` statt einer Abfrage je Zahlung, den Seiten folgt die
 * Auto-Paginierung des SDK. Der Vergleich ist rein (src/lib/geld-abgleich.ts).
 *
 * ERST ALLES LESEN, DANN SCHREIBEN: Scheitert Stripe mittendrin, schreibt der
 * Lauf nichts — sonst hielte er eine offene Abweichung für geklärt, nur weil
 * ihre Zahlung nicht mehr gelesen wurde. Der Fehler geht als Warnung an
 * Sentry (nur Art und Klasse, nie ein Betrag oder eine Kennung) und als
 * `GeldAbgleichStripeFehler` an den Herzschlag: Der Ablauf steht dann auf
 * Admin › Betrieb als gescheitert; die anderen Abläufe laufen davon
 * unberührt weiter (jeder hat seine eigene Route).
 *
 * Offene Abweichungen prüft jeder Lauf mit — auch wenn ihre Zahlung älter als
 * 48 Stunden ist: Ihr PaymentIntent wird einzeln nachgeladen (höchstens
 * NACHLADEN_HOECHSTENS). So verschwindet eine Abweichung erst, wenn Datenbank
 * und Stripe wieder übereinstimmen („erledigt verschwindet von selbst“, N32).
 *
 * Streitfälle zu Kundenzahlungen (Nr. 289, E-022): Der Lauf liest dazu die
 * Streitfälle der letzten 120 Tage — in einem EIGENEN Versuch. Scheitert er
 * oder ist die Liste abgeschnitten, geht eine Warnung an Sentry (Schritt
 * `streit`), die Zeilen `kundenstreit:*` bleiben, wie sie sind, und der übrige
 * Abgleich läuft weiter. Sonst: ein offener Fall mit Bestellung ohne Zeile
 * bekommt eine (der Webhook kam nicht an), eine Zeile, deren Fall Stripe nicht
 * mehr offen führt, wird gelöscht; eine Zeile, deren Fall nicht in der Liste
 * steht, bleibt (Warnung nur mit der Kennung).
 *
 * Nie Adresse, Name, Inhalt oder Token: gelesen werden nur Kennungen,
 * Stände und Beträge; gespeichert nur Kennung und Cent.
 */

/** Höchstens so viele PaymentIntents lädt ein Lauf einzeln nach (offene Abweichungen, Zahlungen ohne Treffer in der Liste). */
export const NACHLADEN_HOECHSTENS = 50

/** Schutz gegen eine endlose Liste: mehr Einträge je Liste liest ein Lauf nicht. */
export const LISTE_HOECHSTENS = 10_000

/** Wie weit der Lauf Streitfälle zurückliest (Nr. 289) — länger, als Stripe einen Fall offen führt. */
const STREIT_FENSTER_MS = 120 * 24 * 60 * 60 * 1000

/** Ohne Antwortfrist von Stripe gilt Eingang + 7 Tage (E-022) — in Sekunden wie `created`. */
const STREIT_FRIST_OHNE_S = 7 * 24 * 60 * 60

/** Stripe war beim Lesen nicht erreichbar oder lehnte ab — der Lauf schreibt nichts. */
export class GeldAbgleichStripeFehler extends Error {
  constructor() {
    super('Geld-Abgleich: Stripe nicht gelesen')
    this.name = 'GeldAbgleichStripeFehler'
  }
}

export type GeldAbgleichErgebnis = {
  zahlungen: number
  verglichen: number
  abweichungen: number
  neu: number
  geklaert: number
  stripeGebuehrTage: number
}

async function alle<T>(liste: AsyncIterable<T>): Promise<T[]> {
  return (await alleMitRand(liste)).eintraege
}

/** Wie `alle`, sagt aber, ob die Liste an LISTE_HOECHSTENS abgeschnitten wurde. */
async function alleMitRand<T>(liste: AsyncIterable<T>): Promise<{ eintraege: T[]; abgeschnitten: boolean }> {
  const eintraege: T[] = []
  for await (const eintrag of liste) {
    if (eintraege.length >= LISTE_HOECHSTENS) return { eintraege, abgeschnitten: true }
    eintraege.push(eintrag)
  }
  return { eintraege, abgeschnitten: false }
}

/** Ein PaymentIntent als Zahlung in Cent — die Erstattung aus der letzten Belastung (expand). */
function alsZahlung(pi: Stripe.PaymentIntent): StripeZahlung {
  const belastung = pi.latest_charge !== null && typeof pi.latest_charge === 'object' ? pi.latest_charge : null
  return {
    paymentIntentId: pi.id,
    betragCents: pi.amount_received,
    gebuehrCents: pi.application_fee_amount ?? 0,
    erstattetCents: belastung?.amount_refunded ?? 0,
  }
}

function istNichtGefunden(err: unknown): boolean {
  const e = err as { code?: unknown; statusCode?: unknown } | null
  return e?.code === 'resource_missing' || e?.statusCode === 404
}

/**
 * Der tägliche Lauf (Herzschlag in der Route). Liest Stripe, vergleicht,
 * schreibt Abweichungen und Stripe-Gebühren je Tag in BetriebMessung.
 */
export async function gleicheGeldAb(jetzt: Date): Promise<GeldAbgleichErgebnis> {
  const ab = Math.floor((jetzt.getTime() - GELD_ABGLEICH_FENSTER_MS) / 1000)
  // Gebühren ab Mitternacht (UTC) des ersten Tages: So ist jeder Tag ganz gelesen, nur heute nicht — den schreibt morgen der nächste Lauf ganz.
  const gebuehrenAb = Math.floor(utcTagesbeginn(new Date(jetzt.getTime() - GELD_ABGLEICH_FENSTER_MS)).getTime() / 1000)
  const offeneZeilen = await ladeAbweichungZeilen()
  const offen = offeneZeilen.flatMap((z) => {
    const gelesen = leseAbweichungArt(z.art)
    return gelesen ? [{ ...gelesen, tag: z.tag, art: z.art }] : []
  })

  // ─── Stripe lesen (nur lesend) ───
  // Erst hier geladen: Heute und Geld lesen aus dieser Datei, ohne den Stripe-Client (server-only) mitzuziehen.
  const { stripe } = await import('@/lib/stripe')
  const zahlungen = new Map<string, StripeZahlung>()
  let buchungen: SaldoBuchung[] = []
  let saldoAbgeschnitten = false
  try {
    const [intents, erstattungen, saldoListe] = await Promise.all([
      alle(stripe.paymentIntents.list({ created: { gte: ab }, limit: 100, expand: ['data.latest_charge'] })),
      alle(stripe.refunds.list({ created: { gte: ab }, limit: 100, expand: ['data.payment_intent.latest_charge'] })),
      alleMitRand(stripe.balanceTransactions.list({ created: { gte: gebuehrenAb }, limit: 100 })),
    ])
    const saldo = saldoListe.eintraege
    saldoAbgeschnitten = saldoListe.abgeschnitten
    for (const pi of intents) zahlungen.set(pi.id, alsZahlung(pi))
    for (const r of erstattungen) {
      if (r.payment_intent !== null && typeof r.payment_intent === 'object') zahlungen.set(r.payment_intent.id, alsZahlung(r.payment_intent))
    }
    buchungen = saldo.map((b) => ({ created: b.created, fee: b.fee, type: b.type, amount: b.amount }))
  } catch (err) {
    meldeStripe(err, 'liste')
    throw new GeldAbgleichStripeFehler()
  }

  // Streitfälle (Nr. 289): eigener Versuch — null heißt „nicht vollständig gelesen“, dann bleiben die Zeilen unberührt.
  let streitfaelle: Stripe.Dispute[] | null = null
  try {
    const gelesen = await alleMitRand(stripe.disputes.list({ created: { gte: Math.floor((jetzt.getTime() - STREIT_FENSTER_MS) / 1000) }, limit: 100 }))
    if (gelesen.abgeschnitten) meldeStreitAbgeschnitten()
    else streitfaelle = gelesen.eintraege
  } catch (err) {
    meldeStripe(err, 'streit')
  }

  // ─── Bestellungen: Zahlungen aus Stripe, bezahlte der letzten 48 h, offene Abweichungen ───
  const bestellungen = await ladeBestellungenFuerAbgleich({
    paymentIntentIds: [...zahlungen.keys()],
    bezahltAb: new Date(ab * 1000),
    orderIds: [...new Set(offen.map((o) => o.orderId))],
  })

  // Zahlungen, die die Listen nicht brachten (älter als 48 h oder vor 48 h angelegt und erst jetzt bezahlt): einzeln nachladen.
  const nichtBeiStripe = new Set<string>()
  const fehlend = bestellungen.filter((b) => !zahlungen.has(b.paymentIntentId)).slice(0, NACHLADEN_HOECHSTENS)
  try {
    for (const b of fehlend) {
      try {
        zahlungen.set(b.paymentIntentId, alsZahlung(await stripe.paymentIntents.retrieve(b.paymentIntentId, { expand: ['latest_charge'] })))
      } catch (err) {
        if (!istNichtGefunden(err)) throw err
        nichtBeiStripe.add(b.paymentIntentId)
      }
    }
  } catch (err) {
    meldeStripe(err, 'nachladen')
    throw new GeldAbgleichStripeFehler()
  }

  const { verglichen, abweichungen } = gleicheAb(bestellungen, zahlungen, nichtBeiStripe)

  // ─── Schreiben ───
  const heute = utcTagesbeginn(jetzt)
  const verglichenSet = new Set(verglichen)
  const jetztArten = new Set(abweichungen.map((a) => abweichungArt(a.orderId, a.feld)))
  const geklaert = offen.filter((o) => verglichenSet.has(o.orderId) && !jetztArten.has(o.art))
  const offenNachArt = new Map(offen.map((o) => [o.art, o]))
  const neu = abweichungen.filter((a) => !offenNachArt.has(abweichungArt(a.orderId, a.feld)))

  if (geklaert.length > 0) {
    await prisma.betriebMessung.deleteMany({ where: { art: { in: geklaert.map((g) => g.art) } } })
  }
  if (neu.length > 0) {
    await prisma.betriebMessung.createMany({
      data: neu.map((a) => ({ tag: heute, art: abweichungArt(a.orderId, a.feld), wert: BigInt(abweichungCents(a)) })),
      skipDuplicates: true,
    })
  }
  // Bestehende behalten ihren ersten Tag (die Frist in Heute zählt ab da); nur der Betrag kann sich ändern.
  for (const a of abweichungen) {
    const alt = offenNachArt.get(abweichungArt(a.orderId, a.feld))
    if (!alt) continue
    await prisma.betriebMessung.updateMany({ where: { tag: alt.tag, art: alt.art }, data: { wert: BigInt(abweichungCents(a)), gemessenAm: jetzt } })
  }

  if (streitfaelle) await gleicheStreitfaelleAb(streitfaelle, jetzt)

  // Abgeschnittene Saldo-Liste: Die Tagessummen wären zu klein und gälten danach als vollständig —
  // dann lieber gar nicht schreiben (die alten Werte bleiben) und warnen.
  const gebuehren = saldoAbgeschnitten ? new Map<string, number>() : stripeGebuehrenJeTag(buchungen)
  if (saldoAbgeschnitten) meldeAbgeschnitten()
  for (const [tag, cents] of gebuehren) {
    const tagDatum = new Date(`${tag}T00:00:00.000Z`)
    await prisma.betriebMessung.upsert({
      where: { tag_art: { tag: tagDatum, art: STRIPE_GEBUEHR_ART } },
      create: { tag: tagDatum, art: STRIPE_GEBUEHR_ART, wert: BigInt(cents) },
      update: { wert: BigInt(cents), gemessenAm: jetzt },
    })
  }

  return { zahlungen: zahlungen.size, verglichen: verglichen.length, abweichungen: abweichungen.length, neu: neu.length, geklaert: geklaert.length, stripeGebuehrTage: gebuehren.size }
}

function zahlungVon(streit: Stripe.Dispute): string | null {
  const pi: string | { id: string } | null = streit.payment_intent
  if (!pi) return null
  return typeof pi === 'string' ? pi : pi.id
}

/**
 * Die Zeilen `kundenstreit:*` gegen die vollständig gelesenen Streitfälle
 * (Nr. 289, E-022): offen mit Bestellung und ohne Zeile → anlegen (Eingang
 * jetzt, Frist `due_by`, sonst Eingang bei Stripe + 7 Tage); Fall gelesen und
 * nicht mehr offen → löschen; Fall nicht in der Liste → bleibt, Warnung.
 * Eine Zahlung ohne Bestellung (Rechnung der Monatsabrechnung) bekommt nie eine Zeile.
 */
async function gleicheStreitfaelleAb(faelle: readonly Stripe.Dispute[], jetzt: Date): Promise<void> {
  const vorhanden = await prisma.betriebMessung.findMany({ where: { art: { startsWith: `${KUNDENSTREIT_ART}:` } }, select: { art: true } })
  const zeilen = vorhanden.flatMap((z) => {
    const gelesen = leseKundenstreitArt(z.art)
    return gelesen ? [{ ...gelesen, zeile: z.art }] : []
  })
  const nachKennung = new Map(faelle.map((f) => [f.id, f]))
  const offen = faelle.filter((f) => kundenstreitOffen(f.status))
  const zahlungen = [...new Set(offen.flatMap((f) => zahlungVon(f) ?? []))]
  const bestellungen = zahlungen.length === 0 ? [] : await prisma.order.findMany({ where: { stripePaymentIntentId: { in: zahlungen } }, select: { id: true, stripePaymentIntentId: true } })
  const bestellungJeZahlung = new Map(bestellungen.map((b) => [b.stripePaymentIntentId, b.id]))
  const angefangen = new Set(zeilen.map((z) => kundenstreitAnfang(z.orderId, z.streitId)))
  const heute = utcTagesbeginn(jetzt)
  const neu = offen.flatMap((f) => {
    const zahlung = zahlungVon(f)
    const orderId = zahlung === null ? undefined : bestellungJeZahlung.get(zahlung)
    if (!orderId || angefangen.has(kundenstreitAnfang(orderId, f.id))) return []
    const frist = f.evidence_details?.due_by ?? f.created + STREIT_FRIST_OHNE_S
    return [{ tag: heute, art: kundenstreitArt(orderId, f.id, kundenstreitArtVonStand(f.status)), wert: BigInt(frist), gemessenAm: jetzt }]
  })
  if (neu.length > 0) await prisma.betriebMessung.createMany({ data: neu, skipDuplicates: true })
  const geschlossen = zeilen.filter((z) => {
    const fall = nachKennung.get(z.streitId)
    return fall !== undefined && !kundenstreitOffen(fall.status)
  })
  if (geschlossen.length > 0) await prisma.betriebMessung.deleteMany({ where: { art: { in: geschlossen.map((z) => z.zeile) } } })
  for (const z of zeilen) if (!nachKennung.has(z.streitId)) meldeStreitUnbekannt(z.streitId)
}

/** Warnung: Die Liste der Streitfälle war länger als LISTE_HOECHSTENS — die Zeilen bleiben, wie sie sind. */
function meldeStreitAbgeschnitten(): void {
  Sentry.captureMessage('Geld-Abgleich: Liste der Streitfälle abgeschnitten, Zeilen nicht geändert', { level: 'warning', tags: { aufgabe: 'geld-abgleich', schritt: 'streit' } })
}

/** Warnung: Eine Zeile `kundenstreit:*` hat keinen Fall in der Liste (älter als 120 Tage?) — sie bleibt. Nur die Kennung. */
function meldeStreitUnbekannt(streitId: string): void {
  Sentry.captureMessage('Geld-Abgleich: Streitfall nicht in der Liste, Zeile bleibt', { level: 'warning', tags: { aufgabe: 'geld-abgleich', schritt: 'streit-unbekannt' }, extra: { streit: streitId } })
}

/** Warnung an Sentry: Die Saldo-Liste war länger als LISTE_HOECHSTENS — ohne Betrag und Kennung. */
function meldeAbgeschnitten(): void {
  Sentry.captureMessage('Geld-Abgleich: Saldo-Liste abgeschnitten, Stripe-Gebühren nicht geschrieben', { level: 'warning', tags: { aufgabe: 'geld-abgleich', schritt: 'saldo' } })
}

/** Warnung an Sentry — nur Schritt und Fehlerklasse, nie Text, Betrag oder Kennung. */
function meldeStripe(err: unknown, schritt: 'liste' | 'nachladen' | 'streit'): void {
  const meldung = new Error('Geld-Abgleich: Stripe nicht gelesen')
  if (err instanceof Error && /^[A-Za-z][A-Za-z0-9_]{0,59}$/.test(err.name)) meldung.name = err.name
  Sentry.captureException(meldung, { level: 'warning', tags: { aufgabe: 'geld-abgleich', schritt } })
}

