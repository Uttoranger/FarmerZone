'use server'

import { revalidatePath } from 'next/cache'
import { verlangeAdminAktion } from '@/server/admin-wache'
import { messeUndPruefe } from '@/server/betrieb'
import { letzteMessungAm } from '@/server/queries/betrieb'
import { ADMIN_BETRIEB_HREF, BETRIEB_TEXT, darfNeuMessen } from '@/lib/betrieb'
import { uhrzeitInWien } from '@/lib/fristen'

/**
 * „Jetzt messen“ in Admin › Betrieb (Register N18, Nr. 103). Nur für den
 * Betreiber — das Admin-Recht ist die Besitzprüfung (`verlangeAdminAktion`,
 * frisch aus der Datenbank). Keine Eingabe, also kein Schema.
 *
 * Liegt die letzte Messung weniger als 10 Minuten zurück, misst sie nicht neu:
 * Jede Messung listet den Bild-Speicher, und jede Auflistung ist ein
 * Bild-Vorgang bei Vercel (Hobby: 2 000 im Monat). Danach prüft sie die
 * Grenzen wie der Mess-Lauf — Warn-Mails nur in der Produktion.
 *
 * Ein unerwarteter Fehler (die Messungen ließen sich nicht schreiben) wirft
 * und geht nach Sentry; eine Quelle, die scheitert (lokal: der Bild-Speicher
 * ohne Schlüssel), hält die anderen nicht auf — das sagt die Kachel.
 */
export async function messeJetztAction(): Promise<{ ok: true; satz: string } | { error: string }> {
  const wache = await verlangeAdminAktion()
  if ('error' in wache) return { error: wache.error }

  const jetzt = new Date()
  const letzte = await letzteMessungAm()
  if (letzte !== null && !darfNeuMessen(letzte, jetzt)) return { ok: true, satz: BETRIEB_TEXT.geradeGemessen(uhrzeitInWien(letzte)) }

  await messeUndPruefe(jetzt)
  revalidatePath(ADMIN_BETRIEB_HREF)
  return { ok: true, satz: BETRIEB_TEXT.gemessen }
}
