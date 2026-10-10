import { revalidatePath, updateTag } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { HOEFE_CACHE_TAG } from '@/lib/hofuebersicht'
import { istGebindeGesperrt, type HofRegistrierung } from '@/lib/futter-registrierung'
import { BEREICH_KATEGORIEN } from '@/lib/taxonomie'
import type { FutterKennzeichnungFormData } from '@/schemas/product'

/*
 * Gemeinsame Helfer der Produkt-Actions (src/server/actions/products.ts) und
 * der Familien-Actions (src/server/actions/produktfamilie.ts, Nr. 20). Kein
 * 'use server' — die Funktionen hier sind keine Aktionen, die der Browser
 * aufrufen darf, sondern Bausteine der Aktionen.
 */

/**
 * Alles neu laden, was Produkte eines Hofs zeigt. updateTag WIRFT außerhalb
 * einer Server Action — deshalb nur aus Aktionen rufen, nie aus einer Route.
 */
export function revalidiereProdukte(farmSlug: string): void {
  revalidatePath('/products')
  revalidatePath(`/${farmSlug}`)
  revalidatePath('/farm-page')
  // Heute nennt in der Teilen-Karte Produkte mit Bestand (getHeute) — nach
  // Vorrat oder Sichtbarkeit sonst ein veralteter Satz.
  revalidatePath('/dashboard')
  // Die Hofübersicht hängt an einem eigenen Fünf-Minuten-Cache, den kein
  // revalidatePath erreicht (src/app/(public)/hoefe/page.tsx). Ohne diese Zeile
  // stand ein ausgeblendetes, umbenanntes oder ausverkauftes Produkt dort bis
  // zu fünf Minuten weiter — bei einem Schalter, der sofort wirken soll, ist
  // das keine Verzögerung, sondern ein falsches Versprechen.
  //
  // updateTag, NICHT revalidateTag: In Next 16 verlangt revalidateTag ein
  // zweites Argument und warnt ohne es; updateTag gilt für Server Actions, gibt
  // „lies deine eigene Schreibung" und braucht kein Profil.
  updateTag(HOEFE_CACHE_TAG)
}

/** Eine Kennzeichnung, die ein Schema durchgelassen hat — dort ist die Futtermittelart gesetzt. */
export type GepruefteKennzeichnung = FutterKennzeichnungFormData & {
  futtermittelart: NonNullable<FutterKennzeichnungFormData['futtermittelart']>
}

/**
 * Die Kennzeichnungsspalten, mit bestaetigtAm = jetzt (Pflicht-Haken, E10a).
 * Beim Anlegen immer; beim Bearbeiten nur, wenn der Hof neu bestätigt hat —
 * sonst lässt updateProduct den alten Zeitpunkt stehen (nur Preis/Vorrat
 * geändert, brauchtNeueBestaetigung).
 *
 * registrierungsnummer wird bewusst NICHT geschrieben (Rückfrage F6): Die
 * Nummer gehört dem Hof. Beim Update bleibt ein Altbestand so unangetastet —
 * er dient nur noch als Rückfall zum Lesen.
 */
export function futterDaten(f: GepruefteKennzeichnung, jetzt: Date) {
  return {
    futtermittelart: f.futtermittelart,
    zielTierarten: f.zielTierarten,
    zusammensetzung: f.zusammensetzung,
    analytischeBestandteile: f.analytischeBestandteile,
    nettoMenge: f.nettoMenge,
    nettoEinheit: f.nettoEinheit,
    rohprotein: f.rohprotein,
    rohfaser: f.rohfaser,
    rohfett: f.rohfett,
    rohasche: f.rohasche,
    zusatzstoffe: f.zusatzstoffe || null,
    gebrauchshinweis: f.gebrauchshinweis || null,
    bestaetigtAm: jetzt,
  }
}

/**
 * Nummer und Status des Hofs FRISCH aus der Datenbank — die Sperre je Gebinde
 * (S7) entscheidet nie mit dem, was ein Formular beim Öffnen gesehen hat.
 */
export async function ladeHofRegistrierung(farmId: string): Promise<HofRegistrierung> {
  const hof = await prisma.farm.findUnique({
    where: { id: farmId },
    select: { betriebsnummer: true, betriebsstatus: true },
  })
  return { betriebsnummer: hof?.betriebsnummer ?? null, betriebsstatus: hof?.betriebsstatus ?? null }
}

/**
 * Nach einer Änderung von Nummer oder Status im Hofprofil: Größen, die mit dem
 * neuen Stand gesperrt sind, gehen aus dem Shop (S7) — sonst stünde abgepacktes
 * Heimtierfutter weiter auf der Hofseite, nachdem der Hof seine BAES-Meldung
 * ausgetragen hat. Nur Futter mit Verpackung (Bestandsprodukte ohne Angabe
 * sperrt die Regel nicht). Bedingt auf `isAvailable: true`; zurück in den Shop
 * bringt der Hof sie selbst, nie diese Funktion. Gibt die Zahl zurück.
 */
export async function nimmGesperrteAusDemShop(farmId: string, hof: HofRegistrierung): Promise<number> {
  const kandidaten = await prisma.product.findMany({
    where: {
      farmId,
      isAvailable: true,
      verpackung: { not: null },
      category: { in: [...BEREICH_KATEGORIEN.FUTTERMITTEL] },
    },
    select: { id: true, category: true, verpackung: true },
  })
  const gesperrt = kandidaten.filter((p) => istGebindeGesperrt(p, hof)).map((p) => p.id)
  if (gesperrt.length === 0) return 0
  const { count } = await prisma.product.updateMany({
    where: { id: { in: gesperrt }, farmId, isAvailable: true },
    data: { isAvailable: false },
  })
  return count
}
