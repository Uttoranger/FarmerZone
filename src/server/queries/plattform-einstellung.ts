import * as Sentry from '@sentry/nextjs'
import { unstable_cache } from 'next/cache'
import { unstable_rethrow } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import {
  KEINE_GRUENDUNG_SEITEN,
  abzeichenBlattAus,
  festschreibenBrauchtPlaetze,
  festschreibenListe,
  gruendungSeitenDaten,
  gruendungsplaetze,
  seitenZahlen,
  zaehleAusgenommene,
  type AbzeichenBlatt,
  type FestschreibenZeile,
  type GruendungSeiten,
} from '@/lib/gruendungshof'
import {
  PLATTFORM_EINSTELLUNG_ID,
  PLATTFORM_EINSTELLUNG_SELECT,
  PLATTFORM_EINSTELLUNG_STANDARD,
  PLATTFORM_EINSTELLUNG_TAG,
  gruendungEinstellungAus,
  plattformEinstellungAus,
  type PlattformEinstellung,
} from '@/lib/plattform-einstellung'
import { HOEFE_CACHE_TAG } from '@/lib/hofuebersicht'
import { bestellstoppAus, type BestellstoppStand } from '@/lib/notbremse'
import { ladeHoefeFuerFestschreiben, ladeHoefeFuerGruendung } from '@/server/queries/admin'

/*
 * Die Plattform-Einstellungen lesen (Register K2-Ergänzung, N15; Nr. 93).
 * NUR LESEN: Fehlt die Zeile, gelten die Standardwerte — kein upsert beim
 * Lesen, so schreibt die Startseite nie (die Zeile legt die Migration an,
 * gespeichert wird nur in Admin › Einstellungen).
 */

/** Die Zeile frisch aus der Datenbank — für Admin › Einstellungen und die Freischaltung, die nie einen alten Stand nehmen dürfen. */
export async function lesePlattformEinstellung(): Promise<PlattformEinstellung> {
  const zeile = await prisma.plattformEinstellung.findUnique({
    where: { id: PLATTFORM_EINSTELLUNG_ID },
    select: PLATTFORM_EINSTELLUNG_SELECT,
  })
  return zeile ? plattformEinstellungAus(zeile) : PLATTFORM_EINSTELLUNG_STANDARD
}

/**
 * Dieselbe Zeile gecacht — für die öffentlichen Seiten. Ohne Ablaufzeit: Die
 * Zeile ändert sich nur über die Admin-Action, und die leert das Etikett
 * (`updateTag`). Die Form ist reines JSON (Kalendertag statt Date), weil der
 * Cache sie so speichert. Der Eintrag entsteht erst beim Aufruf, nicht beim
 * Laden des Moduls: Die Admin-Actions binden diese Datei ein (Freischaltung),
 * und dort braucht niemand den Cache.
 */
export function ladePlattformEinstellung(): Promise<PlattformEinstellung> {
  return unstable_cache(lesePlattformEinstellung, [PLATTFORM_EINSTELLUNG_TAG], { tags: [PLATTFORM_EINSTELLUNG_TAG] })()
}

/**
 * Die Notbremse (Register N34, Nr. 189) — nur die vier Felder `bestellstopp*`,
 * FRISCH aus der Datenbank: für die Prüfkette (src/server/warenkorb.ts), die
 * nie einen alten Stand nehmen darf. Eine Abfrage über den Primärschlüssel.
 * Ohne Zeile: keine Notbremse. Ob sie JETZT gilt, entscheidet der Leser mit
 * `bestellstoppAktiv` (Frist beim Lesen).
 */
export async function leseBestellstopp(): Promise<BestellstoppStand | null> {
  const zeile = await prisma.plattformEinstellung.findUnique({
    where: { id: PLATTFORM_EINSTELLUNG_ID },
    select: { bestellstoppAb: true, bestellstoppBis: true, bestellstoppGrund: true, bestellstoppSatz: true },
  })
  return zeile ? bestellstoppAus(zeile) : null
}

/**
 * Dieselben Felder gecacht unter dem Etikett der Einstellung — für das Band
 * der Kundenseiten. Setzen und Aufheben leeren das Etikett (`updateTag` in
 * src/server/actions/notbremse.ts); das Ende prüft der Leser selbst, darum
 * braucht der Eintrag keine Ablaufzeit.
 */
export function ladeBestellstopp(): Promise<BestellstoppStand | null> {
  return unstable_cache(leseBestellstopp, ['bestellstopp'], { tags: [PLATTFORM_EINSTELLUNG_TAG] })()
}

/**
 * Was Startseite, /fuer-hoefe und Registrieren über die Gründungshöfe zeigen:
 * { zeigen, frei, gesamt, bisTag, voraussichtlicherPlatz } (Register
 * K2-Ergänzung). Die Höfe zählen frisch — die Seiten selbst sind gecacht
 * (revalidate 300) bzw. dynamisch (/register).
 *
 * Scheitert das Laden, zeigt die Seite nichts davon statt einer Fehlerseite:
 * Die Bausteine sind ein Zusatz, und beim Bau ohne Datenbank bräche ein Wurf
 * den ganzen Build ab (wie die Höfe der Startseite). Der Fehler geht nach
 * Sentry — nur mit festem Bereich, ohne Text.
 */
