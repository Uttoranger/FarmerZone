import { cache } from 'react'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getHofBesitzer, getOwnerFarm, getPublicFarm, type PublicFarm } from '@/server/queries/farm'
import { ansichtsModus, type SeitenAnsicht, type Suchparameter } from '@/lib/ansichts-modus'
import { gibVerwaisteFreiFuerSlug } from '@/server/verwaiste-bestellungen'
import { ladeAbzeichenBlatt } from '@/server/queries/plattform-einstellung'

/**
 * Der Hof zu einem Slug und wer ihn sieht. Was die Vorschau (?vorschau=1)
 * von der Seite für Kundinnen unterscheidet, entscheidet `ansichtsModus`
 * (src/lib/ansichts-modus.ts) — hier, auf dem Server, mit Sitzung und Besitzer
 * als Quellen. Sieht der Besitzer seine Vorschau, lädt `getOwnerFarm` ohne die
 * Sichtbarkeitsregel (auch vor der Freigabe), sonst `getPublicFarm` mit ihr.
 *
 * Eigene Datei statt in der Seite: So lässt sich die Wahl zwischen den beiden
 * Abfragen mit nachgebildeter Sitzung prüfen (tests/hofseite-vorschau-laden.test.ts);
 * eine Seite darf nichts anderes exportieren als Next vorsieht.
 */
export async function ladeHofseite(
  farmSlug: string,
  suche: Suchparameter
): Promise<{ farm: PublicFarm | null; ansicht: SeitenAnsicht }> {
  // Frist gilt beim Lesen (src/lib/fristen.ts): Verwaiste Bestellungen geben
  // ihre Ware frei, BEVOR die Hofseite den Bestand zeigt — sonst stünde ein
  // Produkt als „Ausverkauft" da, und niemand riefe /api/reserve auf, das
  // sonst freigäbe. Fehler werden nur gemeldet.
  await gibVerwaisteFreiFuerSlug(farmSlug)

  const { besitzerVorFreigabe, ...ansicht } = await ansichtsModus(suche, {
    angemeldeterNutzer: async () => (await auth.api.getSession({ headers: await headers() }))?.user.id ?? null,
    besitzer: () => getHofBesitzer(farmSlug),
  })
  const geladen = besitzerVorFreigabe ? await getOwnerFarm(besitzerVorFreigabe) : await getPublicFarm(farmSlug)
  // Der Besitzer hat genau einen Hof (ownerId ist eindeutig) — der Abgleich
  // ist eine Absicherung, keine Unterscheidung.
  if (!geladen || geladen.slug !== farmSlug) return { farm: null, ansicht }
  // Abzeichen (Register K2, Nr. 116): Das Erklär-Blatt nennt die Plätze und —
  // solange der Zähler läuft — die freien. Nur für Gründungshöfe, aus dem Cache
  // (ladeAbzeichenBlatt); ohne Zahlen (Ladefehler) zeigt die Seite das Etikett ohne Blatt.
  if (!geladen.gruendungshof) return { farm: geladen, ansicht }
  return { farm: { ...geladen, abzeichenBlatt: await ladeAbzeichenBlatt() }, ansicht }
}

// React `cache` vergleicht Argumente nach Identität: Metadaten und Seite
// bekommen ihre Suchparameter nicht zwingend als dasselbe Objekt. Der Schlüssel
// ist deshalb ihr Text — dieselbe Adresse, dieselbe Antwort, einmal geladen.
const geteilt = cache((farmSlug: string, sucheAlsText: string) =>
  // Der Text stammt aus JSON.stringify in ladeHofseiteGeteilt darunter, nie von
  // außen: Er ist genau das Suchparameter-Objekt, das hineinging — deshalb der
  // Cast statt einer Prüfung. Was darin steht, prüft ansichtsModus (Zod).
  ladeHofseite(farmSlug, JSON.parse(sucheAlsText) as Suchparameter)
)

/** Dieselbe Antwort für Metadaten und Seite eines Aufrufs, statt zweimal zu laden. */
export function ladeHofseiteGeteilt(
  farmSlug: string,
  suche: Suchparameter
): Promise<{ farm: PublicFarm | null; ansicht: SeitenAnsicht }> {
  return geteilt(farmSlug, JSON.stringify(suche))
}
