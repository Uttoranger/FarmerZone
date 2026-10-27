import * as Sentry from '@sentry/nextjs'
import type Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { formatDatumLang } from '@/lib/format'
import { kalendertagInWien, wienerMitternacht } from '@/lib/wiener-tag'
import { LASTSCHRIFT_HREF, ankuendigungText, lastschriftGescheitertText } from '@/lib/konditionen'
import {
  abrechnungSperrtBar,
  gebuehrModellFuer,
  ankuendigungFaellig,
  barEinzugsweg,
  einzugAbFuer,
  folgemonat,
  monatText,
  monatsSummen,
  satzHundertstel,
  satzText,
  vormonat,
  type AbrechnungsZeile,
  type BestellungFuerAbrechnung,
} from '@/lib/plattformgebuehr'
import { bestimmeGruendungBis } from '@/lib/gruendungshof'
import { hofpreisEinstellungAus } from '@/lib/plattform-einstellung'
import { lesePlattformEinstellung } from '@/server/queries/plattform-einstellung'
import { ladeHoefeFuerGruendung } from '@/server/queries/admin'
import { protokolliere } from '@/server/admin-protokoll'
import { stelleEinOhneRisiko } from '@/server/mail-warteschlange'
import { ankuendigungAuftrag, lastschriftGescheitertAuftrag } from '@/server/mail-arten/hof'
import { RECHNUNGSANGABEN_FEHLEN_ART, monatsGrenzen } from '@/server/queries/plattformgebuehr'

/*
 * Die SEPA-Monatsabrechnung der Plattformgebühr (Register N38, Nr. 198) — die
 * Servergrenze. Rechnet nichts selbst: Summen, Sperre und Stände kommen aus
 * src/lib/plattformgebuehr.ts, in ganzen Cent.
 *
 * Ablauf `monatsabrechnung` (täglich 05:30 UTC, /api/cron/monatsabrechnung):
 *  1. Ankündigung: Höfe, deren Einzug in höchstens 28 Tagen beginnt und die
 *     noch keinen Hinweis hatten (`gebuehrHinweisAm`), bekommen genau einmal
 *     eine Postfach-Nachricht und die Mail `plattformgebuehr-ankuendigung`.
 *  2. Für jeden Hof, dessen `abrechnungsTag` heute ist (Wiener Datum), der
 *     Vormonat: Upsert `Monatsabrechnung` (farmId, monat), Rechnung online
 *     („bezahlt außerhalb“) und Rechnung bar (Lastschrift oder Überweisung).
 *     0 € bekommt keine Rechnung. Idempotent: gespeicherte Rechnungs-Kennungen
 *     und Stripe-Idempotenzschlüssel `abr-<farmId>-<yyyy-mm>-bar|online`.
 *  3. Rechnungsangaben (Firma, UID) kommen aus dem Stripe-Dashboard; fehlen
 *     sie, steht eine Warnung an (Sentry und Heute), kein Abbruch.
 * Fehler bei einem Hof → Warnung, die anderen laufen weiter.
 *
 * Webhooks (src/app/api/stripe/webhook/route.ts, nur die Verteilung):
 * `invoice.paid`, `invoice.payment_failed`, `charge.dispute.created`,
 * `setup_intent.succeeded`, `mandate.updated` — die Behandlung steht hier.
 *
 * Nie IBAN, Mandatstext, Adresse oder Name in Datenbank, Log oder Protokoll:
 * gespeichert werden nur die Kennungen von Kunde, Zahlungsmittel und Rechnung.
 */

/** Mehr Zeilen nimmt eine Rechnung nicht auf — darüber eine Sammelzeile mit der Zahl der Bestellungen. */
const ZEILEN_HOECHSTENS = 200

