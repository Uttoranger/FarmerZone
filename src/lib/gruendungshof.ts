// Gründungshöfe: Die ersten freigeschalteten Höfe der Plattform bekommen
// dauerhaft bessere Konditionen.
//
// Der Platz wird BERECHNET, nicht gespeichert — kein Schema-Feld. Damit kann
// er nicht mit der Wirklichkeit auseinanderlaufen, und ein zurückgenommener
// oder stillgelegter Hof gibt seinen Platz automatisch wieder frei.
//
// GELTUNGSBEREICH: Diese Datei speist den Admin-Bereich und die öffentliche
// Konditionen-Seite (src/app/(public)/konditionen/page.tsx). Ein kundenseitiges
// Abzeichen folgt in einem eigenen Sprint; die Gebührenberechnung bleibt
// unberührt (platformFeePercent steht weiterhin auf 0).
//
// REGEL FÜR ANZEIGEN: Zahlen und Datum kommen aus den Konstanten unten, nie
// als Literal in eine Seite. Eine Zahl, die an zwei Orten steht, steht früher
// oder später verschieden da — und bei Konditionen ist das kein Schönheitsfehler.

export const MAX_GRUENDUNGSHOEFE = 12

/** Ende der gebührenfreien Gründungsphase (einschließlich dieses Tages). */
export const GRUENDUNGSPHASE_ENDE = new Date('2029-12-31T23:59:59.999Z')

/**
 * Das Ende als Datum zum Anzeigen, z. B. „31.12.2029".
 *
 * `timeZone: 'UTC'` ist keine Förmlichkeit: Der Zeitpunkt steht auf
 * 23:59:59.999 UTC, und ohne feste Zone würde ein Server östlich davon den
 * 1.1.2030 ausgeben — ein um einen Tag verschobenes Vertragsdatum.
 */
export const GRUENDUNGSPHASE_ENDE_TEXT = GRUENDUNGSPHASE_ENDE.toLocaleDateString('de-AT', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
})

/** Provision nach Ablauf der Gründungsphase, dauerhaft. */
export const GRUENDUNGS_PROVISION_PROZENT = 3

/**
 * Die Konditionen in einem Satz — eine Quelle für alle Anzeigen.
 * Wortlaut unverändert, aber aus den Konstanten gebaut statt abgeschrieben.
 */
export const GRUENDUNGS_KONDITIONEN =
  `Keine Plattformgebühr bis ${GRUENDUNGSPHASE_ENDE_TEXT}, ` +
  `danach dauerhaft ${GRUENDUNGS_PROVISION_PROZENT} %. ` +
  'Zahlungsgebühren von Stripe fallen unabhängig davon an.'

// === TEXTBAUSTEINE DER KONDITIONEN-SEITE ===

/** Das Angebot in einem Satz. */
export const GRUENDUNGS_ANGEBOT =
  `Die ersten ${MAX_GRUENDUNGSHOEFE} freigeschalteten Höfe zahlen bis ` +
  `${GRUENDUNGSPHASE_ENDE_TEXT} keine Plattformgebühr. Danach gilt dauerhaft ein ` +
  `Satz von ${GRUENDUNGS_PROVISION_PROZENT} % pro Online-Bestellung — dauerhaft heißt: ` +
  'auch in zehn Jahren noch.'

/**
 * Die wichtigste Klarstellung der Seite. Die Zwölf begrenzt die KONDITIONEN,
 * nicht den Zugang — sonst liest sich das Angebot wie eine geschlossene Tür.
 */
export const GRUENDUNGS_KEINE_ZUGANGSGRENZE =
  `Die ${MAX_GRUENDUNGSHOEFE} sind eine Konditions-, keine Zugangsgrenze: ` +
  'Mitmachen kann jeder Hof, auch nach dem zwölften Platz. Für später ' +
  'dazukommende Höfe gilt nach dem Pilotzeitraum der reguläre Satz. Wie hoch ' +
  'der ausfällt, geben wir rechtzeitig und vorab bekannt — niemand erfährt ' +
  'eine Änderung erst auf der Abrechnung.'

/**
 * Zahlungsgebühren. BEWUSST OHNE Stripe-Prozentsätze: die ändern sich, und
 * eine Zahl in einem Rechtstext, die niemand nachpflegt, ist schlimmer als
 * keine Zahl. Die aktuellen Sätze zeigt Stripe beim Einrichten selbst an.
 */
export const GRUENDUNGS_ZAHLUNGSGEBUEHREN =
  'Unabhängig davon fallen die Gebühren des Zahlungsdienstleisters (Stripe) an; ' +
  'Barzahlung bei Abholung ist gebührenfrei. Die aktuellen Sätze siehst du beim ' +
  'Einrichten der Online-Zahlung, bevor du sie aktivierst.'

/** Der Weg auf die Plattform, in drei Schritten — durchgängig automatisch,
 *  nur die Freischaltung selbst ist ein bewusster Handgriff des Betreibers. */
export const GRUENDUNGS_AUFNAHME_SCHRITTE = [
  {
    titel: 'Registrieren',
    text: 'Dauert zwei Minuten — Name, E-Mail, Passwort, und du kannst sofort loslegen.',
  },
  {
    titel: 'Hof einrichten',
    text: 'Produkte, Fotos, Abholzeiten. Alles geht schon vor der Freischaltung, in Ruhe.',
  },
  {
    titel: 'Freischaltung',
    text: 'Der Betreiber prüft kurz — du bekommst automatisch eine E-Mail, sobald dein Hof öffentlich ist.',
  },
] as const

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
