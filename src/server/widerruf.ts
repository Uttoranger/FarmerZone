import { Prisma } from '@prisma/client'
import * as Sentry from '@sentry/nextjs'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { alsCents } from '@/lib/order-totals'
import { ABHOLUNG_ERLEDIGT } from '@/lib/heute'
import { istVorOrtZahlung } from '@/lib/servicegebuehr'
import { onlineBezahlt, restNachTeilerstattung } from '@/lib/storno'
import { artikelFehltRechnung, nachFehlendemArtikel, type ArtikelFehltBestellung } from '@/lib/artikel-fehlt'
import { POSTFACH_HREF } from '@/lib/postfach'
import {
  BAR_ERSTATTET,
  WIDERRUF_TEXT,
  deckungGanz,
  eingangZeitpunkt,
  lesePositionen,
  normalisiereBestellnummer,
  waehlePositionen,
  widerrufMoeglich,
  type WiderrufPosition,
  type WiderrufUmfang,
} from '@/lib/widerruf'
import type { WiderrufAufgabeRoh } from '@/lib/admin-aufgaben'
import { protokolliere } from '@/server/admin-protokoll'
import { stelleEinOhneRisiko } from '@/server/mail-warteschlange'
import { widerrufErgebnisAuftrag, widerrufHofAuftrag } from '@/server/mail-arten/widerruf'
import { storniere } from '@/server/stornieren'
import { meldeFehlendenArtikel } from '@/server/artikel-fehlt'
import {
  STRIPE_OPTIONEN,
  StripeStandUnklar,
  bucheVomHofZurueck,
  erstatteKundin,
  ladeStripeStand,
  stripeVorladen,
  teilstornoSumme,
} from '@/server/teilerstattung'

/*
 * Widerruf online (§ 13a FAGG, Register N39, Nr. 200) gegen Datenbank,
 * Stripe und Post. Die Regeln stehen in src/lib/widerruf.ts.
 *
 *  - `legeWiderrufAn`: speichert den Widerruf — mit signiertem Link für genau
 *    diese Bestellung, ohne Link zugeordnet NUR bei genau passender
 *    Bestellnummer UND E-Mail der Bestellung, sonst `orderId` null. Ohne Link
 *    machen Treffer und Fehlversuch dieselben zwei Abfragen (Suche, Anlegen);
 *    alles Weitere — auch der Protokolleintrag des Zuordnens — läuft nach der
 *    Antwort, damit sie weder länger dauert noch anders ausfällt.
 *  - `verarbeiteWiderruf` (nach der Antwort): Eingangsbestätigung sofort per
 *    Mail; vor der Abholung storniert der Widerruf über die bestehenden Wege
 *    (`storniere`, „Artikel fehlt" für einzelne Positionen) — danach Stand
 *    `erstattet` ohne Zutun des Hofs und eine Mail an die Kundin (die
 *    Storno-Mail bzw. beim Teilstorno `widerruf-erstattet` mit dem gebuchten
 *    Betrag); nach der Abholung geht er an den Hof
 *    (Postfach, Mail, Heute).
 *  - `erstatteWiderruf` / `lehneWiderrufAb`: die Knöpfe des Hofs nach der
 *    Abholung. Erstattet wird über src/server/teilerstattung.ts mit den
 *    Beträgen der bestehenden Rechnungen (artikelFehltRechnung für Positionen,
 *    restNachTeilerstattung für die ganze Bestellung) — nie neu gerechnet.
 *
 * KEINE PERSONENDATEN in Logs, Sentry oder Protokoll: nur Kennungen.
 */

/** Der Grund, der beim Storno an der Bestellung steht (sieht der Hof, nicht die Mail). */
export const WIDERRUF_STORNO_GRUND = 'Widerruf der Kundin'

export type WiderrufAnlage =
  | { art: 'link'; orderId: string; umfang: WiderrufUmfang; positionen: readonly string[]; name: string; nachricht?: string }
  | { art: 'frei'; name: string; email: string; bestellnummer: string; umfang: WiderrufUmfang; nachricht?: string }

export type AnlageErgebnis = { ok: true; widerrufId: string; eingegangenAm: Date } | { error: 'fremd' | 'nicht_moeglich' }

