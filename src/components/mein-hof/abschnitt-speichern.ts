import { ladeAuftrittStand, saveAppearanceAction } from '@/server/actions/appearance'
import { ladeProfilStand, updateProfile } from '@/server/actions/farm'
import { auftrittMitTeil, profilMitTeil, type AuftrittTeil, type ProfilTeil } from '@/lib/abschnitt-stand'

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
 * Kette gilt für dieses Browserfenster; zwei Geräte zugleich bleiben, wie
 * bisher, ein Wettlauf (tests/integration/auftritt-abschnitte.int.test.ts).
 */

let letzte: Promise<unknown> = Promise.resolve()

function nacheinander<T>(arbeit: () => Promise<T>): Promise<T> {
  const lauf = letzte.then(arbeit, arbeit)
  // Ein Fehler hält die Kette nicht an; der Aufrufer bekommt ihn trotzdem.
  letzte = lauf.catch(() => undefined)
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
