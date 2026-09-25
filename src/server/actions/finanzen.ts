'use server'

import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { verlangeAdminAktion } from '@/server/admin-wache'
import { monatAlsUtcDatum } from '@/lib/finanzen'
import {
  kostenpostenAendernSchema,
  kostenpostenBeendenSchema,
  kostenpostenLoeschenSchema,
  kostenpostenSchema,
} from '@/schemas/kostenposten'

/**
 * Die Kostenposten der Plattform — anlegen, ändern, beenden, löschen.
 *
 * Nur für den Betreiber: jede Aktion durch `verlangeAdminAktion`
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
  revalidatePath('/admin/finanzen')
}

export async function kostenpostenAnlegen(input: unknown): Promise<Ergebnis> {
  const wache = await verlangeAdminAktion()
  if ('error' in wache) return { error: wache.error }

  const geprueft = kostenpostenSchema.safeParse(input)
  if (!geprueft.success) {
    return { error: geprueft.error.issues[0]?.message ?? 'Das hat nicht geklappt. Bitte nochmal.' }
  }
  const { name, kategorie, betrag, rhythmus, ab, notiz } = geprueft.data

  await prisma.kostenposten.create({
    data: {
      name,
      kategorie,
      betrag: alsDecimal(betrag),
      rhythmus,
      ab: monatAlsUtcDatum(ab),
      notiz,
    },
  })

  revalidate()
  return { ok: true }
}

export async function kostenpostenAendern(input: unknown): Promise<Ergebnis> {
  const wache = await verlangeAdminAktion()
  if ('error' in wache) return { error: wache.error }

  const geprueft = kostenpostenAendernSchema.safeParse(input)
  if (!geprueft.success) {
    return { error: geprueft.error.issues[0]?.message ?? 'Das hat nicht geklappt. Bitte nochmal.' }
  }
  const { id, name, kategorie, betrag, rhythmus, ab, notiz } = geprueft.data
  const abDatum = monatAlsUtcDatum(ab)

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

  revalidate()
  return { ok: true }
}

/**
 * Beenden: `monat` ist der LETZTE Monat, in dem der Posten zählt
 * (einschließlich) — die Monate davor bleiben unverändert richtig.
 */
export async function kostenpostenBeenden(input: unknown): Promise<Ergebnis> {
  const wache = await verlangeAdminAktion()
  if ('error' in wache) return { error: wache.error }

  const geprueft = kostenpostenBeendenSchema.safeParse(input)
  if (!geprueft.success) {
    return { error: geprueft.error.issues[0]?.message ?? 'Das hat nicht geklappt. Bitte nochmal.' }
  }
  const bisDatum = monatAlsUtcDatum(geprueft.data.monat)

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

  revalidate()
  return { ok: true }
}

export async function kostenpostenLoeschen(input: unknown): Promise<Ergebnis> {
  const wache = await verlangeAdminAktion()
  if ('error' in wache) return { error: wache.error }

  const geprueft = kostenpostenLoeschenSchema.safeParse(input)
  if (!geprueft.success) {
    return { error: geprueft.error.issues[0]?.message ?? 'Das hat nicht geklappt. Bitte nochmal.' }
  }

  const { count } = await prisma.kostenposten.deleteMany({ where: { id: geprueft.data.id } })
  if (count === 0) return { error: NICHT_GEFUNDEN }

  revalidate()
  return { ok: true }
}
