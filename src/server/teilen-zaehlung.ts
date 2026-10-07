import { Prisma, type TeilenKanal } from '@prisma/client'
import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'
import { nachDerAntwort } from '@/lib/nach-der-antwort'
import { teilenTag } from '@/lib/teilen-kanal'
import { OEFFENTLICH_SICHTBAR } from '@/server/queries/farm'

/**
 * Teilen-Zählung (Gate 7, S8): zählt einen Besuch oder eine Bestellung über
 * einen geteilten Link — als Summe je Hof, Kanal und Wiener Tag, sonst nichts.
 * Keine Person, kein Gerät, keine IP, kein Cookie: Die Zeile hat dafür keine
 * Spalte (tests/schema-expand.test.ts), und hier geht nichts davon hinein.
 *
 * Atomar: EIN upsert mit `increment` (Postgres: INSERT … ON CONFLICT DO
 * UPDATE). Treffen sich zwei erste Aufrufe eines Tages, kann einer am
 * eindeutigen Index scheitern (P2002) — dann gibt es die Zeile, und ein
 * zweiter Versuch zählt sie hoch. Ein Zähler, kein Geld.
 */
async function zaehle(feld: 'besuche' | 'bestellungen', farmId: string, kanal: TeilenKanal, jetzt: Date): Promise<void> {
  const tag = teilenTag(jetzt)
  const versuch = () =>
    prisma.teilenAufruf.upsert({
      where: { farmId_kanal_tag: { farmId, kanal, tag } },
      create: { farmId, kanal, tag, [feld]: 1 },
      update: { [feld]: { increment: 1 } },
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

/** Ein Besuch der Hofseite über einen geteilten Link. */
export function zaehleTeilenBesuch(farmId: string, kanal: TeilenKanal, jetzt: Date = new Date()): Promise<void> {
  return zaehle('besuche', farmId, kanal, jetzt)
}

/**
 * Eine Bestellung, die über einen geteilten Link kam. Nur als Nachlauf
 * aufrufen (nachDerAntwort): Scheitert das Zählen, bleibt die Bestellung —
 * nie zurückrollen (CLAUDE.md, Geld und Bestellungen).
 */
export function zaehleTeilenBestellung(farmId: string, kanal: TeilenKanal, jetzt: Date = new Date()): Promise<void> {
  return zaehle('bestellungen', farmId, kanal, jetzt)
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

/**
 * Die Bestellung zählt für ihren Kanal — als Nachlauf NACH der Antwort
 * (nachDerAntwort). Ohne Kanal geschieht nichts. Ein Fehler geht nach Sentry
 * (nur Hof-ID und Kanal, keine Person) und erreicht die Bestellung nie.
 */
export function zaehleBestellungNachDerAntwort(farmId: string, kanal: TeilenKanal | null, jetzt: Date): void {
  if (!kanal) return
  nachDerAntwort(async () => {
    try {
      await zaehleTeilenBestellung(farmId, kanal, jetzt)
    } catch (fehler) {
      Sentry.captureException(fehler, { tags: { aufgabe: 'checkout', grund: 'teilen_zaehlung' }, extra: { farmId, kanal } })
    }
  })
}