function warnung(text: string, aufgabe: string, extra: Record<string, string | number> = {}, err?: unknown): void {
  const meldung = new Error(text)
  if (err instanceof Error) meldung.name = err.name
  Sentry.captureException(meldung, { level: 'warning', tags: { bereich: 'monatsabrechnung', aufgabe }, extra })
}

// ─── Stripe-Kunde ────────────────────────────────────────────────────────────

/**
 * Der Hof als Kunde der Plattform bei Stripe (`Farm.stripeKundeId`): laden
 * oder anlegen, Idempotenzschlüssel je Hof — zwei Klicks ergeben einen Kunden.
 * Name und Anmelde-Adresse gehen an Stripe (Rechnung, Lastschrift-Ankündigung),
 * gespeichert wird hier nur die Kennung.
 */
export async function stelleStripeKundeSicher(farmId: string): Promise<string> {
  const hof = await prisma.farm.findUnique({ where: { id: farmId }, select: { id: true, name: true, stripeKundeId: true, owner: { select: { email: true } } } })
  if (!hof) throw new Error('Hof fehlt')
  if (hof.stripeKundeId) return hof.stripeKundeId
  const kunde = await stripe.customers.create(
    { name: hof.name, email: hof.owner.email, metadata: { farmId: hof.id } },
    { idempotencyKey: `kunde-${hof.id}` }
  )
  const { count } = await prisma.farm.updateMany({ where: { id: hof.id, stripeKundeId: null }, data: { stripeKundeId: kunde.id } })
  if (count === 1) return kunde.id
  // Ein paralleler Klick war schneller — dessen Kennung gilt.
  const neu = await prisma.farm.findUnique({ where: { id: hof.id }, select: { stripeKundeId: true } })
  return neu?.stripeKundeId ?? kunde.id
}

// ─── Ankündigung ─────────────────────────────────────────────────────────────

/** Was Ankündigung (Postfach und Mail) sagt — frisch aus der Datenbank; null, wenn es den Hof nicht gibt. */
export async function ankuendigungDaten(farmId: string): Promise<{ text: string; datum: string; an: string; archiviert: boolean } | null> {
  const [hof, einstellung] = await Promise.all([
    prisma.farm.findUnique({
      where: { id: farmId },
      select: { id: true, gruendungBis: true, einzugAb: true, plattformgebuehrProzent: true, barMandatPflicht: true, archivedAt: true, owner: { select: { email: true } } },
    }),
    lesePlattformEinstellung(),
  ])
  if (!hof) return null
  const gruendungBis = hof.einzugAb ? null : bestimmeGruendungBis(hof, await ladeHoefeFuerGruendung())
  const ab = einzugAbFuer(hof, hofpreisEinstellungAus(einstellung), gruendungBis)
  const datum = formatDatumLang(ab)
  return {
    text: ankuendigungText({ datum, satz: satzText(satzHundertstel(hof)), mandatNoetig: hof.barMandatPflicht }),
    datum,
    an: hof.owner.email,
    archiviert: hof.archivedAt !== null,
  }
}

/** Eine Nachricht des Teams an den Hof (Art SYSTEM, eigener Faden) — Nachlauf, nie geworfen. */
async function schreibeHofNachricht(farmId: string, text: string, linkUrl: string, aufgabe: string): Promise<void> {
  try {
    const jetzt = new Date()
    await prisma.unterhaltung.create({
      data: { farmId, rundschreibenId: null, letzteNachrichtAm: jetzt, nachrichten: { create: { vonFarmId: null, text, linkUrl, art: 'SYSTEM', createdAt: jetzt } } },
      select: { id: true },
    })
  } catch (err) {
    warnung('Plattformgebühr: Nachricht an den Hof nicht angelegt', aufgabe, { farmId }, err)
  }
}

/**
 * Die Ankündigung des Einzugs (N38, „Start“): genau einmal je Hof. Erst wird
 * `gebuehrHinweisAm` bedingt gesetzt (der Vermerk ist die Sperre gegen einen
 * zweiten Lauf), dann folgen Postfach und Mail als Nachlauf.
 */
