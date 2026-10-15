import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { ADMIN_POSTFACH_HREF } from '@/lib/postfach'
import { empfaengerZustand } from '@/lib/zustellung'
import { empfaengerTokenSchema } from '@/schemas/postfach'
import { empfaengerTokenHash } from '@/server/queries/postfach'

/*
 * Den Link aus der Bestätigungsmail der Zustellung einlösen (Register N14,
 * Nr. 95) — OHNE Anmeldung: Der Token ist der Ausweis. Bewusst KEIN
 * 'use server': Jeder Export einer Server-Action-Datei ist ein öffentlicher
 * Endpunkt mit eigener Aktions-ID; diesen Weg ruft nur der Route Handler
 * src/app/admin/postfach/zustellung/bestaetigen/route.ts per POST auf, nie
 * beim Öffnen des Links (Link-Scanner). Die Wache in
 * tests/zustellung-bestaetigen.test.ts hält src/server/actions/postfach.ts
 * frei von ungeprüften Exporten.
 */

export type BestaetigenErgebnis = { ok: true } | { error: 'abgelaufen' | 'ungueltig' }

/**
 * Einmalig: In EINEM bedingten Schreiben (Hash über den eindeutigen Index,
 * noch gültig, noch nicht bestätigt) wird bestaetigtAm gesetzt und der Token
 * gelöscht — ein zweiter Klick findet nichts mehr. Die Frist gilt beim
 * Lesen (48 h, tokenBis).
 */
export async function bestaetigeEmpfaenger(eingabe: unknown): Promise<BestaetigenErgebnis> {
  const token = empfaengerTokenSchema.safeParse(eingabe)
  if (!token.success) return { error: 'ungueltig' }
  const jetzt = new Date()
  const hash = empfaengerTokenHash(token.data)
  const { count } = await prisma.betreiberEmpfaenger.updateMany({
    where: { token: hash, bestaetigtAm: null, tokenBis: { gt: jetzt } },
    data: { bestaetigtAm: jetzt, token: null, tokenBis: null },
  })
  if (count === 1) {
    revalidatePath(ADMIN_POSTFACH_HREF)
    return { ok: true }
  }
  // Nur für den richtigen Satz: Gibt es den Link noch, ist er abgelaufen.
  const zeile = await prisma.betreiberEmpfaenger.findUnique({ where: { token: hash }, select: { bestaetigtAm: true, tokenBis: true } })
  return { error: zeile && empfaengerZustand(zeile, jetzt) === 'abgelaufen' ? 'abgelaufen' : 'ungueltig' }
}
