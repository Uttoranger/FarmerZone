import * as Sentry from '@sentry/nextjs'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  ANGABEN_NACHRICHT,
  ZAHLUNG_HREF,
  istStripeKontoStand,
  onlineZahlungNachricht,
  onlineZahlungNachrichtPasst,
  stripeKontoBereit,
  stripeKontoStand,
  type OnlineZahlungAnlass,
  type StripeKontoDaten,
  type StripeKontoStand,
} from '@/lib/stripe-konto'
import { heuteHofSichtbar } from '@/lib/heute'
import { DB_BREMSEN } from '@/lib/bremse-datenbank'
import { bremseUeberAlleInstanzen } from '@/server/bremse-datenbank'
import { protokolliere } from '@/server/admin-protokoll'
import { schreibeSystemNachricht } from '@/server/postfach-system'
import { stelleEinOhneRisiko } from '@/server/mail-warteschlange'
import { onlineZahlungAuftrag } from '@/server/mail-arten/hof'

/*
 * Der eine Schreiber des Stripe-Kontostands eines Hofs (Register N49, A012,
 * Weg A aus Fund 4): Rückkehr aus dem Onboarding, „Status prüfen“ und die
 * Webhook-Ereignisse `account.updated` und `capability.updated` lesen das
 * Konto bei Stripe und übergeben es hier mit dem Zeitpunkt, zu dem sie VOR dem
 * Lesen standen.
 *
 * Jedes Schreiben ist ein bedingtes updateMany auf Hof, gelesene Kennung und
 * „älter als mein Lesen“ (stripeKontoGelesenAm NULL oder < gelesenAm): Ein
 * Schreiber, der früher gelesen hat, überschreibt nie einen, der später
 * gelesen hat — gleich, wer zuerst schreibt. Erst der Wechsel-Fall (der
 * Bereit-Wert dreht sich), dann der Fall ohne Wechsel; so gehört jeder Wechsel
 * genau einem Schreiber, und genau der protokolliert und benachrichtigt.
 */

/** Stände, aus denen der Wechsel nach 'angaben_fehlen' eine Nachricht auslöst (W-A): Der Hof dachte, er sei fertig. */
const VOR_ANGABEN: StripeKontoStand[] = ['pruefung', 'eps_fehlt', 'unklar']

type Wechsel = 'aktiv' | 'pausiert' | 'angaben'

/**
 * Speichert Bereit-Wert, groben Stand und Lesezeit — und nach einem Wechsel
 * den Nachlauf (Protokoll, Nachricht). Gibt zurück, was dieses Lesen ergab.
 * Ergibt keiner der Schritte eine Zeile, war ein neuerer Schreiber da oder die
 * Kennung hat sich geändert: dann nichts, keine Nachricht.
 */
export async function schreibeStripeKontoStand(e: {
  farmId: string
  stripeAccountId: string
  konto: StripeKontoDaten
  gelesenAm: Date
}): Promise<{ bereit: boolean; stand: StripeKontoStand }> {
  const bereit = stripeKontoBereit(e.konto)
  const stand = stripeKontoStand(e.konto)
  // Geprüft beim Schreiben: In die Spalte kommt nur ein Wert der Liste.
  if (!istStripeKontoStand(stand)) throw new Error('Unbekannter Stripe-Kontostand')

  const data = { stripeAccountReady: bereit, stripeKontoStand: stand, stripeKontoGelesenAm: e.gelesenAm }
  const aelter: Prisma.FarmWhereInput = { OR: [{ stripeKontoGelesenAm: null }, { stripeKontoGelesenAm: { lt: e.gelesenAm } }] }
  const basis = { id: e.farmId, stripeAccountId: e.stripeAccountId }
  const angabenMoeglich = ANGABEN_NACHRICHT && !bereit && stand === 'angaben_fehlen'
  // Ohne Wechsel heißt bei W-A auch: nicht aus einem der Stände in VOR_ANGABEN
  // (NOT IN trifft NULL nicht, deshalb ausdrücklich).
  const ohneAngabenWechsel: Prisma.FarmWhereInput[] = angabenMoeglich
    ? [{ OR: [{ stripeKontoStand: null }, { stripeKontoStand: { notIn: VOR_ANGABEN } }] }]
    : []

  for (let versuch = 0; versuch < 2; versuch++) {
    const wechsel = await prisma.farm.updateMany({ where: { ...basis, stripeAccountReady: !bereit, AND: [aelter] }, data })
    if (wechsel.count === 1) {
      await nachDemWechsel(e.farmId, bereit ? 'aktiv' : 'pausiert', stand, e.gelesenAm)
      return { bereit, stand }
    }
    if (angabenMoeglich) {
      const angaben = await prisma.farm.updateMany({
        where: { ...basis, stripeAccountReady: false, stripeKontoStand: { in: VOR_ANGABEN }, AND: [aelter] },
        data,
      })
      if (angaben.count === 1) {
        await nachDemWechsel(e.farmId, 'angaben', stand, e.gelesenAm)
        return { bereit, stand }
      }
    }
    const ohne = await prisma.farm.updateMany({
      where: { ...basis, stripeAccountReady: bereit, AND: [aelter, ...ohneAngabenWechsel] },
      data,
    })
    if (ohne.count === 1) return { bereit, stand }

    // Keine Zeile: Wer war da? Andere Kennung oder ein neueres Lesen → fertig.
    const hof = await prisma.farm.findUnique({
      where: { id: e.farmId },
      select: { stripeAccountId: true, stripeKontoGelesenAm: true },
    })
    if (!hof || hof.stripeAccountId !== e.stripeAccountId) return { bereit, stand }
    if (hof.stripeKontoGelesenAm !== null && hof.stripeKontoGelesenAm.getTime() >= e.gelesenAm.getTime()) return { bereit, stand }
    // Sonst hat ein anderer Schreiber zwischen zwei Schritten gewechselt: einmal von vorn.
  }
  // Ins Server-Protokoll, nur mit Hof-ID — die Kennung des Kontos bleibt draußen.
  console.error(`[Stripe] Kontostand nicht gespeichert, nach einer Wiederholung aufgegeben: Hof ${e.farmId}`)
  return { bereit, stand }
}

