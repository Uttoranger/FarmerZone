import { prisma } from '@/lib/prisma'
import { istKaufbar, kaufSperre, type KaufSperre } from '@/lib/bereiche-anzeige'
import { naechsteAbholung, wienJetzt, type NaechsteAbholung } from '@/lib/hofuebersicht'
import { hofZustand, type HofZustandArt } from '@/lib/mein-hof'
import { alsAbholFenster, ausgebuchteTage } from '@/server/abholfenster'

/**
 * Was der Kopf von Mein Hof am Handy über den EIGENEN Hof sagt (Register N3,
 * Ergänzung 22.10.2026; Nr. 143): ob er Bestellungen annimmt, warum nicht und
 * wann die nächste Abholung ist. EINE Rechnung wie bei der Kundin und auf /hoefe —
 * `kaufSperre` und `naechsteAbholung` über dieselben Fenster mit den vollen Tagen
 * aus `ausgebuchteTage` (wie die Kasse, checkout/page.tsx), `istKaufbar` über die
 * Produkte wie die Hofliste. `naechstesAbholfenster` bleibt für Heute.
 *
 * Der Aufrufer gibt vorher verwaiste Bestellungen frei (`gibVerwaisteFreiOhneRisiko`),
 * sonst stünde ein Fenster als voll da, das die Kasse annimmt — nicht im selben
 * Promise.all, die Zählung muss danach laufen.
 */
export type MeinHofZustand = {
  /**
   * Der Zustand mit der Bedingung des Balkens der HofShell (src/server/hofbereich.ts):
   * `archivedAt` gesetzt → stillgelegt, sonst ohne `approvedAt` → wartet; erst danach
   * hofZustand. Bei `isActive = false` ohne Freigabe sagt hofZustand „aus“, der Balken
   * aber „wartet“ — maßgeblich ist der Balken, damit kein Zustand zweimal dasteht.
   */
  zustand: HofZustandArt
  sperre: KaufSperre
  naechste: NaechsteAbholung | null
  pauseMessage: string | null
  abholzeitAktiv: boolean
  /** Mindestens ein Produkt ist kaufbar (istKaufbar) — wie `istBestellbar` auf /hoefe. */
  kaufbar: boolean
}

export async function ladeMeinHofZustand(farmId: string, jetzt: Date): Promise<MeinHofZustand | null> {
  const [hof, volleTage] = await Promise.all([
    prisma.farm.findUnique({
      where: { id: farmId },
      select: {
        isActive: true,
        isPaused: true,
        adminGesperrtAm: true,
        approvedAt: true,
        archivedAt: true,
        pauseMessage: true,
        pickupSlots: { where: { isActive: true }, select: { dayOfWeek: true, startTime: true, endTime: true } },
        // Der eigene Hof: IN_LISTEN_SICHTBAR gilt hier nicht (ARCHITECTURE §5) — der Hof sieht,
        // was Kundinnen sähen, auch vor der Freigabe und als Testhof.
        products: { where: { isAvailable: true }, select: { isAvailable: true, stock: true, reservedStock: true } },
      },
    }),
    ausgebuchteTage([farmId], jetzt),
  ])
  if (!hof) return null

  const voll = volleTage.get(farmId)
  const fenster = hof.pickupSlots.map((s) => alsAbholFenster(s, voll))
  const zustand: HofZustandArt = hof.archivedAt ? 'stillgelegt' : !hof.approvedAt ? 'wartet' : hofZustand(hof).art
  return {
    zustand,
    sperre: kaufSperre({ isPaused: hof.isPaused, adminGesperrt: Boolean(hof.adminGesperrtAm), pickupSlots: fenster }, jetzt),
    naechste: naechsteAbholung(fenster, wienJetzt(jetzt)),
    pauseMessage: hof.pauseMessage,
    abholzeitAktiv: fenster.length > 0,
    kaufbar: hof.products.some(istKaufbar),
  }
}