export async function kuendigeEinzugAn(jetzt: Date): Promise<number> {
  const einstellung = hofpreisEinstellungAus(await lesePlattformEinstellung())
  const hoefe = await prisma.farm.findMany({
    where: { gebuehrHinweisAm: null, approvedAt: { not: null }, archivedAt: null },
    select: { id: true, gruendungBis: true, einzugAb: true },
  })
  if (hoefe.length === 0) return 0
  const platz = hoefe.some((h) => !h.einzugAb) ? await ladeHoefeFuerGruendung() : []
  let angekuendigt = 0
  for (const hof of hoefe) {
    const ab = einzugAbFuer(hof, einstellung, hof.einzugAb ? null : bestimmeGruendungBis(hof, platz))
    if (!ankuendigungFaellig(ab, null, jetzt)) continue
    const { count } = await prisma.farm.updateMany({ where: { id: hof.id, gebuehrHinweisAm: null }, data: { gebuehrHinweisAm: jetzt } })
    if (count !== 1) continue
    angekuendigt += 1
    const daten = await ankuendigungDaten(hof.id)
    if (daten) await schreibeHofNachricht(hof.id, daten.text, LASTSCHRIFT_HREF, 'ankuendigung')
    await stelleEinOhneRisiko('plattformgebuehr-ankuendigung', null, ankuendigungAuftrag(hof.id))
    await protokolliere({ wer: null, art: 'plattformgebuehr_angekuendigt', bezugArt: 'hof', bezugId: hof.id, mitPasskey: false, grund: `Einzug ab ${kalendertagInWien(ab)}` })
  }
  return angekuendigt
}

// ─── Monatsabrechnung ────────────────────────────────────────────────────────

type HofFuerAbrechnung = {
  id: string
  tarif: 'HOFTOR' | 'HOFLADEN' | null
  barMandatPflicht: boolean
  barSperreNachTagen: number
  sepaMandatAm: Date | null
  sepaZahlungsmittelId: string | null
}

/** Die Bestellungen eines Hofs für den Monat: bar abgeholt bzw. nicht abgeholt, online bezahlt — nur Modell hofpreis. */
export async function ladeBestellungenFuerAbrechnung(farmId: string, von: Date, bis: Date): Promise<BestellungFuerAbrechnung[]> {
  const zeilen = await prisma.order.findMany({
    where: {
      farmId,
      gebuehrModell: 'hofpreis',
      OR: [
        { paymentMethod: { not: 'ONLINE' }, status: 'PICKED_UP', pickedUpAt: { gte: von, lt: bis } },
        { paymentMethod: { not: 'ONLINE' }, status: 'NOT_PICKED_UP', pickupDate: { gte: von, lt: bis } },
        { paymentMethod: 'ONLINE', paidAt: { gte: von, lt: bis } },
      ],
    },
    select: { id: true, orderNumber: true, paymentMethod: true, status: true, paymentStatus: true, serviceFeeCents: true, gebuehrModell: true, gebuehrEinzug: true, serviceFeeRefundedAt: true },
    orderBy: { orderNumber: 'asc' },
  })
  return zeilen.map((z) => ({
    id: z.id,
    orderNumber: z.orderNumber,
    paymentMethod: z.paymentMethod,
    status: z.status,
    paymentStatus: z.paymentStatus,
    serviceFeeCents: z.serviceFeeCents,
    gebuehrModell: z.gebuehrModell,
    gebuehrEinzug: z.gebuehrEinzug,
    gebuehrEntfallen: z.serviceFeeRefundedAt !== null,
  }))
}

