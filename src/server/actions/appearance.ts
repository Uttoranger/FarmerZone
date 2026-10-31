'use server'

import { headers } from 'next/headers'
import { revalidatePath, updateTag } from 'next/cache'
import { Prisma } from '@prisma/client'
import { del } from '@vercel/blob'
import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { SectionConfig } from '@/server/queries/appearance'
import { appearanceSchema } from '@/schemas/auftritt'
import { ABSCHNITT_SPEICHERN_TEXT, auftrittFehlerText } from '@/lib/abschnitt-stand'
import { BILD_NICHT_UEBERNOMMEN, bildUrlErlaubt, istEigenesBild } from '@/server/bild-url'
import { bildUrlsAusInhalt, pfadAusAdresse } from '@/lib/betrieb'
import { HOEFE_CACHE_TAG } from '@/lib/hofuebersicht'

// Das Schema liegt in src/schemas/auftritt.ts — der Hofseiten-Editor prüft
// „Über uns" daraus, ohne es abzuschreiben. Der Typ steht hier als Alias,
// nicht als `export type { … }`: Ein Re-Export in einer 'use server'-Datei
// registriert Next als Server-Aktion und bricht zur Laufzeit.
export type AppearanceSaveInput = z.infer<typeof appearanceSchema>

/**
 * Das ersetzte Logo bzw. Titelbild verlässt den Bild-Speicher (Audit A8, Nr. 206).
 * Erst NACH dem erfolgreichen Schreiben in der Datenbank: Scheitert das Speichern,
 * zeigt die Hofseite weiter das alte Bild (deshalb löscht der Upload es nicht, Nr. 108).
 * Nur eine Datei im Ordner DIESES Hofs aus unserem Speicher (`istEigenesBild`) — nie
 * eine fremde Adresse, auch kein Altbild von vor der Prüfung. Und nur, wenn keine
 * Zeile mehr auf die Datei zeigt (ein Galeriefoto als Titelbild, das Logo auch als
 * Titelbild): Ein Blob wird erst gelöscht, wenn nichts mehr auf ihn zeigt.
 * Die Felder sind dieselben wie in ladeBildVerwendung (src/server/betrieb-bilder.ts);
 * ein neues Bildfeld gehört in beide Kopien hier UND dorthin (Wache tests/bild-ersetzen-loeschen.test.ts).
 * Scheitert das Löschen, gilt die Aktion trotzdem — eine Meldung nach Sentry, ohne
 * Adresse und ohne Fehlertext; die Datei bleibt als „Bild ohne Verwendung“ (N18).
 * Gleicher Weg in products.ts; eine exportierte Hilfsfunktion wäre in einer
 * 'use server'-Datei eine aufrufbare Aktion.
 */
async function entferneAltesBild(alt: string | null | undefined, neu: string | null | undefined, farmId: string, anlass: 'logo' | 'titelbild'): Promise<void> {
  if (!alt || alt === neu || !istEigenesBild(alt, farmId)) return
  try {
    const verwendet = await Promise.all([
      prisma.farm.count({ where: { OR: [{ logoUrl: alt }, { bannerUrl: alt }, { bannerValue: alt }] } }),
      prisma.product.count({ where: { imageUrl: alt } }),
      prisma.farmPhoto.count({ where: { url: alt } }),
      prisma.statusPost.count({ where: { photoUrl: alt } }),
      prisma.meldung.count({ where: { screenshotUrl: alt } }),
      // Die Startseite (Blöcke und Fassungen) zählt mit wie in ladeBildVerwendung (src/server/betrieb-bilder.ts):
      // startseite.ts lässt eine unveränderte alte Adresse stehen, auch ein Hofbild.
      prisma.startseiteBlock.count({ where: { bildUrl: alt } }),
      prisma.startseiteFassung
        .findMany({ select: { inhalt: true } })
        .then((fassungen) => fassungen.filter((f) => bildUrlsAusInhalt(f.inhalt).some((u) => pfadAusAdresse(u) === pfadAusAdresse(alt))).length),
    ])
    if (verwendet.some((n) => n > 0)) return
    await del(alt, { token: process.env.BLOB_READ_WRITE_TOKEN })
  } catch (fehler) {
    Sentry.captureMessage('Ersetztes Bild nicht aus dem Speicher gelöscht', {
      level: 'warning',
      tags: { bereich: 'bild-loeschen', anlass, klasse: fehler instanceof Error ? fehler.name : typeof fehler },
    })
  }
}

/**
 * Schreibt nur die Felder, die mitkommen (Register N4, Ergänzung Lauf 10):
 * Ein fehlendes Feld bleibt, wie es ist; die Werte werden nur gelöscht und neu
 * angelegt, wenn sie mitkommen (auch als leere Liste: „alle entfernt"). So
 * setzt ein Abschnitt von Mein Hof keinen anderen zurück — auch nicht den
 * eines zweiten Tabs, der zwischen Lesen und Schreiben gespeichert hat. Die
 * Abschnitte schicken nur ihren Teil (speichereAuftritt in
 * components/mein-hof/abschnitt-speichern.ts).
 */
