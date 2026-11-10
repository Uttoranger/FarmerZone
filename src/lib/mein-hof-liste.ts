/**
 * Die Zeilen von Mein Hof › Hofseite nach den Boards s1-/w1-mein-hof (Nr. 274) —
 * EINE Quelle für die Liste unter lg (abschnitte-liste.tsx) und den Editor ab lg
 * (hofseite-editor.tsx).
 *
 * Die Boards fassen Abschnitte zusammen, die der Fortschritt einzeln zählt:
 * „Titelbild und Logo“, „Name und Leitspruch“, „Über uns“ (mit den Werten). Der
 * Fortschritt selbst (hofseite-fortschritt.ts, „8 von 11“) bleibt unverändert —
 * er gilt auch auf Heute, in Einrichten und im Postfach, deren Titel diese Nummer
 * nicht ändert. Hier wird nur zusammengelegt und benannt; gezählt wird dort.
 *
 * Eine Zeile öffnet die Bausteine aller ihrer Teile (AbschnittInhalt je Teil);
 * die Vorschau markiert den ersten Teil.
 */
import type { HofseiteFortschritt, HofseiteOrtId, HofseiteZeile } from '@/lib/hofseite-fortschritt'
import { ORTS_GRUPPEN } from '@/lib/hofseite-fortschritt'
import type { HofseiteZeileId } from '@/schemas/hofseite-vorschau'

/** Eine Zeile der Liste — ein oder mehrere Abschnitte unter einem Titel. */
export type MeinHofZeile = {
  /** Der erste Teil: Kennung der Zeile, Markierung in der Vorschau. */
  id: HofseiteZeileId
  /** Alle Abschnitte, die die Zeile öffnet, in dieser Reihenfolge. */
  teile: readonly HofseiteZeileId[]
  titel: string
  /** Die Werte der Teile in einer Zeile, getrennt mit „ · “. */
  wert: string
  /** Ein gezählter Teil fehlt noch — die Zeile steht unter lg in der Karte „Noch n Punkte offen“. */
  offen: boolean
  /** Das Schild eines gezählten Teils („Fehlt“, „Online fehlt“); null = Häkchen. */
  marke: HofseiteZeile['marke']
}

export type MeinHofGruppe = { id: HofseiteOrtId; titel: string; zeilen: MeinHofZeile[] }

/** Aufbau nach den Boards: Gruppe → Zeilen → Teile. „Bestellungen“ (Pause) lebt im Kopf. */
export const MEIN_HOF_AUFBAU: readonly { id: HofseiteOrtId; zeilen: readonly { titel: string; teile: readonly HofseiteZeileId[] }[] }[] = [
  {
    id: 'oben',
    zeilen: [
      { titel: 'Titelbild und Logo', teile: ['titelbild', 'logo'] },
      { titel: 'Name und Leitspruch', teile: ['name', 'tagline'] },
      { titel: 'Adresse und Karte', teile: ['adresse'] },
    ],
  },
  {
    id: 'aufbau-fotos',
    zeilen: [
      { titel: 'Fotos', teile: ['fotos'] },
      { titel: 'Abschnitte', teile: ['abschnitte'] },
    ],
  },
  {
    id: 'abholen-bezahlen',
    zeilen: [
      { titel: 'Abholzeiten', teile: ['abholzeiten'] },
      { titel: 'Zahlung', teile: ['zahlung'] },
      { titel: 'Kontakt', teile: ['kontakt'] },
    ],
  },
  { id: 'ueber-uns', zeilen: [{ titel: 'Über uns', teile: ['ueber-uns', 'werte'] }] },
]

/** Zuerst in der Karte „offen“: Ohne Abholzeiten kann niemand kaufen (Register N24). */
const ZUERST_OFFEN: HofseiteZeileId = 'abholzeiten'

/**
 * Hausstil: Halbgeviertstrich „–“ statt des langen Gedankenstrichs (Liste Lauf 32,
 * meldungen „Langer Gedankenstrich“; Boards). Die Werte kommen aus dem Fortschritt,
 * der auch andere Seiten bedient — hier wird nur die Anzeige in Mein Hof gesetzt.
 */
export function halbgeviert(text: string): string {
  return text.replaceAll('—', '–')
}

function baueZeile(titel: string, teile: readonly HofseiteZeileId[], nachId: ReadonlyMap<HofseiteZeileId, HofseiteZeile>): MeinHofZeile | null {
  const da = teile.map((id) => nachId.get(id)).filter((z): z is HofseiteZeile => z !== undefined)
  const erste = da[0]
  if (!erste) return null
  const gezaehlt = da.filter((z) => !z.freiwillig)
  // Freiwilliges, das fehlt, bleibt aus dem Wert — es ist kein offener Punkt, und „Freiwillig – …“
  // neben einem gesetzten Wert läse sich wie ein Fehler. Steht die Zeile nur aus Freiwilligem, bleibt sein Satz.
  const sichtbar = da.filter((z) => !z.freiwillig || z.fertig)
  const werte = (sichtbar.length > 0 ? sichtbar : da).map((z) => halbgeviert(z.wert))
  return {
    id: erste.id,
    teile: da.map((z) => z.id),
    titel,
    wert: werte.join(' · '),
    offen: gezaehlt.some((z) => !z.fertig),
    marke: gezaehlt.find((z) => z.marke !== null)?.marke ?? null,
  }
}

/**
 * Die Liste nach den Boards: alle Zeilen in ihren vier Gruppen (Web, Board w1) und
 * daneben die offenen Zeilen (Abholzeiten zuerst) für die Karte unter lg (Register N4).
 * `anzahlOffen` ist die Zahl des Fortschritts (gezählte Punkte), nicht die der Zeilen —
 * sie passt so zu „8 von 11“.
 */
export function meinHofListe(fortschritt: HofseiteFortschritt): {
  gruppen: MeinHofGruppe[]
  offen: MeinHofZeile[]
  anzahlOffen: number
} {
  const nachId = new Map(fortschritt.gruppen.flatMap((g) => g.zeilen).map((z) => [z.id, z] as const))
  const gruppen = MEIN_HOF_AUFBAU.map((g) => ({
    id: g.id,
    titel: ORTS_GRUPPEN.find((o) => o.id === g.id)?.titel ?? g.id,
    zeilen: g.zeilen.map((z) => baueZeile(z.titel, z.teile, nachId)).filter((z): z is MeinHofZeile => z !== null),
  })).filter((g) => g.zeilen.length > 0)
  const offen = gruppen
    .flatMap((g) => g.zeilen)
    .filter((z) => z.offen)
    .toSorted((a, b) => Number(b.teile.includes(ZUERST_OFFEN)) - Number(a.teile.includes(ZUERST_OFFEN)))
  return { gruppen, offen, anzahlOffen: fortschritt.gesamt - fortschritt.erledigt }
}
