/**
 * Fabrik für `PublicProduct` (Nr. 136, Regelvorschlag 127, freigegeben 21.10.2026): ein vollständiges öffentliches
 * Produkt, wie `getPublicFarm` es liefert. Testdateien überschreiben nur, was sie prüfen:
 * `publicProduct({ id: 'p_eier', name: 'Freilandeier', stock: 0 })`. Kommt dem Typ ein Pflichtfeld dazu, ergänzt man
 * es HIER — und nur hier. Die Wache `tests/fabrik-wache.test.ts` hält fest, dass keine Testdatei das Produkt noch
 * einmal ausschreibt (elf Testdateien taten es, jede mit denselben 26 Feldern).
 *
 * Jeder Aufruf baut ein frisches Objekt (Listen werden nie zwischen Tests geteilt). Die Vorgaben sind ein
 * kaufbares Gemüse; wer Preis, Einheit oder Bestand prüft, setzt sie selbst.
 */
import type { PublicProduct } from '@/server/queries/farm'

export function publicProduct(teil: Partial<PublicProduct> = {}): PublicProduct {
  return {
    id: 'p_test',
    name: 'Testprodukt',
    description: null,
    imageUrl: null,
    bildAusschnitt: null,
    category: 'GEMUESE',
    categoryImageUrl: null,
    price: 4.5,
    unit: 'STUECK',
    unitSize: null,
    stock: 20,
    isAvailable: true,
    allergens: [],
    isOrganic: false,
    requiresCool: false,
    requiresFreezer: false,
    seasonStart: null,
    seasonEnd: null,
    unavailableReason: null,
    subcategory: null,
    labels: [],
    abgabe: 'ALLE',
    futter: null,
    familieId: null,
    brennmaterial: null,
    abholhinweise: [],
    ...teil,
  }
}
