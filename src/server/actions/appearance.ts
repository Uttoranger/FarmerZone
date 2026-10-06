'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { SectionConfig } from '@/server/queries/appearance'
import { appearanceSchema } from '@/schemas/auftritt'
import { BILD_NICHT_UEBERNOMMEN, bildUrlErlaubt } from '@/server/bild-url'

// Das Schema liegt in src/schemas/auftritt.ts — der Hofseiten-Editor prüft
// „Über uns" daraus, ohne es abzuschreiben. Der Typ steht hier als Alias,
// nicht als `export type { … }`: Ein Re-Export in einer 'use server'-Datei
// registriert Next als Server-Aktion und bricht zur Laufzeit.
export type AppearanceSaveInput = z.infer<typeof appearanceSchema>

export async function saveAppearanceAction(
  data: AppearanceSaveInput,
): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Nicht angemeldet' }

  const farm = await prisma.farm.findUnique({ where: { ownerId: session.user.id } })
  if (!farm) return { error: 'Hof nicht gefunden' }

  const parsed = appearanceSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ungültige Daten' }

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

  // Der Editor schickt Logo und Titelbild bei jedem Speichern mit: Ein schon
  // gespeichertes (auch älteres) Bild bleibt erlaubt, ein neues nur aus
  // unserem Speicher und dem Ordner dieses Hofes (Nr. 19b).
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
        tagline: tagline ?? null,
        foundedYear: foundedYear ?? null,
        aboutText: aboutText ?? null,
        ...(bannerType !== undefined && { bannerType }),
        ...(bannerValue !== undefined && { bannerValue: bannerValue ?? null }),
        ...(bannerUrl !== undefined && { bannerUrl: bannerUrl ?? null }),
        ...(logoUrl !== undefined && { logoUrl: logoUrl ?? null }),
        sectionsConfig: sectionsConfig as unknown as SectionConfig[],
      },
    }),
    prisma.farmValue.deleteMany({ where: { farmId: farm.id } }),
    ...(farmValues.length > 0
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

  revalidatePath(`/${farm.slug}`)
  revalidatePath('/settings/appearance')

  return {}
}

export async function updateFarmLogoAction(logoUrl: string | null): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Nicht angemeldet' }

  const farm = await prisma.farm.findUnique({ where: { ownerId: session.user.id }, select: { id: true, slug: true, logoUrl: true } })
  if (!farm) return { error: 'Hof nicht gefunden' }
  if (!(await bildUrlErlaubt(logoUrl, farm.id, async () => farm.logoUrl))) return { error: BILD_NICHT_UEBERNOMMEN }

  await prisma.farm.update({ where: { id: farm.id }, data: { logoUrl } })

  revalidatePath(`/${farm.slug}`)
  revalidatePath('/settings/appearance')
  revalidatePath('/farm-page')

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

  revalidatePath(`/${farm.slug}`)
  revalidatePath('/settings/appearance')
  revalidatePath('/farm-page')

  return {}
}

// Vertikaler Fokuspunkt des Titelbilds (0 = oben, 100 = unten).
// Wert wird hart geclampt — der Client kann schicken, was er will.
export async function updateBannerFocusAction(focusY: number): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Nicht angemeldet' }

  const farm = await prisma.farm.findUnique({
    where: { ownerId: session.user.id },
    select: { id: true, slug: true },
  })
  if (!farm) return { error: 'Hof nicht gefunden' }

  const clamped = Math.min(100, Math.max(0, Math.round(Number(focusY) || 0)))

  await prisma.farm.update({ where: { id: farm.id }, data: { bannerFocusY: clamped } })

  revalidatePath(`/${farm.slug}`)
  revalidatePath('/farm-page')

  return {}
}
