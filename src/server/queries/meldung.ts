import { prisma } from '@/lib/prisma'
import { EXPORT_AUSWAHL, EXPORT_MAX, type ExportMeldung } from '@/lib/briefkasten-export'
import {
  STATUS_ABGESCHLOSSEN,
  STATUS_OFFEN,
  STATUS_ZU_ENTSCHEIDEN,
  buendelStandVon,
  ersteZeile,
  fuerHof,
  istMeldungArt,
  istMeldungStatus,
  kurznummer,
  liegedauerGrenze,
  type AblaufMeldung,
  type BuendelStand,
  type HauptmeldungAbschluss,
  type MeldungArt,
  type MeldungFuerHof,
  type MeldungStand,
  type MeldungStatus,
} from '@/lib/meldung'

/**
 * Lesezugriffe des Fehlerbriefkastens. Zwei Sichten, streng getrennt:
 *   HOF    nur eigene Meldungen (farmId der Sitzung, hart in der Query), nur
 *          die Felder der Sichtbarkeitsregel (fuerHof) — auch bei Zugriff per ID.
 *   ADMIN  alles, samt Triage-Feldern.
 */

// ─── Hof ────────────────────────────────────────────────────────────────────

const HOF_AUSWAHL = { id: true, art: true, text: true, createdAt: true, status: true, antwortAnMelder: true, duplikatVonId: true } as const

/**
 * Stand und Art der Hauptmeldungen der eigenen Duplikate (Register N14,
 * Ergänzung; Nr. 101): Die Hof-Sicht zeigt „Bereits bekannt · Behoben", sobald
 * die Hauptmeldung erledigt ist. Nur diese zwei Felder — nie ihr Text, nie
 * ihr Hof; die Kennung verlässt die Abfrage nicht (fuerHof ist eine Allowlist).
 */
async function hauptmeldungenFuer(zeilen: readonly { status: MeldungStatus; duplikatVonId: string | null }[]): Promise<Map<string, MeldungStand>> {
  const ids = [...new Set(zeilen.flatMap((z) => (z.status === 'DUPLIKAT' && z.duplikatVonId ? [z.duplikatVonId] : [])))]
  if (ids.length === 0) return new Map()
  const haupt = await prisma.meldung.findMany({ where: { id: { in: ids } }, select: { id: true, status: true, art: true } })
  return new Map(haupt.map((h) => [h.id, { status: h.status, art: h.art }]))
}

export async function getMeldungenFuerHof(farmId: string): Promise<MeldungFuerHof[]> {
  const zeilen = await prisma.meldung.findMany({
    where: { farmId },
    orderBy: { createdAt: 'desc' },
    select: HOF_AUSWAHL,
  })
  const haupt = await hauptmeldungenFuer(zeilen)
  return zeilen.map((z) => fuerHof(z, z.duplikatVonId ? (haupt.get(z.duplikatVonId) ?? null) : null))
}

/** Eine einzelne eigene Meldung — eine fremde ID liefert null, keinen Fehler. */
export async function getMeldungFuerHof(farmId: string, id: string): Promise<MeldungFuerHof | null> {
  const zeile = await prisma.meldung.findFirst({
    where: { id, farmId },
    select: HOF_AUSWAHL,
  })
  if (!zeile) return null
  const haupt = await hauptmeldungenFuer([zeile])
  return fuerHof(zeile, zeile.duplikatVonId ? (haupt.get(zeile.duplikatVonId) ?? null) : null)
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
  sprintName: string | null
  /** Für die Zeile „woher" (Nr. 22f) — gezeigt nur als Pfad bzw. Gerät in Worten. */
  seiteUrl: string
  userAgent: string
}

export type AdminMeldungFilter = { status: MeldungStatus[]; art: MeldungArt | null }

/**
 * Filter aus Suchparametern — unbekannte Werte fallen still weg, leer =
 * Voreinstellung. Export und CLI nehmen die offene Arbeit, die Admin-Liste
 * startet bei „Zu entscheiden".
 */
export function filterAusParametern(
  params: { status?: string; art?: string },
  voreinstellung: readonly MeldungStatus[] = STATUS_OFFEN
): AdminMeldungFilter {
  const status = (params.status ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(istMeldungStatus)
  return {
    status: status.length > 0 ? status : [...voreinstellung],
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
      sprintName: true,
      seiteUrl: true,
      userAgent: true,
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
    sprintName: z.sprintName,
    seiteUrl: z.seiteUrl,
    userAgent: z.userAgent,
  }))
}

