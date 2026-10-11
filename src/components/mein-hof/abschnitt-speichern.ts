import * as Sentry from '@sentry/nextjs'
import { ladeAuftrittStand, saveAppearanceAction } from '@/server/actions/appearance'
import { ladeProfilStand, updateProfile } from '@/server/actions/farm'
import { ABSCHNITT_SPEICHERN_TEXT, auftrittMitTeil, profilMitTeil, type AuftrittTeil, type ProfilTeil } from '@/lib/abschnitt-stand'
import { BEZEICHNER, befundVon, istNetzfehler } from '@/lib/upload-diagnose'

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

/**
 * Meldet eine gescheiterte Anfrage an Sentry. Früher tat das die Fehlergrenze
 * (app/error.tsx); seit die Formulare nicht mehr dorthin werfen, sähe Sentry
 * sonst weder die nach einem Deploy unbekannte Aktion
 * (UnrecognizedActionError) noch einen Fehler im eigenen Code.
 *
 * Nur die Art, nie die Eingabe: fester Text, die Klasse als Name, die
 * Nachricht bereinigt (bereinigeFehlerText nimmt Adressen, Pfade,
 * E-Mail-Adressen und Kennungen heraus — auch die Kennung der Aktion). Die
 * Klasse geht ungefiltert mit (bereinigeEreignis sichtet den Typ nicht),
 * darum nur, wenn sie wie ein Name aussieht. Formularwerte stehen weder im
 * Fehler noch hier.
 *
 * Ein Netzabbruch (Funkloch) ist kein Befund, nur eine Brotkrume: Sie reist
 * mit, falls danach etwas Echtes gemeldet wird. Wirft nie — der Bauer bekommt
 * seinen Satz auch, wenn Sentry selbst scheitert.
 */
function meldeGescheitertesSpeichern(fehler: unknown): void {
  try {
    const { klasse, meldung } = befundVon(fehler)
    const name = BEZEICHNER.test(klasse) ? klasse : 'Unbekannt'
    if (istNetzfehler(fehler)) {
      Sentry.addBreadcrumb({ category: 'mein-hof', level: 'warning', message: 'Speichern: Verbindung abgebrochen', data: { klasse: name } })
      return
    }
    const ereignis = new Error('Mein Hof: Speichern gescheitert')
    ereignis.name = name
    Sentry.captureException(ereignis, { level: 'error', tags: { bereich: 'mein-hof-speichern', klasse: name }, extra: { fehlertext: meldung } })
  } catch {
    // Absichtlich leer: Telemetrie scheitert leise, der Satz für den Bauern kommt trotzdem.
  }
}

/**
 * Ein Speichern, das nie wirft — für die Formulare der Abschnitte: Der Satz
 * der Aktion bzw. bei einer gescheiterten Anfrage (Netz weg, Aktion nach
 * einem Deploy unbekannt) `ABSCHNITT_SPEICHERN_TEXT.gingNicht`, sonst null.
 * Geworfen ginge es an die Fehlergrenze, und die Eingabe wäre weg. Sentry
 * bekommt die gescheiterte Anfrage trotzdem (meldeGescheitertesSpeichern).
 */
export async function speichernOhneWurf(speichern: () => Promise<{ error?: string }>): Promise<string | null> {
  try {
    const antwort = await speichern()
    return antwort.error ?? null
  } catch (fehler) {
    meldeGescheitertesSpeichern(fehler)
    return ABSCHNITT_SPEICHERN_TEXT.gingNicht
  }
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
