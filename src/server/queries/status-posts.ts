/**
 * Lesen rund um Beiträge (StatusPost): die Liste im Reiter „Beiträge", die
 * Beiträge der Hofseite (Register F8), die Vorlage für „Neuer Beitrag" und
 * die WhatsApp-Abonnentinnen samt Tipp-Liste (Register W1) — wer WhatsApp
 * vom Hof bekommt, steht hier EINMAL (`whatsAppAbonnentinnen`, als SQL für
 * setzeWhatsAppGetippt `whatsAppAbonnentinSql`).
 */
import { prisma } from '@/lib/prisma'
import { Prisma, type StatusPostAnlass } from '@prisma/client'
import type { Abonnentin } from '@/lib/whatsapp-versand'

export type StatusPostSummary = {
  id: string
  title: string
  body: string
  anlass: StatusPostAnlass
  photoUrl: string | null
  linkedProductIds: string[]
  publishedAt: string | null
  expiresAt: string | null
  showOnFarmPage: boolean
  sentViaEmail: boolean
  sentViaWhatsApp: boolean
  emailRecipientCount: number
  whatsappRecipientCount: number
  whatsappSentCount: number
  /** Register W1: wer geöffnet bekam (Abonnements-IDs) — daraus „WhatsApp · n von m". */
  whatsappGetippt: string[]
  createdAt: string
  isActive: boolean
  isDraft: boolean
}

export type ActiveStatusPost = {
  id: string
  title: string
  body: string
  anlass: StatusPostAnlass
  photoUrl: string | null
  linkedProductIds: string[]
  publishedAt: string
}

export async function getStatusPostsForFarm(farmId: string): Promise<StatusPostSummary[]> {
  const posts = await prisma.statusPost.findMany({
    where: { farmId },
    orderBy: { createdAt: 'desc' },
  })
  const now = new Date()
  return posts.map((p) => ({
    id: p.id,
    title: p.title,
    body: p.body,
    anlass: p.anlass,
    photoUrl: p.photoUrl,
    linkedProductIds: p.linkedProductIds,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    expiresAt: p.expiresAt?.toISOString() ?? null,
    showOnFarmPage: p.showOnFarmPage,
    sentViaEmail: p.sentViaEmail,
    sentViaWhatsApp: p.sentViaWhatsApp,
    emailRecipientCount: p.emailRecipientCount,
    whatsappRecipientCount: p.whatsappRecipientCount,
    whatsappSentCount: p.whatsappSentCount,
    whatsappGetippt: p.whatsappGetippt,
    createdAt: p.createdAt.toISOString(),
    isActive: !!p.publishedAt && (!p.expiresAt || p.expiresAt > now),
    isDraft: !p.publishedAt,
  }))
}

/**
 * Die Beiträge, die die Hofseite zeigt (Register F8): veröffentlicht, nicht
 * abgelaufen und mit „Auf der Hofseite zeigen“ — der neueste zuerst, höchstens
 * `anzahl`. Die Frist gilt hier beim Lesen, kein Cron räumt sie weg.
 */
