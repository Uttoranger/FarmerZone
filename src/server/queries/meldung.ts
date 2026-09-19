import { prisma } from '@/lib/prisma'
import { EXPORT_AUSWAHL, type ExportMeldung } from '@/lib/briefkasten-export'
import {
  STATUS_ABGESCHLOSSEN,
  STATUS_OFFEN,
  ersteZeile,
  fuerHof,
  istMeldungArt,
  istMeldungStatus,
  kurznummer,
  liegedauerGrenze,
  type MeldungArt,
  type MeldungFuerHof,
  type MeldungStatus,
} from '@/lib/meldung'

/**
 * Lesezugriffe des Fehlerbriefkastens. Zwei Sichten, streng getrennt:
 *   HOF    nur eigene Meldungen (farmId der Sitzung, hart in der Query), nur
 *          die Felder der Sichtbarkeitsregel (fuerHof) — auch bei Zugriff per ID.
 *   ADMIN  alles, samt Triage-Feldern.
 */

// ─── Hof ────────────────────────────────────────────────────────────────────

export async function getMeldungenFuerHof(farmId: string): Promise<MeldungFuerHof[]> {
  const zeilen = await prisma.meldung.findMany({
    where: { farmId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, art: true, text: true, createdAt: true, status: true, antwortAnMelder: true },
  })
  return zeilen.map(fuerHof)
}

/** Eine einzelne eigene Meldung — eine fremde ID liefert null, keinen Fehler. */
export async function getMeldungFuerHof(farmId: string, id: string): Promise<MeldungFuerHof | null> {
  const zeile = await prisma.meldung.findFirst({
    where: { id, farmId },
    select: { id: true, art: true, text: true, createdAt: true, status: true, antwortAnMelder: true },
  })
  return zeile ? fuerHof(zeile) : null
}

// ─── Admin ──────────────────────────────────────────────────────────────────

export type AdminMeldungZeile = {
  id: string
  kurznummer: string
  art: MeldungArt
  status: MeldungStatus
  createdAt: Date
  hofName: string | null
  customerEmail: string | null
  ersteZeile: string
  diagKennung: string | null
  clusterKey: string | null
}

export type AdminMeldungFilter = { status: MeldungStatus[]; art: MeldungArt | null }

