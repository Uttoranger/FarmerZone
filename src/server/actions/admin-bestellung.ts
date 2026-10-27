'use server'

import { revalidatePath } from 'next/cache'
import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'
import { ADMIN_BESTELLUNGEN_HREF, ADMIN_BESTELLUNG_TEXT, hofNachrichtGeld, notfallStornoStand, type HofNachrichtGeld } from '@/lib/admin-bestellung'
import { onlineBezahlt } from '@/lib/storno'
import { ADMIN_POSTFACH_HREF, POSTFACH_HREF } from '@/lib/postfach'
import { adminBestellAktionSchema, adminBestellFehler } from '@/schemas/admin-bestellung'
import { verlangeFrischeBestaetigung } from '@/server/admin-wache'
import { protokolliere } from '@/server/admin-protokoll'
import { storniere, type StornoErgebnis } from '@/server/stornieren'

/*
 * Die Aktionen von Admin › Bestellungen (Register N33, N34, N35; Nr. 186).
 * Jede ist heikel: zuerst `verlangeFrischeBestaetigung({ recht })` — das ist
 * `verlangeAdminAktion({ frisch: true, recht })` unter dem Namen, den die
 * Quelltext-Wache der heiklen Aktionen sucht (src/server/admin-wache.ts) —,
 * dann die Eingabe mit Grund (Pflicht), dann die Wirkung, dann
 * `protokolliere` (wirft nie, rollt nie etwas zurück).
 */

type Ergebnis = { ok: true } | { error: string }

/**
 * „Außerhalb erstattet …“ (Register N14, Ergänzung; seit Nr. 186 hier statt
 * im Postfach, mit Grund): Der Admin hat selbst erstattet (Stripe-Dashboard
 * oder Überweisung) und schließt die Aufgabe. Es ändert sich NUR das Merkmal
 * Order.erstattungOffenSeit — kein Geld, keine Mail, kein Aufruf bei Stripe.
 * Bedingt geschrieben: Eine unbekannte oder schon erledigte Bestellung ergibt
 * 0 Zeilen und keinen Fehler — der gewünschte Zustand gilt dann schon.
 */
export async function markiereErstattungErledigt(eingabe: unknown): Promise<Ergebnis> {
  const wache = await verlangeFrischeBestaetigung({ recht: 'geld' })
  if ('error' in wache) return { error: wache.error }
  const geprueft = adminBestellAktionSchema.safeParse(eingabe)
  if (!geprueft.success) return { error: adminBestellFehler(geprueft.error) }
  const { orderId, grund } = geprueft.data

  const { count } = await prisma.order.updateMany({
    where: { id: orderId, erstattungOffenSeit: { not: null } },
    data: { erstattungOffenSeit: null },
  })
  if (count > 0) await protokolliere({ wer: wache.userId, art: 'erstattung_erledigt', bezugArt: 'bestellung', bezugId: orderId, grund, mitPasskey: wache.mitPasskey })
  revalidatePath(ADMIN_BESTELLUNGEN_HREF)
  revalidatePath(ADMIN_POSTFACH_HREF)
  return { ok: true }
}

/**
 * „Kundin schreiben …“ (N33, N35): die volle Adresse der Kundin — nur nach
 * Grund, mit Recht `adresse_anzeigen`, und mit Eintrag im Protokoll (Art
 * `adresse_angezeigt`, ohne die Adresse). Eine unbekannte Bestellung ergibt
 * den Satz „nicht gefunden“ und keinen Eintrag.
 */
export async function zeigeKundinAdresse(eingabe: unknown): Promise<{ ok: true; adresse: string } | { error: string }> {
  const wache = await verlangeFrischeBestaetigung({ recht: 'adresse_anzeigen' })
  if ('error' in wache) return { error: wache.error }
  const geprueft = adminBestellAktionSchema.safeParse(eingabe)
  if (!geprueft.success) return { error: adminBestellFehler(geprueft.error) }
  const { orderId, grund } = geprueft.data

  const bestellung = await prisma.order.findUnique({ where: { id: orderId }, select: { customerEmail: true } })
  if (!bestellung) return { error: ADMIN_BESTELLUNG_TEXT.nichtGefunden }
  await protokolliere({ wer: wache.userId, art: 'adresse_angezeigt', bezugArt: 'bestellung', bezugId: orderId, grund, mitPasskey: wache.mitPasskey })
  return { ok: true, adresse: bestellung.customerEmail }
}