function melde(text: string, aufgabe: string, extra: Record<string, string | number>, err?: unknown): void {
  const meldung = new Error(text)
  if (err instanceof Error) meldung.name = err.name
  Sentry.captureException(meldung, { level: 'warning', tags: { bereich: 'widerruf', aufgabe }, extra })
}

const LINK_BESTELLUNG = {
  id: true,
  orderNumber: true,
  kaeuferArt: true,
  status: true,
  pickedUpAt: true,
  customerEmail: true,
  items: { select: { id: true, quantity: true, fehltSeit: true } },
} as const

/** Speichert den Widerruf; über den Link nur für eine Bestellung, die noch widerrufen werden kann. */
export async function legeWiderrufAn(e: WiderrufAnlage, jetzt: Date): Promise<AnlageErgebnis> {
  if (e.art === 'link') {
    const order = await prisma.order.findUnique({ where: { id: e.orderId }, select: LINK_BESTELLUNG })
    if (!order || !widerrufMoeglich(order, jetzt)) return { error: 'nicht_moeglich' }
    let positionen: WiderrufPosition[] | null = null
    if (e.umfang === 'teil') {
      positionen = waehlePositionen(
        e.positionen,
        order.items.map((i) => ({ id: i.id, quantity: i.quantity, fehlt: i.fehltSeit !== null }))
      )
      // Eine fremde oder schon fehlende Position: nichts anlegen.
      if (!positionen) return { error: 'fremd' }
    }
    const w = await prisma.widerruf.create({
      data: {
        orderId: order.id,
        eingegangenAm: jetzt,
        name: e.name,
        email: order.customerEmail,
        bestellnummerEingabe: order.orderNumber,
        umfang: e.umfang,
        positionen: positionen ?? Prisma.DbNull,
        nachricht: e.nachricht ?? null,
      },
      select: { id: true },
    })
    return { ok: true, widerrufId: w.id, eingegangenAm: jetzt }
  }

  // Ohne Link: genau dieselbe Nummer UND dieselbe Adresse wie die Bestellung — sonst nicht zugeordnet.
  const treffer = await prisma.order.findFirst({
    where: { orderNumber: normalisiereBestellnummer(e.bestellnummer), customerEmail: { equals: e.email, mode: 'insensitive' } },
    select: { id: true },
  })
  const w = await prisma.widerruf.create({
    data: {
      orderId: treffer?.id ?? null,
      eingegangenAm: jetzt,
      name: e.name,
      email: e.email,
      bestellnummerEingabe: e.bestellnummer.trim(),
      umfang: e.umfang,
      positionen: Prisma.DbNull,
      nachricht: e.nachricht ?? null,
    },
    select: { id: true },
  })
  return { ok: true, widerrufId: w.id, eingegangenAm: jetzt }
}

const VERARBEITEN = {
  id: true,
  orderId: true,
  eingegangenAm: true,
  email: true,
  bestellnummerEingabe: true,
  umfang: true,
  positionen: true,
  nachricht: true,
  stand: true,
} as const

const BESTELLUNG_ZUM_WIDERRUF = {
  id: true,
  farmId: true,
  orderNumber: true,
  kaeuferArt: true,
  status: true,
  pickedUpAt: true,
  farm: { select: { name: true } },
  items: { select: { id: true, productName: true, quantity: true, fehltSeit: true } },
} as const

/** Die Zeilen „Widerrufen“: ganze Bestellung, die Artikel oder der Freitext der Kundin (nur in ihre eigene Mail). */
function umfangZeilen(
  w: { umfang: string; positionen: unknown; nachricht: string | null },
  items: readonly { id: string; productName: string; quantity: number }[]
): string[] {
  if (w.umfang === 'ganz') return [WIDERRUF_TEXT.ganz]
  const positionen = lesePositionen(w.positionen)
  if (positionen.length === 0) return [w.nachricht ?? WIDERRUF_TEXT.teil]
  return positionen.map((p) => {
    const item = items.find((i) => i.id === p.orderItemId)
    return item ? `${p.menge} × ${item.productName}` : WIDERRUF_TEXT.teil
  })
}

