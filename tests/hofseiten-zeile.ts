/**
 * Eine Hofzeile, wie `getPublicFarm` sie aus der Datenbank liest (Nr. 196).
 *
 * Seit Nr. 196 baut das Teilen-Bild aus derselben Abfrage wie die Hofseite
 * (`getPublicFarmMitTeilen`). Die Tests des Teilen-Bilds schreiben weiter nur
 * die Felder hin, die sie prüfen (Name, Ort, Produkte mit Preis und
 * Verpackung, Abholzeiten); den Rest der Zeile füllt diese Hilfe mit
 * neutralen Werten. Jeder Aufruf baut ein frisches Objekt. Erfundene Daten.
 */
const HOF_REST = {
  ownerName: 'Max Muster',
  description: '',
  address: 'Teststraße 1',
  postalCode: '4910',
  country: 'AT',
  phone: '+43 660 0000000',
  email: 'hof@example.com',
  logoUrl: null,
  bannerUrl: null,
  tagline: null,
  foundedYear: null,
  aboutText: null,
  bannerType: 'GRADIENT',
  bannerValue: null,
  bannerFocusY: 50,
  bannerAusschnitt: null,
  logoAusschnitt: null,
  sectionsConfig: [],
  acceptsOnline: true,
  acceptsOnsite: true,
  stripeAccountReady: false,
  isPaused: false,
  pauseMessage: null,
  serviceFeePercent: 0,
  serviceFeeMinCents: 0,
  serviceFeeActiveFrom: null,
  betriebsnummer: null,
  betriebsstatus: null,
  istTesthof: false,
  farmValues: [],
  farmPhotos: [],
  pickupSlots: [],
  products: [],
}

const PRODUKT_REST = {
  description: null,
  imageUrl: null,
  bildAusschnitt: null,
  category: null,
  subcategory: null,
  unit: 'STUECK',
  unitSize: null,
  stock: 0,
  isAvailable: true,
  allergens: [],
  labels: [],
  abgabe: 'ALLE',
  requiresCool: false,
  requiresFreezer: false,
  seasonStart: null,
  seasonEnd: null,
  unavailableReason: null,
  futter: null,
  familieId: null,
  abholhinweise: [],
  brennmaterial: null,
  verpackung: null,
}

/** Die schlanke Zeile eines Tests als volle Zeile der Hofseite; null bleibt null (kein öffentlicher Hof). */
export function hofseitenZeile(zeile: Record<string, unknown> | null): Record<string, unknown> | null {
  if (zeile === null) return null
  const produkte = Array.isArray(zeile.products) ? (zeile.products as Record<string, unknown>[]) : []
  return { ...structuredClone(HOF_REST), ...zeile, products: produkte.map((p) => ({ ...structuredClone(PRODUKT_REST), ...p })) }
}