/**
 * Nachlauf eines Wechsels — wirft nie, nach dem Schreiben, ändert keine
 * Antwort (Register N49, E7):
 * - nicht bereit → bereit: Protokoll „Online-Zahlung aktiv“ und Nachricht „aktiv“;
 * - bereit → nicht bereit: Protokoll „Online-Zahlung pausiert“ mit dem groben Stand, keine Nachricht;
 * - (W-A) pruefung, eps_fehlt oder unklar → angaben_fehlen: Nachricht „angaben“, kein Protokoll.
 */
async function nachDemWechsel(farmId: string, wechsel: Wechsel, stand: StripeKontoStand, gelesenAm: Date): Promise<void> {
  try {
    if (wechsel === 'aktiv') {
      await protokolliere({ wer: null, art: 'online_zahlung_aktiv', bezugArt: 'hof', bezugId: farmId, mitPasskey: false, grund: 'bereit' })
      await meldeStripeKontoWechsel(farmId, 'aktiv', gelesenAm)
    } else if (wechsel === 'pausiert') {
      await protokolliere({ wer: null, art: 'online_zahlung_pausiert', bezugArt: 'hof', bezugId: farmId, mitPasskey: false, grund: stand })
    } else {
      await meldeStripeKontoWechsel(farmId, 'angaben', gelesenAm)
    }
  } catch (err) {
    warnung('Nachlauf nach Wechsel des Stripe-Kontostands gescheitert', farmId, err)
  }
}

/**
 * Nachricht an den Hof (Postfach und Mail, Register N49, E6): Bedingung
 * frisch prüfen (dieselbe Regel wie der Renderer der Mail), dann die Bremse
 * (höchstens eine je Hof und Anlass im festen 24-Stunden-Fenster; scheitert
 * sie, wird geschickt), dann Postfach, dann der Mail-Auftrag. Wirft nie.
 */
export async function meldeStripeKontoWechsel(farmId: string, anlass: OnlineZahlungAnlass, gelesenAm: Date, jetzt: Date = new Date()): Promise<void> {
  try {
    const hof = await prisma.farm.findUnique({
      where: { id: farmId },
      select: {
        archivedAt: true,
        geschlossenAm: true,
        acceptsOnline: true,
        stripeAccountReady: true,
        stripeKontoStand: true,
        isActive: true,
        isPaused: true,
        approvedAt: true,
        adminGesperrtAm: true,
      },
    })
    if (!hof || !onlineZahlungNachrichtPasst(anlass, hof)) return

    let schicken = true
    try {
      schicken = await bremseUeberAlleInstanzen([{ bremse: DB_BREMSEN.stripeKontoNachricht, merkmal: `${anlass}:${farmId}` }], jetzt)
    } catch {
      schicken = true
    }
    if (!schicken) return

    // „Ab sofort“ nur, wenn Kundinnen jetzt bestellen können: sichtbar und nicht vom Team gesperrt (E6 „nicht gesperrt“).
    const { text } = onlineZahlungNachricht(anlass, heuteHofSichtbar(hof) && hof.adminGesperrtAm === null)
    await schreibeSystemNachricht(farmId, text, ZAHLUNG_HREF)
    await stelleEinOhneRisiko('online-zahlung', null, onlineZahlungAuftrag(farmId, anlass, gelesenAm))
  } catch (err) {
    warnung('Nachricht zum Stripe-Konto nicht geschickt', farmId, err)
  }
}

/** Nur die Art des Fehlers und die Hof-ID — ein Prisma-Text kann eine Kennung tragen. */
function warnung(text: string, farmId: string, err: unknown): void {
  try {
    const meldung = new Error(text)
    meldung.name = err instanceof Error ? err.name : 'Unbekannt'
    Sentry.captureException(meldung, { level: 'warning', tags: { aufgabe: 'stripe-konto-stand' }, extra: { farmId } })
  } catch {
    // Telemetrie scheitert leise.
  }
}
