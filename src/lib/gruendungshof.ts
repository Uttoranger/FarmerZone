// Gründungshöfe: Die ersten freigeschalteten Höfe der Plattform bekommen
// dauerhaft bessere Konditionen.
//
// Der Platz wird BERECHNET, nicht gespeichert — kein Schema-Feld. Damit kann
// er nicht mit der Wirklichkeit auseinanderlaufen, und ein zurückgenommener
// oder stillgelegter Hof gibt seinen Platz automatisch wieder frei.
//
// GELTUNGSBEREICH IN DIESEM SPRINT: Diese Datei speist ausschließlich den
// Admin-Bereich. Kundenseitiges Abzeichen und Konditions-Seite folgen in einem
// eigenen Sprint; die Gebührenberechnung bleibt unberührt (platformFeePercent
// steht weiterhin auf 0).

export const MAX_GRUENDUNGSHOEFE = 12

/** Ende der gebührenfreien Gründungsphase (einschließlich dieses Tages). */
export const GRUENDUNGSPHASE_ENDE = new Date('2029-12-31T23:59:59.999Z')

/** Provision nach Ablauf der Gründungsphase, dauerhaft. */
export const GRUENDUNGS_PROVISION_PROZENT = 3

/** Die Konditionen in einem Satz — eine Quelle für alle Anzeigen. */
export const GRUENDUNGS_KONDITIONEN =
  'Keine Plattformgebühr bis 31.12.2029, danach dauerhaft 3 %. ' +
  'Zahlungsgebühren von Stripe fallen unabhängig davon an.'

/** Beschriftung eines belegten Platzes, z. B. „Gründungshof Nr. 3". */
export function gruendungshofLabel(platz: number): string {
  return `Gründungshof Nr. ${platz}`
}

/** Beschriftung für einen freigeschalteten Hof ohne Gründungsplatz. */
export const KEIN_GRUENDUNGSPLATZ = 'kein Gründungsplatz'

/**
 * Ein Hof, so wie ihn die Platzvergabe braucht. Bewusst schmal gehalten, damit
 * die Funktionen rein und ohne Datenbank testbar bleiben — `AdminFarmRow`
 * erfüllt diese Form bereits.
 */
export type HofFuerPlatz = {
  id: string
  approvedAt: Date | null
  createdAt: Date
  archivedAt: Date | null
}

/**
 * Vergibt die Gründungsplätze.
 *
 * Es zählen nur freigeschaltete und nicht stillgelegte Höfe. Ein stillgelegter
 * Hof belegt keinen Platz — sonst blockierte ein aufgegebener Hof dauerhaft
 * eine Zusage, die niemand mehr nutzt; die nachfolgenden Höfe rücken auf.
 *
 * Sortiert wird nach `approvedAt` aufsteigend; bei gleichem Zeitpunkt
 * entscheidet `createdAt`, danach die `id`. Diese doppelte Rückfallebene ist
 * kein Zierrat: Die Migration aus #47 hat allen Bestandshöfen denselben
 * Freigabezeitpunkt eingetragen (Backfill), und auch zwei Freischaltungen in
 * derselben Sekunde sind möglich. Ohne stabilen Tiebreak wäre die Vergabe bei
 * jedem Seitenaufruf eine andere.
 *
 * @returns Map von Hof-ID auf Platznummer (1-basiert), nur für Höfe im Rennen.
 */
export function gruendungsplaetze(hoefe: HofFuerPlatz[]): Map<string, number> {
  const imRennen = hoefe
    .filter((h): h is HofFuerPlatz & { approvedAt: Date } => h.approvedAt !== null && h.archivedAt === null)
    .sort((a, b) => {
      const nachFreigabe = a.approvedAt.getTime() - b.approvedAt.getTime()
      if (nachFreigabe !== 0) return nachFreigabe
      const nachAnlage = a.createdAt.getTime() - b.createdAt.getTime()
      if (nachAnlage !== 0) return nachAnlage
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })

  return new Map(imRennen.map((h, i) => [h.id, i + 1]))
}

/** Platz eines einzelnen Hofes, oder null wenn er nicht im Rennen ist. */
export function gruendungsplatzVon(hofId: string, hoefe: HofFuerPlatz[]): number | null {
  return gruendungsplaetze(hoefe).get(hofId) ?? null
}

/** true, wenn der Hof einen der Gründungsplätze belegt (Platz <= 12). */
export function istGruendungshof(hofId: string, hoefe: HofFuerPlatz[]): boolean {
  const platz = gruendungsplatzVon(hofId, hoefe)
  return platz !== null && platz <= MAX_GRUENDUNGSHOEFE
}

/** Wie viele der Plätze vergeben sind — höchstens MAX_GRUENDUNGSHOEFE. */
export function vergebeneGruendungsplaetze(hoefe: HofFuerPlatz[]): number {
  return Math.min(gruendungsplaetze(hoefe).size, MAX_GRUENDUNGSHOEFE)
}

/**
 * Bekäme ein noch wartender Hof bei sofortiger Freischaltung einen Platz?
 * Für den Bestätigungsdialog. Die 12 sind eine KONDITIONS-Grenze, keine
 * Zugangsgrenze — Freischalten bleibt in jedem Fall möglich.
 */
export function bekaemePlatzBeiFreigabe(hoefe: HofFuerPlatz[]): boolean {
  return vergebeneGruendungsplaetze(hoefe) < MAX_GRUENDUNGSHOEFE
}
