/**
 * Die Adresse, an die wir einen Hof anschreiben (Entscheidung 2 aus
 * Morgenbericht 25, Nr. 194): die Hof-E-Mail aus dem Profil, sonst die
 * Anmelde-Adresse der Inhaberin.
 *
 * Warum eine Funktion: Die Hof-E-Mail ist freiwillig (Anlegen und Profil).
 * Vier Leser nahmen das Feld ohne Rückfall – bei leerem Feld ging die
 * Bestellmail an eine leere Adresse und Stripe bekam keine (Bericht 174).
 *
 * Bewusst NUR zum Anschreiben: Wo Kundinnen die Hof-E-Mail sehen
 * (Bestellseite, Angaben zum Hof), bleibt das Feld, wie es ist – die
 * Anmelde-Adresse stünde dort sonst öffentlich. Direkte Zugriffe auf das
 * Feld meldet tests/hof-kontakt-wache.test.ts.
 */
export type HofKontakt = { email: string; owner: { email: string } }

export function hofKontaktEmail(farm: HofKontakt): string {
  return farm.email.trim() || farm.owner.email
}

/** Für Prisma-Selects: was hofKontaktEmail braucht. */
export const HOF_KONTAKT_FELDER = { email: true, owner: { select: { email: true } } } as const
