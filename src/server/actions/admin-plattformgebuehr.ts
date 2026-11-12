'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { verlangeAdminAktion } from '@/server/admin-wache'
import { protokolliere } from '@/server/admin-protokoll'
import { RUECKBUCHUNG_TEXT, SPERRE_TEXT, adminHofHref, rueckbuchungGeklaertNachricht } from '@/lib/admin-hof-akte'
import { HOEFE_CACHE_TAG } from '@/lib/hofuebersicht'
import { LASTSCHRIFT_HREF } from '@/lib/konditionen'
import { kalendertagInWien, wienerMitternacht } from '@/lib/wiener-tag'
import { monatText, satzHundertstel, satzText } from '@/lib/plattformgebuehr'
import { ADMIN_GRUND_FEHLER } from '@/schemas/admin-aktion'
import { PLATTFORMGEBUEHR_HOF_FEHLER, plattformgebuehrHofSchema, rueckbuchungKlaerenSchema } from '@/schemas/plattformgebuehr'

/**
 * Admin › Hof-Akte › Plattformgebühr (Register N38, Nr. 198): Satz, Mandat
 * Pflicht, Tage bis zur Sperre, Abrechnungstag und Einzug ab je Hof. Recht
 * `geld`, frisch mit Passkey (N20, N35), ins Protokoll mit alt → neu (nur
 * Zahlen und Kalendertage, keine Personendaten). Satz und Einzug gelten nur
 * für neue Bestellungen — gespeicherte behalten ihren Snapshot.
 */
export async function speichereHofPlattformgebuehr(eingabe: unknown): Promise<{ ok: true } | { error: string }> {
  const wache = await verlangeAdminAktion({ frisch: true, recht: 'geld' })
  if ('error' in wache) return { error: wache.error }
  const geprueft = plattformgebuehrHofSchema.safeParse(eingabe)
  if (!geprueft.success) return { error: geprueft.error.issues[0]?.message ?? PLATTFORMGEBUEHR_HOF_FEHLER.satz }
  const d = geprueft.data
  const einzugAb = d.einzugAb === '' ? null : wienerMitternacht(d.einzugAb)
  if (d.einzugAb !== '' && !einzugAb) return { error: PLATTFORMGEBUEHR_HOF_FEHLER.einzug }

  const vorher = await prisma.farm.findUnique({
    where: { id: d.farmId },
    select: { slug: true, plattformgebuehrProzent: true, barMandatPflicht: true, barSperreNachTagen: true, abrechnungsTag: true, einzugAb: true },
  })
  if (!vorher) return { error: 'Den Hof gibt es nicht mehr.' }
  await prisma.farm.update({
    where: { id: d.farmId },
    data: { plattformgebuehrProzent: d.satz, barMandatPflicht: d.mandatPflicht, barSperreNachTagen: d.sperreTage, abrechnungsTag: d.abrechnungsTag, einzugAb },
  })

  const tag = (x: Date | null): string => (x ? kalendertagInWien(x) : 'Vorgabe')
  const teile = [
    `Satz ${satzText(satzHundertstel(vorher))} → ${satzText(satzHundertstel({ plattformgebuehrProzent: d.satz }))} %`,
    `Mandat Pflicht ${vorher.barMandatPflicht ? 'ja' : 'nein'} → ${d.mandatPflicht ? 'ja' : 'nein'}`,
    `Sperre ${vorher.barSperreNachTagen} → ${d.sperreTage} Tage`,
    `Abrechnungstag ${vorher.abrechnungsTag} → ${d.abrechnungsTag}`,
    `Einzug ab ${tag(vorher.einzugAb)} → ${tag(einzugAb)}`,
  ]
  await protokolliere({ wer: wache.userId, art: 'plattformgebuehr_geaendert', bezugArt: 'hof', bezugId: d.farmId, mitPasskey: wache.mitPasskey, grund: teile.join(' · ') })
  // Der Satz steht auf der Hofseite und in der Hofübersicht (Zwischenspeicher) — wie in admin-hof.ts neu laden.
  revalidatePath(adminHofHref(d.farmId))
  revalidatePath(`/${vorher.slug}`)
  updateTag(HOEFE_CACHE_TAG)
  return { ok: true }
}

/**
 * Admin › Hof-Akte › „Sperre nach Rückbuchung aufheben“ (Notweg, Nr. 290,
 * A007): nur wenn der Hof den Betrag anders bezahlt hat oder die Rückbuchung
 * nicht berechtigt war. Recht `geld`, frisch mit Passkey, Grund Pflicht (ins
 * Protokoll). Die Abrechnung geht bedingt von „zurueckgebucht“ auf „geklaert“
 * — mit dem Hof der Abrechnung in der Bedingung (gelesen über die Kennung,
 * tests/hof-schreiben-farmid-wache.test.ts) —, der Hof bekommt eine Nachricht
 * ins Postfach. Kein Aufruf an Stripe: Eine offene Nachforderung bleibt
 * stehen, das Team storniert sie dort von Hand.
 */
export async function klaereRueckbuchung(eingabe: unknown): Promise<{ ok: true } | { error: string }> {
  const wache = await verlangeAdminAktion({ frisch: true, recht: 'geld' })
  if ('error' in wache) return { error: wache.error }
  const geprueft = rueckbuchungKlaerenSchema.safeParse(eingabe)
  if (!geprueft.success) {
    const amGrund = geprueft.error.issues.filter((i) => i.path[0] === 'grund')
    if (amGrund.length === 0) return { error: RUECKBUCHUNG_TEXT.nichtMehr }
    return { error: amGrund.some((i) => i.message === ADMIN_GRUND_FEHLER) ? ADMIN_GRUND_FEHLER : SPERRE_TEXT.eingabe }
  }
  const { abrechnungId, grund } = geprueft.data

  const abr = await prisma.monatsabrechnung.findUnique({ where: { id: abrechnungId }, select: { farmId: true, monat: true } })
  if (!abr) return { error: RUECKBUCHUNG_TEXT.nichtMehr }
  const { count } = await prisma.monatsabrechnung.updateMany({
    where: { id: abrechnungId, farmId: abr.farmId, stand: 'zurueckgebucht' },
    data: { stand: 'geklaert' },
  })
  if (count !== 1) return { error: RUECKBUCHUNG_TEXT.nichtMehr }

  await protokolliere({ wer: wache.userId, art: 'lastschrift_rueckbuchung_geklaert', bezugArt: 'hof', bezugId: abr.farmId, mitPasskey: wache.mitPasskey, grund })
  // Dynamisch: Die Akte bindet diese Action ein, das Abrechnungs-Modul zieht Stripe statisch (tests/schwere-module.test.ts).
  const { schreibeHofNachricht } = await import('@/server/plattformgebuehr-abrechnung')
  await schreibeHofNachricht(abr.farmId, rueckbuchungGeklaertNachricht(monatText(abr.monat.toISOString().slice(0, 7))), LASTSCHRIFT_HREF, 'geklaert')
  revalidatePath(adminHofHref(abr.farmId))
  return { ok: true }
}