/** Eingangsbestätigung — direkt (Sofort). Fehler gehen an Sentry, der Widerruf bleibt gültig. */
async function schickeEingang(
  w: { id: string; email: string; eingegangenAm: Date; bestellnummerEingabe: string | null; umfang: string; positionen: unknown; nachricht: string | null; orderId: string | null },
  order: { id: string; farmId: string; farm: { name: string }; items: { id: string; productName: string; quantity: number }[] } | null,
  ueberLink: boolean,
  nochmalVon?: string
): Promise<void> {
  try {
    const { sendWiderrufEingang } = await import('@/lib/email')
    await sendWiderrufEingang(
      w.email,
      {
        bestellnummer: w.bestellnummerEingabe,
        umfang: umfangZeilen(w, order?.items ?? []),
        eingegangenAm: eingangZeitpunkt(w.eingegangenAm),
        naechsteSchritte: WIDERRUF_TEXT.naechsteSchritte,
        // Den Hof nennt nur die Mail zu einem Widerruf über den Link — ohne Link verriete er die Zuordnung.
        hofName: ueberLink && order ? order.farm.name : null,
      },
      { ...(order ? { bestellungId: order.id, farmId: order.farmId } : {}), ...(nochmalVon ? { nochmalVon } : {}) }
    )
  } catch (err) {
    melde('Widerruf: Eingangsbestätigung nicht verschickt', 'eingang', { widerrufId: w.id }, err)
  }
}

/** Der Hof bekommt den Widerruf: Postfach (Art SYSTEM, eigener Faden) und Mail (Wichtig). Nachlauf, wirft nie. */
async function meldeAnHof(widerrufId: string, order: { id: string; farmId: string; orderNumber: string }): Promise<void> {
  try {
    const jetzt = new Date()
    await prisma.unterhaltung.create({
      data: {
        farmId: order.farmId,
        rundschreibenId: null,
        letzteNachrichtAm: jetzt,
        nachrichten: { create: { vonFarmId: null, text: WIDERRUF_TEXT.hofPostfach(order.orderNumber), linkUrl: `/orders/${order.id}`, art: 'SYSTEM', createdAt: jetzt } },
      },
      select: { id: true },
    })
    revalidatePath(POSTFACH_HREF)
  } catch (err) {
    melde('Widerruf: Nachricht an den Hof nicht angelegt', 'hof-postfach', { widerrufId, orderId: order.id }, err)
  }
  await stelleEinOhneRisiko('widerruf-hof', order.id, widerrufHofAuftrag(widerrufId, order))
}

/** Stand bedingt setzen — nur aus `eingegangen` (die Sperre gegen einen zweiten Weg). */
async function setzeStand(widerrufId: string, stand: 'erstattet', jetzt: Date): Promise<boolean> {
  const { count } = await prisma.widerruf.updateMany({ where: { id: widerrufId, stand: 'eingegangen' }, data: { stand, standGeaendertAm: jetzt } })
  return count === 1
}

/**
 * Was der Storno vor der Abholung gebucht hat: `storno` — die ganze
 * Bestellung, die Mail verschickt `storniere`; `teil` — einzelne Positionen,
 * Betrag in Cent (online, von Stripe bestätigt) bzw. null (vor Ort, nichts
 * bezahlt); null — nicht (ganz) gebucht, der Hof entscheidet.
 */
type VorAbholungErgebnis = { art: 'storno' } | { art: 'teil'; erstattetCents: number | null } | null

/**
 * Vor der Abholung ist der Widerruf fachlich ein Storno (Freigabe 200 Punkt
 * 4): die ganze Bestellung über `storniere`, einzelne Positionen über
 * „Artikel fehlt" (dieselbe Teilerstattung). Erstattung wie beim Storno; die
 * Mail zum Teilstorno stellt der Aufrufer ein (`meldeFehlendenArtikel`
 * verschickt keine).
 */
async function storniereVorAbholung(
  w: { id: string; umfang: string; positionen: unknown },
  order: { id: string; farmId: string; items: { id: string; fehltSeit: Date | null }[] },
  jetzt: Date
): Promise<VorAbholungErgebnis> {
  const positionen = lesePositionen(w.positionen)
  const items = order.items.map((i) => ({ id: i.id, fehlt: i.fehltSeit !== null }))
  const ganz = async (): Promise<VorAbholungErgebnis> => {
    const ergebnis = await storniere({ id: order.farmId }, order.id, WIDERRUF_STORNO_GRUND)
    return ergebnis.error ? null : { art: 'storno' }
  }
  if (w.umfang === 'ganz' || deckungGanz(positionen, items)) return ganz()
  if (positionen.length === 0) return null
  let summeCents = 0
  let online = false
  for (const p of positionen) {
    const ausgang = await meldeFehlendenArtikel({ farmId: order.farmId, orderId: order.id, itemId: p.orderItemId, jetzt })
    if (ausgang.art === 'storno') return ganz()
    if (ausgang.art !== 'teil') return null
    // Gezählt wird, was Stripe bestätigt hat — nie neu gerechnet.
    if (ausgang.rechnung.zahlung === 'online') online = true
    summeCents += ausgang.erstattetCents
  }
  return { art: 'teil', erstattetCents: online ? summeCents : null }
}

