'use server'

import * as Sentry from '@sentry/nextjs'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getClientIp } from '@/lib/rate-limit'
import { adressMerkmal } from '@/lib/bremse-datenbank'
import { widerrufLinkGilt } from '@/lib/bestell-link'
import { nachDerAntwort } from '@/lib/nach-der-antwort'
import { WIDERRUF_BREMSEN, WIDERRUF_TEXT } from '@/lib/widerruf'
import { widerrufAblehnenSchema, widerrufErstattenSchema, widerrufMitLinkSchema, widerrufOhneLinkSchema } from '@/schemas/widerruf'
import { bremseUeberAlleInstanzen } from '@/server/bremse-datenbank'
import { erstatteWiderruf, legeWiderrufAn, lehneWiderrufAb, verarbeiteWiderruf, type AnlageErgebnis } from '@/server/widerruf'

/*
 * Widerruf online (§ 13a FAGG, Register N39, Nr. 200). Öffentlich ohne
 * Anmeldung — mit signiertem Link (Zweck `widerruf`, src/lib/bestell-link.ts)
 * oder ohne (Fuß, direkt). Ohne Link gebremst: 5 je IP und Stunde, 3 je
 * Adresse und Tag, über alle Instanzen (nur in Produktion, wie die übrigen
 * zweiten Stufen). Die Antwort ohne Link ist für jede gültige Eingabe gleich —
 * sie verrät nie, ob es die Bestellung gibt; Storno, Mails und die Meldung an
 * den Hof laufen erst nach der Antwort.
 *
 * Nie im Log oder in Sentry: Name, Adresse, Bestellnummer, Nachricht.
 */

export type WiderrufAntwort = { ok: true; eingegangenAm: string } | { error: string; code: 'EINGABE' | 'LINK' | 'ZU_VIELE' | 'NICHT_MOEGLICH' | 'FEHLER' }

function antwortAus(ergebnis: AnlageErgebnis, ueberLink: boolean): WiderrufAntwort {
  if ('error' in ergebnis) {
    return ergebnis.error === 'fremd' ? { error: WIDERRUF_TEXT.fehlerEingabe, code: 'EINGABE' } : { error: WIDERRUF_TEXT.nichtMehr, code: 'NICHT_MOEGLICH' }
  }
  const { widerrufId } = ergebnis
  nachDerAntwort(async () => {
    try {
      await verarbeiteWiderruf(widerrufId, ueberLink)
    } catch (err) {
      Sentry.captureException(new Error('Widerruf: Nachlauf gescheitert'), {
        level: 'warning',
        tags: { bereich: 'widerruf', aufgabe: 'nachlauf', fehler: err instanceof Error ? err.name : 'unbekannt' },
        extra: { widerrufId },
      })
    }
  })
  return { ok: true, eingegangenAm: ergebnis.eingegangenAm.toISOString() }
}

function speicherFehler(err: unknown): WiderrufAntwort {
  Sentry.captureException(new Error('Widerruf: nicht gespeichert'), { tags: { bereich: 'widerruf', fehler: err instanceof Error ? err.name : 'unbekannt' } })
  return { error: WIDERRUF_TEXT.fehlerSpeichern, code: 'FEHLER' }
}

/** Mit signiertem Link: die Bestellung steht fest; eine falsche Signatur ist „Link ungültig“. */
export async function reicheWiderrufMitLinkEin(eingabe: unknown): Promise<WiderrufAntwort> {
  const geprueft = widerrufMitLinkSchema.safeParse(eingabe)
  if (!geprueft.success) return { error: geprueft.error.issues[0]?.message ?? WIDERRUF_TEXT.fehlerEingabe, code: 'EINGABE' }
  const e = geprueft.data
  if (!widerrufLinkGilt(e.bestellung, e.sig)) return { error: WIDERRUF_TEXT.linkUngueltig, code: 'LINK' }
  try {
    const ergebnis = await legeWiderrufAn(
      { art: 'link', orderId: e.bestellung, umfang: e.umfang, positionen: e.positionen, name: e.name, nachricht: e.nachricht },
      new Date()
    )
    return antwortAus(ergebnis, true)
  } catch (err) {
    return speicherFehler(err)
  }
}

