/**
 * Integrationstest — Größe der Hofliste bei 50, 200 und 500 Höfen mit je 20
 * Produkten (Register N19, Ergänzung 24.10.2026, Nr. 163).
 *
 * Die Aussage, die nur die Datenbank beantwortet: Wie groß wird der Eintrag,
 * den `ladeOeffentlicheHoefe` als EINEN Zwischenspeicher-Eintrag ablegt, und
 * ab wie vielen Höfen erreicht er die 2 MB, ab denen Vercel ihn nicht mehr
 * speichert? Gemessen mit derselben Funktion wie Admin › Betrieb
 * (`messeHofliste`: `getOeffentlicheHoefe` ohne Cache, Bytes des JSON).
 *
 * Die Höfe sind erfunden (Präfix `int-`, example.com) und eher üppig gefüllt:
 * jedes Produkt mit Foto, Kategorie und Siegel, jeder Hof mit Logo, Titelbild,
 * vier Galerie-Fotos, Kartenpunkt und sieben Abholzeiten — so liegt die
 * Messung eher über als unter dem echten Wert. Die Zahlen schreibt der Test in
 * die Ausgabe (für den Bericht); geprüft wird, dass sie mit der Zahl der Höfe
 * gleichmäßig wachsen und die Hochrechnung eine Zahl liefert.
 */
import { writeFileSync } from 'node:fs'
import { describe, it, expect, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { HOFLISTE_GRENZE_BYTES } from '@/lib/betrieb'
import { messeHofliste } from '@/server/betrieb'
import { getOeffentlicheHoefe } from '@/server/queries/farm'
import { INT_PRAEFIX, intKennung, raeumeAuf } from './setup/basis'

afterAll(async () => {
  await raeumeAuf()
}, 120_000)

const BILD = 'https://beispiel.public.blob.vercel-storage.com'
const KATEGORIEN = ['GEMUESE', 'OBST', 'EIER', 'MILCH', 'FLEISCH', 'HONIG'] as const

/** Legt `anzahl` freigeschaltete Höfe mit je 20 verfügbaren Produkten an — in wenigen Anweisungen (createMany). */
async function legeHoefeAn(anzahl: number): Promise<void> {
  const hoefe = Array.from({ length: anzahl }, () => intKennung('gross'))
  await prisma.user.createMany({
    data: hoefe.map((k) => ({ id: k, email: `${k}@example.com`, name: 'Max Mustermann', role: 'FARMER' as const, emailVerified: true })),
  })
  await prisma.farm.createMany({
    data: hoefe.map((k, i) => ({
      id: k,
      slug: k,
      name: `Hof Beispiel ${i}`,
      ownerName: 'Max Mustermann',
      description: 'Erfundener Hof für die Messung der Hofliste.',
      address: 'Teststraße 1',
      postalCode: '8700',
      city: 'Teststadt',
      phone: '+43 660 0000000',
      email: `${k}@example.com`,
      acceptsOnline: false,
      acceptsOnsite: true,
      isActive: true,
      isPaused: false,
      approvedAt: new Date(),
      ownerId: k,
      latitude: 47.38,
      longitude: 15.09,
      logoUrl: `${BILD}/hoefe/${k}/logo-aB3dE5fG7hJ9kL1mN3pQ5rS7tU9vW.webp`,
      bannerUrl: `${BILD}/hoefe/${k}/titel-aB3dE5fG7hJ9kL1mN3pQ5rS7tU9vW.webp`,
      bannerType: 'PHOTO' as const,
    })),
  })
  await prisma.pickupSlot.createMany({
    data: hoefe.flatMap((k) => [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ farmId: k, dayOfWeek, startTime: '15:00', endTime: '18:00' }))),
  })
  await prisma.farmPhoto.createMany({
    data: hoefe.flatMap((k) => [0, 1, 2, 3].map((sortOrder) => ({ farmId: k, sortOrder, url: `${BILD}/hoefe/${k}/galerie-${sortOrder}-aB3dE5fG7hJ9kL1mN3pQ5rS7tU9vW.webp` }))),
  })
  await prisma.product.createMany({
    data: hoefe.flatMap((k) =>
      Array.from({ length: 20 }, (_, p) => ({
        id: `${k}-p${p}`,
        farmId: k,
        name: `Erdäpfel festkochend ${p}`,
        price: 3.9,
        vatRate: 10,
        unit: 'KG' as const,
        unitSize: 2.5,
        stock: 40,
        isAvailable: true,
        abgabe: 'ALLE' as const,
        category: KATEGORIEN[p % KATEGORIEN.length],
        labels: ['BIO' as const],
        imageUrl: `${BILD}/hoefe/${k}/produkte/${p}-aB3dE5fG7hJ9kL1mN3pQ5rS7tU9vW.webp`,
      }))
    ),
  })
}

/** Bytes nur der erfundenen Höfe — ohne die Höfe aus dem Seed. */
async function bytesDerTesthoefe(): Promise<number> {
  const liste = (await getOeffentlicheHoefe()).filter((h) => h.slug.startsWith(INT_PRAEFIX))
  return Buffer.byteLength(JSON.stringify(liste))
}

describe('Größe der Hofliste', () => {
  it('bei 50, 200 und 500 Höfen mit je 20 Produkten — und ab wie vielen Höfen 2 MB erreicht sind', async () => {
    const vorher = await messeHofliste()
    const messungen: Array<{ hoefe: number; bytes: number; gesamt: number; jeHof: number }> = []
    let angelegt = 0
    for (const ziel of [50, 200, 500]) {
      await legeHoefeAn(ziel - angelegt)
      angelegt = ziel
      const gesamt = await messeHofliste()
      expect(gesamt.hoefe).toBe(vorher.hoefe + ziel)
      const bytes = await bytesDerTesthoefe()
      messungen.push({ hoefe: ziel, bytes, gesamt: gesamt.bytes, jeHof: Math.round(bytes / ziel) })
    }

    // Wächst gleichmäßig: je Hof (fast) dieselbe Zahl Bytes, ± 5 %.
    const jeHof = messungen.map((m) => m.jeHof)
    expect(Math.max(...jeHof) / Math.min(...jeHof)).toBeLessThan(1.05)
    const grenzeHoefe = Math.floor(HOFLISTE_GRENZE_BYTES / jeHof[jeHof.length - 1])
    expect(grenzeHoefe).toBeGreaterThan(0)

    // Für den Bericht (docs/nachtlauf/berichte/163.md): in die Ausgabe und, wenn
    // HOFLISTE_MESSWERTE einen Pfad nennt, als JSON dorthin (der Reporter zeigt
    // die Ausgabe bestandener Tests nicht immer).
    const ergebnis = { seed: vorher, messungen, grenzeHoefe, grenzeBytes: HOFLISTE_GRENZE_BYTES }
    console.info(`[hofliste-groesse] ${JSON.stringify(ergebnis)}`)
    if (process.env.HOFLISTE_MESSWERTE) writeFileSync(process.env.HOFLISTE_MESSWERTE, JSON.stringify(ergebnis, null, 2))
  }, 180_000)
})