/**
 * Die Nachricht an den Hof nach einem Notfall-Storno: ein Faden ohne
 * Rundschreiben, eine Nachricht der Art SYSTEM mit Link zur Bestellung —
 * Faden und Nachricht in EINER Anweisung (nie ein leerer Faden).
 *
 * NACHLAUF: Ein Fehler hier rollt den Storno nie zurück (CLAUDE.md, Geld und
 * Bestellungen); er geht mit festem Text und nur den Kennungen nach Sentry.
 */
async function schreibeHofNachricht(farmId: string, orderId: string, nummer: string, grund: string, geld: HofNachrichtGeld): Promise<void> {
  try {
    const jetzt = new Date()
    await prisma.unterhaltung.create({
      data: {
        farmId,
        rundschreibenId: null,
        letzteNachrichtAm: jetzt,
        nachrichten: {
          create: { vonFarmId: null, text: ADMIN_BESTELLUNG_TEXT.hofNachricht(nummer, grund, geld), linkUrl: `/orders/${orderId}`, art: 'SYSTEM', createdAt: jetzt },
        },
      },
      select: { id: true },
    })
    revalidatePath(POSTFACH_HREF)
  } catch (err) {
    const meldung = new Error('Notfall-Storno: Nachricht an den Hof nicht angelegt')
    meldung.name = err instanceof Error ? err.name : 'Unbekannt'
    Sentry.captureException(meldung, { level: 'warning', tags: { bereich: 'admin', aufgabe: 'notfall-storno-nachricht' }, extra: { farmId, orderId } })
  }
}

/**
 * „Notfall-Storno …“ (Register N34): Das Team storniert im Namen des Hofs —
 * nur vor der Abholung, mit Grund, Recht `hof_sperren_storno`. Derselbe Weg
 * wie der Storno des Hofs: `storniere` (src/server/stornieren.ts) mit dem Hof
 * AUS DER BESTELLUNG — Sperre, Bestand, Erstattung, Storno-Mail an die
 * Kundin (ohne Grund: Der Grund ist für Hof und Protokoll, nicht für die
 * Mail). Die Sperre selbst ist der bedingte Statuswechsel dort; die Prüfung
 * hier davor gibt nur den passenden Satz.
 *
 * Danach, auch wenn nur die Erstattung scheiterte (storniert ist dann
 * trotzdem): die Nachricht an den Hof und zwei Einträge im Protokoll — an der
 * Bestellung und am Hof (seine Akte, Nr. 187).
 */
export async function notfallStorno(eingabe: unknown): Promise<StornoErgebnis> {
  const wache = await verlangeFrischeBestaetigung({ recht: 'hof_sperren_storno' })
  if ('error' in wache) return { error: wache.error }
  const geprueft = adminBestellAktionSchema.safeParse(eingabe)
  if (!geprueft.success) return { error: adminBestellFehler(geprueft.error) }
  const { orderId, grund } = geprueft.data

  const bestellung = await prisma.order.findUnique({ where: { id: orderId }, select: { farmId: true, orderNumber: true, status: true, stripePaymentIntentId: true, paymentStatus: true } })
  if (!bestellung) return { error: ADMIN_BESTELLUNG_TEXT.nichtGefunden }
  const stand = notfallStornoStand(bestellung)
  if (!stand.moeglich) return { error: stand.grund }

  const ergebnis = await storniere({ id: bestellung.farmId }, orderId)
  if (ergebnis.error && !ergebnis.erstattungOffen) return ergebnis

  const geld = hofNachrichtGeld(onlineBezahlt(bestellung), Boolean(ergebnis.erstattungOffen))
  await schreibeHofNachricht(bestellung.farmId, orderId, bestellung.orderNumber, grund, geld)
  await protokolliere({ wer: wache.userId, art: 'notfall_storno', bezugArt: 'bestellung', bezugId: orderId, grund, mitPasskey: wache.mitPasskey })
  await protokolliere({ wer: wache.userId, art: 'notfall_storno', bezugArt: 'hof', bezugId: bestellung.farmId, grund, mitPasskey: wache.mitPasskey })
  revalidatePath(ADMIN_BESTELLUNGEN_HREF)
  return ergebnis
}
