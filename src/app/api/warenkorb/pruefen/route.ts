import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { enforceRateLimit } from '@/lib/rate-limit'
import { pruefeSitzungsWarenkorb, erneuereHalte, loescheHalte } from '@/server/warenkorb'

/**
 * Warenkorb gegen die Wirklichkeit abgleichen (Bug-Report Befund 3).
 * Gerufen beim Laden des Warenkorbs und beim Öffnen des Checkouts.
 *
 * Die Route SCHREIBT nur Reservierungen dieser Sitzung: Sie erneuert die Halte
 * für das, was bleibt, und räumt die für das weg, was nicht mehr geht. Sie legt
 * keine Bestellung an, ändert keinen Bestand und fasst keine fremde Sitzung an.
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
        quantity: z.number().int().positive(),
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

  try {
    const jetzt = new Date()
    const { befund, meldung, berichtigt } = await pruefeSitzungsWarenkorb(items, sessionId, jetzt)

    // Halte nachführen: erneuern, was bleibt; löschen, was rausfällt.
    const entfallen = befund.positionen.filter((p) => p.moeglich === 0).map((p) => p.productId)
    await erneuereHalte(berichtigt, sessionId, jetzt)
    await loescheHalte(entfallen, sessionId)

    return NextResponse.json({
      meldung,
      etwasAbgelaufen: befund.etwasAbgelaufen,
      etwasGeaendert: befund.etwasGeaendert,
      items: berichtigt,
      positionen: befund.positionen,
    })
  } catch (e) {
    console.error('[/api/warenkorb/pruefen]', e)
    // Fehlschlag darf den Warenkorb nicht leeren: Der Browser behält dann
    // seinen Stand, der Checkout prüft ohnehin noch einmal verbindlich.
    return NextResponse.json({ error: 'Warenkorb konnte nicht geprüft werden' }, { status: 500 })
  }
}
