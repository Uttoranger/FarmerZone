import { prisma } from '@/lib/prisma'

export type SectionConfig = {
  key: string
  visible: boolean
  order: number
}

export const DEFAULT_SECTIONS: SectionConfig[] = [
  { key: 'status',  visible: true, order: 1 },
  { key: 'about',   visible: true, order: 2 },
  { key: 'values',  visible: true, order: 3 },
  { key: 'gallery', visible: true, order: 4 },
  { key: 'products', visible: true, order: 5 },
]

export type FarmValueData = {
  id: string
  icon: string
  title: string
  subtitle: string | null
  sortOrder: number
}

export type AppearanceData = {
  tagline: string | null
  foundedYear: number | null
  aboutText: string | null
  bannerType: 'GRADIENT' | 'PHOTO'
  bannerValue: string | null
  sectionsConfig: SectionConfig[]
  farmValues: FarmValueData[]
  slug: string
}

export async function getAppearanceData(ownerId: string): Promise<AppearanceData | null> {
  const farm = await prisma.farm.findUnique({
    where: { ownerId },
    select: {
      tagline: true,
      foundedYear: true,
      aboutText: true,
      bannerType: true,
      bannerValue: true,
      sectionsConfig: true,
      slug: true,
      farmValues: {
        orderBy: { sortOrder: 'asc' },
        select: { id: true, icon: true, title: true, subtitle: true, sortOrder: true },
      },
    },
  })

  if (!farm) return null

  const rawSections = farm.sectionsConfig
  const sections: SectionConfig[] =
    Array.isArray(rawSections) && rawSections.length > 0
      ? (rawSections as SectionConfig[])
      : DEFAULT_SECTIONS

  return {
    tagline: farm.tagline,
    foundedYear: farm.foundedYear,
    aboutText: farm.aboutText,
    bannerType: farm.bannerType,
    bannerValue: farm.bannerValue,
    sectionsConfig: sections,
    farmValues: farm.farmValues,
    slug: farm.slug,
  }
}