/** Die Positionen einer Rechnung: je Bestellnummer eine, über ZEILEN_HOECHSTENS eine Sammelzeile. */
function rechnungsPositionen(zeilen: readonly AbrechnungsZeile[], art: 'bar' | 'online'): Array<{ schluessel: string; cents: number; text: string }> {
  const wort = art === 'bar' ? 'bar' : 'online'
  if (zeilen.length <= ZEILEN_HOECHSTENS) {
    return zeilen.map((z) => ({ schluessel: z.orderId, cents: z.cents, text: `Plattformgebühr ${wort} · Bestellung ${z.orderNumber}` }))
  }
  return [{ schluessel: 'sammel', cents: zeilen.reduce((s, z) => s + z.cents, 0), text: `Plattformgebühr ${wort} · ${zeilen.length} Bestellungen` }]
}

/**
 * Legt EINE Stripe-Rechnung an und füllt sie — ohne sie zu finalisieren.
 * Die Kennung wird sofort gespeichert (`speichere`): Scheitert ein späterer
 * Schritt, macht der nächste Lauf mit derselben Rechnung weiter.
 */
async function legeRechnungAn(
  basis: string,
  kunde: string,
  parameter: Stripe.InvoiceCreateParams,
  positionen: ReadonlyArray<{ schluessel: string; cents: number; text: string }>,
  speichere: (id: string) => Promise<void>
): Promise<string> {
  const rechnung = await stripe.invoices.create(
    { customer: kunde, currency: 'eur', pending_invoice_items_behavior: 'exclude', auto_advance: false, ...parameter },
    { idempotencyKey: basis }
  )
  await speichere(rechnung.id)
  for (const p of positionen) {
    await stripe.invoiceItems.create(
      { customer: kunde, invoice: rechnung.id, currency: 'eur', amount: p.cents, description: p.text },
      { idempotencyKey: `${basis}-pos-${p.schluessel}` }
    )
  }
  return rechnung.id
}

export type HofErgebnis = { farmId: string; monat: string; stand: string; neu: boolean }

/**
 * Die Abrechnung EINES Hofs für EINEN Monat. Idempotent: Steht die
 * Abrechnung schon außerhalb von „entwurf“, passiert nichts; im Entwurf geht
 * es mit den gespeicherten Kennungen weiter.
 */