export async function getActiveStatusPosts(farmId: string, anzahl: number): Promise<ActiveStatusPost[]> {
  const now = new Date()
  const posts = await prisma.statusPost.findMany({
    where: {
      farmId,
      publishedAt: { lte: now },
      showOnFarmPage: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    // Bei gleicher Veröffentlichungszeit entscheidet die Kennung: Die Reihenfolge
    // ist nie Zufall, und kein Beitrag springt zwischen zwei Aufrufen über die Grenze.
    orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
    take: anzahl,
    // Nur, was die Karte zeigt: Der Beitrag ist öffentlich, sein Versand (Empfänger, Zähler) nicht.
    select: { id: true, title: true, body: true, anlass: true, photoUrl: true, linkedProductIds: true, publishedAt: true },
  })
  return posts.map((post) => ({
    id: post.id,
    title: post.title,
    body: post.body,
    anlass: post.anlass,
    photoUrl: post.photoUrl,
    linkedProductIds: post.linkedProductIds,
    // Sicher: `publishedAt: { lte: now }` schließt Entwürfe (null) aus.
    publishedAt: post.publishedAt!.toISOString(),
  }))
}

// Vorlage-Muster (nachlese-6): lädt einen Alt-Status als Vorbefüllung für den
// Wizard. Ownership über den farmId-Scope — fremde oder ungültige IDs liefern
// null, der Wizard startet dann einfach leer (kein Fehler, kein Crash).
export type StatusTemplate = {
  anlass: StatusPostAnlass
  title: string
  body: string
  photoUrl: string | null
}

export async function getStatusTemplate(
  farmId: string,
  statusId: string | null | undefined
): Promise<StatusTemplate | null> {
  if (!statusId) return null
  const post = await prisma.statusPost.findFirst({
    where: { id: statusId, farmId },
    select: { anlass: true, title: true, body: true, photoUrl: true },
  })
  return post ?? null
}

/**
 * Wer WhatsApp vom Hof bekommt: Häkchen gesetzt und eine Nummer hinterlegt,
 * die nicht leer ist (`''` kam als „hinterlegt" durch, Nr. 75) — dieselbe
 * Bedingung für die Liste, die Zahl im Reiter „Beiträge" und das Teilen-Fenster.
 */
function whatsAppAbonnentinnen(farmId: string): Prisma.CustomerFarmSubscriptionWhereInput {
  return { farmId, optInWhatsApp: true, AND: [{ customerPhone: { not: null } }, { customerPhone: { not: '' } }] }
}

/**
 * Dieselbe Regel als SQL für eine Zeile von "CustomerFarmSubscription" — für
 * das EXISTS in setzeWhatsAppGetippt, das in EINER Anweisung schreibt (Nr. 75,
 * Defense in Depth): Eine E-Mail-Abonnentin lässt sich nicht als geöffnet
 * markieren. Wer die Regel oben ändert, ändert sie hier mit
 * (tests/integration/whatsapp-getippt.int.test.ts prüft beide).
 */
export function whatsAppAbonnentinSql(farmId: string): Prisma.Sql {
  return Prisma.sql`"farmId" = ${farmId} AND "optInWhatsApp" = true AND "customerPhone" IS NOT NULL AND "customerPhone" <> ''`
}

/**
 * Die Tipp-Liste eines eigenen Beitrags (fremde ID → null). Register W1: die
 * Empfängerinnen live beim Öffnen, nie die beim Veröffentlichen eingefrorene
 * Zahl, dazu, wer schon geöffnet bekam. Je Person gehen Abonnements-ID, Name
 * und Nummer an den Browser; ohne Bestellung beim Hof steht wie bisher die
 * Adresse als Name.
 */
export async function getStatusPostForWhatsApp(
  farmId: string,
  postId: string
): Promise<{
  id: string
  title: string
  body: string
  farm: { name: string; slug: string }
  getippt: string[]
  abonnentinnen: Abonnentin[]
} | null> {
  const post = await prisma.statusPost.findFirst({
    where: { id: postId, farmId },
    select: {
      id: true,
      title: true,
      body: true,
      whatsappGetippt: true,
      farm: { select: { name: true, slug: true } },
    },
  })
  if (!post) return null

  // Feste Reihenfolge: Wer später weitermacht, findet die Liste wie verlassen.
  const subscribers = await prisma.customerFarmSubscription.findMany({
    where: whatsAppAbonnentinnen(farmId),
    select: { id: true, customerEmail: true, customerPhone: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })

  const nameMap = await prisma.order
    .findMany({
      where: { farmId, customerEmail: { in: subscribers.map((s) => s.customerEmail) } },
      select: { customerEmail: true, customerName: true },
      orderBy: { createdAt: 'desc' },
      distinct: ['customerEmail'],
    })
    .then((rows) => new Map(rows.map((r) => [r.customerEmail.toLowerCase(), r.customerName])))

  const { whatsappGetippt, ...beitrag } = post
  return {
    ...beitrag,
    getippt: whatsappGetippt,
    abonnentinnen: subscribers.map((s) => ({
      id: s.id,
      name: nameMap.get(s.customerEmail.toLowerCase()) ?? s.customerEmail,
      // Sicher: whatsAppAbonnentinnen verlangt customerPhone: { not: null }.
      phone: s.customerPhone!,
    })),
  }
}

/**
 * Wie viele heutige Abonnentinnen der Hof per WhatsApp erreicht — das „m" im
 * Knopf „WhatsApp · n von m" (Register W1), einmal je Seitenaufruf geladen.
 */
export async function zaehleWhatsAppAbonnentinnen(farmId: string): Promise<number> {
  return prisma.customerFarmSubscription.count({ where: whatsAppAbonnentinnen(farmId) })
}
