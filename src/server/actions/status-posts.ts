'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getFarmForUser } from '@/server/queries/dashboard'
import { whatsAppAbonnentinSql } from '@/server/queries/status-posts'
import { generateUnsubscribeToken } from '@/lib/unsubscribe'
import { WERBEMAIL_EMPFAENGER } from '@/server/abo-anmeldung'
import * as Sentry from '@sentry/nextjs'
import { BILD_NICHT_UEBERNOMMEN, bildUrlErlaubt } from '@/server/bild-url'
import {
  BEITRAG_FELDER_MIT_SATZ,
  BEITRAG_PRODUKT_FREMD,
  beitragIdSchema,
  beitragVeroeffentlichenSchema,
  whatsAppGetipptSchema,
  type BeitragVeroeffentlichenEingabe,
} from '@/schemas/status-post'

/*
 * Nach außen gehen nur diese Sätze (Nr. 32): Vorher stand `err.message` im
 * Toast — „Post nicht gefunden", „Nicht eingeloggt" oder ein Prisma-Text mit
 * Titel und Text des Beitrags.
 */
const NICHT_ANGEMELDET = 'Bitte melde dich neu an.'
const BEITRAG_WEG = 'Diesen Beitrag gibt es nicht mehr. Lade die Seite neu.'
const ABONNENTIN_WEG = 'Diese Person bekommt deine WhatsApp-Nachrichten nicht mehr. Lade die Seite neu.'
const UNERWARTET = {
  veroeffentlichen: 'Wir konnten den Beitrag gerade nicht veröffentlichen. Bitte versuch es noch einmal.',
  deaktivieren: 'Wir konnten den Beitrag gerade nicht deaktivieren. Bitte versuch es noch einmal.',
  loeschen: 'Wir konnten den Beitrag gerade nicht löschen. Bitte versuch es noch einmal.',
  whatsapp: 'Wir konnten den Stand gerade nicht speichern. Bitte versuch es noch einmal.',
} as const
type Schritt = keyof typeof UNERWARTET
const EINGABE_UNGUELTIG = 'Da stimmt etwas mit dem Beitrag nicht. Lade die Seite neu und versuch es noch einmal.'

/** Der Hof der Anmeldung — `null` ohne Sitzung oder ohne Hof. */
async function angemeldeterHof() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  return getFarmForUser(session.user.id)
}

/**
 * Meldet einen unerwarteten Fehler an Sentry — fester Text, Schritt und
 * Fehlerklasse, nie Titel, Text, Bild-Adresse oder E-Mail (Vorbild
 * meldeVersandFehler in bestellungen-finden.ts): Die Nachricht eines
 * Prisma-Fehlers kann die Werte des Aufrufs enthalten.
 */
function meldeFehler(schritt: Schritt, err: unknown): void {
  const meldung = new Error(`Beitrag: ${schritt} fehlgeschlagen`)
  meldung.name = err instanceof Error ? err.name : 'Unbekannt'
  const code = typeof (err as { code?: unknown } | null)?.code === 'string' ? (err as { code: string }).code : undefined
  Sentry.captureException(meldung, { tags: { aktion: 'beitrag', schritt, ...(code ? { code } : {}) } })
}

/** Hofseite und Reiter „Beiträge" neu aufbauen (seit Nr. 22e unter /farm-page). */
function baueBeitragsSeitenNeu(slug: string): void {
  revalidatePath('/farm-page')
  revalidatePath(`/${slug}`)
}

