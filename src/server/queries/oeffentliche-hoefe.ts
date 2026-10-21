import { unstable_cache } from 'next/cache'
import { getOeffentlicheHoefe } from '@/server/queries/farm'
import { HOEFE_CACHE_TAG } from '@/lib/hofuebersicht'
import { leseOeffentlichMitWiederholung } from '@/server/oeffentlich-lesen'

/**
 * Die öffentliche Hofliste, fünf Minuten gecacht — EIN Eintrag für die
 * Startseite und /hoefe. Vorher legte jede Seite ihren eigenen an (Schlüssel
 * 'startseite-hoefe' bzw. HOEFE_CACHE_TAG): zwei Datenbankabfragen für
 * dieselben Daten, und beide alterten unabhängig voneinander.
 *
 * `tags` ist nicht Zierde: OHNE Etikett gibt es keinen Weg, diesen Eintrag
 * vorzeitig zu leeren — `revalidatePath` erreicht einen Dateneintrag nicht, und
 * `updateTag`/`revalidateTag` brauchen ein Etikett. Genau deshalb blieb ein
 * ausgeblendetes Produkt bis zu fünf Minuten stehen, obwohl die
 * Produktaktionen längst revalidierten (Sprint Sichtbarkeits-Schalter). Die
 * statische Startseite hängt über dasselbe Etikett mit: Leert eine Aktion den
 * Eintrag, baut Next auch die Seite neu.
 *
 * BEWUSST IN KAUF GENOMMEN: Auch die „Heute/Morgen"-Angabe der nächsten
 * Abholung wird mit den Daten gecacht und altert höchstens fünf Minuten. Auf
 * /hoefe rechnet der Browser sie seit Nr. 120 aus `abholfenster` neu.
 *
 * DER SCHLÜSSELTEIL 'v3' (Nr. 129; 'v2' seit Nr. 120, wie 'fassung-v1' der
 * Startseite seit Nr. 99): Ein Eintrag von vor dem Deploy trägt kein
 * `neuerBeitrag` (bzw. kein `abholfenster`) — mit dem neuen Schlüssel wird er
 * nie gelesen, die erste Anfrage danach lädt neu. Jede neue Form braucht
 * einen neuen Schlüssel, denn der Datenspeicher überlebt Deploys.
 *
 * Erneuert wird über `updateTag(HOEFE_CACHE_TAG)`: Produkte, Auftritt,
 * Abzeichen, Admin — und seit Nr. 129 Veröffentlichen, Deaktivieren und
 * Löschen eines Beitrags (src/server/actions/status-posts.ts). Das
 * automatische Ablaufen eines Beitrags deckt der Browser über `endet` ab.
 *
 * EINE WIEDERHOLUNG bei einem Verbindungsabbruch (Nr. 47): Beim Neubau im
 * Hintergrund scheiterte die Anmeldung am Pooler gelegentlich mit
 * „(EAUTHTIMEOUT)". Die Abfrage liest nur und läuft in keiner Transaktion —
 * eine zweite Runde nach kurzer Pause ist gefahrlos (src/server/oeffentlich-lesen.ts).
 */
export const ladeOeffentlicheHoefe = unstable_cache(
  () => leseOeffentlichMitWiederholung('oeffentliche-hoefe', () => getOeffentlicheHoefe()),
  [HOEFE_CACHE_TAG, 'v3'],
  {
    revalidate: 300,
    tags: [HOEFE_CACHE_TAG],
  }
)
