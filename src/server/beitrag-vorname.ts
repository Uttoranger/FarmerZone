import { prisma } from '@/lib/prisma'

/**
 * Der Vorname für `{Vorname}` in einer Beitragsmail — EINE Stelle für den
 * direkten Versand (`versendeBeitragsMails`) und den Renderer „beitrag“ der
 * Warteschlange (Nr. 158), damit beide Wege für dasselbe Abo denselben Text
 * liefern. Quelle ist die neueste Bestellung der Adresse beim Hof, das erste
 * Wort des Namens. Der Schlüssel der Karte ist die klein geschriebene
 * Adresse; nachgeschlagen wird mit `vornameFuer`, das genauso abgleicht.
 */
export async function vornamenAusBestellungen(farmId: string, adressen: string[]): Promise<Map<string, string>> {
  const vornamen = new Map<string, string>()
  if (adressen.length === 0) return vornamen
  const zeilen = await prisma.order.findMany({
    where: { farmId, customerEmail: { in: adressen } },
    select: { customerEmail: true, customerName: true },
    distinct: ['customerEmail'],
    orderBy: { createdAt: 'desc' },
  })
  for (const z of zeilen) {
    const schluessel = z.customerEmail.toLowerCase()
    // Neueste zuerst: Gibt es dieselbe Adresse in anderer Schreibung, gewinnt die neueste Bestellung.
    if (!vornamen.has(schluessel)) vornamen.set(schluessel, z.customerName.split(' ')[0] ?? '')
  }
  return vornamen
}

/** Vorname zu einer Adresse aus der Karte von `vornamenAusBestellungen`; ohne Bestellung leer. */
export function vornameFuer(vornamen: Map<string, string>, adresse: string): string {
  return vornamen.get(adresse.toLowerCase()) ?? ''
}

/** Setzt den Vornamen für jeden `{Vorname}` im Text ein (Groß-/Kleinschreibung egal). */
export function setzeVorname(text: string, vorname: string): string {
  return text.replace(/\{Vorname\}/gi, vorname)
}
