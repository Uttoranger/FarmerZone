'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { verlangeAdminAktion, verlangeFrischeBestaetigung } from '@/server/admin-wache'
import { protokolliere } from '@/server/admin-protokoll'
import { PLATTFORM_BEZUG } from '@/schemas/admin-aktion'
import { GRUENDUNGSPLAETZE_SPERRE, bildeGruendungBis, vergebeneGruendungsplaetze } from '@/lib/gruendungshof'
import {
  ADMIN_EINSTELLUNGEN_HREF,
  GRUENDUNG_EINSTELLUNG_FEHLER,
  PLATTFORM_EINSTELLUNG_ID,
  PLATTFORM_EINSTELLUNG_SELECT,
  PLATTFORM_EINSTELLUNG_STANDARD,
  PLATTFORM_EINSTELLUNG_TAG,
  HOFPREIS_STICHTAG_FEHLER,
  gruendungEinstellungAus,
  hofpreisEinstellungAus,
  plattformEinstellungAus,
  pruefeGruendungEingabe,
  pruefeHofpreisStichtag,
} from '@/lib/plattform-einstellung'
import { wienerMitternacht } from '@/lib/wiener-tag'
import { gruendungEinstellungSchema, hofpreisStichtagSchema } from '@/schemas/plattform-einstellung'
import { ladeHoefeFuerGruendung } from '@/server/queries/admin'

/** Die Sätze, die eine Zod-Meldung sein dürfen — alles andere wäre Zods englischer Standardtext. */
const EIGENE_SAETZE: ReadonlySet<string> = new Set([
  GRUENDUNG_EINSTELLUNG_FEHLER.plaetze,
  GRUENDUNG_EINSTELLUNG_FEHLER.monate,
  GRUENDUNG_EINSTELLUNG_FEHLER.datum,
  GRUENDUNG_EINSTELLUNG_FEHLER.ungueltig,
])

/**
 * Die Gruppe Gründungshöfe in Admin › Einstellungen speichern (Register
 * K2-Ergänzung, Nr. 93; Aktion seit Nr. 116): Plätze gesamt, Monate, „Aktion
 * bis“, Anzeige an/aus. Nur der Admin (frisch aus der Datenbank,
 * verlangeFrischeBestaetigung, Recht hoefe_freischalten).
 *
 * SPERRE (Nr. 116): in EINER Transaktion unter GRUENDUNGSPLAETZE_SPERRE —
 * dieselbe wie Freischalten, Ausnehmen, Wiederaufnahme, Festschreiben und
 * Wieder-Aktivieren. Gespeicherter Stand und vergebene Plätze werden erst
 * NACH der Sperre gelesen, so kann keine Freischaltung dazwischen einen Platz
 * vergeben, den die neue Zahl nicht mehr hätte. Die Regeln (Plätze nur
 * erhöhen und nie unter die vergebenen, Monate nur erhöhen, Stichtag nur
 * früher) prüft dieselbe reine Funktion wie das Formular.
 *
 * Geschrieben wird per upsert NUR in die Felder dieser Gruppe — Standard-Ende,
 * Festschreiben und Zustell-Regeln (Nr. 95) bleiben, wie sie sind; dazu wer
 * gespeichert hat (Protokollzeile, N15). Danach den Cache der Einstellung und
 * der Höfe-Liste leeren und die Seiten neu bauen, die die Zahlen zeigen.
 */
