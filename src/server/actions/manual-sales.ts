'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { manualSaleFormSchema, verkaufIdSchema } from '@/schemas/manual-sale'
import { getFarmForUser } from '@/server/queries/dashboard'
import {
  gebindeZumAbziehen,
  verkaufOhneAngaben,
  vorratHinweis,
  type VorratBuchung,
  type VorratHinweis,
} from '@/lib/verkauf-eintragen'
import { wienKalendertag } from '@/lib/kalender'
import { revalidiereProdukte } from '@/server/produkte-schreiben'

/*
 * Direktverkäufe (Verkauf eintragen, ändern, löschen). Seit Register D1
 * (Nachtlauf Nr. 39) zieht „Verkauf eintragen" mit einem Produkt aus dem
 * Sortiment den Vorrat ab, wenn der Schalter „Vorrat abziehen" an ist —
 * bedingt, nie unter 0, in derselben Transaktion wie der Verkauf. Ändern und
 * Löschen buchen weiterhin nichts ab und nichts zurück: D1 regelt nur das
 * Eintragen, und eine Gegenbuchung beim Löschen könnte Vorrat erfinden, den
 * der Hof inzwischen selbst neu gezählt hat.
 */

/** `vorrat` nur, wenn abgezogen wurde (oder werden sollte) — der Dialog zeigt den Satz nach dem Speichern. */
export type VerkaufAntwort = { ok: true; vorrat?: VorratHinweis } | { error: string }

/** Wie oft die Buchung neu ansetzt, wenn sich der Vorrat zwischen ihren zwei Schritten ändert. */
const VORRAT_VERSUCHE = 3

const NICHT_ANGEMELDET = 'Bitte melde dich neu an.'
const NICHT_MEHR_DA = 'Diesen Verkauf gibt es nicht mehr. Lade die Seite neu.'

/** Der Hof der Sitzung — oder null, dann antwortet die Action mit einem Satz statt abzustürzen. */
async function eigenerHof(): Promise<{ id: string; slug: string } | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  return getFarmForUser(session.user.id)
}

// 12:00 UTC des gewählten Tages: liegt in Wien sicher auf demselben Tag
// (13 bzw. 14 Uhr) — die Umsatzregel zählt manuelle Verkäufe nach ihrem
// Wiener Tag (src/lib/umsatz.ts). Früher 12:00 Serverzeit, was auf Vercel
// dasselbe ist.
function toDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
}

function revalidate() {
  revalidatePath('/sales')
  revalidatePath('/analytics')
  revalidatePath('/dashboard')
}

/**
 * Prüft die Eingabe und baut die Zeile. Ein gewähltes Produkt muss dem
 * eigenen Hof gehören — sonst hinge ein Verkauf an einem fremden Produkt und
 * tauchte in dessen Grenzwert-Zählung auf.
 */
type Verkaufsprodukt = { id: string; unit: string; unitSize: Prisma.Decimal | null }

async function verkaufsDaten(
  farmId: string,
  data: unknown
): Promise<
  | { error: string }
  | {
      daten: Omit<Prisma.ManualSaleUncheckedCreateInput, 'farmId'>
      /** Gesetzt, wenn ein eigenes Produkt gewählt und der Schalter „Vorrat abziehen" an ist. */
      abziehen: Verkaufsprodukt | null
    }
> {
  const geprueft = manualSaleFormSchema.safeParse(data)
  if (!geprueft.success) return { error: geprueft.error.issues[0]?.message ?? 'Bitte prüf deine Eingaben.' }
  const v = geprueft.data

  // Das Feld lässt keinen künftigen Tag zu — der Server prüft trotzdem
  // (Wiener Tag, Textvergleich JJJJ-MM-TT): Ein Verkauf von morgen zählte
  // heute noch nirgends und morgen plötzlich doppelt im Kopf des Hofs.
  if (v.saleDate > wienKalendertag(new Date())) {
    return { error: 'Ein Verkauf in der Zukunft geht nicht. Wähl heute oder einen Tag davor.' }
  }

  const produkt = v.productId
    ? await prisma.product.findFirst({
        where: { id: v.productId, farmId },
        select: { id: true, name: true, unit: true, unitSize: true },
      })
    : null
  if (v.productId && !produkt) {
    return { error: 'Dieses Produkt gibt es auf deinem Hof nicht mehr. Wähl ein anderes oder „Anderes".' }
  }

  const { productName, quantity } = verkaufOhneAngaben({
    productName: v.productName || produkt?.name,
    quantity: v.quantity,
  })

  return {
    daten: {
      productId: produkt?.id ?? null,
      productName,
      quantity,
      unit: v.unit ?? produkt?.unit ?? null,
      // Zwei Nachkommastellen, wie die Spalte — ein getipptes 24,555 wird nicht still von der Datenbank gerundet.
      totalAmount: new Prisma.Decimal(v.totalAmount).toDecimalPlaces(2),
      channel: v.channel,
      saleDate: toDate(v.saleDate),
      note: v.note || null,
    },
    abziehen: produkt && v.vorratAbziehen === true ? produkt : null,
  }
}

