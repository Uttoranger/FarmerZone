/**
 * „Einmal je Tag“ über alle Instanzen (Nr. 213.3, herausgezogen aus
 * `erstmalsHeute` in src/lib/umgebung-server.ts und dem Stripe-Webhook,
 * Verhalten gleich): Wer die Zeile des UTC-Tages für den Schlüssel anlegt,
 * bekommt true und meldet; jede andere Anfrage bekommt false. Der Schlüssel
 * ist frei; die Aufrufer bauen ihn (`sentry:<zustand>:<deploy>`,
 * `sentry:stripe-schema:<typ>`).
 *
 * Rein (ARCHITECTURE §1, Nachbesserung Runde 1): Die Datenbankanweisung kommt
 * als Parameter `legeAn` herein — sie steht einmal in `legeTageszeileAn`
 * (src/lib/umgebung-server.ts), beide Aufrufer reichen sie durch. Hier steht
 * nur die Entscheidung: welcher Tag, ab wann true, und dass ein Fehler false
 * ergibt — lieber eine Meldung zu wenig als ein Wurf in einem Nachlauf.
 */

/** Legt die Zeile (Tag, Schlüssel) an, falls es sie noch nicht gibt; liefert die Zahl der angelegten Zeilen. */
export type LegeTageszeileAn = (tag: string, art: string, jetzt: Date) => Promise<number>

/** Der UTC-Tag als JJJJ-MM-TT — wie BetriebMessung zählt. */
export function utcTagVon(jetzt: Date): string {
  return jetzt.toISOString().slice(0, 10)
}

/** true genau für die Anfrage, die heute (UTC) die Zeile für `art` anlegt; sonst und bei jedem Fehler false. */
export async function einmalJeTag(art: string, jetzt: Date, legeAn: LegeTageszeileAn): Promise<boolean> {
  try {
    return (await legeAn(utcTagVon(jetzt), art, jetzt)) > 0
  } catch {
    return false
  }
}