export async function publishStatusPost(
  eingabe: BeitragVeroeffentlichenEingabe
): Promise<{ postId?: string; emailCount?: number; error?: string }> {
  const geprueft = beitragVeroeffentlichenSchema.safeParse(eingabe)
  if (!geprueft.success) {
    // Nur Titel, Text und Anlass tragen eigene deutsche Sätze; sonst stünde
    // englischer Zod-Text im Hinweis (Nr. 32, Runde 1).
    const erste = geprueft.error.issues[0]
    const feld = erste?.path[0]
    return { error: erste && typeof feld === 'string' && BEITRAG_FELDER_MIT_SATZ.includes(feld) ? erste.message : EINGABE_UNGUELTIG }
  }
  const data = geprueft.data

  try {
    const farm = await angemeldeterHof()
    if (!farm) return { error: NICHT_ANGEMELDET }
    // Das Foto geht auf die Hofseite und in die Mail an Abonnentinnen — nur
    // aus unserem Speicher und dem Ordner dieses Hofes (Nr. 19b).
    if (!(await bildUrlErlaubt(data.photoUrl, farm.id))) return { error: BILD_NICHT_UEBERNOMMEN }
    // Verknüpfte Produkte nur vom eigenen Hof (Nr. 35): Die Hofseite zeigt sie
    // zum Beitrag. Eine fremde oder unbekannte Kennung lehnt den Beitrag ab,
    // statt sie still zu verwerfen — sonst ginge er ohne das Produkt hinaus,
    // das der Hof gemeint hat, und das womöglich schon per Mail.
    const produktIds = [...new Set(data.linkedProductIds ?? [])]
    if (produktIds.length > 0) {
      const eigene = await prisma.product.findMany({
        where: { id: { in: produktIds }, farmId: farm.id },
        select: { id: true },
      })
      if (eigene.length !== produktIds.length) return { error: BEITRAG_PRODUKT_FREMD }
    }
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    // Email subscribers — with frequency protection (farm-level: 1 email per 7 days)
    let emailSubscribers: { customerEmail: string; customerPhone: string | null }[] = []
    if (data.sendEmail) {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const recentSend = await prisma.statusPost.findFirst({
        where: { farmId: farm.id, sentViaEmail: true, publishedAt: { gte: sevenDaysAgo } },
      })
      if (!recentSend) {
        // Nur Bestand und bestätigte Anmeldungen (Double-Opt-in, S11, Nr. 38).
        emailSubscribers = await prisma.customerFarmSubscription.findMany({
          where: { farmId: farm.id, ...WERBEMAIL_EMPFAENGER },
          select: { customerEmail: true, customerPhone: true },
        })
      }
    }

    // Kein WhatsApp-Häkchen mehr (Register T5, Nr. 67): Die Abonnentinnen
    // erreicht der Hof danach über das Teilen-Fenster bzw. die Tipp-Liste, die
    // sie beim Öffnen live liest (W1) — sentViaWhatsApp und
    // whatsappRecipientCount werden hier nicht mehr gesetzt (Vorgabe der Spalten).

    const post = await prisma.statusPost.create({
      data: {
        farmId: farm.id,
        title: data.title,
        body: data.body,
        anlass: data.anlass,
        photoUrl: data.photoUrl ?? null,
        linkedProductIds: produktIds,
        showOnFarmPage: data.showOnFarmPage,
        publishedAt: now,
        expiresAt,
        sentViaEmail: data.sendEmail && emailSubscribers.length > 0,
        emailRecipientCount: emailSubscribers.length,
      },
    })

    // Send emails asynchronously (fire + don't block)
    if (emailSubscribers.length > 0) {
      const farmFull = await prisma.farm.findUnique({
        where: { id: farm.id },
        select: { name: true, slug: true },
      })

      // Get customer names for personalisation
      const nameRows = await prisma.order.findMany({
        where: { farmId: farm.id, customerEmail: { in: emailSubscribers.map((s) => s.customerEmail) } },
        select: { customerEmail: true, customerName: true },
        distinct: ['customerEmail'],
        orderBy: { createdAt: 'desc' },
      })
      const nameMap = new Map(nameRows.map((r) => [r.customerEmail.toLowerCase(), r.customerName.split(' ')[0]]))

      if (farmFull) {
        const { sendStatusUpdateEmail } = await import('@/lib/email')
        for (const sub of emailSubscribers) {
          const firstName = nameMap.get(sub.customerEmail.toLowerCase()) ?? ''
          const personalBody = data.body.replace(/\{Vorname\}/gi, firstName)
          // Aus dem Token baut der Versand Abmeldelink und Abmelde-Kopfzeilen (Nr. 47).
          await sendStatusUpdateEmail({
            to: sub.customerEmail,
            farmName: farmFull.name,
            farmSlug: farmFull.slug,
            title: data.title,
            body: personalBody,
            anlass: data.anlass,
            photoUrl: data.photoUrl,
            abmeldeToken: generateUnsubscribeToken(sub.customerEmail, farm.id),
          })
        }
      }
    }

    // Die Beiträge stehen seit Nr. 22e im Reiter von Mein Hof (/status leitet dorthin um).
    revalidatePath('/farm-page')
    // Revalidate public farm page (ISR bust)
    const farmSlug = await prisma.farm.findUnique({ where: { id: farm.id }, select: { slug: true } })
    if (farmSlug) revalidatePath(`/${farmSlug.slug}`)

    return { postId: post.id, emailCount: emailSubscribers.length }
  } catch (err) {
    meldeFehler('veroeffentlichen', err)
    return { error: UNERWARTET.veroeffentlichen }
  }
}

/*
 * Die Aktionen auf einem bestehenden Beitrag prüfen den Besitz IM Schreiben
 * (Nr. 32): „geöffnet" (setzeWhatsAppGetippt) in EINER SQL-Anweisung mit
 * Besitz in der WHERE-Klausel, deaktivieren und löschen über
 * `updateMany`/`deleteMany` mit `{ id, farmId }` und `count`. Vorher fragte
 * ein `findFirst` den Besitz ab und ein zweiter Aufruf schrieb per ID allein.
 */

