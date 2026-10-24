import { prisma } from '@/lib/prisma'
import { SUPPORT_EMAIL } from '@/lib/support'
import { kurznummer } from '@/lib/meldung'
import { erstattungOffenInhalt } from '@/lib/erstattung-offen'
import { POSTFACH_TEXT } from '@/lib/postfach'
import type { StapelMail } from '@/lib/email'
import type { ZustellArt } from '@/lib/zustellung'
import type { EinstellAuftrag } from '@/server/mail-warteschlange'
import type { Verworfen } from '@/server/mail-arten'
import {
  SUPPORT_EMPFAENGER,
  VORRANG,
  betreiberBezugSchema,
  erstattungOffenBezugSchema,
  hofBetreiberBezugSchema,
  meldungBetreiberBezugSchema,
  nachrichtBetreiberBezugSchema,
  wochenberichtBezugSchema,
  type ErstattungOffenFall,
  type MailArt,
} from '@/schemas/mail-auftrag'

/*
 * Die Mails an die Betreiber (Register N14, N26; Nr. 159) — alle Wichtig,
 * EIN Auftrag je Adresse der Empfängerliste. Wer auf der Liste steht,
 * entscheidet beim Einstellen weiter `ladeBetreiberEmpfaenger`
 * (empfaengerFuer, Regel „aus", Rückfall auf die feste Adresse); im Auftrag
 * steht statt der Adresse ihre Kennung: `support` für SUPPORT_EMAIL, sonst
 * die Zeile in BetreiberEmpfaenger. Der Renderer lädt die Adresse frisch —
 * ist eine weitere Adresse inzwischen entfernt, bekommt sie nichts mehr.
 *
 * Die Warn-Mail des Betriebs gehört nicht hierher: Sie geht direkt
 * (N18-Ergänzung, sendBetriebWarnung).
 */

/**
 * Aus den Adressen der Empfängerliste die Kennungen für den Auftrag. Eine
 * Adresse ohne Zeile (zwischen Lesen und hier entfernt) fällt weg.
 */
export async function empfaengerKennungen(adressen: readonly string[]): Promise<string[]> {
  if (adressen.length === 0) return []
  const fest = SUPPORT_EMAIL.toLowerCase()
  const weitere = adressen.filter((a) => a !== fest)
  const zeilen =
    weitere.length === 0
      ? []
      : await prisma.betreiberEmpfaenger.findMany({
          where: { email: { in: weitere, mode: 'insensitive' }, bestaetigtAm: { not: null } },
          select: { id: true, email: true },
        })
  const kennungen: string[] = []
  for (const adresse of adressen) {
    if (adresse === fest) kennungen.push(SUPPORT_EMPFAENGER)
    else {
      const zeile = zeilen.find((z) => z.email.trim().toLowerCase() === adresse)
      if (zeile) kennungen.push(zeile.id)
    }
  }
  return kennungen
}

/** Die Kennungen der Empfänger einer Art (Regel und Liste wie `ladeBetreiberEmpfaenger`). */
export async function betreiberKennungen(art: ZustellArt): Promise<string[]> {
  const { ladeBetreiberEmpfaenger } = await import('@/server/queries/postfach')
  return empfaengerKennungen(await ladeBetreiberEmpfaenger(art))
}

/**
 * Je Empfänger ein Auftrag derselben Mail. `grund` macht den Schlüssel
 * fachlich eindeutig (`<art>:<grund>:<empfänger>`): dieselbe Meldung, derselbe
 * Hof, dieselbe Nachricht geht an eine Adresse höchstens einmal.
 */
export function betreiberAuftraege(
  art: Extract<MailArt, 'erstattung-offen' | 'neuer-hof' | 'meldung' | 'wochenbericht' | 'antwort-an-team' | 'betreiber-testmail'>,
  grund: string,
  kennungen: readonly string[],
  bezug: Record<string, string>,
  zusatz: { bestellungId?: string; farmId?: string } = {}
): EinstellAuftrag[] {
  return kennungen.map((empfaengerId) => ({
    art,
    vorrang: VORRANG.wichtig,
    schluessel: `${art}:${grund}:${empfaengerId}`,
    bezug: { ...bezug, empfaengerId },
    ...zusatz,
  }))
}

/** Die Adresse hinter einer Kennung — nur, solange sie bestätigt auf der Liste steht. */
async function betreiberAdresse(empfaengerId: string): Promise<string | null> {
  if (empfaengerId === SUPPORT_EMPFAENGER) return SUPPORT_EMAIL.toLowerCase()
  const zeile = await prisma.betreiberEmpfaenger.findFirst({ where: { id: empfaengerId, bestaetigtAm: { not: null } }, select: { email: true } })
  return zeile?.email ?? null
}

const OHNE_EMPFAENGER: Verworfen = { verworfen: 'empfaenger_fehlt' }

/** Die Cent aus dem Bezug (vom Worker geprüfte Ziffern). */
function cents(ziffern: string | undefined): number | undefined {
  return ziffern === undefined ? undefined : Number.parseInt(ziffern, 10)
}

/** Der Bezug von „Erstattung offen": Fall und Beträge, dazu Bestellung und/oder Stripe-Kennung. */
export function erstattungOffenBezug(m: {
  fall: ErstattungOffenFall
  orderId: string | null
  refundId: string | null
  kundinCents?: number
  hofCents?: number
}): Record<string, string> {
  return {
    fall: m.fall,
    ...(m.orderId ? { orderId: m.orderId } : {}),
    ...(m.refundId ? { refundId: m.refundId } : {}),
    ...(m.kundinCents === undefined ? {} : { kundinCents: String(m.kundinCents) }),
    ...(m.hofCents === undefined ? {} : { hofCents: String(m.hofCents) }),
  }
}