/** true = gebremst. Erst je IP, dann je Adresse — beide gezählt über alle Instanzen. */
async function widerrufGebremst(email: string): Promise<boolean> {
  if (process.env.NODE_ENV !== 'production') return false
  const ip = getClientIp(await headers())
  return !(await bremseUeberAlleInstanzen([
    { bremse: WIDERRUF_BREMSEN.ip, merkmal: ip },
    { bremse: WIDERRUF_BREMSEN.adresse, merkmal: adressMerkmal(email) },
  ]))
}

/** Ohne Link: Zuordnung nur bei genau passender Nummer UND Adresse; die Antwort ist immer dieselbe. */
export async function reicheWiderrufOhneLinkEin(eingabe: unknown): Promise<WiderrufAntwort> {
  const geprueft = widerrufOhneLinkSchema.safeParse(eingabe)
  if (!geprueft.success) return { error: geprueft.error.issues[0]?.message ?? WIDERRUF_TEXT.fehlerEingabe, code: 'EINGABE' }
  const e = geprueft.data
  if (await widerrufGebremst(e.email)) return { error: WIDERRUF_TEXT.fehlerZuViele, code: 'ZU_VIELE' }
  try {
    const ergebnis = await legeWiderrufAn(
      { art: 'frei', name: e.name, email: e.email, bestellnummer: e.bestellnummer, umfang: e.umfang, nachricht: e.nachricht },
      new Date()
    )
    return antwortAus(ergebnis, false)
  } catch (err) {
    return speicherFehler(err)
  }
}

/** Der Hof der Sitzung — nur ein Konto mit Rolle FARMER und eigenem Hof. */
async function hofDerSitzung(): Promise<{ farmId: string; userId: string } | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  const role = (session.user as typeof session.user & { role?: string }).role
  if (role !== 'FARMER') return null
  const farm = await prisma.farm.findUnique({ where: { ownerId: session.user.id }, select: { id: true } })
  return farm ? { farmId: farm.id, userId: session.user.id } : null
}

export type HofWiderrufAntwort = { ok: true } | { error: string }

/** „Rückgabe erhalten – erstatten …“ — nur der eigene Hof, nur nach der Abholung (src/server/widerruf.ts). */
export async function erstatteWiderrufAction(eingabe: unknown): Promise<HofWiderrufAntwort> {
  const geprueft = widerrufErstattenSchema.safeParse(eingabe)
  if (!geprueft.success) return { error: WIDERRUF_TEXT.hofFehler }
  const hof = await hofDerSitzung()
  if (!hof) return { error: 'Nicht angemeldet' }
  const ergebnis = await erstatteWiderruf({ id: hof.farmId }, geprueft.data.widerrufId, new Date())
  if ('error' in ergebnis) return { error: WIDERRUF_TEXT.hofFehler }
  revalidatePath('/orders')
  revalidatePath('/dashboard')
  return { ok: true }
}

/** „Ablehnen …“ — Grund Pflicht; ohne Grund kommt der Satz des Schemas zurück. */
export async function lehneWiderrufAbAction(eingabe: unknown): Promise<HofWiderrufAntwort> {
  const geprueft = widerrufAblehnenSchema.safeParse(eingabe)
  if (!geprueft.success) {
    const grundFehler = geprueft.error.issues.find((i) => i.path[0] === 'grund')
    return { error: grundFehler?.message ?? WIDERRUF_TEXT.hofFehler }
  }
  const hof = await hofDerSitzung()
  if (!hof) return { error: 'Nicht angemeldet' }
  const ok = await lehneWiderrufAb({ id: hof.farmId }, geprueft.data.widerrufId, geprueft.data.grund, hof.userId, new Date())
  if (!ok) return { error: WIDERRUF_TEXT.hofFehler }
  revalidatePath('/orders')
  revalidatePath('/dashboard')
  return { ok: true }
}
