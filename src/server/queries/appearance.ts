import { prisma } from '@/lib/prisma'
import { leseAusschnitt, type BildAusschnitt } from '@/schemas/bild-ausschnitt'

export type SectionConfig = {
  key: string
  visible: boolean
  order: number
}

export const DEFAULT_SECTIONS: SectionConfig[] = [
  { key: 'status',   visible: true, order: 1 },
  { key: 'about',    visible: true, order: 2 },
  { key: 'values',   visible: true, order: 3 },
  { key: 'gallery',  visible: true, order: 4 },
  { key: 'products', visible: true, order: 5 },
]

export type FarmValueData = {
  id: string
  icon: string
  title: string
  subtitle: string | null
  sortOrder: number
}

export type FarmPhotoData = {
  id: string
  url: string
  caption: string | null
  sortOrder: number
  /** Ausschnitt der Kachel (Register N17, Nr. 98) — schon geprüft; null = wie heute. */
  ausschnitt: BildAusschnitt | null
}

export type AppearanceData = {
  farmId: string
  tagline: string | null
  foundedYear: number | null
  aboutText: string | null
  logoUrl: string | null
  /** Ausschnitt des Logos (Register N17, Nr. 98) — schon geprüft; null = wie heute. */
  logoAusschnitt: BildAusschnitt | null
  bannerType: 'GRADIENT' | 'PHOTO'
  bannerUrl: string | null
  bannerValue: string | null
  sectionsConfig: SectionConfig[]
  farmValues: FarmValueData[]
  farmPhotos: FarmPhotoData[]
  slug: string
}

export async function getAppearanceData(ownerId: string): Promise<AppearanceData | null> {
  const farm = await prisma.farm.findUnique({
    where: { ownerId },
    select: {
      id: true,
      tagline: true,
      foundedYear: true,
      aboutText: true,
      logoUrl: true,
      logoAusschnitt: true,
      bannerType: true,
      bannerUrl: true,
      bannerValue: true,
      sectionsConfig: true,
      slug: true,
      farmValues: {
        orderBy: { sortOrder: 'asc' },
        select: { id: true, icon: true, title: true, subtitle: true, sortOrder: true },
      },
      farmPhotos: {
        orderBy: { sortOrder: 'asc' },
        select: { id: true, url: true, caption: true, sortOrder: true, ausschnitt: true },
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
    farmId: farm.id,
    tagline: farm.tagline,
    foundedYear: farm.foundedYear,
    aboutText: farm.aboutText,
    logoUrl: farm.logoUrl,
    logoAusschnitt: leseAusschnitt(farm.logoAusschnitt),
    bannerType: farm.bannerType as 'GRADIENT' | 'PHOTO',
    bannerUrl: farm.bannerUrl,
    bannerValue: farm.bannerValue,
    sectionsConfig: sections,
    farmValues: farm.farmValues,
    farmPhotos: farm.farmPhotos.map(({ ausschnitt, ...foto }) => ({ ...foto, ausschnitt: leseAusschnitt(ausschnitt) })),
    slug: farm.slug,
  }
}
