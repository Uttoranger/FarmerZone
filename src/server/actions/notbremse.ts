'use server'

import { updateTag } from 'next/cache'
import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'
import { verlangeAdminAktion } from '@/server/admin-wache'
import { protokolliere } from '@/server/admin-protokoll'
import { PLATTFORM_BEZUG, ohnePersonendaten } from '@/schemas/admin-aktion'
import { PLATTFORM_EINSTELLUNG_ID, PLATTFORM_EINSTELLUNG_TAG } from '@/lib/plattform-einstellung'
import {
  NOTBREMSE_FEHLER,
  NOTBREMSE_GRUND_WERTE,
  NOTBREMSE_SATZ_MAX,
  notbremseBisFehler,
  notbremseGrundLabel,
} from '@/lib/notbremse'

/*
 * Die Notbremse „Bestellungen anhalten“ (Register N34, Nr. 189).
 *
 * Wirkung: Die Prüfkette (`pruefeBestellstopp` in src/server/warenkorb.ts)
 * lehnt in /api/reserve, /api/warenkorb/pruefen und /api/checkout jede NEUE
 * Bestellung mit dem Satz ab. Laufende Bestellungen, Abholung, Status und
 * Storno durch den Hof gehen an der Kette vorbei und bleiben unberührt.
 *
 * Beide Admin-Actions: Recht `notbremse`, frisch mit Passkey bestätigt,
 * Eintrag im Protokoll (N20, N33, N35). Geschrieben werden NUR die vier Felder
 * `bestellstopp*` in einer Anweisung ohne `updatedAt`: Die Zeit der letzten
 * Änderung zeigt Admin › Einstellungen als Protokollzeile der Gründungshöfe —
 * die Notbremse soll dort nicht als deren Änderung erscheinen. Danach leert
 * `updateTag` das Etikett der Einstellung, damit das Band sofort stimmt.
 */

const anhaltenSchema = z.object({
  grund: z.enum(NOTBREMSE_GRUND_WERTE, { error: NOTBREMSE_FEHLER.grund }),
  satz: z
    .string({ error: NOTBREMSE_FEHLER.satz })
    .trim()
    .min(1, { error: NOTBREMSE_FEHLER.satz })
    .max(NOTBREMSE_SATZ_MAX, { error: NOTBREMSE_FEHLER.satz })
    .refine(ohnePersonendaten, { error: NOTBREMSE_FEHLER.satzPerson }),
  bis: z.iso.datetime({ offset: true, error: NOTBREMSE_FEHLER.bis }),
})

/** Die Sätze, die eine Zod-Meldung sein dürfen — alles andere wäre Zods englischer Standardtext. */
const EIGENE_SAETZE: ReadonlySet<string> = new Set([NOTBREMSE_FEHLER.grund, NOTBREMSE_FEHLER.satz, NOTBREMSE_FEHLER.satzPerson, NOTBREMSE_FEHLER.bis])

/**
 * Neue Bestellungen auf allen Höfen anhalten — mit Grund aus der Liste, Satz
 * für die Kundschaft und „bis“ (Pflicht, nach jetzt, höchstens 72 Stunden).
 * Ist schon eine gesetzt, ersetzt die neue sie (anderer Satz, anderes Ende).
 */
export async function halteBestellungenAn(eingabe: unknown): Promise<{ ok: true } | { error: string }> {
  const wache = await verlangeAdminAktion({ frisch: true, recht: 'notbremse' })
  if ('error' in wache) return { error: wache.error }

  const geprueft = anhaltenSchema.safeParse(eingabe)
  if (!geprueft.success) {
    const satz = geprueft.error.issues[0]?.message
    return { error: satz !== undefined && EIGENE_SAETZE.has(satz) ? satz : NOTBREMSE_FEHLER.ungueltig }
  }
  const { grund, satz } = geprueft.data
  const jetzt = new Date()
  const bis = new Date(geprueft.data.bis)
  const bisFehler = notbremseBisFehler(bis, jetzt)
  if (bisFehler) return { error: bisFehler }

  try {
    // Fehlt die Zeile (frische Datenbank), legt die Anweisung sie an; sonst
    // nur die vier Felder — `updatedAt` bleibt (s. oben).
    await prisma.$executeRaw`
      INSERT INTO "PlattformEinstellung" ("id", "bestellstoppAb", "bestellstoppBis", "bestellstoppGrund", "bestellstoppSatz", "updatedAt")
      VALUES (${PLATTFORM_EINSTELLUNG_ID}, ${jetzt}, ${bis}, ${grund}, ${satz}, ${jetzt})
      ON CONFLICT ("id") DO UPDATE SET
        "bestellstoppAb" = EXCLUDED."bestellstoppAb",
        "bestellstoppBis" = EXCLUDED."bestellstoppBis",
        "bestellstoppGrund" = EXCLUDED."bestellstoppGrund",
        "bestellstoppSatz" = EXCLUDED."bestellstoppSatz"`
  } catch (err) {
    Sentry.captureException(err, { tags: { bereich: 'notbremse' } })
    return { error: NOTBREMSE_FEHLER.speichern }
  }

  await protokolliere({
    wer: wache.userId,
    art: 'bestellungen_angehalten',
    bezugArt: 'plattform',
    bezugId: PLATTFORM_BEZUG,
    grund: notbremseGrundLabel(grund),
    mitPasskey: wache.mitPasskey,
  })
  updateTag(PLATTFORM_EINSTELLUNG_TAG)
  return { ok: true }
}

/**
 * Die Notbremse aufheben: Neue Bestellungen gehen sofort wieder. War keine
 * gesetzt, ändert sich nichts und es entsteht kein Eintrag (zweimal tippen
 * oder zwei Admins zugleich).
 */
export async function gibBestellungenFrei(): Promise<{ ok: true } | { error: string }> {
  const wache = await verlangeAdminAktion({ frisch: true, recht: 'notbremse' })
  if ('error' in wache) return { error: wache.error }

  let geaendert: number
  try {
    geaendert = await prisma.$executeRaw`
      UPDATE "PlattformEinstellung"
      SET "bestellstoppAb" = NULL, "bestellstoppBis" = NULL, "bestellstoppGrund" = NULL, "bestellstoppSatz" = NULL
      WHERE "id" = ${PLATTFORM_EINSTELLUNG_ID} AND "bestellstoppAb" IS NOT NULL`
  } catch (err) {
    Sentry.captureException(err, { tags: { bereich: 'notbremse' } })
    return { error: NOTBREMSE_FEHLER.speichern }
  }

  // Nichts geändert (schon frei, zwei Admins zugleich): kein Eintrag. Der Cache wird trotzdem geleert —
  // ein zweites „Freigeben“ räumt so auch einen veralteten Eintrag des Bands ab.
  if (geaendert > 0) {
    await protokolliere({ wer: wache.userId, art: 'bestellungen_freigegeben', bezugArt: 'plattform', bezugId: PLATTFORM_BEZUG, mitPasskey: wache.mitPasskey })
  }
  updateTag(PLATTFORM_EINSTELLUNG_TAG)
  return { ok: true }
}