/**
 * Meldungen je Status — die Zahlen hinter den Filtern des Briefkastens
 * (Nr. 22f). Eine gruppierte Abfrage über den Index auf status; mit Art-Filter
 * zählt sie nur diese Art, damit Chip und Liste dasselbe sagen.
 */
export async function zaehleMeldungenJeStatus(art: MeldungArt | null): Promise<Partial<Record<MeldungStatus, number>>> {
  const gruppen = await prisma.meldung.groupBy({
    by: ['status'],
    where: art ? { art } : {},
    _count: { _all: true },
  })
  const zahlen: Partial<Record<MeldungStatus, number>> = {}
  for (const g of gruppen) zahlen[g.status] = g._count._all
  return zahlen
}

/**
 * Die Nachbarn einer Meldung für „‹ Vorige" und „Nächste ›" (Nr. 22f): über
 * ALLE Meldungen, neueste zuerst — der Filter des Briefkastens gilt hier
 * nicht (das Detail kennt ihn nicht). Die vorige ist die nächst jüngere, die
 * nächste die nächst ältere; bei gleichem Zeitpunkt entscheidet die Kennung,
 * damit keine übersprungen wird. Nur Kennungen, nichts zum Anzeigen.
 */
export async function getMeldungNachbarn(meldung: { id: string; createdAt: Date }): Promise<{ vorige: string | null; naechste: string | null }> {
  const zeit = meldung.createdAt
  const [juenger, aelter] = await Promise.all([
    prisma.meldung.findFirst({
      where: { OR: [{ createdAt: { gt: zeit } }, { createdAt: zeit, id: { gt: meldung.id } }] },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    }),
    prisma.meldung.findFirst({
      where: { OR: [{ createdAt: { lt: zeit } }, { createdAt: zeit, id: { lt: meldung.id } }] },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
    }),
  ])
  return { vorige: juenger?.id ?? null, naechste: aelter?.id ?? null }
}

/**
 * Alle Felder für den Markdown-Export (Leseroute /api/triage/export, Sprint
 * triage-leseroute). Dieselbe Auswahl wie der Datenbank-Weg des CLI
 * (EXPORT_AUSWAHL), derselbe Filter wie die Admin-Liste. Höchstens
 * EXPORT_MAX + 1 Zeilen: die eine mehr sagt dem Export, dass er kappen und
 * es dazuschreiben muss (Sprint Briefkasten-Rückkopplung). Nur lesend.
 */
export async function getMeldungenFuerExport(filter: AdminMeldungFilter): Promise<ExportMeldung[]> {
  return prisma.meldung.findMany({
    where: { status: { in: filter.status }, ...(filter.art ? { art: filter.art } : {}) },
    orderBy: { createdAt: 'desc' },
    take: EXPORT_MAX + 1,
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

/**
 * Was auf eine Entscheidung wartet: Neues und die Wunsch-Vorschläge der KI —
 * der Zähler auf /admin und am Menüpunkt „Admin". Nutzt den Index auf status.
 */
export async function zaehleZuEntscheiden(): Promise<number> {
  return prisma.meldung.count({ where: { status: { in: [...STATUS_ZU_ENTSCHEIDEN] } } })
}

// ─── Ablauf im Reiter „Meldungen" (Register N14, Ergänzung; Nr. 101) ─────

/**
 * Alle Meldungen für den Ablauf — das Stand-Band zählt über alle, also ohne
 * Grenze: Abgeschlossenes löscht der Wochenlauf nach 90 Tagen, die Liste
 * bleibt klein. Der Text verlässt die Abfrage nur als erste Zeile.
 */
export async function ladeMeldungenAblauf(): Promise<AblaufMeldung[]> {
  const zeilen = await prisma.meldung.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      art: true,
      status: true,
      createdAt: true,
      triagedAt: true,
      text: true,
      farmId: true,
      customerEmail: true,
      clusterKey: true,
      sprintName: true,
      duplikatVonId: true,
      screenshotUrl: true,
      diagKennung: true,
      triageNotiz: true,
      antwortAnMelder: true,
      farm: { select: { name: true } },
    },
  })
  return zeilen.map(({ text, farm, screenshotUrl, ...z }) => ({
    ...z,
    ersteZeile: ersteZeile(text),
    hofName: farm?.name ?? null,
    screenshot: screenshotUrl !== null && screenshotUrl !== '',
  }))
}