/** Filter aus Suchparametern — unbekannte Werte fallen still weg, leer = Voreinstellung. */
export function filterAusParametern(params: { status?: string; art?: string }): AdminMeldungFilter {
  const status = (params.status ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(istMeldungStatus)
  return {
    status: status.length > 0 ? status : [...STATUS_OFFEN],
    art: istMeldungArt(params.art) ? params.art : null,
  }
}

export async function getMeldungenFuerAdmin(filter: AdminMeldungFilter): Promise<AdminMeldungZeile[]> {
  const zeilen = await prisma.meldung.findMany({
    where: { status: { in: filter.status }, ...(filter.art ? { art: filter.art } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      art: true,
      status: true,
      createdAt: true,
      customerEmail: true,
      text: true,
      diagKennung: true,
      clusterKey: true,
      farm: { select: { name: true } },
    },
  })
  return zeilen.map((z) => ({
    id: z.id,
    kurznummer: kurznummer(z.id),
    art: z.art,
    status: z.status,
    createdAt: z.createdAt,
    hofName: z.farm?.name ?? null,
    customerEmail: z.customerEmail,
    ersteZeile: ersteZeile(z.text),
    diagKennung: z.diagKennung,
    clusterKey: z.clusterKey,
  }))
}

/**
 * Alle Felder für den Markdown-Export (Leseroute /api/triage/export, Sprint
 * triage-leseroute). Dieselbe Auswahl wie der Datenbank-Weg des CLI
 * (EXPORT_AUSWAHL), derselbe Filter wie die Admin-Liste — aber ohne deren
 * Projektion und ohne `take`: der Export ist der ganze Briefkasten. Nur lesend.
 */
export async function getMeldungenFuerExport(filter: AdminMeldungFilter): Promise<ExportMeldung[]> {
  return prisma.meldung.findMany({
    where: { status: { in: filter.status }, ...(filter.art ? { art: filter.art } : {}) },
    orderBy: { createdAt: 'desc' },
    select: EXPORT_AUSWAHL,
  })
}

export type AdminMeldungDetail = {
  id: string
  kurznummer: string
  art: MeldungArt
  status: MeldungStatus
  text: string
  createdAt: Date
  seiteUrl: string
  userAgent: string
  viewport: string
  customerEmail: string | null
  screenshotUrl: string | null
  diagKennung: string | null
  clusterKey: string | null
  triageNotiz: string | null
  duplikatVonId: string | null
  sprintName: string | null
  triagedAt: Date | null
  antwortAnMelder: string | null
  farm: { id: string; name: string; slug: string } | null
}

/** Detail für den Admin — per voller ID oder Kurznummer (Präfix). */
export async function getMeldungDetail(idOderKurz: string): Promise<AdminMeldungDetail | null> {
  const zeile = await prisma.meldung.findFirst({
    where: idOderKurz.length >= 20 ? { id: idOderKurz } : { id: { startsWith: idOderKurz } },
    include: { farm: { select: { id: true, name: true, slug: true } } },
  })
  if (!zeile) return null
  return { ...zeile, kurznummer: kurznummer(zeile.id) }
}

export async function zaehleNeueMeldungen(): Promise<number> {
  return prisma.meldung.count({ where: { status: 'NEU' } })
}

// ─── Wünsche, gebündelt ─────────────────────────────────────────────────────

export type WunschCluster = {
  /** null = noch keinem Bündel zugeordnet */
  clusterKey: string | null
  anzahl: number
  /** Die jüngsten Meldungen des Bündels, erste Zeile — als Anhalt, worum es geht. */
  beispiele: Array<{ id: string; kurznummer: string; ersteZeile: string; hofName: string | null; createdAt: Date }>
}

/**
 * Die gezählte Wunschliste: Wunsch-Meldungen nach clusterKey gebündelt, größte
 * Bündel zuerst, das Bündel „ohne Cluster" ganz unten. Rein, damit die
 * Bündelung ohne Datenbank prüfbar ist. Kein Automatismus daraus — die Liste
 * ist Grundlage einer Produktentscheidung, nicht ihr Ersatz.
 */
export function gruppiereWuensche(
  wuensche: readonly { id: string; text: string; clusterKey: string | null; createdAt: Date; hofName: string | null }[],
  beispieleJeCluster = 3
): WunschCluster[] {
  const buendel = new Map<string | null, WunschCluster>()
  const sortiert = [...wuensche].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  for (const w of sortiert) {
    const key = w.clusterKey && w.clusterKey.trim() !== '' ? w.clusterKey.trim() : null
    const eintrag = buendel.get(key) ?? { clusterKey: key, anzahl: 0, beispiele: [] }
    eintrag.anzahl += 1
    if (eintrag.beispiele.length < beispieleJeCluster) {
      eintrag.beispiele.push({
        id: w.id,
        kurznummer: kurznummer(w.id),
        ersteZeile: ersteZeile(w.text),
        hofName: w.hofName,
        createdAt: w.createdAt,
      })
    }
    buendel.set(key, eintrag)
  }
  return [...buendel.values()].sort((a, b) => {
    if (a.clusterKey === null) return 1
    if (b.clusterKey === null) return -1
    return b.anzahl - a.anzahl || a.clusterKey.localeCompare(b.clusterKey)
  })
}

export async function getWunschCluster(): Promise<WunschCluster[]> {
  const zeilen = await prisma.meldung.findMany({
    where: { art: 'WUNSCH', status: { not: 'DUPLIKAT' } },
    select: { id: true, text: true, clusterKey: true, createdAt: true, farm: { select: { name: true } } },
  })
  return gruppiereWuensche(zeilen.map((z) => ({ ...z, hofName: z.farm?.name ?? null })))
}

// ─── Wochenlauf ─────────────────────────────────────────────────────────────

export type WochenZaehler = {
  neu: number
  liegenGeblieben: number
  offen: number
  /** Die jüngsten neuen Meldungen für die Zusammenfassung. */
  neueste: Array<{ kurznummer: string; art: MeldungArt; ersteZeile: string; hofName: string | null }>
}

export async function zaehleFuerWochenlauf(jetzt: Date): Promise<WochenZaehler> {
  const [neu, liegenGeblieben, offen, neueste] = await Promise.all([
    prisma.meldung.count({ where: { status: 'NEU' } }),
    prisma.meldung.count({ where: { status: { in: [...STATUS_OFFEN] }, createdAt: { lt: liegedauerGrenze(jetzt) } } }),
    prisma.meldung.count({ where: { status: { in: [...STATUS_OFFEN] } } }),
    prisma.meldung.findMany({
      where: { status: 'NEU' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, art: true, text: true, farm: { select: { name: true } } },
    }),
  ])
  return {
    neu,
    liegenGeblieben,
    offen,
    neueste: neueste.map((m) => ({
      kurznummer: kurznummer(m.id),
      art: m.art,
      ersteZeile: ersteZeile(m.text),
      hofName: m.farm?.name ?? null,
    })),
  }
}

/** Alle abgeschlossenen Meldungen — die reine Auswahl (waehleZuLoeschende) entscheidet. */
export async function findeLoeschKandidaten() {
  return prisma.meldung.findMany({
    where: { status: { in: [...STATUS_ABGESCHLOSSEN] } },
    select: { id: true, status: true, triagedAt: true, createdAt: true, screenshotUrl: true },
  })
}

export async function loescheMeldungen(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  const result = await prisma.meldung.deleteMany({ where: { id: { in: ids } } })
  return result.count
}
