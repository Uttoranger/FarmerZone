/**
 * Wer die Hofseite unter /[farmSlug] gerade sieht — und was daraus folgt.
 *
 * Die Hofseite gibt es genau einmal; die Vorschau des Hofs ist dieselbe Route
 * mit ?vorschau=1, nie ein Nachbau (ARCHITECTURE §4). Was die Vorschau von der
 * Seite für Kundinnen unterscheidet, entscheidet allein `ansichtsModus`:
 *  - der Besitzer sieht seinen Hof auch vor der Freigabe,
 *  - die Adresse ist für Suchmaschinen gesperrt,
 *  - Kaufen ist wirkungslos.
 *
 * Aufgerufen wird sie serverseitig, im Lader der Hofseite
 * (src/server/hofseite-vorschau.ts). Die Seite und die Ansicht lesen nur ihr
 * Ergebnis, nie den URL-Parameter — tests/hofseite-einmal.test.ts sucht nach
 * jeder anderen Lesestelle.
 */
import { VORSCHAU_PARAMETER } from '@/lib/hofseite-vorschau'
import { vorschauParameterSchema } from '@/schemas/hofseite-vorschau'

/** Die Suchparameter einer Seite, wie Next sie liefert. */
export type Suchparameter = Record<string, string | string[] | undefined>

export type AnsichtsModus = {
  /** Kundin — dazu zählt jeder ohne Recht auf die Vorschau — oder der Besitzer in der Vorschau. */
  art: 'kundin' | 'vorschau'
  /**
   * Der Besitzer, der seinen Hof auch vor der Freigabe sieht — nur in der
   * Vorschau, sonst null. Bleibt im Lader; an die Ansicht geht `SeitenAnsicht`.
   */
  besitzerVorFreigabe: string | null
  /** Suchmaschinen fernhalten: sobald der Parameter dasteht — mit jedem Wert, mit und ohne Recht. */
  noindex: boolean
  /** Ob Kaufen wirkt. In der Vorschau nie: kein Korb, keine Reservierung, kein Nachbestell-Link. */
  kaufen: boolean
}

/** Was Seite und Ansicht vom Modus brauchen — ohne die Nutzer-ID, die nur der Lader braucht. */
export type SeitenAnsicht = Omit<AnsichtsModus, 'besitzerVorFreigabe'>

/**
 * Woher die Antworten kommen, die nur der Server kennt. Beide werden nur
 * gefragt, wenn sie zählen: die Sitzung nur mit ?vorschau=1, der Besitzer nur,
 * wenn jemand angemeldet ist — die Seite für Kundinnen bleibt ohne Auth-Runde.
 */
export type AnsichtsQuellen = {
  /** Die ID der angemeldeten Person, sonst null. */
  angemeldeterNutzer: () => Promise<string | null>
  /** Wem der Hof zu diesem Slug gehört; null, wenn es ihn nicht gibt. */
  besitzer: () => Promise<string | null>
}

function kundin(noindex: boolean): AnsichtsModus {
  return { art: 'kundin', besitzerVorFreigabe: null, noindex, kaufen: true }
}

export async function ansichtsModus(suche: Suchparameter, quellen: AnsichtsQuellen): Promise<AnsichtsModus> {
  const roh = suche[VORSCHAU_PARAMETER]
  const noindex = roh !== undefined
  // Steht der Parameter mehrfach da, zählt der letzte Wert — so liest ihn auch
  // die Header-Regel in next.config.ts (`has: query`). Seite und Header sollen
  // dieselbe Adresse gleich verstehen.
  const wert = Array.isArray(roh) ? roh.at(-1) : roh
  // Nur genau „1" verlangt die Vorschau (src/schemas/hofseite-vorschau.ts).
  if (!vorschauParameterSchema.safeParse(wert).success) return kundin(noindex)

  const nutzerId = await quellen.angemeldeterNutzer()
  if (!nutzerId) return kundin(noindex)
  // Nur der Besitzer GENAU dieses Hofs. Ein fremder Hof, ein unbekannter Slug:
  // die Seite wie für alle — ein nicht freigegebener Hof bleibt dann „nicht gefunden".
  if ((await quellen.besitzer()) !== nutzerId) return kundin(noindex)

  return { art: 'vorschau', besitzerVorFreigabe: nutzerId, noindex: true, kaufen: false }
}