export async function rechneHofAb(hof: HofFuerAbrechnung, monat: string, jetzt: Date): Promise<HofErgebnis> {
  const { von, bis, datum } = monatsGrenzen(monat)
  const vorher = await prisma.monatsabrechnung.findUnique({ where: { farmId_monat: { farmId: hof.id, monat: datum } } })
  if (vorher && vorher.stand !== 'entwurf') return { farmId: hof.id, monat, stand: vorher.stand, neu: false }

  const summen = monatsSummen(await ladeBestellungenFuerAbrechnung(hof.id, von, bis))
  const felder = {
    grundgebuehrCents: 0,
    servicegebuehrBarCents: summen.barCents,
    barBestellungen: summen.barZeilen.length,
    servicegebuehrOnlineCents: summen.onlineCents,
    nichtAbgeholtBestellungen: summen.nichtAbgeholtBestellungen,
    summeCents: summen.barCents,
  }
  const abrechnung = await prisma.monatsabrechnung.upsert({
    where: { farmId_monat: { farmId: hof.id, monat: datum } },
    // Tarif wie gespeichert; ein Hof ohne gewählten Tarif zählt wie Hoftor (ohne Grundgebühr).
    create: { farmId: hof.id, monat: datum, tarif: hof.tarif ?? 'HOFTOR', ...felder },
    update: felder,
  })
  const id = abrechnung.id
  const basis = `abr-${hof.id}-${monat}`
  const beschreibung = `Plattformgebühr ${monatText(monat)}`

  // Rechnung online: schon von Stripe einbehalten — finalisiert und „bezahlt außerhalb“.
  if (summen.onlineCents > 0 && !abrechnung.rechnungOnlineId) {
    const kunde = await stelleStripeKundeSicher(hof.id)
    const rechnungId = await legeRechnungAn(
      `${basis}-online`,
      kunde,
      { collection_method: 'charge_automatically', description: `${beschreibung} · online, bereits einbehalten`, metadata: { farmId: hof.id, monat, art: 'online' } },
      rechnungsPositionen(summen.onlineZeilen, 'online'),
      async (rid) => {
        await prisma.monatsabrechnung.update({ where: { id }, data: { rechnungOnlineId: rid } })
      }
    )
    await stripe.invoices.finalizeInvoice(rechnungId, { auto_advance: false }, { idempotencyKey: `${basis}-online-fertig` })
    await stripe.invoices.pay(rechnungId, { paid_out_of_band: true }, { idempotencyKey: `${basis}-online-bezahlt` })
  }

  // Rechnung bar: 0 € → keine Rechnung.
  if (summen.barCents === 0) {
    await prisma.monatsabrechnung.update({ where: { id }, data: { stand: 'nichts' } })
    await protokolliere({ wer: null, art: 'monatsabrechnung_erstellt', bezugArt: 'hof', bezugId: hof.id, mitPasskey: false, grund: `Monatsabrechnung ${monat}: bar nichts fällig` })
    return { farmId: hof.id, monat, stand: 'nichts', neu: true }
  }
  const weg = barEinzugsweg(hof)
  if (weg === null) {
    // Mandat Pflicht, aber keins (mehr) da: keine Rechnung ohne Weg — die Abrechnung bleibt im Entwurf.
    warnung('Monatsabrechnung: Mandat Pflicht, aber keins da — Rechnung bar nicht angelegt', 'ohne-mandat', { farmId: hof.id, monat })
    return { farmId: hof.id, monat, stand: 'entwurf', neu: !vorher }
  }
  let rechnungBarId = abrechnung.rechnungBarId
  if (!rechnungBarId) {
    const kunde = await stelleStripeKundeSicher(hof.id)
    const parameter: Stripe.InvoiceCreateParams =
      weg === 'lastschrift'
        ? {
            collection_method: 'charge_automatically',
            default_payment_method: hof.sepaZahlungsmittelId ?? undefined,
            payment_settings: { payment_method_types: ['sepa_debit'] },
          }
        : { collection_method: 'send_invoice', days_until_due: Math.max(1, hof.barSperreNachTagen) }
    rechnungBarId = await legeRechnungAn(
      `${basis}-bar`,
      kunde,
      { ...parameter, description: `${beschreibung} · bar`, metadata: { farmId: hof.id, monat, art: 'bar' } },
      rechnungsPositionen(summen.barZeilen, 'bar'),
      async (rid) => {
        await prisma.monatsabrechnung.update({ where: { id }, data: { rechnungBarId: rid } })
      }
    )
  }
  // Lastschrift: Stripe zieht nach dem Finalisieren selbst ein (auto_advance). Überweisung: die Rechnung geht per Mail.
  await stripe.invoices.finalizeInvoice(rechnungBarId, { auto_advance: weg === 'lastschrift' }, { idempotencyKey: `${basis}-bar-fertig` })
  if (weg === 'ueberweisung') await stripe.invoices.sendInvoice(rechnungBarId, {}, { idempotencyKey: `${basis}-bar-senden` })
  // offenSeit zählt die Tage bis zur Sperre: bei Überweisung ab dem Senden, bei Lastschrift erst ab dem ersten Fehlschlag.
  await prisma.monatsabrechnung.update({ where: { id }, data: { stand: 'offen', offenSeit: weg === 'ueberweisung' ? jetzt : null } })
  await protokolliere({ wer: null, art: 'monatsabrechnung_erstellt', bezugArt: 'hof', bezugId: hof.id, mitPasskey: false, grund: `Monatsabrechnung ${monat}: ${weg === 'lastschrift' ? 'Lastschrift' : 'Überweisung'}` })
  return { farmId: hof.id, monat, stand: 'offen', neu: true }
}

