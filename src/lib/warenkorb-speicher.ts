/**
 * Der Warenkorb im Browser-Speicher — EINE Stelle für Schlüssel, Lesen,
 * Schreiben und das Signal an alle, die mitzählen.
 *
 * Vorher stand der Schlüssel an drei Stellen hart im Code (use-cart.ts,
 * checkout-form.tsx, clear-cart-on-mount.tsx), gelesen wurde mit nacktem
 * JSON.parse, und wer außer dem Produktraster die Anzahl wissen wollte, bekam
 * Änderungen nicht mit. Die Kopfzeile der Kundenseiten braucht beides.
 *
 * Es gibt genau einen Korb, für genau einen Hof: Wer bei einem zweiten Hof
 * etwas hinzufügt, überschreibt den ersten (offener Punkt, bewusst nicht in
 * diesem Sprint gelöst).
 *
 * Die Regeln sind rein (tests/warenkorb-speicher.test.ts); nur schreibeWarenkorb
 * und leereWarenkorb berühren den Browser.
 */
import {
  warenkorbPositionSchema,
  warenkorbSpeicherSchema,
  type WarenkorbPosition,
} from '@/schemas/warenkorb-speicher'

export const WARENKORB_SCHLUESSEL = 'bauernshop_cart'
export const SITZUNG_SCHLUESSEL = 'bauernshop_sid'

/** Wird nach jedem Schreiben im selben Tab ausgelöst; andere Tabs hören das storage-Ereignis. */
export const WARENKORB_EREIGNIS = 'farmerzone:warenkorb'

/** Mit diesem Anker öffnet die Hofseite beim Ankommen den Warenkorb. */
export const WARENKORB_ANKER = 'warenkorb'

export type WarenkorbSpeicher = {
  farmId: string
  farmSlug?: string
  items: WarenkorbPosition[]
}

/**
 * Liest den gespeicherten Korb. Kaputtes JSON oder eine kaputte Hülle ergibt
 * null — ein leerer Korb ist dann das richtige Ergebnis, kein Fehler, den die
 * Kundin sehen müsste. Kaputte Positionen fallen einzeln heraus.
 */
export function leseWarenkorb(roh: string | null): WarenkorbSpeicher | null {
  if (!roh) return null
  let daten: unknown
  try {
    daten = JSON.parse(roh)
  } catch {
    // Kein JSON: Jemand hat im Speicher herumgeschrieben, oder ein alter
    // Stand ist kaputt. Wie ein leerer Korb behandeln — der Rückgabewert sagt es.
    return null
  }
  const huelle = warenkorbSpeicherSchema.safeParse(daten)
  if (!huelle.success) return null
  const items = huelle.data.items.flatMap((p) => {
    const position = warenkorbPositionSchema.safeParse(p)
    return position.success ? [position.data] : []
  })
  return { farmId: huelle.data.farmId, farmSlug: huelle.data.farmSlug, items }
}

/** Die Positionen für diesen Hof — der Korb eines anderen Hofs zählt hier nicht. */
export function positionenFuer(speicher: WarenkorbSpeicher | null, farmId: string): WarenkorbPosition[] {
  return speicher?.farmId === farmId ? speicher.items : []
}

/** Die Anzahl im Warenkorb: Stück, nicht Positionen — so zählt auch der Knopf unten auf der Hofseite. */
export function warenkorbAnzahl(items: readonly Pick<WarenkorbPosition, 'quantity'>[]): number {
  return items.reduce((summe, p) => summe + p.quantity, 0)
}

/**
 * Was das Warenkorb-Symbol in der Kopfzeile zeigt: nichts, solange kein
 * nicht-leerer Korb liegt; sonst die Anzahl und den Weg zum Hof, der den
 * Warenkorb gleich öffnet. Ein alter Eintrag ohne Slug hat keinen Weg — dann
 * lieber kein Symbol als eines, das ins Leere führt.
 */
export function warenkorbImKopf(speicher: WarenkorbSpeicher | null): { anzahl: number; href: string } | null {
  if (!speicher?.farmSlug) return null
  const anzahl = warenkorbAnzahl(speicher.items)
  if (anzahl === 0) return null
  return { anzahl, href: `/${speicher.farmSlug}#${WARENKORB_ANKER}` }
}

function meldeAenderung(): void {
  window.dispatchEvent(new Event(WARENKORB_EREIGNIS))
}

/** Schreibt den Korb und sagt allen im Tab Bescheid. Wirft nie — ohne Speicher (privates Fenster) bleibt die Anzeige, der Server prüft ohnehin. */
export function schreibeWarenkorb(speicher: WarenkorbSpeicher): void {
  try {
    localStorage.setItem(WARENKORB_SCHLUESSEL, JSON.stringify(speicher))
  } catch {
    // Kein Schreibzugriff (privates Fenster, voller Speicher): Die Anzeige
    // stimmt trotzdem, und der Checkout prüft serverseitig erneut.
  }
  meldeAenderung()
}

/** Leert den Korb (nach der Bestellung) und sagt allen im Tab Bescheid. */
export function leereWarenkorb(): void {
  try {
    localStorage.removeItem(WARENKORB_SCHLUESSEL)
  } catch {
    // Kein Zugriff auf den Speicher: Dann gab es dort auch keinen Korb.
  }
  meldeAenderung()
}
