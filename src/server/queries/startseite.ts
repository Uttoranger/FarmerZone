import * as Sentry from '@sentry/nextjs'
import { unstable_cache } from 'next/cache'
import { unstable_rethrow } from 'next/navigation'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  STARTSEITE_CACHE_TAG,
  type StartseitenBlockDaten,
  type StartseitenZeile,
} from '@/lib/startseite-gestalten'
import type { StartseitenHof } from '@/lib/startseite'
import { OEFFENTLICH_SICHTBAR } from '@/server/queries/farm'

/*
 * Die Startseite als Liste lesen (Register N16, Nr. 96). EINE Abfrage für
 * alle Abschnitte samt Blöcken; die gewählten Höfe aller Blöcke zusammen in
 * höchstens einer zweiten — nie eine Abfrage je Block. Beides im Datencache
 * mit dem Etikett 'startseite' (fünf Minuten wie die Seite); Speichern in
 * Admin › Startseite leert ihn.
 */

const ZEILE_MIT_BLOCK = {
  orderBy: [{ position: 'asc' }, { id: 'asc' }],
  include: { block: true },
} satisfies Prisma.StartseiteAbschnittFindManyArgs

type ZeileRoh = Prisma.StartseiteAbschnittGetPayload<typeof ZEILE_MIT_BLOCK>

/** Die Slugs der freigeschalteten Höfe zu allen gewählten Kennungen — eine Abfrage. */
async function hofSlugs(zeilen: readonly ZeileRoh[]): Promise<Map<string, string>> {
  const ids = [...new Set(zeilen.flatMap((z) => z.block?.farmIds ?? []))]
  if (ids.length === 0) return new Map()
  const hoefe = await prisma.farm.findMany({ where: { id: { in: ids }, ...OEFFENTLICH_SICHTBAR }, select: { id: true, slug: true } })
  return new Map(hoefe.map((h) => [h.id, h.slug]))
}

function alsZeile(zeile: ZeileRoh, slugs: Map<string, string>): StartseitenZeile | null {
  if (zeile.art !== 'BLOCK') return { art: zeile.art, sichtbar: zeile.sichtbar }
  const b = zeile.block
  // Eine BLOCK-Zeile ohne Block gibt es nur nach einem Eingriff von Hand — sie fällt weg.
  if (!b) return null
  const block: StartseitenBlockDaten = {
    id: b.id,
    vorlage: b.vorlage,
    ueberzeile: b.ueberzeile,
    titel: b.titel,
    text: b.text,
    bildUrl: b.bildUrl,
    linkUrl: b.linkUrl,
    linkText: b.linkText,
    // Ein inzwischen gesperrter oder archivierter Hof fällt hier weg.
    hofSlugs: b.farmIds.flatMap((id) => slugs.get(id) ?? []),
    kategorie: b.kategorie,
    liveAb: b.liveAb.toISOString(),
    liveBis: b.liveBis?.toISOString() ?? null,
  }
  return { art: 'BLOCK', sichtbar: zeile.sichtbar, block }
}

/** Die Zeilen frisch aus der Datenbank (Vorschau, Tests). */
export async function leseStartseitenZeilen(): Promise<StartseitenZeile[]> {
  const zeilen = await prisma.startseiteAbschnitt.findMany(ZEILE_MIT_BLOCK)
  const slugs = await hofSlugs(zeilen)
  return zeilen.flatMap((z) => alsZeile(z, slugs) ?? [])
}

const ladeGecacht = unstable_cache(leseStartseitenZeilen, [STARTSEITE_CACHE_TAG], {
  revalidate: 300,
  tags: [STARTSEITE_CACHE_TAG],
})

/**
 * Die Liste für die Startseite. Bei einem Lesefehler eine leere Liste — die
 * Seite rendert dann die heutige Reihenfolge (zuRendern), statt der ganzen
 * Startseite eine 500 zu geben; beim Bau ohne Datenbank genauso. Der Fehler
 * geht nach Sentry.
 */
export async function ladeStartseite(): Promise<StartseitenZeile[]> {
  try {
    return await ladeGecacht()
  } catch (err) {
    unstable_rethrow(err)
    Sentry.captureException(err, { tags: { bereich: 'startseite-liste' } })
    return []
  }
}

// ─── Admin › Startseite ─────────────────────────────────────────────────────

export type AdminStartseitenZeile = {
  id: string
  art: ZeileRoh['art']
  sichtbar: boolean
  block: (StartseitenBlockDaten & { farmIds: string[] }) | null
}

export type AdminHof = { id: string; hof: StartseitenHof }

export type AdminStartseite = {
  zeilen: AdminStartseitenZeile[]
  /** Freigeschaltete, öffentlich sichtbare Höfe für die Höfe-Auswahl — Name und Ort. */
  hoefe: AdminHof[]
}

/** Alles für Admin › Startseite, frisch (die Seite ist ohnehin dynamisch). */
export async function ladeStartseiteAdmin(): Promise<AdminStartseite> {
  const [zeilen, hoefe] = await Promise.all([
    prisma.startseiteAbschnitt.findMany(ZEILE_MIT_BLOCK),
    prisma.farm.findMany({
      where: OEFFENTLICH_SICHTBAR,
      orderBy: { name: 'asc' },
      select: { id: true, slug: true, name: true, postalCode: true, city: true },
    }),
  ])
  const slugs = new Map(hoefe.map((h) => [h.id, h.slug]))
  return {
    zeilen: zeilen.map((z) => {
      const zeile = alsZeile(z, slugs)
      return {
        id: z.id,
        art: z.art,
        sichtbar: z.sichtbar,
        block: zeile?.art === 'BLOCK' && z.block ? { ...zeile.block, farmIds: z.block.farmIds } : null,
      }
    }),
    hoefe: hoefe.map((h) => ({
      id: h.id,
      hof: {
        slug: h.slug,
        name: h.name,
        ort: `${h.postalCode} ${h.city}`.trim(),
        abholung: null,
        abholungIstTermin: false,
        angebot: '',
        foto: null,
        lage: null,
      },
    })),
  }
}
