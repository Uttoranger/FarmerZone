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
import {
  fassungAusEntwurf,
  hofKennungen,
  mussFrischLesen,
  ordneFassungen,
  standardFassung,
  zeilenAusFassung,
  type EntwurfZeile,
} from '@/lib/startseite-fassung'
import { fassungInhaltSchema, type FassungInhalt } from '@/schemas/startseite-fassung'
import type { VorschauQuelle } from '@/schemas/startseite'
import type { StartseitenHof } from '@/lib/startseite'
import { OEFFENTLICH_SICHTBAR } from '@/server/queries/farm'

/*
 * Die Startseite lesen (Register N16; seit Nr. 99 Entwurf und Fassung).
 *
 * LIVE ist die jüngste nicht zurückgezogene Fassung mit liveAb ≤ jetzt —
 * verglichen hier, beim Lesen, kein Cron. Ohne Fassung (oder mit einer
 * unlesbaren) die Standard-Reihenfolge: genau der Stand vor Nr. 99, darum
 * gibt es keinen Seed. Der ENTWURF sind die Tabellen StartseiteAbschnitt/
 * -Block; die öffentliche Seite liest sie nie. Live, jede Fassung und der
 * Entwurf werden über DENSELBEN Weg zu den Zeilen der Seite
 * (zeilenAusFassung), die gewählten Höfe aller Blöcke in höchstens einer
 * Abfrage — nie eine je Block.
 */

const ZEILE_MIT_BLOCK = {
  orderBy: [{ position: 'asc' }, { id: 'asc' }],
  include: { block: true },
} satisfies Prisma.StartseiteAbschnittFindManyArgs

type ZeileRoh = Prisma.StartseiteAbschnittGetPayload<typeof ZEILE_MIT_BLOCK>

/** Bei gleicher Zeit gilt die später angelegte — dieselbe Reihenfolge wie ordneFassungen. */
const NEUESTE_ZUERST = [{ liveAb: 'desc' }, { createdAt: 'desc' }] satisfies Prisma.StartseiteFassungOrderByWithRelationInput[]

/**
 * Der Inhalt einer gespeicherten Fassung — der einzige Weg, ihn zu lesen.
 * Ungültig heißt null und eine Meldung nach Sentry: nur die Kennung und wo
 * es hakt, nie der Inhalt (Texte des Admins).
 */
export function leseFassung(json: unknown, kennung: string): FassungInhalt | null {
  const gelesen = fassungInhaltSchema.safeParse(json)
  if (gelesen.success) return gelesen.data
  const erste = gelesen.error.issues[0]
  Sentry.captureMessage('Startseite: Fassung nicht lesbar', {
    level: 'error',
    tags: { bereich: 'startseite-fassung', fassung: kennung },
    extra: { stelle: erste?.path.join('.') ?? '', code: erste?.code ?? '' },
  })
  return null
}

/** Die Slugs der freigeschalteten Höfe zu allen gewählten Kennungen — eine Abfrage, ohne Höfe keine. */
async function hofSlugs(inhalte: readonly FassungInhalt[]): Promise<Map<string, string>> {
  const ids = hofKennungen(inhalte)
  if (ids.length === 0) return new Map()
  const hoefe = await prisma.farm.findMany({ where: { id: { in: ids }, ...OEFFENTLICH_SICHTBAR }, select: { id: true, slug: true } })
  return new Map(hoefe.map((h) => [h.id, h.slug]))
}

/** DER Weg vom Inhalt zu den Zeilen der Seite — Live, Fassung und Entwurf. */
export async function zeilenFuerSeite(inhalt: FassungInhalt): Promise<StartseitenZeile[]> {
  return zeilenAusFassung(inhalt, await hofSlugs([inhalt]))
}

function entwurfZeile(z: ZeileRoh): EntwurfZeile {
  const b = z.block
  return {
    art: z.art,
    sichtbar: z.sichtbar,
    block: b && {
      id: b.id,
      vorlage: b.vorlage,
      ueberzeile: b.ueberzeile,
      titel: b.titel,
      text: b.text,
      bildUrl: b.bildUrl,
      linkUrl: b.linkUrl,
      linkText: b.linkText,
      farmIds: b.farmIds,
      kategorie: b.kategorie,
      liveAb: b.liveAb.toISOString(),
      liveBis: b.liveBis?.toISOString() ?? null,
    },
  }
}

/** Der Entwurf im Format einer Fassung, frisch aus den Tabellen. `db` ist in „Veröffentlichen …" die Transaktion. */
export async function leseEntwurf(db: Pick<Prisma.TransactionClient, 'startseiteAbschnitt'> = prisma): Promise<FassungInhalt> {
  const zeilen = await db.startseiteAbschnitt.findMany(ZEILE_MIT_BLOCK)
  return fassungAusEntwurf(zeilen.map(entwurfZeile))
}