export async function rendereErstattungOffen(bezug: Record<string, string>): Promise<StapelMail | Verworfen> {
  const b = erstattungOffenBezugSchema.parse(bezug)
  const an = await betreiberAdresse(b.empfaengerId)
  if (!an) return OHNE_EMPFAENGER
  const bestellung = b.orderId
    ? await prisma.order.findUnique({ where: { id: b.orderId }, select: { orderNumber: true, farm: { select: { name: true } } } })
    : null
  const inhalt = erstattungOffenInhalt(b.fall, { kundinCents: cents(b.kundinCents), hofCents: cents(b.hofCents) })
  const { baueErstattungOffen } = await import('@/lib/email')
  return baueErstattungOffen(
    {
      ...inhalt,
      bestellId: b.orderId ?? null,
      bestellnummer: bestellung?.orderNumber ?? null,
      hofName: bestellung?.farm.name ?? null,
      stripeKennung: b.refundId ?? null,
    },
    an
  )
}

export async function rendereNeuerHof(bezug: Record<string, string>): Promise<StapelMail | Verworfen> {
  const { farmId, empfaengerId } = hofBetreiberBezugSchema.parse(bezug)
  const an = await betreiberAdresse(empfaengerId)
  if (!an) return OHNE_EMPFAENGER
  const hof = await prisma.farm.findUnique({ where: { id: farmId }, select: { id: true, name: true, slug: true, createdAt: true, owner: { select: { email: true } } } })
  if (!hof) return { verworfen: 'hof_fehlt' }
  const { baueNewFarmNotification } = await import('@/lib/email')
  return baueNewFarmNotification({ id: hof.id, name: hof.name, slug: hof.slug, ownerEmail: hof.owner.email, createdAt: hof.createdAt }, an)
}

export async function rendereMeldung(bezug: Record<string, string>): Promise<StapelMail | Verworfen> {
  const { meldungId, empfaengerId } = meldungBetreiberBezugSchema.parse(bezug)
  const an = await betreiberAdresse(empfaengerId)
  if (!an) return OHNE_EMPFAENGER
  const m = await prisma.meldung.findUnique({
    where: { id: meldungId },
    select: { id: true, text: true, seiteUrl: true, userAgent: true, viewport: true, diagKennung: true, screenshotUrl: true, createdAt: true, farm: { select: { name: true } } },
  })
  if (!m) return { verworfen: 'meldung_fehlt' }
  const { baueMeldungNotification } = await import('@/lib/email')
  return baueMeldungNotification(
    {
      id: m.id,
      kurznummer: kurznummer(m.id),
      text: m.text,
      seiteUrl: m.seiteUrl,
      userAgent: m.userAgent,
      viewport: m.viewport,
      diagKennung: m.diagKennung,
      farmName: m.farm?.name ?? null,
      screenshotUrl: m.screenshotUrl,
      createdAt: m.createdAt,
    },
    an
  )
}

/**
 * Wochenbericht: Die Zahlen zählt der Renderer beim Versand frisch (dieselben
 * Zählungen wie der Wochenlauf); nur die Zahl der eben gelöschten Meldungen
 * kennt allein der Lauf. Ist im Eingang inzwischen nichts mehr offen, geht
 * keine Mail — dieselbe Regel wie im Lauf.
 */
export async function rendereWochenbericht(bezug: Record<string, string>): Promise<StapelMail | Verworfen> {
  const { empfaengerId, geloeschtAnzahl } = wochenberichtBezugSchema.parse(bezug)
  const an = await betreiberAdresse(empfaengerId)
  if (!an) return OHNE_EMPFAENGER
  const [{ zaehleFuerWochenlauf }, { zaehleOffenImEingang }] = await Promise.all([import('@/server/queries/meldung'), import('@/server/queries/postfach')])
  const [zaehler, eingang] = await Promise.all([zaehleFuerWochenlauf(new Date()), zaehleOffenImEingang()])
  if (eingang.gesamt === 0) return { verworfen: 'nichts_offen' }
  const { baueBriefkastenZusammenfassung } = await import('@/lib/email')
  return baueBriefkastenZusammenfassung({ ...zaehler, geloescht: Number.parseInt(geloeschtAnzahl, 10), eingang }, an)
}

export async function rendereAntwortAnTeam(bezug: Record<string, string>): Promise<StapelMail | Verworfen> {
  const { nachrichtId, empfaengerId } = nachrichtBetreiberBezugSchema.parse(bezug)
  const an = await betreiberAdresse(empfaengerId)
  if (!an) return OHNE_EMPFAENGER
  const n = await prisma.nachricht.findUnique({
    where: { id: nachrichtId },
    select: { text: true, unterhaltungId: true, unterhaltung: { select: { farm: { select: { name: true } }, rundschreiben: { select: { titel: true } } } } },
  })
  if (!n) return { verworfen: 'nachricht_fehlt' }
  const { baueHofAntwortAnTeam } = await import('@/lib/email')
  return baueHofAntwortAnTeam(an, {
    hofName: n.unterhaltung.farm.name,
    titel: n.unterhaltung.rundschreiben?.titel ?? POSTFACH_TEXT.ohneTitel,
    text: n.text,
    unterhaltungId: n.unterhaltungId,
  })
}

export async function rendereBetreiberTestmail(bezug: Record<string, string>): Promise<StapelMail | Verworfen> {
  const { empfaengerId } = betreiberBezugSchema.parse(bezug)
  const an = await betreiberAdresse(empfaengerId)
  if (!an) return OHNE_EMPFAENGER
  const { baueBetreiberTestmail } = await import('@/lib/email')
  return baueBetreiberTestmail(an)
}