/**
 * Nach der Antwort: Eingangsbestätigung, dann je nach Lage Storno (vor der
 * Abholung) oder Meldung an den Hof. Ohne Zuordnung bleibt es bei der
 * Bestätigung — die Aufgabe „Widerruf offen“ zeigt ihn dem Team.
 */
export async function verarbeiteWiderruf(widerrufId: string, ueberLink: boolean, jetzt: Date = new Date()): Promise<void> {
  const w = await prisma.widerruf.findUnique({ where: { id: widerrufId }, select: VERARBEITEN })
  if (!w) return
  // Das Zuordnen ohne Link vermerkt das Protokoll (Freigabe 200 Punkt 6) — erst hier, nach der Antwort,
  // damit ein Treffer die Antwort nicht verlangsamt. System, nur Kennungen; protokolliere wirft nie.
  if (!ueberLink && w.orderId) await protokolliere({ wer: null, art: 'widerruf_zugeordnet', bezugArt: 'bestellung', bezugId: w.orderId, mitPasskey: false })
  const order = w.orderId ? await prisma.order.findUnique({ where: { id: w.orderId }, select: BESTELLUNG_ZUM_WIDERRUF }) : null
  await schickeEingang(w, order, ueberLink)
  if (!order) return

  const vorAbholung = !(ABHOLUNG_ERLEDIGT as readonly string[]).includes(order.status)
  if (widerrufMoeglich(order, jetzt) && vorAbholung && (w.umfang === 'ganz' || lesePositionen(w.positionen).length > 0)) {
    try {
      const gebucht = await storniereVorAbholung(w, order, jetzt)
      if (gebucht) {
        const gesetzt = await setzeStand(widerrufId, 'erstattet', new Date())
        // Erstattung und Mail wie beim Storno (Freigabe 200 Punkt 4): Die Storno-Mail kommt aus `storniere`,
        // das Teilstorno meldet Betrag bzw. Streichung hier — je Widerruf höchstens einmal (Schlüssel).
        if (gesetzt && gebucht.art === 'teil') {
          await stelleEinOhneRisiko(
            'widerruf-erstattet',
            order.id,
            widerrufErgebnisAuftrag('widerruf-erstattet', widerrufId, { id: order.id, farmId: order.farmId }, gebucht.erstattetCents, true)
          )
        }
        return
      }
    } catch (err) {
      melde('Widerruf: Storno vor der Abholung gescheitert', 'storno', { widerrufId, orderId: order.id }, err)
    }
  }
  // Nach der Abholung, Freitext oder ein Storno, der nicht ging: Der Hof entscheidet.
  await meldeAnHof(widerrufId, order)
}

/** Support: Eingangsbestätigung des neuesten Widerrufs dieser Bestellung nochmal (Sofort, N27). */
export async function schickeEingangNochmal(orderId: string, nochmalVon: string): Promise<boolean> {
  const w = await prisma.widerruf.findFirst({ where: { orderId }, orderBy: { eingegangenAm: 'desc' }, select: VERARBEITEN })
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { ...BESTELLUNG_ZUM_WIDERRUF, customerEmail: true } })
  if (!w || !order) return false
  // An die heute hinterlegte Adresse der Bestellung, nie an eine eingegebene (N27).
  await schickeEingang({ ...w, email: order.customerEmail }, order, false, nochmalVon)
  return true
}

