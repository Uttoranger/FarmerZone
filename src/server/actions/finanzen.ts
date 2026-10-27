'use server'

import { alsCents } from '@/lib/order-totals'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { verlangeFrischeBestaetigung } from '@/server/admin-wache'
import { protokolliere } from '@/server/admin-protokoll'
import { adminGrundSchema, plattformBezug } from '@/schemas/admin-aktion'
import {
  abgeschlosseneMonateBetroffen,
  kostenGrundFehlt,
  kostenSummeImMonat,
  monatAlsUtcDatum,
  monateZwischenEnden,
  monatsabschlussMoeglich,
  monatsabschlussPruefliste,
  utcDatumAlsMonat,
} from '@/lib/finanzen'
import { istMonatsschluessel, monatsAbstand, monatsschluesselInWien, type Monatsschluessel } from '@/lib/servicegebuehr'
import { ladeAbgeschlosseneMonate, ladeGeldMonat } from '@/server/queries/geld'
import {
  kostenpostenAendernSchema,
  kostenpostenBeendenSchema,
  kostenpostenLoeschenSchema,
  kostenpostenSchema,
} from '@/schemas/kostenposten'

/**
 * Die Kostenposten der Plattform — anlegen, ändern, beenden, löschen.
 *
 * Nur für den Betreiber: jede Aktion durch `verlangeFrischeBestaetigung` (Recht geld, Nr. 188)
 * (src/server/admin-wache.ts). Es gibt hier keinen Hofbezug und damit keine
 * Besitzprüfung — die Tabelle gehört der Plattform. Das Admin-Recht IST die
 * Besitzprüfung, deshalb steht es in jeder einzelnen Aktion und nicht nur in
 * der Seite.
 *
 * BEENDEN IST DER NORMALFALL. Löschen ändert die Vergangenheit: Ein gelöschter
 * Posten verschwindet auch aus den Monaten, in denen er tatsächlich Geld
 * gekostet hat, und das Ergebnis dieser Monate wird rückwirkend besser, als es
 * war. Beenden setzt `bis` und lässt die Vergangenheit stehen.
 *
 * Euro → Decimal: Der Betrag kommt als Zahl mit höchstens zwei
 * Nachkommastellen (Zod) und geht als ZEICHENKETTE in Prisma.Decimal.
 * `new Prisma.Decimal(19.99)` wäre der Weg über einen Float; über
 * `'19.99'` gibt es keinen.
 */

type Ergebnis = { ok: true } | { error: string }

const NICHT_GEFUNDEN = 'Diesen Posten gibt es nicht mehr.'

function alsDecimal(betragEuro: number): Prisma.Decimal {
  return new Prisma.Decimal(betragEuro.toFixed(2))
}

function revalidate(): void {
  // /admin/finanzen leitet seit Nr. 191 nur noch um (308) — neu gebaut wird Geld.
  revalidatePath('/admin/geld')
}

/**
 * Sperre nach dem Monatsabschluss (Register N37, Nr. 191): Berührt die
 * Änderung einen abgeschlossenen Monat (`von` … `bis`, bis null = ohne Ende),
 * braucht sie einen Grund — geprüft wie jeder Grund im Admin-Protokoll
 * (ohne E-Mail-Adresse, ohne Telefonnummer). Der Grund kommt als Feld `grund`
 * neben den Feldern des Postens; die Schemas der Posten kennen ihn nicht.
 * `alt`: der Posten vor der Änderung, nur geladen, wenn es überhaupt
 * abgeschlossene Monate gibt.
 */
async function grundNachAbschluss(
  input: unknown,
  bereich: (alt: { ab: Monatsschluessel; bis: Monatsschluessel | null } | null) => { von: Monatsschluessel; bis: Monatsschluessel | null } | null,
  id: string | null
): Promise<{ grund: string | null } | { error: string }> {
  const abgeschlossen = [...(await ladeAbgeschlosseneMonate()).keys()]
  if (abgeschlossen.length === 0) return { grund: null }
  const altZeile = id === null ? null : await prisma.kostenposten.findUnique({ where: { id }, select: { ab: true, bis: true } })
  const alt = altZeile === null ? null : { ab: utcDatumAlsMonat(altZeile.ab), bis: altZeile.bis === null ? null : utcDatumAlsMonat(altZeile.bis) }
  const b = bereich(alt)
  const betroffen = b === null ? [] : abgeschlosseneMonateBetroffen(abgeschlossen, b.von, b.bis)
  if (betroffen.length === 0) return { grund: null }
  const roh = typeof input === 'object' && input !== null && 'grund' in input ? (input as { grund: unknown }).grund : undefined
  if (typeof roh !== 'string' || roh.trim() === '') return { error: kostenGrundFehlt(betroffen) }
  const grund = adminGrundSchema.safeParse(roh)
  if (!grund.success) return { error: grund.error.issues[0]?.message ?? kostenGrundFehlt(betroffen) }
  return { grund: grund.data }
}