/** Die Fassung, die zu einem Zeitpunkt live ist (jetzt oder an einem Tag der Vorschau), oder null. */
async function leseFassungZu(zeitpunkt: Date): Promise<{ id: string; inhalt: FassungInhalt | null } | null> {
  const fassung = await prisma.startseiteFassung.findFirst({
    where: { liveAb: { lte: zeitpunkt }, zurueckgezogenAm: null },
    orderBy: NEUESTE_ZUERST,
    select: { id: true, inhalt: true },
  })
  return fassung && { id: fassung.id, inhalt: leseFassung(fassung.inhalt, fassung.id) }
}

/** Der Termin der nächsten geplanten Fassung nach `jetzt`, oder null. */
export async function naechsterTermin(jetzt: Date): Promise<Date | null> {
  const naechste = await prisma.startseiteFassung.findFirst({
    where: { liveAb: { gt: jetzt }, zurueckgezogenAm: null },
    orderBy: { liveAb: 'asc' },
    select: { liveAb: true },
  })
  return naechste?.liveAb ?? null
}

export type LiveStand = { zeilen: StartseitenZeile[]; naechsteAb: string | null }

/** Live zu `jetzt`, frisch an der Datenbank — samt dem Termin der nächsten Planung für den Cache. */
export async function leseLiveStand(jetzt: Date): Promise<LiveStand> {
  const live = await leseFassungZu(jetzt)
  const naechste = await naechsterTermin(jetzt)
  return { zeilen: await zeilenFuerSeite(live?.inhalt ?? standardFassung()), naechsteAb: naechste?.toISOString() ?? null }
}

// Eigener Schlüssel seit Nr. 99: Ein Eintrag aus der Zeit davor (eine Liste
// statt LiveStand) darf nach dem Deploy nicht als neuer gelesen werden.
const ladeGecacht = unstable_cache(() => leseLiveStand(new Date()), [STARTSEITE_CACHE_TAG, 'fassung-v1'], {
  revalidate: 300,
  tags: [STARTSEITE_CACHE_TAG],
})

/**
 * Die Zeilen der Startseite. Aus dem Datencache (fünf Minuten wie die Seite;
 * Veröffentlichen leert ihn) — außer der Termin der nächsten geplanten
 * Fassung ist erreicht: Dann frisch, bis der Eintrag erneuert ist
 * (mussFrischLesen), damit „bis zu 5 Minuten“ auch für Planungen stimmt. Bei
 * einem Lesefehler eine leere Liste — die Seite rendert dann die
 * Standard-Reihenfolge (zuRendern), statt der ganzen Startseite eine 500 zu
 * geben; beim Bau ohne Datenbank genauso. Der Fehler geht nach Sentry.
 */
export async function ladeStartseite(jetzt: Date = new Date()): Promise<StartseitenZeile[]> {
  try {
    const stand = await ladeGecacht()
    return mussFrischLesen(stand.naechsteAb, jetzt) ? (await leseLiveStand(jetzt)).zeilen : stand.zeilen
  } catch (err) {
    unstable_rethrow(err)
    Sentry.captureException(err, { tags: { bereich: 'startseite-liste' } })
    return []
  }
}

/**
 * Der Inhalt hinter einer Quelle der Vorschau: der Entwurf aus den Tabellen,
 * „live“ = die Fassung, die zum gewählten Tag live ist, oder eine bestimmte
 * Fassung (Zeitplan). Ohne Fassung bzw. unlesbar die Standard-Reihenfolge —
 * wie auf der echten Seite.
 */
export async function leseQuelle(quelle: VorschauQuelle, zeitpunkt: Date): Promise<FassungInhalt> {
  if (quelle === 'entwurf') return leseEntwurf()
  if (quelle === 'live') return (await leseFassungZu(zeitpunkt))?.inhalt ?? standardFassung()
  const id = quelle.slice('fassung:'.length)
  const fassung = await prisma.startseiteFassung.findUnique({ where: { id }, select: { inhalt: true } })
  return (fassung && leseFassung(fassung.inhalt, id)) ?? standardFassung()
}

/** Die Zeilen der Vorschau (nur im Draft Mode mit gültigem Link und Admin-Sitzung, src/app/page.tsx). */
export async function ladeVorschauZeilen({ quelle, datum }: { quelle: VorschauQuelle; datum: Date }): Promise<StartseitenZeile[]> {
  return zeilenFuerSeite(await leseQuelle(quelle, datum))
}

// ─── Admin › Startseite ─────────────────────────────────────────────────────

export type AdminStartseitenZeile = {
  id: string
  art: ZeileRoh['art']
  sichtbar: boolean
  block: (StartseitenBlockDaten & { farmIds: string[] }) | null
}

