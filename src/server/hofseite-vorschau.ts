import { cache } from 'react'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getHofBesitzer, getOwnerFarm, getPublicFarmMitTeilen, type OeffentlicherHof, type PublicFarm } from '@/server/queries/farm'
import { ansichtsModus, type SeitenAnsicht, type Suchparameter } from '@/lib/ansichts-modus'
import { gibVerwaisteFreiFuerSlug } from '@/server/verwaiste-bestellungen'
import { alsAbholFenster, ausgebuchteTage } from '@/server/abholfenster'
import { ladeAbzeichenBlatt } from '@/server/queries/plattform-einstellung'

/** Was die Hof- und die Produktseite laden: der Hof, wer ihn sieht, und (öffentlich) die Rohwerte des Teilen-Bilds. */
export type Hofseite = { farm: PublicFarm | null; ansicht: SeitenAnsicht; teilen?: OeffentlicherHof | null }

/** Etwas, das mit der Hof-ID gleichzeitig mit den vollen Tagen startet (Nr. 180); die Seite liest sein Ergebnis selbst (React `cache`). */
export type Vorab = (hofId: string) => Promise<unknown>

/**
 * Der Hof zu einem Slug und wer ihn sieht. Was die Vorschau (?vorschau=1)
 * von der Seite für Kundinnen unterscheidet, entscheidet `ansichtsModus`
 * (src/lib/ansichts-modus.ts) — hier, auf dem Server, mit Sitzung und Besitzer
 * als Quellen. Sieht der Besitzer seine Vorschau, lädt `getOwnerFarm` ohne die
 * Sichtbarkeitsregel (auch vor der Freigabe), sonst `getPublicFarmMitTeilen`
 * (die Abfrage von `getPublicFarm`) mit ihr. `teilen` ist dann der
 * öffentliche Hof samt Rohwerten des Teilen-Bilds: Die Metadaten bauen das
 * Bild daraus, statt den Hof ein zweites Mal zu fragen (Nr. 196); in der
 * Vorschau des Besitzers vor der Freigabe ist es null — dann gibt es kein Bild.
 *
 * Eigene Datei statt in der Seite: So lässt sich die Wahl zwischen den beiden
 * Abfragen mit nachgebildeter Sitzung prüfen (tests/hofseite-vorschau-laden.test.ts);
 * eine Seite darf nichts anderes exportieren als Next vorsieht.
 */
export async function ladeHofseite(
  farmSlug: string,
  suche: Suchparameter,
  vorab?: Vorab
): Promise<Hofseite> {
  // Frist gilt beim Lesen (src/lib/fristen.ts): Verwaiste Bestellungen geben
  // ihre Ware frei, BEVOR die Hofseite den Bestand zeigt — sonst stünde ein
  // Produkt als „Ausverkauft" da, und niemand riefe /api/reserve auf, das
  // sonst freigäbe. Fehler werden nur gemeldet.
  await gibVerwaisteFreiFuerSlug(farmSlug)

  const { besitzerVorFreigabe, ...ansicht } = await ansichtsModus(suche, {
    angemeldeterNutzer: async () => (await auth.api.getSession({ headers: await headers() }))?.user.id ?? null,
    besitzer: () => getHofBesitzer(farmSlug),
  })
  const oeffentlich = besitzerVorFreigabe ? null : await getPublicFarmMitTeilen({ slug: farmSlug })
  const hof = besitzerVorFreigabe ? await getOwnerFarm(besitzerVorFreigabe) : (oeffentlich?.farm ?? null)
  // Der Besitzer hat genau einen Hof (ownerId ist eindeutig) — der Abgleich
  // ist eine Absicherung, keine Unterscheidung.
  if (!hof || hof.slug !== farmSlug) return { farm: null, ansicht, teilen: null }
  // „Nächste Abholung" lässt volle Fenster weg (Register N19, Ergänzung
  // 21.10.2026): gezählt wie in der Kasse, NACH der Freigabe verwaister
  // Bestellungen oben — getPublicFarm/getOwnerFarm zählen selbst nicht (Mein
  // Hof liest getOwnerFarm auch). Die zweite Abfrage läuft nur bei einer Höchstzahl.
  // Volle Tage, Abzeichen-Blatt und (mit `vorab`) die Beiträge der Seite hängen nicht voneinander ab, sobald
  // die Hof-ID bekannt ist: gleichzeitig (Nr. 180).
  const [volleTage, abzeichenBlatt] = await Promise.all([
    ausgebuchteTage([hof.id], new Date()),
    hof.gruendungshof ? ladeAbzeichenBlatt() : null,
    vorab?.(hof.id),
  ])
  const voll = volleTage.get(hof.id)
  const geladen = voll ? { ...hof, pickupSlots: hof.pickupSlots.map((s) => alsAbholFenster(s, voll)) } : hof
  // Abzeichen (Register K2, Nr. 116): Das Erklär-Blatt nennt die Plätze und —
  // solange der Zähler läuft — die freien. Nur für Gründungshöfe, aus dem Cache
  // (ladeAbzeichenBlatt); ohne Zahlen (Ladefehler) zeigt die Seite das Etikett ohne Blatt.
  if (!geladen.gruendungshof) return { farm: geladen, ansicht, teilen: oeffentlich }
  return { farm: { ...geladen, abzeichenBlatt }, ansicht, teilen: oeffentlich }
}

// React `cache` vergleicht Argumente nach Identität: Metadaten und Seite
// bekommen ihre Suchparameter nicht zwingend als dasselbe Objekt. Der Schlüssel
// ist deshalb ihr Text — dieselbe Adresse, dieselbe Antwort, einmal geladen.
//
// `vorab` kann nicht zum Schlüssel gehören (eine neue Funktion je Aufruf, die Antwort wäre
// nicht mehr geteilt — auch die schlanke Prüfung der Vorschau liest sie ohne). Es steht deshalb
// in einem Fach derselben Anfrage, das der Lader erst liest, wenn der Hof da ist (nach mehreren
// Abfragen): Wer vorher `vorab` mitgibt, dessen Wunsch läuft mit; wer zu spät kommt, lädt danach
// wie bisher.
const vorabFach = cache((_farmSlug: string, _sucheAlsText: string): { vorab: Vorab | null } => ({ vorab: null }))

const geteilt = cache((farmSlug: string, sucheAlsText: string) =>
  // Der Text stammt aus JSON.stringify in ladeHofseiteGeteilt darunter, nie von
  // außen: Er ist genau das Suchparameter-Objekt, das hineinging — deshalb der
  // Cast statt einer Prüfung. Was darin steht, prüft ansichtsModus (Zod).
  ladeHofseite(farmSlug, JSON.parse(sucheAlsText) as Suchparameter, (hofId) => vorabFach(farmSlug, sucheAlsText).vorab?.(hofId) ?? Promise.resolve())
)

/** Dieselbe Antwort für Metadaten und Seite eines Aufrufs, statt zweimal zu laden. `vorab`: siehe oben. */
export function ladeHofseiteGeteilt(
  farmSlug: string,
  suche: Suchparameter,
  vorab?: Vorab
): Promise<Hofseite> {
  const sucheAlsText = JSON.stringify(suche)
  if (vorab) vorabFach(farmSlug, sucheAlsText).vorab = vorab
  return geteilt(farmSlug, sucheAlsText)
}