function frueher(a: Monatsschluessel, b: Monatsschluessel): Monatsschluessel {
  return monatsAbstand(a, b) >= 0 ? a : b
}

export async function kostenpostenAnlegen(input: unknown): Promise<Ergebnis> {
  // Heikel (Audit D10; Nr. 188): Kosten ändern die Zahlen in Geld — frisch mit Passkey bestätigt.
  const wache = await verlangeFrischeBestaetigung({ recht: 'geld' })
  if ('error' in wache) return { error: wache.error }

  const geprueft = kostenpostenSchema.safeParse(input)
  if (!geprueft.success) {
    return { error: geprueft.error.issues[0]?.message ?? 'Das hat nicht geklappt. Bitte nochmal.' }
  }
  const { name, kategorie, betrag, rhythmus, ab, notiz } = geprueft.data
  // Ein neuer Posten zählt ab `ab` in jedem Monat — auch in abgeschlossenen.
  const sperre = await grundNachAbschluss(input, () => ({ von: ab, bis: null }), null)
  if ('error' in sperre) return { error: sperre.error }

  const neu = await prisma.kostenposten.create({
    select: { id: true },
    data: {
      name,
      kategorie,
      betrag: alsDecimal(betrag),
      rhythmus,
      ab: monatAlsUtcDatum(ab),
      notiz,
    },
  })
  await protokolliere({ wer: wache.userId, art: 'kostenposten_angelegt', bezugArt: 'plattform', bezugId: plattformBezug('kostenposten', neu.id), mitPasskey: wache.mitPasskey, grund: sperre.grund })

  revalidate()
  return { ok: true }
}

export async function kostenpostenAendern(input: unknown): Promise<Ergebnis> {
  // Heikel (Audit D10; Nr. 188): Kosten ändern die Zahlen in Geld — frisch mit Passkey bestätigt.
  const wache = await verlangeFrischeBestaetigung({ recht: 'geld' })
  if ('error' in wache) return { error: wache.error }

  const geprueft = kostenpostenAendernSchema.safeParse(input)
  if (!geprueft.success) {
    return { error: geprueft.error.issues[0]?.message ?? 'Das hat nicht geklappt. Bitte nochmal.' }
  }
  const { id, name, kategorie, betrag, rhythmus, ab, notiz } = geprueft.data
  const abDatum = monatAlsUtcDatum(ab)
  // Ändern berührt alles vom früheren Beginn bis zum Ende des Postens (das Ende ändert hier nichts).
  const sperre = await grundNachAbschluss(input, (alt) => (alt === null ? null : { von: frueher(alt.ab, ab), bis: alt.bis }), id)
  if ('error' in sperre) return { error: sperre.error }

  // Die Bedingung steht in der WHERE-Klausel, nicht in einem vorgelagerten if:
  // Ein Beginn NACH dem Ende ergäbe einen Posten, der in keinem Monat zählt —
  // er wäre eingetragen und doch unsichtbar.
  const { count } = await prisma.kostenposten.updateMany({
    where: { id, OR: [{ bis: null }, { bis: { gte: abDatum } }] },
    data: {
      name,
      kategorie,
      betrag: alsDecimal(betrag),
      rhythmus,
      ab: abDatum,
      notiz,
    },
  })

  if (count === 0) {
    // Erst jetzt nachsehen, woran es lag — im Erfolgsfall kostet das nichts.
    const vorhanden = await prisma.kostenposten.count({ where: { id } })
    return {
      error:
        vorhanden === 0
          ? NICHT_GEFUNDEN
          : 'Der erste Monat liegt nach dem letzten. Wähle einen früheren Monat.',
    }
  }
  await protokolliere({ wer: wache.userId, art: 'kostenposten_geaendert', bezugArt: 'plattform', bezugId: plattformBezug('kostenposten', id), mitPasskey: wache.mitPasskey, grund: sperre.grund })

  revalidate()
  return { ok: true }
}

/**
 * Beenden: `monat` ist der LETZTE Monat, in dem der Posten zählt
 * (einschließlich) — die Monate davor bleiben unverändert richtig.
 */