/**
 * Zieht `menge` Gebinde vom Vorrat ab — nie unter 0 (Register D1,
 * CLAUDE.md: nie ein blindes decrement). Erst bedingt `stock >= menge`;
 * reicht das nicht, bedingt `stock < menge` auf 0: Der Verkauf ist echt
 * passiert, die Ware ist weg, der gezählte Vorrat war schlicht zu klein.
 * Ändert sich der Vorrat zwischen den beiden Schritten (eine Bestellung, der
 * Hof selbst), greift keine der Bedingungen — dann setzt die Buchung neu an,
 * begrenzt. Hof in jeder WHERE-Klausel.
 */
async function bucheVorrat(
  tx: Prisma.TransactionClient,
  produktId: string,
  farmId: string,
  menge: number
): Promise<VorratBuchung> {
  for (let versuch = 0; versuch < VORRAT_VERSUCHE; versuch++) {
    const abgezogen = await tx.product.updateMany({
      where: { id: produktId, farmId, stock: { gte: menge } },
      data: { stock: { decrement: menge } },
    })
    if (abgezogen.count === 1) {
      // In derselben Transaktion: die eigene Schreibung, die Zeilensperre hält bis zum Commit.
      const danach = await tx.product.findFirst({ where: { id: produktId, farmId }, select: { stock: true } })
      return { art: 'abgezogen', vorrat: danach?.stock ?? 0 }
    }
    const geleert = await tx.product.updateMany({
      where: { id: produktId, farmId, stock: { lt: menge } },
      data: { stock: 0 },
    })
    if (geleert.count === 1) return { art: 'auf-null' }
  }
  return { art: 'unveraendert' }
}

export async function createManualSale(data: unknown): Promise<VerkaufAntwort> {
  const farm = await eigenerHof()
  if (!farm) return { error: NICHT_ANGEMELDET }
  const ergebnis = await verkaufsDaten(farm.id, data)
  if ('error' in ergebnis) return { error: ergebnis.error }
  const { daten, abziehen } = ergebnis

  // Verkauf und Abzug in EINER Transaktion: Scheitert das Speichern, ist auch
  // nichts abgezogen — nie Ware weg ohne Verkauf. Abgezogen wird nach der
  // Menge, wie die Spalte sie gespeichert hat (drei Stellen).
  const buchung = await prisma.$transaction(async (tx) => {
    const verkauf = await tx.manualSale.create({ data: { farmId: farm.id, ...daten }, select: { quantity: true } })
    if (!abziehen) return null
    return bucheVorrat(tx, abziehen.id, farm.id, gebindeZumAbziehen(verkauf.quantity.toNumber()))
  })

  revalidate()
  if (!buchung || !abziehen) return { ok: true }
  // Vorrat geändert: Produkte, Hofseite und Hofübersicht zeigen sonst den alten Stand („ausverkauft" bei 0).
  revalidiereProdukte(farm.slug)
  return { ok: true, vorrat: vorratHinweis(buchung, abziehen) }
}

export async function updateManualSale(saleId: unknown, data: unknown): Promise<VerkaufAntwort> {
  const id = verkaufIdSchema.safeParse(saleId)
  if (!id.success) return { error: NICHT_MEHR_DA }
  const farm = await eigenerHof()
  if (!farm) return { error: NICHT_ANGEMELDET }
  const ergebnis = await verkaufsDaten(farm.id, data)
  if ('error' in ergebnis) return { error: ergebnis.error }

  // Besitz und Schreiben in einem: nur ein Verkauf des eigenen Hofs. Der
  // Vorrat bleibt beim Ändern unberührt (D1 regelt nur das Eintragen) —
  // `abziehen` wird hier bewusst nicht ausgewertet.
  const { count } = await prisma.manualSale.updateMany({
    where: { id: id.data, farmId: farm.id },
    data: ergebnis.daten,
  })
  if (count === 0) return { error: NICHT_MEHR_DA }

  revalidate()
  return { ok: true }
}

export async function deleteManualSale(saleId: unknown): Promise<VerkaufAntwort> {
  const id = verkaufIdSchema.safeParse(saleId)
  if (!id.success) return { error: NICHT_MEHR_DA }
  const farm = await eigenerHof()
  if (!farm) return { error: NICHT_ANGEMELDET }

  // Besitz in der WHERE-Klausel statt Lesen-dann-Löschen: zwischen Prüfung
  // und Schreiben bleibt keine Lücke, und ein fremder Verkauf ist schlicht 0.
  const { count } = await prisma.manualSale.deleteMany({ where: { id: id.data, farmId: farm.id } })
  if (count === 0) return { error: NICHT_MEHR_DA }

  revalidate()
  return { ok: true }
}