/**
 * Fehlen die Rechnungsangaben im Stripe-Dashboard (Firmenname, Steuernummer)?
 * Liest nur das eigene Konto; steht dann eine Zeile in BetriebMessung (Quelle
 * in Heute), sonst wird sie gelöscht. Ein Lesefehler ändert nichts.
 */
async function pruefeRechnungsangaben(jetzt: Date): Promise<boolean | null> {
  let fehlen: boolean
  try {
    const konto = await stripe.accounts.retrieveCurrent()
    const steuer = konto.settings?.invoices?.default_account_tax_ids ?? []
    fehlen = !konto.business_profile?.name || steuer.length === 0
  } catch (err) {
    warnung('Monatsabrechnung: Rechnungsangaben nicht gelesen', 'rechnungsangaben', {}, err)
    return null
  }
  const tag = new Date(`${kalendertagInWien(jetzt)}T00:00:00.000Z`)
  if (fehlen) {
    warnung('Monatsabrechnung: Rechnungsangaben fehlen im Stripe-Dashboard', 'rechnungsangaben')
    await prisma.betriebMessung.upsert({ where: { tag_art: { tag, art: RECHNUNGSANGABEN_FEHLEN_ART } }, create: { tag, art: RECHNUNGSANGABEN_FEHLEN_ART, wert: BigInt(1) }, update: { wert: BigInt(1) } })
  } else {
    await prisma.betriebMessung.deleteMany({ where: { art: RECHNUNGSANGABEN_FEHLEN_ART } })
  }
  return fehlen
}

export type AbrechnungsLauf = { monat: string; hoefe: number; neu: number; fehler: number; angekuendigt: number; rechnungsangabenFehlen: boolean | null }

/** Der tägliche Ablauf `monatsabrechnung` (Kopf der Datei). */
export async function rechneMonatsabrechnungen(jetzt: Date): Promise<AbrechnungsLauf> {
  let angekuendigt = 0
  try {
    angekuendigt = await kuendigeEinzugAn(jetzt)
  } catch (err) {
    warnung('Monatsabrechnung: Ankündigung gescheitert', 'ankuendigung', {}, err)
  }
  const heute = kalendertagInWien(jetzt)
  const monat = vormonat(heute)
  const tag = Number.parseInt(heute.slice(8, 10), 10)
  const hoefe = await prisma.farm.findMany({
    where: { abrechnungsTag: tag, orders: { some: { gebuehrModell: 'hofpreis' } } },
    select: { id: true, tarif: true, barMandatPflicht: true, barSperreNachTagen: true, sepaMandatAm: true, sepaZahlungsmittelId: true },
  })
  const rechnungsangabenFehlen = hoefe.length > 0 ? await pruefeRechnungsangaben(jetzt) : null
  let neu = 0
  let fehler = 0
  for (const hof of hoefe) {
    try {
      const ergebnis = await rechneHofAb(hof, monat, jetzt)
      if (ergebnis.neu) neu += 1
    } catch (err) {
      fehler += 1
      warnung('Monatsabrechnung: Hof nicht abgerechnet', 'hof', { farmId: hof.id, monat }, err)
    }
  }
  return { monat, hoefe: hoefe.length, neu, fehler, angekuendigt, rechnungsangabenFehlen }
}

// ─── Webhooks ────────────────────────────────────────────────────────────────

function kennung(wert: string | { id: string } | null | undefined): string | null {
  if (!wert) return null
  return typeof wert === 'string' ? wert : wert.id
}

/** Unbekannte Rechnung (nicht in Monatsabrechnung): nur protokollieren, nichts ändern. */
function unbekannt(typ: string, id: string): void {
  console.warn(`[Webhook] ${typ}: Rechnung ${id} gehört zu keiner Monatsabrechnung — nichts geändert`)
}