/** Vorschau der Eingangsbestätigung (Admin › Betrieb, N27): der neueste Widerruf der Bestellung, an ihre Adresse. */
export async function eingangVorschau(orderId: string): Promise<{ betreff: string; html: string } | null> {
  const w = await prisma.widerruf.findFirst({ where: { orderId }, orderBy: { eingegangenAm: 'desc' }, select: VERARBEITEN })
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { ...BESTELLUNG_ZUM_WIDERRUF, customerEmail: true } })
  if (!w || !order) return null
  const { widerrufEingangInhalt } = await import('@/lib/email')
  return widerrufEingangInhalt(order.customerEmail, {
    bestellnummer: w.bestellnummerEingabe,
    umfang: umfangZeilen(w, order.items),
    eingegangenAm: eingangZeitpunkt(w.eingegangenAm),
    naechsteSchritte: WIDERRUF_TEXT.naechsteSchritte,
    hofName: null,
  })
}

// ─── Der Hof nach der Abholung ──────────────────────────────────────────────

const STAND_ZUM_ERSTATTEN = {
  id: true,
  status: true,
  paymentMethod: true,
  paymentStatus: true,
  stripePaymentIntentId: true,
  totalAmount: true,
  platformFeeAmount: true,
  serviceFeeCents: true,
  serviceFeePercentApplied: true,
  serviceFeeMinCentsApplied: true,
  gebuehrModell: true,
  gebuehrEinzug: true,
  erstattetCents: true,
  createdAt: true,
  items: { select: { id: true, totalPrice: true, fehltSeit: true, gebuehrCents: true } },
} satisfies Prisma.OrderSelect

export type ErstattenErgebnis = { ok: true; erstattetCents: number | null } | { error: 'nicht_offen' | 'status' | 'stripe' | 'unbekannt' }

/** Je Stripe-Aufruf die Zeitgrenze, dazu 10 s für die Datenbank (wie TRANSAKTION_MS in artikel-fehlt.ts). */
function transaktionMs(positionen: number): number {
  return (3 + 2 * Math.max(1, positionen)) * STRIPE_OPTIONEN.timeout + 10_000
}

/**
 * „Rückgabe erhalten – erstatten …“ (Freigabe 200 Punkt 5): nur nach der
 * Abholung, nur aus `eingegangen`, nur für den eigenen Hof. In EINER
 * Transaktion mit Zeilensperre auf die Bestellung (wie „Artikel fehlt"):
 * Stand des Widerrufs, Stripe-Buchungen und neue Beträge der Bestellung — ganz
 * oder gar nicht. Scheitert Stripe, rollt alles zurück und derselbe Knopf geht
 * nochmal; `ladeStripeStand` findet eine schon gebuchte Erstattung und bucht
 * sie nie doppelt.
 *
 * Positionen: dieselbe Rechnung wie „Artikel fehlt" (Artikelpreis +
 * Gebührendifferenz an die Kundin, genau der Artikelpreis vom Hof). Die ganze
 * Bestellung: der Rest nach `restNachTeilerstattung` (bezahlt laut Stripe minus
 * Teilerstattungen; vom Hof der Warenpreis minus Provision). Bar: dieselben
 * neuen Beträge, kein Stripe, Vermerk „bar erstattet“.
 */
