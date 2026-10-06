/**
 * Ein Wiener Kalendertag als Zeitpunkt und zurück — rein, ohne Abhängigkeit.
 *
 * Eigene Datei, damit Stichtage (konditionen.ts: Tarife, Bargebühr) und die
 * Servicegebühr (servicegebuehr.ts) dieselbe Grenze nutzen, ohne sich
 * gegenseitig einzubinden: servicegebuehr.ts liest den Bar-Stichtag aus
 * konditionen.ts (Register B1), konditionen.ts darf deshalb nichts aus
 * servicegebuehr.ts holen — ein Ring wäre beim Laden der Module eine Falle
 * (Konstante noch nicht belegt). servicegebuehr.ts reicht beide Funktionen
 * unverändert weiter, alle bisherigen Aufrufer bleiben, wie sie sind.
 */

/**
 * Ein Kalendertag (JJJJ-MM-TT) → Mitternacht dieses Tages in Europe/Vienna,
 * als UTC-Zeitpunkt für die Datenbank. Der Betreiber denkt in Tagen („ab
 * 1. Oktober"), die Bestellung trägt einen Zeitpunkt — die Grenze muss um
 * Mitternacht WIENER Zeit liegen, nicht um Mitternacht UTC (das wäre 01:00
 * bzw. 02:00 Uhr in Wien, und eine Bestellung um 00:30 fiele auf die
 * falsche Seite).
 */
export function wienerMitternacht(kalendertag: string): Date | null {
  const treffer = /^(\d{4})-(\d{2})-(\d{2})$/.exec(kalendertag)
  if (!treffer) return null
  const [, j, m, t] = treffer
  const utcMitternacht = Date.UTC(Number(j), Number(m) - 1, Number(t), 0, 0, 0)
  if (Number.isNaN(utcMitternacht)) return null
  // Welche Stunde ist es in Wien, wenn in UTC Mitternacht ist? (1 oder 2)
  const wienStunde = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Vienna',
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(new Date(utcMitternacht))
  )
  const ergebnis = new Date(utcMitternacht - wienStunde * 60 * 60 * 1000)
  // Plausibilität: das Ergebnis muss in Wien genau auf den gewünschten Tag fallen.
  if (kalendertagInWien(ergebnis) !== kalendertag) return null
  return ergebnis
}

/** Ein Zeitpunkt → sein Kalendertag in Wien als JJJJ-MM-TT (für <input type="date">). */
export function kalendertagInWien(zeitpunkt: Date): string {
  const teile = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Vienna',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(zeitpunkt)
  const wert = (typ: string) => teile.find((p) => p.type === typ)?.value ?? ''
  return `${wert('year')}-${wert('month')}-${wert('day')}`
}
