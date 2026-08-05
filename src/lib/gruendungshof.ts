// Gründungshöfe: die ersten freigeschalteten Höfe der Plattform bekommen
// dauerhaft bessere Konditionen.
//
// GELTUNGSBEREICH IN DIESEM SPRINT: Diese Datei erzeugt noch KEINE
// kundenseitige Anzeige. Sie wird ausschließlich vom Admin-Bereich genutzt,
// damit der Betreiber beim Freischalten sieht, ob ein Hof einen der Plätze
// belegt. Das Abzeichen auf der Hofseite und die Konditions-Seite folgen in
// einem eigenen Sprint.
//
// Die Grenze ist eine KONDITIONS-Grenze, keine Zugangsgrenze: Ist Platz 12
// vergeben, können weitere Höfe trotzdem freigeschaltet werden — sie
// bekommen dann nur keinen Gründungsplatz mehr.

export const MAX_GRUENDUNGSHOEFE = 12

/** Ende der gebührenfreien Gründungsphase (inklusive dieses Tages). */
export const GRUENDUNGSPHASE_ENDE = new Date('2029-12-31T23:59:59.999Z')

/** Provision nach Ablauf der Gründungsphase, dauerhaft. */
export const GRUENDUNGS_PROVISION_PROZENT = 3

/** Die Konditionen in einem Satz — eine Quelle für alle Anzeigen. */
export const GRUENDUNGS_KONDITIONEN =
  'Keine Plattformgebühr bis 31.12.2029, danach dauerhaft 3 %. ' +
  'Zahlungsgebühren von Stripe fallen unabhängig davon an.'

/** Beschriftung für einen belegten Platz, z. B. „Gründungshof Nr. 3". */
export function gruendungshofLabel(platz: number): string {
  return `Gründungshof Nr. ${platz}`
}

/** Beschriftung für einen freigeschalteten Hof ohne Gründungsplatz. */
export const KEIN_GRUENDUNGSPLATZ = 'kein Gründungsplatz'

/**
 * Ein Hof, so wie ihn die Platzvergabe braucht. Bewusst schmal gehalten,
 * damit die Funktion rein und ohne Datenbank testbar bleibt.
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
 * eine Zusage, die niemand mehr nutzt.
 *
 * Sortiert wird nach `approvedAt` aufsteigend; bei gleichem Zeitpunkt
 * entscheidet `createdAt`, danach die `id`. Diese doppelte Rückfallebene ist
 * kein Zierrat: Werden mehrere Höfe in derselben Sekunde freigeschaltet — oder
 * trägt eine Migration allen Bestandshöfen denselben Zeitpunkt ein, genau wie
 * der Backfill dieses Sprints —, wäre die Reihenfolge sonst zufällig und die
 * Platzvergabe bei jedem Aufruf eine andere.
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

/** true, wenn der Hof einen der Gründungsplätze belegt. */
export function istGruendungshof(hofId: string, hoefe: HofFuerPlatz[]): boolean {
  const platz = gruendungsplatzVon(hofId, hoefe)
  return platz !== null && platz <= MAX_GRUENDUNGSHOEFE
}

/** Wie viele der Plätze bereits vergeben sind (höchstens MAX_GRUENDUNGSHOEFE). */
export function vergebeneGruendungsplaetze(hoefe: HofFuerPlatz[]): number {
  return Math.min(gruendungsplaetze(hoefe).size, MAX_GRUENDUNGSHOEFE)
}

/**
 * Bekäme ein noch wartender Hof bei sofortiger Freischaltung einen Platz?
 * Für den Bestätigungsdialog im Admin-Bereich.
 */
export function bekaemePlatzBeiFreigabe(hoefe: HofFuerPlatz[]): boolean {
  return vergebeneGruendungsplaetze(hoefe) < MAX_GRUENDUNGSHOEFE
}
