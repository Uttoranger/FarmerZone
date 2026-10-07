/**
 * Der Kopf von „Mein Hof" (components/mein-hof/seitenkopf.tsx) — was er über
 * den Hof sagt. Rein und ohne Datenbank prüfbar (tests/mein-hof.test.ts).
 */

/**
 * Ersatz-Titelbild, wenn ein Hof noch kein Foto hochgeladen hat. Bildersatz,
 * kein Anstrich — die Verläufe folgen dem Modus bewusst nicht. Eine Quelle für
 * die Hofseite (farm-page-view.tsx) und den Streifen im Kopf.
 */
export const TITELBILD_VERLAEUFE: Record<string, string> = {
  tannengruen: 'linear-gradient(135deg, #1F4732 0%, #3D7B58 60%, #E8F0E8 100%)',
  wiese: 'linear-gradient(135deg, #2D6A4F 0%, #52B788 50%, #D8F3DC 100%)',
  erde: 'linear-gradient(135deg, #6B4226 0%, #A0663E 55%, #F5E6D8 100%)',
  herbst: 'linear-gradient(135deg, #7B4F00 0%, #D4900A 55%, #FFF3CC 100%)',
}

/** Der Verlauf zu einem gespeicherten Wert — Unbekanntes fällt auf Tannengrün. */
export function titelbildVerlauf(bannerValue: string | null | undefined): string {
  return TITELBILD_VERLAEUFE[bannerValue ?? 'tannengruen'] ?? TITELBILD_VERLAEUFE.tannengruen
}

/**
 * Das hochgeladene Titelbild, sonst null (dann gilt der Verlauf). Eine Stelle
 * für Hofseite und Streifen — `bannerValue` kann laut Schema auch eine
 * Foto-URL tragen, maßgeblich ist aber nur PHOTO mit `bannerUrl`.
 */
export function titelbildFoto(hof: { bannerType: string; bannerUrl: string | null }): string | null {
  return hof.bannerType === 'PHOTO' && hof.bannerUrl ? hof.bannerUrl : null
}

export type HofZustandArt = 'sichtbar' | 'pausiert' | 'wartet' | 'aus' | 'stillgelegt'

/**
 * Farbe eines Schilds — Bedeutungsfarben, die Komponente (components/farmer/schild.tsx)
 * ordnet Klassen zu. Rot braucht der Hofzustand nicht, wohl aber die
 * Produktzeile („Ausverkauft").
 */
export type SchildFarbe = 'gruen' | 'bernstein' | 'grau' | 'rot'

/**
 * Das Schild im neuen Design als StatusBadge-Ton (components/ui/status-badge.tsx):
 * Grün = fertig, Bernstein = offen (Orange), Grau = neutral. Rot gibt es dort
 * nicht — „Ausverkauft" und Ähnliches ist ein offener Zustand.
 */
export function schildTon(farbe: SchildFarbe): 'offen' | 'fertig' | 'neutral' {
  if (farbe === 'gruen') return 'fertig'
  if (farbe === 'grau') return 'neutral'
  return 'offen'
}

export type HofZustand = {
  art: HofZustandArt
  /**
   * Das Schild im Kopf. null bei einem stillgelegten Hof: Den Zustand sagt
   * der Balken über jeder Seite, ein zweites Schild darunter wäre Nachhall.
   */
  schild: { text: string; farbe: SchildFarbe } | null
  /** Die Hofseite ist öffentlich erreichbar — nur dann gibt es Link, Kopieren, Kundenansicht und Teilen. */
  oeffentlich: boolean
}

const NOCH_NICHT_FREIGEGEBEN = { text: 'Noch nicht freigegeben', farbe: 'grau' } as const

/**
 * Der Zustand des Hofs in einem Wort. Reihenfolge nach farm-approval.ts:
 * stillgelegt → nicht öffentlich → nicht freigeschaltet → pausiert.
 * Ein pausierter Hof bleibt öffentlich (mit Hinweis), die anderen nicht —
 * einen Link zu teilen, der ins Leere führt, wäre irreführend. Nicht
 * öffentlich (isActive false, wird heute nirgends gesetzt) und „wartet"
 * tragen dasselbe graue Schild: Für den Hof heißt beides, dass Kundinnen die
 * Seite noch nicht sehen.
 */
export function hofZustand(hof: {
  isActive: boolean
  isPaused: boolean
  approvedAt: Date | null
  archivedAt: Date | null
}): HofZustand {
  if (hof.archivedAt) return { art: 'stillgelegt', schild: null, oeffentlich: false }
  if (!hof.isActive) return { art: 'aus', schild: NOCH_NICHT_FREIGEGEBEN, oeffentlich: false }
  if (!hof.approvedAt) return { art: 'wartet', schild: NOCH_NICHT_FREIGEGEBEN, oeffentlich: false }
  if (hof.isPaused) return { art: 'pausiert', schild: { text: 'Pausiert', farbe: 'bernstein' }, oeffentlich: true }
  return { art: 'sichtbar', schild: { text: 'Öffentlich', farbe: 'gruen' }, oeffentlich: true }
}

/**
 * Die Adresse der Hofseite, wie der Kopf sie zeigt: Host und Slug, ohne
 * Protokoll („farmerzone.at/muellerhof"). Ein Bauer liest eine Adresse, kein
 * „https://". Die vollständige Adresse (zum Öffnen und Kopieren) bleibt
 * daneben; ein ungültiger appUrl fällt auf den rohen Wert zurück.
 */
export function hofAdresse(appUrl: string, slug: string): { anzeige: string; url: string } {
  const url = `${appUrl.replace(/\/+$/, '')}/${slug}`
  let host = appUrl
  try {
    host = new URL(appUrl).host
  } catch {
    // Kein gültiger Ursprung (z. B. leer) — dann steht die Adresse eben roh da.
  }
  return { anzeige: `${host}/${slug}`, url }
}
