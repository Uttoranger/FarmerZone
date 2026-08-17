/**
 * Ablage geteilter Fotos — die Übergabestelle zwischen Service Worker und
 * /teilen-Seite.
 *
 * Der Service Worker (public/sw.js) legt die per „Teilen an FarmerZone"
 * empfangenen Dateien in der Cache-API ab; die /teilen-Seite liest sie hier
 * wieder aus und leert die Ablage nach dem Upload. Cache-Name, Schlüsselschema
 * und Namens-Kopfzeile stehen in BEIDEN Dateien: Der Service Worker ist
 * bewusst abhängigkeitsfrei (liegt ungebündelt in public/) — Änderungen
 * daher NUR im Doppel.
 *
 * Reine Funktionen über einem hereingereichten CacheStorage, damit sie ohne
 * echten Service Worker prüfbar sind. tests/teilen-ablage.test.ts treibt
 * zusätzlich den ECHTEN Quelltext von public/sw.js gegen dieselbe Attrappe —
 * das hält die beiden Seiten des Vertrags zusammen.
 */

export const TEILEN_CACHE = 'geteilte-fotos'

/**
 * Kopfzeile mit dem Original-Dateinamen. HTTP-Kopfzeilen sind Latin-1 —
 * Umlaute im Dateinamen („Kürbisernte.jpg") stehen deshalb URL-kodiert darin.
 */
export const FOTO_NAME_HEADER = 'x-foto-name'

/** Schlüssel des n-ten geteilten Fotos. Pfad-förmig, weil die Cache-API
 *  Request-URLs als Schlüssel führt. */
export function teilenSchluessel(index: number): string {
  return `/geteilte-fotos/${index}`
}

/**
 * Liest alle abgelegten Fotos in Ablage-Reihenfolge.
 *
 * Bewusst über match(0), match(1), … statt über keys(): So hängt die
 * Reihenfolge am Schlüsselschema selbst und nicht an der Aufzähl-Reihenfolge
 * einer Cache-Implementierung.
 */
export async function leseGeteilteFotos(speicher: CacheStorage): Promise<File[]> {
  if (!(await speicher.has(TEILEN_CACHE))) return []
  const ablage = await speicher.open(TEILEN_CACHE)

  const fotos: File[] = []
  for (let i = 0; ; i++) {
    const antwort = await ablage.match(teilenSchluessel(i))
    if (!antwort) break

    const inhalt = await antwort.blob()
    const roherName = antwort.headers.get(FOTO_NAME_HEADER) ?? ''
    let name: string
    try {
      name = decodeURIComponent(roherName)
    } catch {
      name = roherName
    }
    fotos.push(
      new File([inhalt], name || `foto-${i + 1}.jpg`, {
        type: antwort.headers.get('content-type') ?? inhalt.type ?? 'application/octet-stream',
      })
    )
  }
  return fotos
}

/** Leert die Ablage vollständig — nach erfolgreichem Upload. */
export async function leereGeteilteFotos(speicher: CacheStorage): Promise<void> {
  await speicher.delete(TEILEN_CACHE)
}