export async function speichereGruendungEinstellung(eingabe: unknown): Promise<{ ok: true } | { error: string }> {
  // Heikel (Audit D10; Nr. 188): wirkt sofort auf Startseite und Plätze — frisch mit Passkey bestätigt.
  const guard = await verlangeFrischeBestaetigung({ recht: 'hoefe_freischalten' })
  if ('error' in guard) return { error: guard.error }

  const geprueft = gruendungEinstellungSchema.safeParse(eingabe)
  if (!geprueft.success) {
    const satz = geprueft.error.issues[0]?.message
    return { error: satz !== undefined && EIGENE_SAETZE.has(satz) ? satz : GRUENDUNG_EINSTELLUNG_FEHLER.ungueltig }
  }
  const { plaetze, monate, aktionBisTag, anzeige } = geprueft.data

  const ergebnis = await prisma.$transaction(async (tx): Promise<{ ok: true } | { error: string }> => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${GRUENDUNGSPLAETZE_SPERRE})`
    // Nach der Sperre gelesen, nacheinander (eine Abfrage zur Zeit in der Transaktion).
    const zeile = await tx.plattformEinstellung.findUnique({ where: { id: PLATTFORM_EINSTELLUNG_ID }, select: PLATTFORM_EINSTELLUNG_SELECT })
    const bisher = gruendungEinstellungAus(zeile ? plattformEinstellungAus(zeile) : PLATTFORM_EINSTELLUNG_STANDARD)
    const hoefe = await ladeHoefeFuerGruendung(tx)
    const fehler = pruefeGruendungEingabe({ plaetze, monate, aktionBisTag, anzeige }, bisher, vergebeneGruendungsplaetze(hoefe, bisher.plaetze), new Date())
    if (fehler) return { error: fehler }

    const werte = {
      gruendungPlaetze: plaetze,
      gruendungMonate: monate,
      gruendungAktionBis: aktionBisTag === null ? null : bildeGruendungBis(aktionBisTag),
      gruendungAnzeige: anzeige,
      geaendertVonUserId: guard.userId,
    }
    await tx.plattformEinstellung.upsert({
      where: { id: PLATTFORM_EINSTELLUNG_ID },
      create: { id: PLATTFORM_EINSTELLUNG_ID, ...werte },
      update: werte,
    })
    return { ok: true }
  })
  if ('error' in ergebnis) return ergebnis
  await protokolliere({ wer: guard.userId, art: 'gruendung_einstellung_geaendert', bezugArt: 'plattform', bezugId: PLATTFORM_BEZUG, mitPasskey: guard.mitPasskey })

  // updateTag statt revalidateTag: In Next 16 verlangt revalidateTag ein
  // Profil; updateTag gilt für Server Actions (wie revalidiereProdukte).
  updateTag(PLATTFORM_EINSTELLUNG_TAG)
  revalidatePath('/')
  revalidatePath('/fuer-hoefe')
  revalidatePath('/register')
  revalidatePath('/konditionen')
  revalidatePath(ADMIN_EINSTELLUNGEN_HREF)
  return { ok: true }
}

/**
 * Den Stichtag „Hofpreis-Modell ab“ speichern (Register N38, Nr. 197,
 * Punkt 6): Recht `geld`, frisch mit Passkey bestätigt, mit Eintrag im
 * Protokoll. Nur ein Tag in der Zukunft und nur, solange der wirksame
 * Stichtag noch nicht erreicht ist (`pruefeHofpreisStichtag`, frisch aus der
 * Datenbank gelesen — nie aus dem Cache). Geschrieben wird nur dieses Feld.
 * Danach den Cache der Einstellung leeren: Hofseite, Kasse und /api/checkout
 * rechnen ab dem Tag im Hofpreis-Modell.
 */
export async function speichereHofpreisStichtag(eingabe: unknown): Promise<{ ok: true } | { error: string }> {
  const guard = await verlangeAdminAktion({ frisch: true, recht: 'geld' })
  if ('error' in guard) return { error: guard.error }

  const geprueft = hofpreisStichtagSchema.safeParse(eingabe)
  if (!geprueft.success) return { error: HOFPREIS_STICHTAG_FEHLER.datum }
  const { tag } = geprueft.data

  const zeile = await prisma.plattformEinstellung.findUnique({ where: { id: PLATTFORM_EINSTELLUNG_ID }, select: PLATTFORM_EINSTELLUNG_SELECT })
  const bisher = hofpreisEinstellungAus(zeile ? plattformEinstellungAus(zeile) : PLATTFORM_EINSTELLUNG_STANDARD)
  const fehler = pruefeHofpreisStichtag(tag, bisher, new Date())
  if (fehler) return { error: fehler }
  const ab = wienerMitternacht(tag)
  if (!ab) return { error: HOFPREIS_STICHTAG_FEHLER.datum }

  const werte = { hofpreisModellAb: ab, geaendertVonUserId: guard.userId }
  await prisma.plattformEinstellung.upsert({
    where: { id: PLATTFORM_EINSTELLUNG_ID },
    create: { id: PLATTFORM_EINSTELLUNG_ID, ...werte },
    update: werte,
  })
  await protokolliere({ wer: guard.userId, art: 'hofpreis_stichtag_geaendert', bezugArt: 'plattform', bezugId: PLATTFORM_BEZUG, mitPasskey: guard.mitPasskey })

  updateTag(PLATTFORM_EINSTELLUNG_TAG)
  revalidatePath('/')
  revalidatePath(ADMIN_EINSTELLUNGEN_HREF)
  return { ok: true }
}
