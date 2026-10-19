'use server'

import { revalidatePath } from 'next/cache'
import { verlangeAdminAktion } from '@/server/admin-wache'
import { beginneMessung, messeUndPruefe } from '@/server/betrieb'
import { letzteMessungAm } from '@/server/queries/betrieb'
import { ADMIN_BETRIEB_HREF, BETRIEB_TEXT } from '@/lib/betrieb'
import { uhrzeitInWien } from '@/lib/fristen'

/**
 * „Jetzt messen“ in Admin › Betrieb (Register N18, Nr. 103). Nur für den
 * Betreiber — das Admin-Recht ist die Besitzprüfung (`verlangeAdminAktion`,
 * frisch aus der Datenbank). Keine Eingabe, also kein Schema.
 *
 * Liegt die letzte Messung weniger als 10 Minuten zurück, misst sie nicht neu:
 * Jede Messung listet den Bild-Speicher, und jede Auflistung ist ein
 * Bild-Vorgang bei Vercel. Seit Nr. 113 entscheidet das EINE Anweisung
 * (`beginneMessung`) — zwei gleichzeitige Klicks messen nur einmal. Danach
 * prüft sie die Grenzen wie der Mess-Lauf; die Warn-Mail geht erst nach der
 * Antwort hinaus (`nachher`), der Knopf wartet nicht auf den Versand.
 *
 * Ein unerwarteter Fehler (die Messungen ließen sich nicht schreiben) wirft
 * und geht nach Sentry; eine Quelle, die scheitert (lokal: der Bild-Speicher
 * ohne Schlüssel), hält die anderen nicht auf — das sagt die Kachel.
 */
export async function messeJetztAction(): Promise<{ ok: true; satz: string } | { error: string }> {
  const wache = await verlangeAdminAktion()
  if ('error' in wache) return { error: wache.error }

  const jetzt = new Date()
  if (!(await beginneMessung(jetzt))) {
    // Eine Messung begann vor weniger als 10 Minuten — ihre Uhrzeit (die Zeile ist sicher da, sonst hätte die Anweisung getroffen).
    const letzte = await letzteMessungAm(true)
    return { ok: true, satz: BETRIEB_TEXT.geradeGemessen(uhrzeitInWien(letzte ?? jetzt)) }
  }

  await messeUndPruefe(jetzt, { nachher: true })
  revalidatePath(ADMIN_BETRIEB_HREF)
  return { ok: true, satz: BETRIEB_TEXT.gemessen }
}