export async function erstatteWiderruf(farm: { id: string }, widerrufId: string, jetzt: Date): Promise<ErstattenErgebnis> {
  const w = await prisma.widerruf.findUnique({ where: { id: widerrufId }, select: { id: true, orderId: true, stand: true, umfang: true, positionen: true } })
  if (!w || !w.orderId || w.stand !== 'eingegangen') return { error: 'nicht_offen' }
  const orderId = w.orderId
  const gewaehlt = lesePositionen(w.positionen)
  // Freitext ohne Positionen kann nicht gebucht werden: Der Hof nimmt Artikel fehlt bzw. lehnt ab.
  if (w.umfang === 'teil' && gewaehlt.length === 0) return { error: 'nicht_offen' }

  await stripeVorladen()
  let ergebnis: ErstattenErgebnis
  try {
    ergebnis = await prisma.$transaction(
      async (tx) => {
        const gesperrt = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "Order" WHERE id = ${orderId} AND "farmId" = ${farm.id} FOR UPDATE`
        if (gesperrt.length === 0) return { error: 'nicht_offen' } as const
        const { count } = await tx.widerruf.updateMany({
          where: { id: widerrufId, orderId, stand: 'eingegangen' },
          data: { stand: 'erstattet', standGeaendertAm: jetzt },
        })
        if (count !== 1) return { error: 'nicht_offen' } as const
        const stand = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: STAND_ZUM_ERSTATTEN })
        if (stand.status !== 'PICKED_UP') throw new StatusFalsch()

        const online = !istVorOrtZahlung(stand.paymentMethod)
        if (online && !onlineBezahlt(stand)) throw new StatusFalsch()
        const pi = online ? stand.stripePaymentIntentId : null
        const items = stand.items.map((i) => ({ id: i.id, fehlt: i.fehltSeit !== null }))
        const ganz = w.umfang === 'ganz' || deckungGanz(gewaehlt, items)
        const stripeStand = pi ? await ladeStripeStand(pi, orderId) : null

        let erstattetCents = 0
        if (ganz) {
          let erstattetGesamt = stand.erstattetCents
          if (stripeStand && pi) {
            const bezahltDatenbankCents = alsCents(stand.totalAmount) + stand.serviceFeeCents + stand.erstattetCents
            const rest = restNachTeilerstattung({
              bezahltStripeCents: stripeStand.bezahltCents,
              bezahltDatenbankCents,
              warenOriginalCents: stand.items.reduce((s, i) => s + alsCents(i.totalPrice), 0),
              provisionCents: alsCents(stand.platformFeeAmount),
              teilErstattetCents: teilstornoSumme(stripeStand.erstattungen),
              teilZurueckgebuchtCents: teilstornoSumme(stripeStand.rueckbuchungen),
            })
            if (!rest) throw new StripeStandUnklar('bezahlt_abweichend', { orderId })
            if (rest.erstattungCents > 0) {
              erstattetCents = (
                await erstatteKundin(stripeStand, { paymentIntentId: pi, orderId, anlass: 'reststorno', positionId: null, betragCents: rest.erstattungCents, schluessel: `widerruf-${widerrufId}` })
              ).erstattetCents
            }
            await rueckbuchen(stripeStand, orderId, null, rest.vomHofCents, `widerruf-hof-${widerrufId}`)
            erstattetGesamt = teilstornoSumme(stripeStand.erstattungen) + erstattetCents
          }
          // Die ganze Bestellung ist zurück: kein Warenpreis, keine Gebühr mehr — der Hof erhält nichts, abgerechnet wird nichts.
          const { count: c } = await tx.order.updateMany({
            where: { id: orderId, farmId: farm.id, status: 'PICKED_UP', erstattetCents: stand.erstattetCents },
            data: {
              totalAmount: new Prisma.Decimal(0),
              serviceFeeCents: 0,
              erstattetCents: erstattetGesamt,
              ...(stripeStand ? { paymentStatus: 'REFUNDED' as const } : {}),
            },
          })
          if (c !== 1) throw new Error('Widerruf: Bestellung hat sich unter der Sperre geändert')
        } else {
          let zustand: ArtikelFehltBestellung = {
            // Die Rechnung ist die von „Artikel fehlt"; ob nach der Abholung erstattet wird, hat oben der Widerruf entschieden.
            status: 'READY',
            paymentMethod: stand.paymentMethod,
            paymentStatus: stand.paymentStatus,
            stripePaymentIntentId: stand.stripePaymentIntentId,
            warenpreisCents: alsCents(stand.totalAmount),
            serviceFeeCents: stand.serviceFeeCents,
            serviceFeePercentApplied: stand.serviceFeePercentApplied === null ? null : stand.serviceFeePercentApplied.toNumber(),
            serviceFeeMinCentsApplied: stand.serviceFeeMinCentsApplied,
            erstattetCents: stand.erstattetCents,
            bestelltAm: stand.createdAt,
            gebuehrModell: stand.gebuehrModell,
            gebuehrEinzug: stand.gebuehrEinzug,
            positionen: stand.items.map((i) => ({ id: i.id, betragCents: alsCents(i.totalPrice), fehlt: i.fehltSeit !== null, gebuehrCents: i.gebuehrCents })),
          }
          for (const p of gewaehlt) {
            const r = artikelFehltRechnung(zustand, p.orderItemId)
            if (r.art !== 'teil') throw new StatusFalsch()
            let gebucht = 0
            if (stripeStand && pi && r.zahlung === 'online') {
              gebucht = (
                await erstatteKundin(stripeStand, { paymentIntentId: pi, orderId, anlass: 'teilstorno', positionId: p.orderItemId, betragCents: r.erstattungCents, schluessel: `teilstorno-${orderId}-${p.orderItemId}` })
              ).erstattetCents
              await rueckbuchen(stripeStand, orderId, p.orderItemId, r.vomHofCents, `teilstorno-hof-${orderId}-${p.orderItemId}`)
            }
            erstattetCents += gebucht
            zustand = nachFehlendemArtikel(zustand, p.orderItemId, r, gebucht)
            const { count: c } = await tx.orderItem.updateMany({ where: { id: p.orderItemId, orderId, fehltSeit: null }, data: { fehltSeit: jetzt } })
            if (c !== 1) throw new Error('Widerruf: Position hat sich unter der Sperre geändert')
          }
          const { count: c } = await tx.order.updateMany({
            where: { id: orderId, farmId: farm.id, status: 'PICKED_UP', serviceFeeCents: stand.serviceFeeCents, erstattetCents: stand.erstattetCents },
            data: { totalAmount: new Prisma.Decimal(zustand.warenpreisCents).div(100), serviceFeeCents: zustand.serviceFeeCents, erstattetCents: zustand.erstattetCents },
          })
          if (c !== 1) throw new Error('Widerruf: Bestellung hat sich unter der Sperre geändert')
        }
        if (!online) await tx.widerruf.update({ where: { id: widerrufId }, data: { grund: BAR_ERSTATTET } })
        return { ok: true, erstattetCents: online ? erstattetCents : null } as const
      },
      { timeout: transaktionMs(gewaehlt.length), maxWait: 10_000 }
    )
  } catch (err) {
    if (err instanceof StatusFalsch) return { error: 'status' }
    melde('Widerruf: Erstattung gescheitert', err instanceof StripeStandUnklar ? `stripe_unklar_${err.grund}` : 'erstatten', { widerrufId, orderId }, err)
    return { error: err instanceof StripeStandUnklar ? 'stripe' : 'unbekannt' }
  }
  if ('ok' in ergebnis) {
    await stelleEinOhneRisiko('widerruf-erstattet', orderId, async () => {
      const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: { id: true, farmId: true } })
      return widerrufErgebnisAuftrag('widerruf-erstattet', widerrufId, order, ergebnis.erstattetCents)
    })
  }
  return ergebnis
}

class StatusFalsch extends Error {
  constructor() {
    super('Widerruf: Bestellung nicht im passenden Stand')
    this.name = 'StatusFalsch'
  }
}

function rueckbuchen(stand: Awaited<ReturnType<typeof ladeStripeStand>>, orderId: string, positionId: string | null, betragCents: number, schluessel: string): Promise<boolean> {
  return bucheVomHofZurueck(stand, {
    orderId,
    anlass: positionId === null ? 'reststorno' : 'teilstorno',
    positionId,
    betragCents,
    schluessel,
    onFehler: (err) => melde('Widerruf: Rückbuchung vom Hof offen', 'rueckbuchung_offen', { orderId, vomHofCents: betragCents }, err),
  })
}

/**
 * „Ablehnen …“ (Freigabe 200 Punkt 5): Grund Pflicht (prüft die Action), nur
 * aus `eingegangen`, nur für eine Bestellung des eigenen Hofs. Die Kundin
 * bekommt den Grund per Mail; das Protokoll vermerkt das Ablehnen.
 */
export async function lehneWiderrufAb(farm: { id: string }, widerrufId: string, grund: string, wer: string, jetzt: Date): Promise<boolean> {
  const w = await prisma.widerruf.findUnique({ where: { id: widerrufId }, select: { orderId: true } })
  if (!w?.orderId) return false
  const order = await prisma.order.findFirst({ where: { id: w.orderId, farmId: farm.id }, select: { id: true } })
  if (!order) return false
  // Besitz auch in der WHERE-Klausel: nur der Widerruf genau dieser Bestellung des Hofs, nur aus `eingegangen`.
  const { count } = await prisma.widerruf.updateMany({
    where: { id: widerrufId, orderId: order.id, stand: 'eingegangen' },
    data: { stand: 'abgelehnt', standGeaendertAm: jetzt, grund },
  })
  if (count !== 1) return false
  await protokolliere({ wer, art: 'widerruf_abgelehnt', bezugArt: 'bestellung', bezugId: order.id, mitPasskey: false })
  await stelleEinOhneRisiko('widerruf-abgelehnt', order.id, widerrufErgebnisAuftrag('widerruf-abgelehnt', widerrufId, { id: order.id, farmId: farm.id }))
  return true
}

// ─── Lesen für Hof und Team ─────────────────────────────────────────────────

export type HofWiderruf = {
  id: string
  orderId: string
  bestellnummer: string
  eingegangenAm: string
  umfang: string[]
  /** Kann der Knopf „Rückgabe erhalten – erstatten …“ buchen? (nach der Abholung, mit Positionen oder ganz) */
  erstattbar: boolean
  bar: boolean
}

/**
 * Erst der Hof, dann die Grenze: Widerruf hat keinen Fremdschlüssel, daher die
 * Verbindung über die Bestellung in SQL — so lädt die Seite nie Freitexte
 * fremder Höfe, und viele offene Widerrufe anderswo verdrängen keinen.
 */
async function offeneWiderrufIds(farmId: string, orderId?: string): Promise<string[]> {
  if (orderId) {
    const eigen = await prisma.order.findFirst({ where: { id: orderId, farmId }, select: { id: true } })
    if (!eigen) return []
    return (await prisma.widerruf.findMany({ where: { stand: 'eingegangen', orderId }, select: { id: true } })).map((w) => w.id)
  }
  const zeilen = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT w.id FROM "Widerruf" w JOIN "Order" o ON o.id = w."orderId"
    WHERE w.stand = 'eingegangen' AND o."farmId" = ${farmId}
    ORDER BY w."eingegangenAm" ASC LIMIT 500`
  return zeilen.map((z) => z.id)
}

/** Die offenen Widerrufe eines Hofs (Stand `eingegangen`) — für Heute und das Bestell-Detail; ohne Name, Adresse, Nachricht. */
export async function ladeOffeneWiderrufe(farmId: string, orderId?: string): Promise<HofWiderruf[]> {
  const ids = await offeneWiderrufIds(farmId, orderId)
  if (ids.length === 0) return []
  const liste = await prisma.widerruf.findMany({
    where: { id: { in: ids }, stand: 'eingegangen' },
    orderBy: { eingegangenAm: 'asc' },
    select: { id: true, orderId: true, eingegangenAm: true, umfang: true, positionen: true, nachricht: true },
  })
  if (liste.length === 0) return []
  const bestellungen = await prisma.order.findMany({
    where: { farmId, id: { in: liste.flatMap((w) => (w.orderId ? [w.orderId] : [])) } },
    select: { id: true, orderNumber: true, status: true, paymentMethod: true, items: { select: { id: true, productName: true, quantity: true } } },
  })
  return liste.flatMap((w) => {
    const b = bestellungen.find((o) => o.id === w.orderId)
    if (!b) return []
    const mitPositionen = w.umfang === 'ganz' || lesePositionen(w.positionen).length > 0
    return [
      {
        id: w.id,
        orderId: b.id,
        bestellnummer: b.orderNumber,
        eingegangenAm: eingangZeitpunkt(w.eingegangenAm),
        // Der Freitext ohne Positionen ist Text der Kundin an den Hof — der Hof darf ihn lesen.
        umfang: umfangZeilen(w, b.items),
        erstattbar: b.status === 'PICKED_UP' && mitPositionen,
        bar: istVorOrtZahlung(b.paymentMethod),
      },
    ]
  })
}

/** Admin › Heute, „Widerruf offen“ (Nr. 200): alle Widerrufe im Stand `eingegangen` — nur Kennungen, Nummer, Hofname. */
export async function ladeWiderrufAufgaben(): Promise<WiderrufAufgabeRoh[]> {
  const offen = await prisma.widerruf.findMany({
    where: { stand: 'eingegangen' },
    orderBy: { eingegangenAm: 'asc' },
    select: { id: true, orderId: true, eingegangenAm: true },
    take: 200,
  })
  if (offen.length === 0) return []
  const bestellungen = await prisma.order.findMany({
    where: { id: { in: offen.flatMap((w) => (w.orderId ? [w.orderId] : [])) } },
    select: { id: true, orderNumber: true, farm: { select: { name: true } } },
  })
  return offen.map((w) => {
    const b = bestellungen.find((o) => o.id === w.orderId)
    return { id: w.id, orderId: b ? b.id : null, bestellnummer: b?.orderNumber ?? null, hofName: b?.farm.name ?? null, eingegangenAm: w.eingegangenAm }
  })
}
