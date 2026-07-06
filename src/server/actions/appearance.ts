'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { SectionConfig } from '@/server/queries/appearance'

const farmValueSchema = z.object({
  icon: z.string().max(10),
  title: z.string().min(1).max(50),
  subtitle: z.string().max(100).nullable().optional(),
  sortOrder: z.number().int(),
})

const sectionConfigSchema = z.object({
  key: z.string(),
  visible: z.boolean(),
  order: z.number().int(),
})

const appearanceSchema = z.object({
  tagline: z.string().max(60).nullable().optional(),
  foundedYear: z.number().int().min(1800).max(2050).nullable().optional(),
  aboutText: z.string().max(1000).nullable().optional(),
  bannerValue: z.string().nullable().optional(),
  sectionsConfig: z.array(sectionConfigSchema).default([]),
  farmValues: z.array(farmValueSchema).max(4),
})

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

  const { tagline, foundedYear, aboutText, bannerValue, sectionsConfig, farmValues } = parsed.data

  await prisma.$transaction([
    prisma.farm.update({
      where: { id: farm.id },
      data: {
        tagline: tagline ?? null,
        foundedYear: foundedYear ?? null,
        aboutText: aboutText ?? null,
        bannerValue: bannerValue ?? null,
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