/** `invoice.paid` → bezahlt, eingezogen, nicht mehr offen. Damit ist der Hof von selbst wieder frei. */
export async function behandleRechnungBezahlt(rechnung: Stripe.Invoice, jetzt = new Date()): Promise<void> {
  const abr = await prisma.monatsabrechnung.findFirst({ where: { OR: [{ rechnungBarId: rechnung.id }, { rechnungOnlineId: rechnung.id }] }, select: { id: true, farmId: true, rechnungBarId: true } })
  if (!abr) return unbekannt('invoice.paid', rechnung.id)
  // Die Rechnung online ist von Anfang an „bezahlt außerhalb“ — der Stand hängt an der Rechnung bar.
  if (abr.rechnungBarId !== rechnung.id) return
  const { count } = await prisma.monatsabrechnung.updateMany({
    where: { id: abr.id, stand: { in: ['offen', 'gescheitert', 'entwurf'] } },
    data: { stand: 'bezahlt', eingezogenAm: jetzt, offenSeit: null },
  })
  if (count === 1) await protokolliere({ wer: null, art: 'lastschrift_bezahlt', bezugArt: 'hof', bezugId: abr.farmId, mitPasskey: false })
}

/** `invoice.payment_failed` → gescheitert, offen seit dem ersten Fehlschlag; Postfach und Mail an den Hof. */
export async function behandleRechnungGescheitert(rechnung: Stripe.Invoice, jetzt = new Date()): Promise<void> {
  const abr = await prisma.monatsabrechnung.findFirst({
    where: { rechnungBarId: rechnung.id },
    select: { id: true, farmId: true, monat: true, farm: { select: { barSperreNachTagen: true } } },
  })
  if (!abr) {
    const online = await prisma.monatsabrechnung.findFirst({ where: { rechnungOnlineId: rechnung.id }, select: { id: true } })
    if (!online) unbekannt('invoice.payment_failed', rechnung.id)
    return
  }
  await prisma.monatsabrechnung.updateMany({ where: { id: abr.id, offenSeit: null, stand: { in: ['offen', 'gescheitert', 'entwurf'] } }, data: { offenSeit: jetzt } })
  const { count } = await prisma.monatsabrechnung.updateMany({ where: { id: abr.id, stand: { in: ['offen', 'gescheitert', 'entwurf'] } }, data: { stand: 'gescheitert' } })
  if (count !== 1) return
  await protokolliere({ wer: null, art: 'lastschrift_gescheitert', bezugArt: 'hof', bezugId: abr.farmId, mitPasskey: false })
  const monat = monatText(abr.monat.toISOString().slice(0, 7))
  await schreibeHofNachricht(abr.farmId, lastschriftGescheitertText({ monat, tage: abr.farm.barSperreNachTagen }), '/settings/konditionen', 'gescheitert')
  // Je Versuch eine Mail: Stripe zählt die Versuche, der Schlüssel macht jeden einmalig.
  await stelleEinOhneRisiko('lastschrift-gescheitert', null, lastschriftGescheitertAuftrag(abr.id, abr.farmId, rechnung.attempt_count ?? 0))
}

/**
 * `charge.dispute.created` zu einer Rechnungszahlung → zurückgebucht, sofort
 * gesperrt. Die Rechnung zur Zahlung kennt Stripe über die Rechnungszahlungen
 * (`invoicePayments`, nur lesend); eine Rückbuchung einer Bestellung der
 * Kundschaft gehört zu keiner Rechnung und bleibt hier unberührt.
 */