export type AdminHof = { id: string; hof: StartseitenHof }

/** Eine Fassung für Zeitplan und Verlauf — Zeiten als ISO-Text, wer sie angelegt hat als Name. */
export type AdminFassung = {
  id: string
  liveAb: string
  createdAt: string
  von: string | null
  inhalt: FassungInhalt
}

export type AdminStartseite = {
  zeilen: AdminStartseitenZeile[]
  /** Freigeschaltete, öffentlich sichtbare Höfe für die Höfe-Auswahl — Name und Ort. */
  hoefe: AdminHof[]
  live: AdminFassung | null
  geplant: AdminFassung[]
  frueher: (AdminFassung & { bis: string })[]
}

/** Die Zeilen des Entwurfs für die Liste — der Block mit seinen Kennungen der Höfe für das Formular. */
function adminZeilen(zeilen: readonly ZeileRoh[], slugs: ReadonlyMap<string, string>): AdminStartseitenZeile[] {
  const entwurf = zeilenAusFassung(fassungAusEntwurf(zeilen.map(entwurfZeile)), slugs)
  return zeilen.map((z) => {
    const zeile = z.block ? entwurf.find((e) => e.art === 'BLOCK' && e.block.id === z.block?.id) : undefined
    return {
      id: z.id,
      art: z.art,
      sichtbar: z.sichtbar,
      block: zeile?.art === 'BLOCK' && z.block ? { ...zeile.block, farmIds: z.block.farmIds } : null,
    }
  })
}

/** Nur die Liste des Entwurfs, frisch — nach „Als Entwurf übernehmen“ ersetzt der Browser damit seine. */
export async function ladeEntwurfAdmin(): Promise<AdminStartseitenZeile[]> {
  const zeilen = await prisma.startseiteAbschnitt.findMany(ZEILE_MIT_BLOCK)
  return adminZeilen(zeilen, await hofSlugs([fassungAusEntwurf(zeilen.map(entwurfZeile))]))
}

/** So viele erreichte Fassungen liest der Zeitplan: die Live-Fassung und der Verlauf davor. */
const ERREICHTE_HOECHSTENS = 50

const FASSUNG_ADMIN = { id: true, inhalt: true, liveAb: true, createdAt: true, erstelltVonUserId: true } satisfies Prisma.StartseiteFassungSelect

/**
 * Alles für Admin › Startseite, frisch (die Seite ist ohnehin dynamisch).
 * Planungen und erreichte Fassungen getrennt gelesen (Nacharbeit 99): die
 * Planungen alle, die erreichten höchstens 50 — so fällt die Live-Fassung nie
 * aus dem Vergleich, auch nicht hinter vielen Planungen.
 */
export async function ladeStartseiteAdmin(jetzt: Date): Promise<AdminStartseite> {
  const [zeilen, hoefe, planungen, erreicht] = await Promise.all([
    prisma.startseiteAbschnitt.findMany(ZEILE_MIT_BLOCK),
    prisma.farm.findMany({
      where: OEFFENTLICH_SICHTBAR,
      orderBy: { name: 'asc' },
      select: { id: true, slug: true, name: true, postalCode: true, city: true },
    }),
    prisma.startseiteFassung.findMany({ where: { zurueckgezogenAm: null, liveAb: { gt: jetzt } }, orderBy: NEUESTE_ZUERST, select: FASSUNG_ADMIN }),
    prisma.startseiteFassung.findMany({
      where: { zurueckgezogenAm: null, liveAb: { lte: jetzt } },
      orderBy: NEUESTE_ZUERST,
      take: ERREICHTE_HOECHSTENS,
      select: FASSUNG_ADMIN,
    }),
  ])
  const fassungen = [...planungen, ...erreicht]
  const personen = await prisma.user.findMany({
    where: { id: { in: [...new Set(fassungen.map((f) => f.erstelltVonUserId))] } },
    select: { id: true, name: true },
  })
  const namen = new Map(personen.map((p) => [p.id, p.name]))
  const { live, geplant, frueher } = ordneFassungen(
    fassungen.map(
      (f): AdminFassung => ({
        id: f.id,
        liveAb: f.liveAb.toISOString(),
        createdAt: f.createdAt.toISOString(),
        von: namen.get(f.erstelltVonUserId) ?? null,
        // Unlesbar zeigt die Startseite die Standard-Reihenfolge — der Zeitplan dasselbe.
        inhalt: leseFassung(f.inhalt, f.id) ?? standardFassung(),
      })
    ),
    jetzt
  )
  return {
    zeilen: adminZeilen(zeilen, new Map(hoefe.map((h) => [h.id, h.slug]))),
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
    live,
    geplant,
    frueher,
  }
}
