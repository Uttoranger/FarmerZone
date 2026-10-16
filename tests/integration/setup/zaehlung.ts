/**
 * Die Rechnung hinter der Zählung in `raeumeAuf` (basis.ts) — rein, ohne Datenbank, damit die schnelle Suite
 * sie prüfen kann (`tests/raeume-auf-zaehlung.test.ts`).
 *
 * `vorher` und `nachher` sind die Zählungen vor und nach dem Aufräumen: je Tabelle mit Fremdschlüssel auf ein
 * Konto oder einen Hof die Zeilen insgesamt (`gesamt`) und die, die an Test-Konten oder -Höfen hängen (`haengt`).
 * Nach dem Aufräumen darf die Tabelle höchstens `gesamt - haengt` Zeilen haben, also nur die, die nicht an
 * Test-Konten oder -Höfen hingen.
 */
export type Zaehlung = Map<string, { gesamt: number; haengt: number }>

/**
 * Tabellen, deren Zeilen bewusst an Test-Konten oder -Höfen liegen bleiben dürfen — je Tabelle mit Grund.
 * Leer ist der Normalfall; ein Eintrag hier ist eine Schuld, kein Freibrief.
 */
export const BLEIBT_LIEGEN: Record<string, string> = {}

/** Die Tabellen, in denen nach dem Aufräumen noch Zeilen stehen, die vorher an Test-Konten oder -Höfen hingen: `Tabelle: n`. */
export function liegengebliebene(vorher: Zaehlung, nachher: Zaehlung, ausnahmen: Record<string, string> = BLEIBT_LIEGEN): string[] {
  return [...vorher].flatMap(([tabelle, v]) => {
    const uebrig = (nachher.get(tabelle)?.gesamt ?? 0) - (v.gesamt - v.haengt)
    return uebrig > 0 && !(tabelle in ausnahmen) ? [`${tabelle}: ${uebrig}`] : []
  })
}