export async function behandleRueckbuchung(streit: Stripe.Dispute, jetzt = new Date()): Promise<void> {
  const zahlung = kennung(streit.payment_intent)
  if (!zahlung) return
  const liste = await stripe.invoicePayments.list({ payment: { type: 'payment_intent', payment_intent: zahlung }, limit: 1 })
  const rechnungId = kennung(liste.data[0]?.invoice as string | { id: string } | undefined)
  if (!rechnungId) return
  const abr = await prisma.monatsabrechnung.findFirst({ where: { rechnungBarId: rechnungId }, select: { id: true, farmId: true } })
  if (!abr) return unbekannt('charge.dispute.created', rechnungId)
  const { count } = await prisma.monatsabrechnung.updateMany({ where: { id: abr.id, stand: { not: 'zurueckgebucht' } }, data: { stand: 'zurueckgebucht', zurueckgebuchtAm: jetzt } })
  if (count === 1) await protokolliere({ wer: null, art: 'lastschrift_zurueckgebucht', bezugArt: 'hof', bezugId: abr.farmId, mitPasskey: false })
}

/**
 * `setup_intent.succeeded` → das Mandat gilt: `sepaZahlungsmittelId` und
 * `sepaMandatAm`. NUR hier — nie über die Rückmeldung des Browsers. Der Hof
 * ergibt sich aus dem Kunden (`stripeKundeId`) und muss zu `metadata.farmId`
 * passen; sonst ändert sich nichts.
 */
export async function behandleMandatEingerichtet(si: Stripe.SetupIntent, jetzt = new Date()): Promise<void> {
  if (!si.payment_method_types.includes('sepa_debit')) return
  const kunde = kennung(si.customer as string | { id: string } | null)
  const zahlungsmittel = kennung(si.payment_method as string | { id: string } | null)
  if (!kunde || !zahlungsmittel) return
  const hof = await prisma.farm.findFirst({ where: { stripeKundeId: kunde }, select: { id: true } })
  if (!hof || si.metadata?.farmId !== hof.id) {
    console.warn(`[Webhook] setup_intent.succeeded: ${si.id} passt zu keinem Hof — nichts geändert`)
    return
  }
  await prisma.farm.update({ where: { id: hof.id }, data: { sepaZahlungsmittelId: zahlungsmittel, sepaMandatAm: jetzt } })
  await protokolliere({ wer: null, art: 'lastschrift_mandat_gueltig', bezugArt: 'hof', bezugId: hof.id, mitPasskey: false })
}

/** `mandate.updated` mit Stand „inactive“ → `sepaMandatAm` null; ist das Mandat Pflicht, ist bar damit aus. */
export async function behandleMandatGeaendert(mandat: Stripe.Mandate): Promise<void> {
  if (mandat.status !== 'inactive') return
  const zahlungsmittel = kennung(mandat.payment_method as string | { id: string })
  if (!zahlungsmittel) return
  const hoefe = await prisma.farm.findMany({ where: { sepaZahlungsmittelId: zahlungsmittel, sepaMandatAm: { not: null } }, select: { id: true } })
  if (hoefe.length === 0) return
  await prisma.farm.updateMany({ where: { id: { in: hoefe.map((h) => h.id) } }, data: { sepaMandatAm: null } })
  for (const h of hoefe) await protokolliere({ wer: null, art: 'lastschrift_mandat_beendet', bezugArt: 'hof', bezugId: h.id, mitPasskey: false })
}

/**
 * Das Mandat zur Anzeige: Bank (Bankleitzahl) und die letzten 4 Stellen der
 * IBAN, LIVE von Stripe — nichts davon wird gespeichert. Scheitert Stripe,
 * zeigt die Seite nur „eingerichtet“.
 */
export async function ladeMandatAnzeige(zahlungsmittelId: string | null): Promise<{ bank: string | null; letzte4: string | null }> {
  if (!zahlungsmittelId) return { bank: null, letzte4: null }
  try {
    const pm = await stripe.paymentMethods.retrieve(zahlungsmittelId)
    return { bank: pm.sepa_debit?.bank_code ?? null, letzte4: pm.sepa_debit?.last4 ?? null }
  } catch (err) {
    warnung('Lastschrift: Anzeige des Mandats nicht gelesen', 'mandat-anzeige', {}, err)
    return { bank: null, letzte4: null }
  }
}
