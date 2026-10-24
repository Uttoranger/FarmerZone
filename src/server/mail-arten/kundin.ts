import { prisma } from '@/lib/prisma'
import { APP_URL } from '@/lib/umgebung-server'
import { aboBestaetigungsPfad, erzeugeAboBestaetigungsToken } from '@/lib/abo-bestaetigung-token'
import type { StapelMail } from '@/lib/email'
import type { EinstellAuftrag } from '@/server/mail-warteschlange'
import type { Verworfen } from '@/server/mail-arten'
import { VORRANG, aboBezugSchema, meldungBezugSchema } from '@/schemas/mail-auftrag'

/*
 * Mails an Kundinnen außerhalb einer Bestellung (Nr. 159): die Bestätigung
 * einer Neuigkeiten-Anmeldung (Double-Opt-in S11, Wichtig) und der Bescheid
 * auf einen Wunsch (Kann warten). Der Bestätigungslink steht nie im Auftrag:
 * Der Renderer signiert ihn beim Versand frisch aus Abo und
 * Anfragezeitpunkt — derselbe Token wie vorher direkt.
 */

/** Abo-Bestätigung: je Anfrage (Zeitpunkt) höchstens ein Auftrag. */
export function aboBestaetigungAuftrag(abo: { id: string; farmId: string }, angefragtAm: Date): EinstellAuftrag {
  return {
    art: 'abo-bestaetigung',
    vorrang: VORRANG.wichtig,
    schluessel: `abo-bestaetigung:${abo.id}:${angefragtAm.getTime()}`,
    bezug: { aboId: abo.id },
    farmId: abo.farmId,
  }
}

/** Bescheid: je Meldung und Speichern ein Auftrag (ein neuer Stand darf neu schreiben). */
export function bescheidAuftraege(meldungIds: readonly string[], gespeichertAm: Date): EinstellAuftrag[] {
  return meldungIds.map((meldungId) => ({
    art: 'bescheid',
    vorrang: VORRANG.kannWarten,
    schluessel: `bescheid:${meldungId}:${gespeichertAm.getTime()}`,
    bezug: { meldungId },
  }))
}

/**
 * Nur solange die Anfrage offen ist: Ist das Abo inzwischen bestätigt,
 * ausgeschaltet oder neu angefragt, gilt dieser Link nicht mehr — dann keine
 * Mail (ein neuerer Auftrag trägt die neue Anfrage).
 */
export async function rendereAboBestaetigung(bezug: Record<string, string>): Promise<StapelMail | Verworfen> {
  const { aboId } = aboBezugSchema.parse(bezug)
  const abo = await prisma.customerFarmSubscription.findUnique({
    where: { id: aboId },
    select: { customerEmail: true, emailOptInAngefragtAm: true, emailOptInBestaetigtAm: true, farm: { select: { name: true } } },
  })
  if (!abo) return { verworfen: 'abo_fehlt' }
  if (!abo.emailOptInAngefragtAm || abo.emailOptInBestaetigtAm) return { verworfen: 'anfrage_erledigt' }
  const url = `${APP_URL}${aboBestaetigungsPfad(erzeugeAboBestaetigungsToken(aboId, abo.emailOptInAngefragtAm))}`
  const { baueAboBestaetigung } = await import('@/lib/email')
  return baueAboBestaetigung(abo.customerEmail, { hofName: abo.farm.name, url })
}

/** Bescheid an die Kundin einer Meldung — Adresse und Antwort frisch aus der Meldung. */
export async function rendereBescheid(bezug: Record<string, string>): Promise<StapelMail | Verworfen> {
  const { meldungId } = meldungBezugSchema.parse(bezug)
  const m = await prisma.meldung.findUnique({ where: { id: meldungId }, select: { customerEmail: true, farmId: true, antwortAnMelder: true } })
  if (!m) return { verworfen: 'meldung_fehlt' }
  // Ein Hof liest den Bescheid in seinem Postfach; nur Kundinnen mit Adresse bekommen die Mail.
  if (m.farmId || !m.customerEmail || !m.antwortAnMelder) return { verworfen: 'ohne_kundin' }
  const { baueBescheidMail } = await import('@/lib/email')
  return baueBescheidMail(m.customerEmail.trim().toLowerCase(), m.antwortAnMelder)
}