export async function kostenpostenBeenden(input: unknown): Promise<Ergebnis> {
  // Heikel (Audit D10; Nr. 188): Kosten ändern die Zahlen in Geld — frisch mit Passkey bestätigt.
  const wache = await verlangeFrischeBestaetigung({ recht: 'geld' })
  if ('error' in wache) return { error: wache.error }

  const geprueft = kostenpostenBeendenSchema.safeParse(input)
  if (!geprueft.success) {
    return { error: geprueft.error.issues[0]?.message ?? 'Das hat nicht geklappt. Bitte nochmal.' }
  }
  const bisDatum = monatAlsUtcDatum(geprueft.data.monat)
  // Beenden ändert nur die Monate zwischen dem alten und dem neuen Ende.
  const sperre = await grundNachAbschluss(input, (alt) => (alt === null ? null : monateZwischenEnden(alt.bis, geprueft.data.monat)), geprueft.data.id)
  if ('error' in sperre) return { error: sperre.error }

  const { count } = await prisma.kostenposten.updateMany({
    where: { id: geprueft.data.id, ab: { lte: bisDatum } },
    data: { bis: bisDatum },
  })

  if (count === 0) {
    const vorhanden = await prisma.kostenposten.count({ where: { id: geprueft.data.id } })
    return {
      error:
        vorhanden === 0
          ? NICHT_GEFUNDEN
          : 'Dieser Monat liegt vor dem Beginn des Postens. Wähle den Beginn oder einen späteren Monat.',
    }
  }
  await protokolliere({ wer: wache.userId, art: 'kostenposten_beendet', bezugArt: 'plattform', bezugId: plattformBezug('kostenposten', geprueft.data.id), mitPasskey: wache.mitPasskey, grund: sperre.grund })

  revalidate()
  return { ok: true }
}

export async function kostenpostenLoeschen(input: unknown): Promise<Ergebnis> {
  // Heikel (Audit D10; Nr. 188): Kosten ändern die Zahlen in Geld — frisch mit Passkey bestätigt.
  const wache = await verlangeFrischeBestaetigung({ recht: 'geld' })
  if ('error' in wache) return { error: wache.error }

  const geprueft = kostenpostenLoeschenSchema.safeParse(input)
  if (!geprueft.success) {
    return { error: geprueft.error.issues[0]?.message ?? 'Das hat nicht geklappt. Bitte nochmal.' }
  }
  // Löschen nimmt den Posten aus jedem Monat, in dem er zählte.
  const sperre = await grundNachAbschluss(input, (alt) => (alt === null ? null : { von: alt.ab, bis: alt.bis }), geprueft.data.id)
  if ('error' in sperre) return { error: sperre.error }

  const { count } = await prisma.kostenposten.deleteMany({ where: { id: geprueft.data.id } })
  if (count === 0) return { error: NICHT_GEFUNDEN }
  await protokolliere({ wer: wache.userId, art: 'kostenposten_geloescht', bezugArt: 'plattform', bezugId: plattformBezug('kostenposten', geprueft.data.id), mitPasskey: wache.mitPasskey, grund: sperre.grund })

  revalidate()
  return { ok: true }
}

/**
 * „<Monat> abschließen …“ (Register N37, Nr. 191): nur ein vergangener Monat,
 * nur einmal und nur, wenn die Prüfliste ganz erledigt ist — der Server prüft
 * sie selbst noch einmal, die Seite kann veraltet sein. Der Abschluss IST der
 * Eintrag `monat_abgeschlossen` im Protokoll (Bezug `monat`, Kennung
 * `JJJJ-MM`); danach verlangen die Kostenposten-Actions für diesen Monat
 * einen Grund (`grundNachAbschluss`).
 */
const monatAbschliessenSchema = z.object({ monat: z.string().refine(istMonatsschluessel) })

export async function monatAbschliessen(input: unknown): Promise<Ergebnis> {
  const wache = await verlangeFrischeBestaetigung({ recht: 'geld' })
  if ('error' in wache) return { error: wache.error }

  const geprueft = monatAbschliessenSchema.safeParse(input)
  if (!geprueft.success) return { error: 'Bitte wähle einen Monat.' }
  const { monat } = geprueft.data
  if (monatsAbstand(monat, monatsschluesselInWien(new Date())) <= 0) return { error: 'Einen Monat kannst du erst nach seinem Ende abschließen.' }

  const [abgeschlossen, stand, posten] = await Promise.all([
    ladeAbgeschlosseneMonate(),
    ladeGeldMonat(monat),
    prisma.kostenposten.findMany({ select: { betrag: true, rhythmus: true, ab: true, bis: true } }),
  ])
  if (abgeschlossen.has(monat)) return { error: 'Dieser Monat ist schon abgeschlossen.' }
  const kosten = kostenSummeImMonat(
    posten.map((p) => ({
      betragCents: alsCents(p.betrag),
      rhythmus: p.rhythmus,
      ab: utcDatumAlsMonat(p.ab),
      bis: p.bis === null ? null : utcDatumAlsMonat(p.bis),
    })),
    monat
  )
  const pruefung = monatsabschlussMoeglich(
    monatsabschlussPruefliste({
      abgleichNachMonatsende: stand.abgleichNachMonatsende,
      abweichungen: stand.abweichungen.length,
      erstattungenOffen: stand.erstattungen.offen,
      kostenPosten: kosten.anzahl,
      csvGeladen: stand.csvGeladen,
    })
  )
  if (!pruefung.moeglich) return { error: pruefung.grund }

  await protokolliere({ wer: wache.userId, art: 'monat_abgeschlossen', bezugArt: 'monat', bezugId: monat, mitPasskey: wache.mitPasskey })
  revalidate()
  return { ok: true }
}