/**
 * „Geöffnet" je Person setzen oder zurücksetzen (Register W1, Nr. 66; ersetzt
 * markWhatsAppSent, das eine Zahl aus dem Browser speicherte). EINE Anweisung
 * ohne Lesen-dann-Schreiben: array_remove/array_append rechnen auf der Zeile,
 * die Postgres beim Schreiben sperrt — zwei Tabs verlieren nichts, und
 * Hinzufügen nimmt ein vorhandenes Vorkommen erst heraus (idempotent).
 * whatsappSentCount wird gleich der Länge mitgeschrieben, damit Bestand und
 * alter Code im Deploy-Fenster stimmen (Contract später). Besitz in der
 * WHERE-Klausel: der Beitrag über { id, farmId }, das Abonnement über farmId
 * und dieselbe Regel wie die Tipp-Liste (WhatsApp-Häkchen, Nummer nicht leer;
 * whatsAppAbonnentinSql, Nr. 75) — eine fremde Abonnements-ID oder eine
 * E-Mail-Abonnentin landet nie in der Liste. Zurück geht die Liste, wie sie
 * danach in der Datenbank steht.
 */
export async function setzeWhatsAppGetippt(
  postId: string,
  subscriptionId: string,
  geoeffnet: boolean
): Promise<{ ok: true; getippt: string[] } | { error: string }> {
  const geprueft = whatsAppGetipptSchema.safeParse({ postId, subscriptionId, geoeffnet })
  if (!geprueft.success) return { error: EINGABE_UNGUELTIG }
  const { postId: beitrag, subscriptionId: abo } = geprueft.data

  try {
    const farm = await angemeldeterHof()
    if (!farm) return { error: NICHT_ANGEMELDET }
    const ohne = Prisma.sql`array_remove(COALESCE("whatsappGetippt", ARRAY[]::TEXT[]), ${abo}::text)`
    const liste = geprueft.data.geoeffnet ? Prisma.sql`array_append(${ohne}, ${abo}::text)` : ohne
    const zeilen = await prisma.$queryRaw<{ whatsappGetippt: string[] }[]>(Prisma.sql`
      UPDATE "StatusPost"
      SET "whatsappGetippt" = ${liste},
          "whatsappSentCount" = cardinality(${liste}),
          "updatedAt" = now() AT TIME ZONE 'UTC'
      WHERE "id" = ${beitrag} AND "farmId" = ${farm.id}
        AND EXISTS (SELECT 1 FROM "CustomerFarmSubscription" WHERE "id" = ${abo} AND ${whatsAppAbonnentinSql(farm.id)})
      RETURNING "whatsappGetippt"`)
    const [zeile] = zeilen
    if (zeile) {
      // Der Knopf „WhatsApp · n von m" im Reiter „Beiträge" und die Tipp-Liste
      // unter /status zeigen sonst aus dem Router-Cache den alten Stand (Nr. 75).
      revalidatePath('/farm-page')
      revalidatePath('/status', 'layout')
      return { ok: true, getippt: zeile.whatsappGetippt }
    }
    // Nichts geschrieben — nachgesehen wird nur noch für den richtigen Satz.
    const eigenerBeitrag = await prisma.statusPost.count({ where: { id: beitrag, farmId: farm.id } })
    return { error: eigenerBeitrag === 0 ? BEITRAG_WEG : ABONNENTIN_WEG }
  } catch (err) {
    meldeFehler('whatsapp', err)
    return { error: UNERWARTET.whatsapp }
  }
}

export async function expireStatusPost(postId: string): Promise<{ error?: string }> {
  const id = beitragIdSchema.safeParse(postId)
  if (!id.success) return { error: EINGABE_UNGUELTIG }

  try {
    const farm = await angemeldeterHof()
    if (!farm) return { error: NICHT_ANGEMELDET }
    const { count } = await prisma.statusPost.updateMany({
      where: { id: id.data, farmId: farm.id },
      data: { expiresAt: new Date() },
    })
    if (count === 0) return { error: BEITRAG_WEG }
    // Der Beitrag verschwindet auch von der öffentlichen Hofseite (Hinweis 22e).
    baueBeitragsSeitenNeu(farm.slug)
    return {}
  } catch (err) {
    meldeFehler('deaktivieren', err)
    return { error: UNERWARTET.deaktivieren }
  }
}

export async function deleteStatusPost(postId: string): Promise<{ error?: string }> {
  const id = beitragIdSchema.safeParse(postId)
  if (!id.success) return { error: EINGABE_UNGUELTIG }

  try {
    const farm = await angemeldeterHof()
    if (!farm) return { error: NICHT_ANGEMELDET }
    const { count } = await prisma.statusPost.deleteMany({ where: { id: id.data, farmId: farm.id } })
    if (count === 0) return { error: BEITRAG_WEG }
    baueBeitragsSeitenNeu(farm.slug)
    return {}
  } catch (err) {
    meldeFehler('loeschen', err)
    return { error: UNERWARTET.loeschen }
  }
}
