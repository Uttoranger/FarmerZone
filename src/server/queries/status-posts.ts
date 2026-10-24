/**
 * Lesen rund um Beiträge (StatusPost): die Liste im Reiter „Beiträge", die
 * Beiträge der Hofseite (Register F8: „Aktuell vom Hof“, AKTIVER_BEITRAG,
 * `?beitrag=`), die Vorlage für „Neuer Beitrag" und
 * die WhatsApp-Abonnentinnen samt Tipp-Liste (Register W1) — wer WhatsApp
 * vom Hof bekommt, steht hier EINMAL (`whatsAppAbonnentinnen`, als SQL für
 * setzeWhatsAppGetippt `whatsAppAbonnentinSql`).
 */
import { prisma } from '@/lib/prisma'
import { Prisma, type StatusPostAnlass } from '@prisma/client'
import type { Abonnentin } from '@/lib/whatsapp-versand'
import { leseAusschnitt, type BildAusschnitt } from '@/schemas/bild-ausschnitt'
import { gesendeteBeitragsMails } from '@/server/mail-arten/beitrag'

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
  /** Ausschnitt und Filter des Fotos (Register N17, Nr. 98) — schon geprüft; null = das Foto steht ganz wie heute. */
  fotoAusschnitt: BildAusschnitt | null
  linkedProductIds: string[]
  publishedAt: string
}

export async function getStatusPostsForFarm(farmId: string): Promise<StatusPostSummary[]> {
  const posts = await prisma.statusPost.findMany({
    where: { farmId },
    orderBy: { createdAt: 'desc' },
  })
  // „n per E-Mail" aus der Warteschlange — eine Quelle (Nr. 159).
  const gesendet = await gesendeteBeitragsMails(posts)
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
    emailRecipientCount: gesendet.get(p.id) ?? p.emailRecipientCount,
    whatsappRecipientCount: p.whatsappRecipientCount,
    whatsappSentCount: p.whatsappSentCount,
    whatsappGetippt: p.whatsappGetippt,
    createdAt: p.createdAt.toISOString(),
    isActive: !!p.publishedAt && (!p.expiresAt || p.expiresAt > now),
    isDraft: !p.publishedAt,
  }))
}

/**
 * Ein aktiver Beitrag (Register F8) — EINE Bedingung für die Hofseite
 * („Aktuell vom Hof“, `?beitrag=`) und alles, was Beiträge außerhalb zeigt
 * (Nr. 129: Marke auf /hoefe, „Neu bei den Höfen“): veröffentlicht, nicht
 * abgelaufen und „Auf der Hofseite zeigen“. Die Frist gilt beim Lesen, kein
 * Cron räumt sie weg — darum mit dem Zeitpunkt der Anfrage.
 *
 * Die Form trägt ein eigenes `OR`: neben einer eigenen Bedingung mit `OR`
 * nicht ausbreiten, sondern als Element einer `AND`-Liste nehmen.
 */
export const AKTIVER_BEITRAG = (jetzt: Date): Prisma.StatusPostWhereInput => ({
  publishedAt: { lte: jetzt },
  showOnFarmPage: true,
  OR: [{ expiresAt: null }, { expiresAt: { gt: jetzt } }],
})

/**
 * Die Reihenfolge der aktiven Beiträge, der neueste zuerst. Bei gleicher
 * Veröffentlichungszeit entscheidet die Kennung: Die Reihenfolge ist nie Zufall,
 * und kein Beitrag springt zwischen zwei Aufrufen über die Grenze. EINE Fassung
 * für alle, die „den neuesten“ Beitrag nennen (Hofseite, Heute, Mein Hof, Marke
 * auf /hoefe, „Neu bei den Höfen“) — sonst nennt bei Gleichstand eine Stelle
 * einen anderen Beitrag als den, der oben auf der Hofseite steht.
 */
export const NEUESTER_BEITRAG_ZUERST: Prisma.StatusPostOrderByWithRelationInput[] = [{ publishedAt: 'desc' }, { id: 'desc' }]

/** Nur, was die Karte zeigt: Der Beitrag ist öffentlich, sein Versand (Empfänger, Zähler) nicht. */
const HOFSEITE_BEITRAG_SELECT = {
  id: true,
  title: true,
  body: true,
  anlass: true,
  photoUrl: true,
  fotoAusschnitt: true,
  linkedProductIds: true,
  publishedAt: true,
} satisfies Prisma.StatusPostSelect

type HofseiteBeitragRoh = Prisma.StatusPostGetPayload<{ select: typeof HOFSEITE_BEITRAG_SELECT }>

function alsHofseitenBeitrag(post: HofseiteBeitragRoh): ActiveStatusPost {
  return {
    id: post.id,
    title: post.title,
    body: post.body,
    anlass: post.anlass,
    photoUrl: post.photoUrl,
    fotoAusschnitt: leseAusschnitt(post.fotoAusschnitt),
    linkedProductIds: post.linkedProductIds,
    // Sicher: AKTIVER_BEITRAG verlangt `publishedAt: { lte: jetzt }` und schließt Entwürfe (null) aus.
    publishedAt: post.publishedAt!.toISOString(),
  }
}

/**
 * Die Beiträge, die die Hofseite zeigt (Register F8): aktiv nach
 * AKTIVER_BEITRAG — der neueste zuerst, höchstens `anzahl`.
 */
export async function getActiveStatusPosts(farmId: string, anzahl: number): Promise<ActiveStatusPost[]> {
  const posts = await prisma.statusPost.findMany({
    where: { farmId, AND: [AKTIVER_BEITRAG(new Date())] },
    orderBy: NEUESTER_BEITRAG_ZUERST,
    take: anzahl,
    select: HOFSEITE_BEITRAG_SELECT,
  })
  return posts.map(alsHofseitenBeitrag)
}

/**
 * Der Beitrag aus `?beitrag=<id>` (Register F8/T5, Nr. 128): nur, wenn er GENAU
 * diesem Hof gehört und aktiv ist — Hof, Kennung und AKTIVER_BEITRAG in EINER
 * Abfrage. Abgelaufen, gelöscht, von einem anderen Hof oder unbekannt: null,
 * ohne Unterschied — die Seite verrät nicht, ob es ihn gab.
 */
export async function ladeAktivenBeitrag(farmId: string, beitragId: string): Promise<ActiveStatusPost | null> {
  const post = await prisma.statusPost.findFirst({
    where: { id: beitragId, farmId, AND: [AKTIVER_BEITRAG(new Date())] },
    select: HOFSEITE_BEITRAG_SELECT,
  })
  return post ? alsHofseitenBeitrag(post) : null
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
  showOnFarmPage: boolean
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
      showOnFarmPage: true,
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
