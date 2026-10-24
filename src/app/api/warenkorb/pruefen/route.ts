import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { enforceRateLimit } from '@/lib/rate-limit'
import { bremseReservieren } from '@/server/bremse-datenbank'
import { pruefeSitzungsWarenkorb, erneuereHalte, loescheHalte, hofSperrenFuerProdukte } from '@/server/warenkorb'
import { MAX_MENGE } from '@/lib/reservierung'
import { gibVerwaisteFreiFuerProdukte } from '@/server/verwaiste-bestellungen'

/**
 * Warenkorb gegen die Wirklichkeit abgleichen (Bug-Report Befund 3).
 * Gerufen beim Laden des Warenkorbs und beim Öffnen des Checkouts.
 *
 * Die Route SCHREIBT nur Reservierungen dieser Sitzung: Sie erneuert die Halte
 * für das, was bleibt, und räumt die für das weg, was nicht mehr geht. Sie legt
 * keine Bestellung an, ändert keinen Bestand und fasst keine fremde Sitzung an.
 *
 * Die Höfe prüft sie mit derselben Kette wie /api/reserve (Nr. 165, Register
 * N24): Stilllegung → Freischaltung → Pause → Kaufsperre. Besteht ein Hof
 * nicht, hält der Warenkorb bei ihm nichts mehr fest — sonst hielte ein Korb
 * aus der Zeit vor einer Pause die Ware weiter.
 *
 * Antwort: die berichtigten Positionen und — falls nötig — EINE Meldung im
 * Klartext. Der Browser zeigt dann den aktuellen Warenkorb samt Grund, statt
 * die Kundin vor eine leere Seite zu setzen.
 */

const bodySchema = z.object({
  sessionId: z.string().min(1),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        // Dieselbe Obergrenze wie /api/reserve: Auch das Erneuern hält Ware fest.
        quantity: z.number().int().positive().max(MAX_MENGE),
      })
    )
    .max(100),
})

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit('warenkorb-pruefen', request)
  if (limited) return limited

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Parameter' }, { status: 400 })
  }

  const { sessionId, items } = parsed.data

  // Zweite Stufe über alle Instanzen (Register S17 Punkt 1): derselbe Zähler je
  // IP wie /api/reserve — auch das Erneuern hält Ware fest. Vor der Fristfreigabe
  // und vor jedem Schreiben.
  const ueberAlleInstanzen = await bremseReservieren(request)
  if (ueberAlleInstanzen) return ueberAlleInstanzen

  try {
    const jetzt = new Date()
    // Frist gilt beim Lesen: erst verwaiste Bestellungen freigeben, dann den
    // Bestand prüfen. Ein Fehler darin bleibt gemeldet, nie die Antwort.
    await gibVerwaisteFreiFuerProdukte(items.map((i) => i.productId), jetzt)
    // Die Prüfkette je Hof nach der Fristfreigabe (wie /api/reserve): Positionen
    // eines gesperrten Hofs gelten im Abgleich als nicht möglich.
    const sperren = await hofSperrenFuerProdukte(items.map((i) => i.productId), jetzt)
    const pruefung = await pruefeSitzungsWarenkorb(items, sessionId, jetzt, new Set(sperren.keys()))
    const { befund, berichtigt } = pruefung
    // Der Grund steht vorn, die Folge (entfernt, abgelaufen) dahinter — je Grund einmal.
    const gruende = [...new Set([...sperren.values()].map((s) => s.text))]
    const meldung = [...gruende, pruefung.meldung].filter((t): t is string => !!t).join(' ') || null

    // Halte nachführen: erneuern, was bleibt; löschen, was rausfällt.
    const entfallen = befund.positionen.filter((p) => p.moeglich === 0).map((p) => p.productId)
    const reserviertBis = await erneuereHalte(berichtigt, sessionId, jetzt)
    await loescheHalte(entfallen, sessionId)

    return NextResponse.json({
      meldung,
      // Bis dahin gelten die eben erneuerten Halte — die Kasse zeigt die Frist.
      reserviertBis: reserviertBis?.toISOString() ?? null,
      etwasAbgelaufen: befund.etwasAbgelaufen,
      etwasGeaendert: befund.etwasGeaendert,
      items: berichtigt,
      positionen: befund.positionen.map((p) => {
        const sperre = sperren.get(p.productId)
        return sperre ? { ...p, grund: sperre.text } : p
      }),
    })
  } catch (e) {
    console.error('[/api/warenkorb/pruefen]', e)
    // Fehlschlag darf den Warenkorb nicht leeren: Der Browser behält dann
    // seinen Stand, der Checkout prüft ohnehin noch einmal verbindlich.
    return NextResponse.json({ error: 'Warenkorb konnte nicht geprüft werden' }, { status: 500 })
  }
}
