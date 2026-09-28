/**
 * Der Kopf von „Mein Hof" (components/farmer/mein-hof-kopf.tsx) — was er über
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

export type HofZustandArt = 'sichtbar' | 'pausiert' | 'wartet' | 'aus'

export type HofZustand = {
  art: HofZustandArt
  text: string
  /** Die Hofseite ist öffentlich erreichbar — nur dann gibt es Kundenansicht und Teilen. */
  oeffentlich: boolean
}

/**
 * Der Zustand des Hofs in einem Wort. Reihenfolge nach farm-approval.ts:
 * stillgelegt → nicht freigeschaltet → pausiert; „Nicht öffentlich"
 * (isActive false) steht nach „Stillgelegt", weil das dem Hof mehr sagt.
 * Ein pausierter Hof bleibt öffentlich (mit Hinweis), die anderen nicht —
 * einen Link zu teilen, der ins Leere führt, wäre irreführend.
 */
export function hofZustand(hof: {
  isActive: boolean
  isPaused: boolean
  approvedAt: Date | null
  archivedAt: Date | null
}): HofZustand {
  if (hof.archivedAt) return { art: 'aus', text: 'Stillgelegt', oeffentlich: false }
  if (!hof.isActive) return { art: 'aus', text: 'Nicht öffentlich', oeffentlich: false }
  if (!hof.approvedAt) return { art: 'wartet', text: 'Wartet auf Freischaltung', oeffentlich: false }
  if (hof.isPaused) return { art: 'pausiert', text: 'Pausiert', oeffentlich: true }
  return { art: 'sichtbar', text: 'Im Shop sichtbar', oeffentlich: true }
}