export async function gruendungFuerSeiten(jetzt: Date = new Date()): Promise<GruendungSeiten> {
  try {
    return await zaehleGruendungSeiten(jetzt)
  } catch (err) {
    meldeSeitenFehler(err)
    return KEINE_GRUENDUNG_SEITEN
  }
}

/** Die Zahlen frisch gezählt — wirft bei einem Ladefehler; die Aufrufer fangen ihn. */
async function zaehleGruendungSeiten(jetzt: Date): Promise<GruendungSeiten> {
  const [einstellung, hoefe, wartend] = await Promise.all([
    ladePlattformEinstellung(),
    ladeHoefeFuerGruendung(),
    // Wartend wie in der Admin-Liste (approvedAt null), stillgelegte nicht — sie kommen nie dran.
    // Ein Testhof (nach zurückgenommener Freigabe) zählt nie mit (Register N21).
    prisma.farm.count({ where: { approvedAt: null, archivedAt: null, istTesthof: false } }),
  ])
  return gruendungSeitenDaten(gruendungEinstellungAus(einstellung), hoefe, wartend, jetzt)
}

function meldeSeitenFehler(err: unknown): void {
  // Nexts eigene Steuersignale (dynamisches Rendern beim Bau) gehören nicht in die Fehleranzeige.
  unstable_rethrow(err)
  Sentry.captureException(err, { tags: { bereich: 'gruendung-seiten' } })
}

/**
 * Die Zahlen fürs Erklär-Blatt des Abzeichens (Hofseite, Register K2, Nr. 116)
 * — gecacht statt bei jedem Aufruf der Hofseite alle Höfe zu zählen. Das
 * Etikett der Höfe erneuern Freischalten, Ausnehmen, Wiederaufnahme,
 * Festschreiben und der Schalter, das der Einstellung Speichern und
 * Festschreiben; die fünf Minuten fangen den Stichtag (wie die Höfe-Liste).
 * Ein Ladefehler wird nicht gecacht: Dann zeigt die Seite das Etikett ohne Blatt.
 */
export async function ladeAbzeichenBlatt(): Promise<AbzeichenBlatt | null> {
  try {
    return await unstable_cache(async () => abzeichenBlattAus(await zaehleGruendungSeiten(new Date())), ['abzeichen-blatt'], {
      tags: [HOEFE_CACHE_TAG, PLATTFORM_EINSTELLUNG_TAG],
      revalidate: 300,
    })()
  } catch (err) {
    meldeSeitenFehler(err)
    return null
  }
}

/** Was Admin › Einstellungen › Gründungshöfe über die Höfe braucht — nur Zahlen und die Liste fürs Festschreiben. */
export type GruendungStandAdmin = {
  /** Vergebene Plätze: vor dem Festschreiben die Höfe im Rennen, danach die festgeschriebenen Nummern. */
  vergeben: number
  ausgenommen: number
  /** Die Liste „Zusagen festschreiben“ — leer, sobald festgeschrieben ist. */
  festschreiben: FestschreibenZeile[]
  /** Reichen die Plätze nicht, damit jeder Hof mit Platz einen behält: die nötige Zahl, sonst null. */
  festschreibenPlaetze: number | null
}

/**
 * Der Stand der Gründungsplätze für Admin › Einstellungen (Register K2,
 * Änderung Nr. 116) — frisch, nie aus dem Cache. Die Liste fürs Festschreiben
 * mit derselben Regel wie die Action (`festschreibenListe`); die Action
 * rechnet sie nach der Sperre noch einmal selbst.
 */
export async function ladeGruendungStandAdmin(einstellung: PlattformEinstellung): Promise<GruendungStandAdmin> {
  const regeln = gruendungEinstellungAus(einstellung)
  const [hoefe, alle] = await Promise.all([
    ladeHoefeFuerGruendung(),
    regeln.festAm === null ? ladeHoefeFuerFestschreiben() : Promise.resolve([]),
  ])
  return {
    vergeben: gruendungsplaetze(hoefe).size,
    ausgenommen: zaehleAusgenommene(hoefe),
    festschreiben: regeln.festAm === null ? festschreibenListe(alle, regeln) : [],
    festschreibenPlaetze: regeln.festAm === null ? festschreibenBrauchtPlaetze(alle, regeln) : null,
  }
}

/** Die Zahlen der Seiten mit dem gespeicherten Stand — für die zugeklappte Gruppe am Handy. */
export function gruendungZahlenAdmin(einstellung: PlattformEinstellung, vergeben: number, jetzt: Date): ReturnType<typeof seitenZahlen> {
  return seitenZahlen(gruendungEinstellungAus(einstellung), vergeben, jetzt)
}
