import * as Sentry from '@sentry/nextjs'
import { unstable_cache } from 'next/cache'
import { unstable_rethrow } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { KEINE_GRUENDUNG_SEITEN, gruendungSeitenDaten, type GruendungSeiten } from '@/lib/gruendungshof'
import {
  PLATTFORM_EINSTELLUNG_ID,
  PLATTFORM_EINSTELLUNG_STANDARD,
  PLATTFORM_EINSTELLUNG_TAG,
  gruendungEinstellungAus,
  plattformEinstellungAus,
  type PlattformEinstellung,
} from '@/lib/plattform-einstellung'
import { ladeHoefeFuerGruendung } from '@/server/queries/admin'

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
    select: { gruendungPlaetze: true, gruendungBisStandard: true, gruendungAnzeige: true, geaendertVonUserId: true, updatedAt: true },
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
    const [einstellung, hoefe, wartend] = await Promise.all([
      ladePlattformEinstellung(),
      ladeHoefeFuerGruendung(),
      // Wartend wie in der Admin-Liste (approvedAt null), stillgelegte nicht — sie kommen nie dran.
      prisma.farm.count({ where: { approvedAt: null, archivedAt: null } }),
    ])
    return gruendungSeitenDaten(gruendungEinstellungAus(einstellung), hoefe, wartend, jetzt)
  } catch (err) {
    // Nexts eigene Steuersignale (dynamisches Rendern beim Bau) gehören nicht in die Fehleranzeige.
    unstable_rethrow(err)
    Sentry.captureException(err, { tags: { bereich: 'gruendung-seiten' } })
    return KEINE_GRUENDUNG_SEITEN
  }
}
