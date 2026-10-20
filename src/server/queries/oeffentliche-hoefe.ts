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
 * DER SCHLÜSSELTEIL 'v2' (Nr. 120, wie 'fassung-v1' der Startseite seit Nr.
 * 99): Ein Eintrag von vor dem Deploy trägt kein `abholfenster` — mit dem
 * neuen Schlüssel wird er nie gelesen, die erste Anfrage danach lädt neu.
 *
 * EINE WIEDERHOLUNG bei einem Verbindungsabbruch (Nr. 47): Beim Neubau im
 * Hintergrund scheiterte die Anmeldung am Pooler gelegentlich mit
 * „(EAUTHTIMEOUT)". Die Abfrage liest nur und läuft in keiner Transaktion —
 * eine zweite Runde nach kurzer Pause ist gefahrlos (src/server/oeffentlich-lesen.ts).
 */
export const ladeOeffentlicheHoefe = unstable_cache(
  () => leseOeffentlichMitWiederholung('oeffentliche-hoefe', () => getOeffentlicheHoefe()),
  [HOEFE_CACHE_TAG, 'v2'],
  {
    revalidate: 300,
    tags: [HOEFE_CACHE_TAG],
  }
)