/** Die Duplikate einer Hauptmeldung — für „Woraus" in Meldung entscheiden. Nur Kurztitel, Wer und Zeit. */
export async function getDuplikateVon(hauptmeldungId: string): Promise<Array<{ id: string; kurznummer: string; ersteZeile: string; hofName: string | null; createdAt: Date }>> {
  const zeilen = await prisma.meldung.findMany({
    where: { status: 'DUPLIKAT', duplikatVonId: hauptmeldungId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, text: true, createdAt: true, farm: { select: { name: true } } },
  })
  return zeilen.map((z) => ({ id: z.id, kurznummer: kurznummer(z.id), ersteZeile: ersteZeile(z.text), hofName: z.farm?.name ?? null, createdAt: z.createdAt }))
}

// ─── Wünsche, gebündelt ─────────────────────────────────────────────────────

export type WunschMeldung = {
  id: string
  kurznummer: string
  ersteZeile: string
  hofName: string | null
  createdAt: Date
  status: MeldungStatus
  /** true = ein Duplikat, das über seine Hauptmeldung in diesem Bündel zählt. */
  duplikat: boolean
}

export type WunschCluster = {
  /** null = noch keinem Bündel zugeordnet */
  clusterKey: string | null
  /** Meldungen samt Duplikaten. */
  anzahl: number
  /** Verschiedene Höfe und Kundinnen (Register N14) — derselbe Hof zweimal zählt einmal. */
  stimmen: number
  hoefe: number
  kundinnen: number
  /** Kundinnen, die eine Adresse für Rückfragen angegeben haben — nur sie bekommen einen Bescheid per E-Mail. */
  kundinnenMitAdresse: number
  duplikate: number
  erste: Date
  letzte: Date
  /** Der gemeinsame Stand der Meldungen ohne Duplikate, sonst „gemischt". */
  stand: BuendelStand
  /** Mindestens eine Meldung (ohne Duplikate) ist noch nicht abgeschlossen. */
  offen: boolean
  /** Der gemeinsame Sprintname („Nr. 97"), sonst null. */
  sprintName: string | null
  /** Alle Meldungen, neueste zuerst — für „Woraus". */
  meldungen: WunschMeldung[]
  /** Die jüngsten Meldungen des Bündels, erste Zeile — als Anhalt, worum es geht. */
  beispiele: Array<{ id: string; kurznummer: string; ersteZeile: string; hofName: string | null; createdAt: Date }>
}

export type WunschRoh = {
  id: string
  art: MeldungArt
  text: string
  clusterKey: string | null
  createdAt: Date
  hofName: string | null
  farmId: string | null
  customerEmail: string | null
  status: MeldungStatus
  duplikatVonId: string | null
  sprintName: string | null
}

/** Wer eine Stimme ist: der Hof, sonst die Adresse der Kundin, sonst die Meldung selbst (Kundin ohne Adresse). */
function melderVon(w: WunschRoh): string {
  if (w.farmId) return `hof:${w.farmId}`
  if (w.customerEmail) return `kundin:${w.customerEmail.trim().toLowerCase()}`
  return `meldung:${w.id}`
}

/**
 * Die gezählte Wunschliste (Register N14, Ergänzung; Nr. 101): Wunsch-Meldungen
 * nach Stichwort gebündelt. Gezählt werden STIMMEN — verschiedene Melder
 * (Hof, sonst Adresse der Kundin, sonst die Meldung) —, Duplikate zählen beim
 * Stichwort ihrer Hauptmeldung mit. Offene Bündel zuerst, dann nach Stimmen,
 * das Bündel „ohne Stichwort" ganz unten. Rein, damit es ohne Datenbank
 * prüfbar ist; kein Automatismus daraus — die Liste ist Grundlage einer
 * Produktentscheidung, nicht ihr Ersatz.
 */
