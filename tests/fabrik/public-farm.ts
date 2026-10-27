/**
 * Fabrik für `PublicFarm` (Nr. 127, Regelvorschlag 119): ein vollständiger öffentlicher Hof, wie ihn
 * `getPublicFarm` liefert. Testdateien überschreiben nur, was sie prüfen: `publicFarm({ isPaused: true })`.
 * Kommt dem Typ ein Pflichtfeld dazu, ergänzt man es HIER — und nur hier. Die Wache
 * `tests/fabrik-wache.test.ts` hält fest, dass keine Testdatei den Hof noch einmal ausschreibt.
 *
 * Jeder Aufruf baut ein frisches Objekt (Listen und Unterobjekte werden nie zwischen Tests geteilt).
 * Personendaten sind erfunden (`@example.com`, genulltes Telefon).
 */
import type { PublicFarm } from '@/server/queries/farm'

export function publicFarm(teil: Partial<PublicFarm> = {}): PublicFarm {
  return {
    id: 'farm_test',
    slug: 'hof-test',
    name: 'Hof Test',
    ownerName: 'Erika Muster',
    description: 'Gemüse aus Musterdorf',
    address: 'Musterweg 1',
    postalCode: '4900',
    city: 'Musterdorf',
    country: 'AT',
    phone: '+43 660 0000000',
    email: 'hof@example.com',
    logoUrl: null,
    logoAusschnitt: null,
    bannerUrl: null,
    tagline: null,
    foundedYear: null,
    aboutText: null,
    bannerType: 'GRADIENT',
    bannerValue: null,
    bannerFocusY: 50,
    bannerAusschnitt: null,
    sectionsConfig: [],
    farmValues: [],
    farmPhotos: [],
    acceptsOnline: true,
    acceptsOnsite: true,
    stripeAccountReady: true,
    isPaused: false,
    pauseMessage: null,
    serviceFeePercent: 5,
    serviceFeeMinCents: 50,
    serviceFeeActiveFrom: '2026-01-01T00:00:00.000Z',
    preisAnzeige: null,
    betriebsstatus: null,
    products: [],
    pickupSlots: [{ dayOfWeek: 3, startTime: '15:00', endTime: '18:00' }],
    gruendungshof: false,
    istTesthof: false,
    gruendungSeit: null,
    abzeichenBlatt: null,
    ...teil,
  }
}
