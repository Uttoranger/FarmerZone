import { z } from 'zod'

/**
 * Der Auftritt der Hofseite, wie saveAppearanceAction
 * (src/server/actions/appearance.ts) ihn verlangt. Hier statt in der Aktion,
 * weil der Hofseiten-Editor (components/farmer/hofseite-editor.tsx) „Über
 * uns" mit `.pick()` daraus prüft — eine Regel, nicht zwei Abschriften.
 */
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

export const appearanceSchema = z.object({
  tagline: z.string().max(60).nullable().optional(),
  foundedYear: z.number().int().min(1800).max(2050).nullable().optional(),
  aboutText: z.string().max(1000, 'Höchstens 1000 Zeichen').nullable().optional(),
  bannerType: z.enum(['GRADIENT', 'PHOTO']).optional(),
  bannerValue: z.string().nullable().optional(),
  bannerUrl: z.string().url().nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  sectionsConfig: z.array(sectionConfigSchema).default([]),
  farmValues: z.array(farmValueSchema).max(4),
})

export type AppearanceSaveInput = z.infer<typeof appearanceSchema>
