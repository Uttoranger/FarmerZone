import { Prisma, type TeilenKanal } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { teilenTag } from '@/lib/teilen-kanal'
import { OEFFENTLICH_SICHTBAR } from '@/server/queries/farm'

/**
 * Teilen-Zählung (Gate 7, S8): zählt einen Besuch über einen geteilten Link —
 * als Summe je Hof, Kanal und Wiener Tag, sonst nichts. Bestellungen zählen
 * seit Nr. 25 nicht mehr (Register T1): Die Spalte `bestellungen` bleibt
 * (Expand/Contract), wird aber nie beschrieben.
 * Keine Person, kein Gerät, keine IP, kein Cookie: Die Zeile hat dafür keine
 * Spalte (tests/schema-expand.test.ts), und hier geht nichts davon hinein.
 *
 * Atomar: EIN upsert mit `increment` (Postgres: INSERT … ON CONFLICT DO
 * UPDATE). Treffen sich zwei erste Aufrufe eines Tages, kann einer am
 * eindeutigen Index scheitern (P2002) — dann gibt es die Zeile, und ein
 * zweiter Versuch zählt sie hoch. Ein Zähler, kein Geld.
 */
export async function zaehleTeilenBesuch(farmId: string, kanal: TeilenKanal, jetzt: Date = new Date()): Promise<void> {
  const tag = teilenTag(jetzt)
  const versuch = () =>
    prisma.teilenAufruf.upsert({
      where: { farmId_kanal_tag: { farmId, kanal, tag } },
      create: { farmId, kanal, tag, besuche: 1 },
      update: { besuche: { increment: 1 } },
      select: { id: true },
    })
  try {
    await versuch()
  } catch (fehler) {
    if (fehler instanceof Prisma.PrismaClientKnownRequestError && fehler.code === 'P2002') {
      await versuch()
      return
    }
    throw fehler
  }
}

/**
 * Ein Besuch über einen geteilten Link, wie ihn die Hofseite meldet: zählt
 * nur bei einem öffentlich sichtbaren Hof (dieselbe Bedingung wie die
 * Hofseite, OEFFENTLICH_SICHTBAR). Ein unbekannter oder nicht öffentlicher
 * Hof zählt still nicht — die Antwort verrät nichts über ihn.
 */
export async function zaehleBesuchFuerSlug(slug: string, kanal: TeilenKanal, jetzt: Date = new Date()): Promise<boolean> {
  const hof = await prisma.farm.findUnique({ where: { slug, ...OEFFENTLICH_SICHTBAR }, select: { id: true } })
  if (!hof) return false
  await zaehleTeilenBesuch(hof.id, kanal, jetzt)
  return true
}