export async function saveAppearanceAction(
  data: AppearanceSaveInput,
): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: ABSCHNITT_SPEICHERN_TEXT.nichtAngemeldet }

  const farm = await prisma.farm.findUnique({ where: { ownerId: session.user.id } })
  if (!farm) return { error: ABSCHNITT_SPEICHERN_TEXT.hofFehlt }

  const parsed = appearanceSchema.safeParse(data)
  // Die Meldung nennt den Abschnitt, dessen Feld nicht passt.
  if (!parsed.success) return { error: auftrittFehlerText(parsed.error.issues) }

  const {
    tagline,
    foundedYear,
    aboutText,
    bannerType,
    bannerValue,
    bannerUrl,
    logoUrl,
    sectionsConfig,
    farmValues,
  } = parsed.data

  // Kommen Logo oder Titelbild mit: Ein schon gespeichertes (auch älteres)
  // Bild bleibt erlaubt, ein neues nur aus unserem Speicher und dem Ordner
  // dieses Hofes (Nr. 19b).
  if (
    !(await bildUrlErlaubt(bannerUrl, farm.id, async () => farm.bannerUrl)) ||
    !(await bildUrlErlaubt(logoUrl, farm.id, async () => farm.logoUrl))
  ) {
    return { error: BILD_NICHT_UEBERNOMMEN }
  }

  await prisma.$transaction([
    prisma.farm.update({
      where: { id: farm.id },
      data: {
        // Immer, auch wenn nur die Werte mitkommen: Ohne Feld setzt Prisma kein
        // UPDATE ab, und erst das UPDATE sperrt die Hofzeile bis zum Ende der
        // Transaktion. So speichern zwei Tabs ihre Werte nacheinander — sonst
        // löschten beide zugleich, legten beide an, und die Liste stünde doppelt da.
        updatedAt: new Date(),
        ...(tagline !== undefined && { tagline }),
        ...(foundedYear !== undefined && { foundedYear }),
        ...(aboutText !== undefined && { aboutText }),
        ...(bannerType !== undefined && { bannerType }),
        ...(bannerValue !== undefined && { bannerValue }),
        ...(bannerUrl !== undefined && { bannerUrl }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(sectionsConfig !== undefined && { sectionsConfig: sectionsConfig as unknown as SectionConfig[] }),
      },
    }),
    ...(farmValues === undefined ? [] : [prisma.farmValue.deleteMany({ where: { farmId: farm.id } })]),
    ...(farmValues !== undefined && farmValues.length > 0
      ? [
          prisma.farmValue.createMany({
            data: farmValues.map((v) => ({
              farmId: farm.id,
              icon: v.icon,
              title: v.title,
              subtitle: v.subtitle ?? null,
              sortOrder: v.sortOrder,
            })),
          }),
        ]
      : []),
  ])

  // Nur Felder, die mitkommen (N4) — ein fehlendes Feld hat sein Bild nicht ersetzt.
  if (logoUrl !== undefined) await entferneAltesBild(farm.logoUrl, logoUrl, farm.id, 'logo')
  if (bannerUrl !== undefined) await entferneAltesBild(farm.bannerUrl, bannerUrl, farm.id, 'titelbild')
  // Altbestand: Vor dem eigenen Feld stand die Foto-Adresse des Titelbilds in bannerValue.
  if (bannerValue !== undefined) await entferneAltesBild(farm.bannerValue, bannerValue, farm.id, 'titelbild')

  revalidatePath(`/${farm.slug}`)
  // Seit Nr. 50 wird der Auftritt in Mein Hof bearbeitet; /settings/appearance leitet nur noch um.
  revalidatePath('/farm-page')
  // Logo und Titelbild stehen auch in der Hofliste (/hoefe, Startseite) — deren eigener Zwischenspeicher.
  updateTag(HOEFE_CACHE_TAG)

  return {}
}

export async function updateFarmLogoAction(logoUrl: string | null): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Nicht angemeldet' }

  const farm = await prisma.farm.findUnique({ where: { ownerId: session.user.id }, select: { id: true, slug: true, logoUrl: true } })
  if (!farm) return { error: 'Hof nicht gefunden' }
  if (!(await bildUrlErlaubt(logoUrl, farm.id, async () => farm.logoUrl))) return { error: BILD_NICHT_UEBERNOMMEN }

  // Der Ausschnitt gehörte zum alten Logo: im selben Update zurück auf „wie heute“ (Nacharbeit 98, Nr. 108).
  // Vorher war das ein zweiter Aufruf — scheiterte er, stand der alte Ausschnitt am neuen Logo.
  await prisma.farm.update({ where: { id: farm.id }, data: { logoUrl, logoAusschnitt: Prisma.DbNull } })
  await entferneAltesBild(farm.logoUrl, logoUrl, farm.id, 'logo')

  revalidatePath(`/${farm.slug}`)
  revalidatePath('/farm-page')
  // Das Logo steht auch im Karussell auf /hoefe — dessen eigener Cache (wie bei speichereBildAusschnittAction).
  updateTag(HOEFE_CACHE_TAG)

  return {}
}

export async function updateFarmBannerAction(
  bannerType: 'GRADIENT' | 'PHOTO',
  bannerUrl: string | null,
): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Nicht angemeldet' }

  const farm = await prisma.farm.findUnique({ where: { ownerId: session.user.id }, select: { id: true, slug: true, bannerUrl: true } })
  if (!farm) return { error: 'Hof nicht gefunden' }
  if (!(await bildUrlErlaubt(bannerUrl, farm.id, async () => farm.bannerUrl))) return { error: BILD_NICHT_UEBERNOMMEN }

  await prisma.farm.update({ where: { id: farm.id }, data: { bannerType, bannerUrl } })
  await entferneAltesBild(farm.bannerUrl, bannerUrl, farm.id, 'titelbild')

  revalidatePath(`/${farm.slug}`)
  revalidatePath('/farm-page')
  // Das Titelbild steht auch in der Hofliste — deren eigener Zwischenspeicher (wie beim Logo).
  updateTag(HOEFE_CACHE_TAG)

  return {}
}
