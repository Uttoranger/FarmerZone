import { ladeAuftrittStand, saveAppearanceAction } from '@/server/actions/appearance'
import { ladeProfilStand, updateProfile } from '@/server/actions/farm'
import { ABSCHNITT_SPEICHERN_TEXT, auftrittMitTeil, profilMitTeil, type AuftrittTeil, type ProfilTeil } from '@/lib/abschnitt-stand'

/*
 * Der EINE Speicherweg der Abschnitte von Mein Hof (Nachtlauf Nr. 50,
 * Register N4) — unter lg aus dem Blatt, ab lg aus dem Editor, mit denselben
 * Bausteinen. Keine zweite Speicherlogik: gespeichert wird über die
 * bestehenden Aktionen saveAppearanceAction und updateProfile.
 *
 * Beide schreiben bei jedem Aufruf mehr als das eine Feld. Darum liest jeder
 * Abschnitt direkt vor dem Speichern den frischen Stand vom Server und ändert
 * nur sein eigenes Feld (lib/abschnitt-stand.ts) — der Stand aus den Props der
 * Seite schriebe nach einem anderen Abschnitt alte Werte zurück, solange
 * router.refresh() noch läuft.
 *
 * Lesen und Schreiben laufen nacheinander, nie verschränkt: Zwei Abschnitte,
 * die zugleich speichern (ein zweiter Tipp, ein schneller Wechsel), läsen
 * sonst beide den alten Stand, und der zweite überschriebe den ersten. Die
 * Kette gilt für dieses Browserfenster; zwei Tabs oder zwei Geräte zugleich
 * bleiben ein Wettlauf zwischen Lesen und Schreiben
 * (tests/integration/auftritt-abschnitte.int.test.ts, Bericht Nr. 50).
 *
 * Ein Fehler hält die Kette nicht an — der Aufrufer bekommt ihn trotzdem, das
 * nächste Speichern läuft und liest frisch. Hängt ein Speichern (Funkloch, die
 * Anfrage kommt nie zurück), wartet das nächste höchstens
 * KETTE_WARTET_HOECHSTENS_MS und sagt dann, dass das vorige noch nicht fertig
 * ist. Es startet nicht daneben: Zwei zugleich könnten einander überschreiben.
 * Die Kette wartet weiter auf das hängende (tests/abschnitt-speichern.test.ts).
 */

/** So lange wartet ein Speichern höchstens auf das vorige — ein normales dauert ein, zwei Sekunden. */
export const KETTE_WARTET_HOECHSTENS_MS = 30_000

let letzte: Promise<unknown> = Promise.resolve()

/** true, sobald `vorige` fertig ist (gleich wie), false nach Ablauf der Wartezeit. */
function rechtzeitigFertig(vorige: Promise<unknown>): Promise<boolean> {
  return new Promise((antwort) => {
    const uhr = setTimeout(() => antwort(false), KETTE_WARTET_HOECHSTENS_MS)
    const fertig = () => {
      clearTimeout(uhr)
      antwort(true)
    }
    vorige.then(fertig, fertig)
  })
}

function nacheinander(arbeit: () => Promise<{ error?: string }>): Promise<{ error?: string }> {
  const vorige = letzte
  const lauf = rechtzeitigFertig(vorige).then((fertig) => (fertig ? arbeit() : { error: ABSCHNITT_SPEICHERN_TEXT.vorigesHaengt }))
  // Das nächste wartet auf beides: auf dieses und, falls dieses aufgegeben hat, weiter auf das vorige.
  letzte = Promise.allSettled([vorige, lauf])
  return lauf
}

/** Speichert einen Teil des Auftritts (Leitspruch und Gründungsjahr, Über uns, Werte, Abschnitte). */
export function speichereAuftritt(teil: AuftrittTeil): Promise<{ error?: string }> {
  return nacheinander(async () => {
    const frisch = await ladeAuftrittStand()
    if ('error' in frisch) return { error: frisch.error }
    return saveAppearanceAction(auftrittMitTeil(frisch.stand, teil))
  })
}

/** Speichert einen Teil des Profils (Name und Kurzbeschreibung, Adresse, Kontakt). */
export function speichereProfil(teil: ProfilTeil): Promise<{ error?: string }> {
  return nacheinander(async () => {
    const frisch = await ladeProfilStand()
    if ('error' in frisch) return { error: frisch.error }
    return updateProfile(profilMitTeil(frisch.profil, teil))
  })
}
