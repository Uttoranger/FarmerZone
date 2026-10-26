import * as Sentry from '@sentry/nextjs'
import { saveAppearanceAction } from '@/server/actions/appearance'
import { ladeProfilStand, updateProfile } from '@/server/actions/farm'
import { ABSCHNITT_SPEICHERN_TEXT, bereiteAuftrittVor, profilMitTeil, type AuftrittTeil, type ProfilTeil } from '@/lib/abschnitt-stand'
import { BEZEICHNER, befundVon } from '@/lib/upload-diagnose'
import { NETZ_SATZ, istNetzFehler } from '@/lib/netz'

/*
 * Der EINE Speicherweg der Abschnitte von Mein Hof (Nachtlauf Nr. 50,
 * Register N4) — unter lg aus dem Blatt, ab lg aus dem Editor, mit denselben
 * Bausteinen. Keine zweite Speicherlogik: gespeichert wird über die
 * bestehenden Aktionen saveAppearanceAction und updateProfile.
 *
 * saveAppearanceAction schreibt seit Nr. 65 nur, was mitkommt (Register N4,
 * Ergänzung Lauf 10): Ein Abschnitt des Auftritts schickt nur seinen Teil
 * und liest vorher nichts — so setzt er auch den Abschnitt eines zweiten Tabs
 * nicht zurück. updateProfile schreibt weiter das ganze Profil; darum liest
 * ein Abschnitt des Profils direkt vor dem Speichern den frischen Stand vom
 * Server und ändert nur sein eigenes Feld (lib/abschnitt-stand.ts) — der
 * Stand aus den Props der Seite schriebe nach einem anderen Abschnitt alte
 * Werte zurück, solange router.refresh() noch läuft.
 *
 * Die Speicherungen eines Fensters laufen nacheinander, nie verschränkt:
 * Zwei Profil-Abschnitte, die zugleich speichern (ein zweiter Tipp, ein
 * schneller Wechsel), läsen sonst beide den alten Stand, und der zweite
 * überschriebe den ersten. Die Kette gilt für dieses Browserfenster; beim
 * Profil bleiben zwei Tabs oder zwei Geräte zugleich ein Wettlauf zwischen
 * Lesen und Schreiben (tests/integration/auftritt-abschnitte.int.test.ts,
 * Bericht Nr. 50), beim Auftritt nicht mehr (Nr. 65).
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
export function meldeGescheitertesSpeichern(fehler: unknown): void {
  try {
    const { klasse, meldung } = befundVon(fehler)
    const name = BEZEICHNER.test(klasse) ? klasse : 'Unbekannt'
    if (istNetzFehler(fehler)) {
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
 * Eine gescheiterte Anfrage in der Form der Antwort: `error` gesetzt, alle
 * übrigen Felder der Aktion fehlen — so liest der Aufrufer `ergebnis.error`
 * und z. B. `ergebnis.erstattungOffen` wie bei einer Antwort der Aktion.
 */
export type AktionGescheitert<T> = Partial<T> & { error: string; netz?: true }

/**
 * Ein Aufruf einer Server-Action, der nie wirft — für jede Aktion im
 * Hofbereich, deren Antwort mehr trägt als einen Satz (Register N29, Nr. 175):
 * die Antwort der Aktion unverändert, bei einer gescheiterten Anfrage
 * `{ error }` — am Netz gescheitert `NETZ_SATZ` mit `netz: true` (die Anzeige
 * bietet „Nochmal" an), sonst `ABSCHNITT_SPEICHERN_TEXT.gingNicht`.
 * Geworfen ginge es an die Fehlergrenze, und die Eingabe wäre weg. Sentry
 * bekommt die gescheiterte Anfrage trotzdem (meldeGescheitertesSpeichern).
 * Die Wache tests/hof-aktionen-netz-wache.test.ts verlangt diesen Weg (oder try).
 */
export async function aktionOhneWurf<T extends object>(aufruf: () => Promise<T>): Promise<T | AktionGescheitert<T>> {
  try {
    return await aufruf()
  } catch (fehler) {
    meldeGescheitertesSpeichern(fehler)
    const gescheitert: AktionGescheitert<T> = istNetzFehler(fehler)
      ? ({ error: NETZ_SATZ, netz: true } as AktionGescheitert<T>)
      : ({ error: ABSCHNITT_SPEICHERN_TEXT.gingNicht } as AktionGescheitert<T>)
    return gescheitert
  }
}

/**
 * Ein Speichern, das nie wirft — für die Formulare der Abschnitte, das
 * Hof-Profil und jede Aktion, deren Antwort nur `{ error? }` ist: der Satz der
 * Aktion bzw. bei einer gescheiterten Anfrage der Satz aus aktionOhneWurf
 * (am Netz `NETZ_SATZ`, Register N29), sonst null.
 */
export async function speichernOhneWurf(speichern: () => Promise<{ error?: string }>): Promise<string | null> {
  const antwort = await aktionOhneWurf(speichern)
  return antwort.error ?? null
}

/** Speichert einen Teil des Auftritts (Leitspruch und Gründungsjahr, Über uns, Werte, Abschnitte) — nur diesen Teil. */
export function speichereAuftritt(teil: AuftrittTeil): Promise<{ error?: string }> {
  return nacheinander(() => saveAppearanceAction(bereiteAuftrittVor(teil)))
}

/** Speichert einen Teil des Profils (Name und Kurzbeschreibung, Adresse, Kontakt). */
export function speichereProfil(teil: ProfilTeil): Promise<{ error?: string }> {
  return nacheinander(async () => {
    const frisch = await ladeProfilStand()
    if ('error' in frisch) return { error: frisch.error }
    return updateProfile(profilMitTeil(frisch.profil, teil))
  })
}