export function gruppiereWuensche(meldungen: readonly WunschRoh[], beispieleJeCluster = 3): WunschCluster[] {
  const wuensche = meldungen.filter((m) => m.art === 'WUNSCH' && m.status !== 'DUPLIKAT')
  const nachId = new Map(wuensche.map((w) => [w.id, w]))
  const buendel = new Map<string | null, { eigene: WunschRoh[]; duplikate: WunschRoh[] }>()
  const keyVon = (w: WunschRoh): string | null => (w.clusterKey && w.clusterKey.trim() !== '' ? w.clusterKey.trim() : null)
  for (const w of wuensche) {
    const key = keyVon(w)
    const eintrag = buendel.get(key) ?? { eigene: [], duplikate: [] }
    eintrag.eigene.push(w)
    buendel.set(key, eintrag)
  }
  for (const d of meldungen) {
    const haupt = d.status === 'DUPLIKAT' && d.duplikatVonId ? nachId.get(d.duplikatVonId) : undefined
    if (haupt) buendel.get(keyVon(haupt))?.duplikate.push(d)
  }

  const cluster: WunschCluster[] = [...buendel.entries()].map(([clusterKey, { eigene, duplikate }]) => {
    const alle = [...eigene, ...duplikate].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    const melder = new Set(alle.map(melderVon))
    const hoefe = [...melder].filter((m) => m.startsWith('hof:')).length
    const sprints = new Set(eigene.map((w) => w.sprintName?.trim() || null))
    const [sprint] = [...sprints]
    const zeiten = alle.map((w) => w.createdAt.getTime())
    return {
      clusterKey,
      anzahl: alle.length,
      stimmen: melder.size,
      hoefe,
      kundinnen: melder.size - hoefe,
      kundinnenMitAdresse: [...melder].filter((m) => m.startsWith('kundin:')).length,
      duplikate: duplikate.length,
      erste: new Date(Math.min(...zeiten)),
      letzte: new Date(Math.max(...zeiten)),
      stand: buendelStandVon(eigene.map((w) => w.status)),
      offen: eigene.some((w) => !STATUS_ABGESCHLOSSEN.includes(w.status)),
      sprintName: sprints.size === 1 ? (sprint ?? null) : null,
      meldungen: alle.map((w) => ({
        id: w.id,
        kurznummer: kurznummer(w.id),
        ersteZeile: ersteZeile(w.text),
        hofName: w.hofName,
        createdAt: w.createdAt,
        status: w.status,
        duplikat: w.status === 'DUPLIKAT',
      })),
      beispiele: eigene
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, beispieleJeCluster)
        .map((w) => ({ id: w.id, kurznummer: kurznummer(w.id), ersteZeile: ersteZeile(w.text), hofName: w.hofName, createdAt: w.createdAt })),
    }
  })
  return cluster.sort((a, b) => {
    if (a.clusterKey === null) return 1
    if (b.clusterKey === null) return -1
    return Number(b.offen) - Number(a.offen) || b.stimmen - a.stimmen || a.clusterKey.localeCompare(b.clusterKey)
  })
}

/** Wünsche samt aller Duplikate (deren Hauptmeldung entscheidet, ob sie zählen). */
export async function getWunschCluster(): Promise<WunschCluster[]> {
  const zeilen = await prisma.meldung.findMany({
    where: { OR: [{ art: 'WUNSCH', status: { not: 'DUPLIKAT' } }, { status: 'DUPLIKAT' }] },
    select: {
      id: true,
      art: true,
      text: true,
      clusterKey: true,
      createdAt: true,
      farmId: true,
      customerEmail: true,
      status: true,
      duplikatVonId: true,
      sprintName: true,
      farm: { select: { name: true } },
    },
  })
  return gruppiereWuensche(zeilen.map(({ farm, ...z }) => ({ ...z, hofName: farm?.name ?? null })))
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
    select: { id: true, status: true, triagedAt: true, createdAt: true, screenshotUrl: true, duplikatVonId: true },
  })
}

/**
 * Status und Abschluss der Hauptmeldungen (Register N14, Ergänzung; Nr. 101):
 * die zweite Abfrage des Wochenlaufs — ein Duplikat geht erst mit seiner
 * Hauptmeldung. Eine fehlende Kennung fehlt in der Karte (dann gilt die Regel
 * für das Duplikat allein).
 */
export async function findeHauptmeldungen(ids: readonly string[]): Promise<Map<string, HauptmeldungAbschluss>> {
  if (ids.length === 0) return new Map()
  const zeilen = await prisma.meldung.findMany({
    where: { id: { in: [...new Set(ids)] } },
    select: { id: true, status: true, triagedAt: true, createdAt: true },
  })
  return new Map(zeilen.map(({ id, ...abschluss }) => [id, abschluss]))
}

export async function loescheMeldungen(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  const result = await prisma.meldung.deleteMany({ where: { id: { in: ids } } })
  return result.count
}
