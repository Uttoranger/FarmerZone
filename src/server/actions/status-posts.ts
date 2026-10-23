'use server'

import { headers } from 'next/headers'
import { revalidatePath, updateTag } from 'next/cache'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getFarmForUser } from '@/server/queries/dashboard'
import { whatsAppAbonnentinSql } from '@/server/queries/status-posts'
import { generateUnsubscribeToken } from '@/lib/unsubscribe'
import { WERBEMAIL_EMPFAENGER } from '@/server/abo-anmeldung'
import * as Sentry from '@sentry/nextjs'
import { BILD_NICHT_UEBERNOMMEN, bildUrlErlaubt } from '@/server/bild-url'
import { HOEFE_CACHE_TAG } from '@/lib/hofuebersicht'
import { beitragIdImLink } from '@/lib/teilen-fenster'
import { NEUIGKEITEN_CACHE_TAG } from '@/lib/startseite-gestalten'
import { beitragLaeuftBis, mailSperreWo } from '@/lib/beitrag-mailabstand'
import { nachDerAntwort } from '@/lib/nach-der-antwort'
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
/** `versand` hat keinen Satz: Die Mails gehen nach der Antwort, der Hof liest dazu nichts mehr. */
type Schritt = keyof typeof UNERWARTET | 'versand'
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

/**
 * Die Marke an der Hofkarte (/hoefe, N22) und „Neu bei den Höfen“ (Startseite,
 * N16) sind zwischengespeichert (Nr. 129): Veröffentlichen, Deaktivieren und
 * Löschen leeren beide Einträge, damit die Marke ohne Warten kommt bzw. geht.
 * updateTag statt revalidateTag: In Next 16 verlangt revalidateTag ein Profil.
 */
function erneuereListen(): void {
  updateTag(HOEFE_CACHE_TAG)
  updateTag(NEUIGKEITEN_CACHE_TAG)
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
    const expiresAt = beitragLaeuftBis(now)

    // Mail-Sperre: dieselbe Bedingung wie die Seite „Neuer Beitrag" (mailSperreWo, Nr. 149).
    let emailSubscribers: { customerEmail: string; customerPhone: string | null }[] = []
    if (data.sendEmail) {
      const recentSend = await prisma.statusPost.findFirst({ where: mailSperreWo(farm.id, now), select: { id: true } })
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

    // Der Beitrag steht mit der GEPLANTEN Zahl — sie sperrt, bis der Versand
    // die angenommenen Mails einträgt (Nr. 149). Die Mails gehen erst nach der
    // Antwort hinaus: Vorher wartete der Hof auf jede einzelne.
    if (emailSubscribers.length > 0) {
      const empfaenger = emailSubscribers.map((s) => s.customerEmail)
      const farmId = farm.id
      nachDerAntwort(() => versendeBeitragsMails({ postId: post.id, farmId, empfaenger, data }))
    }

    // Die Beiträge stehen seit Nr. 22e im Reiter von Mein Hof (/status leitet dorthin um).
    revalidatePath('/farm-page')
    // Revalidate public farm page (ISR bust)
    const farmSlug = await prisma.farm.findUnique({ where: { id: farm.id }, select: { slug: true } })
    if (farmSlug) revalidatePath(`/${farmSlug.slug}`)
    erneuereListen()

    return { postId: post.id, emailCount: emailSubscribers.length }
  } catch (err) {
    meldeFehler('veroeffentlichen', err)
    return { error: UNERWARTET.veroeffentlichen }
  }
}

/**
 * Die Mails zu einem Beitrag, nach der Antwort (Nr. 149). Jede Mail hat ihr
 * eigenes try/catch: Ein Fehler geht an Sentry (Schritt `versand`, nie
 * Adresse oder Token) und hält die übrigen nicht auf. Am Ende steht am
 * Beitrag die Zahl der ANGENOMMENEN Mails (mit `id`); gesperrte (Z3) und
 * gescheiterte zählen nicht. Bricht die Funktion vorher ab, bleibt die
 * geplante Zahl stehen — dann hält die Sperre, statt doppelt zu schreiben.
 */
async function versendeBeitragsMails(auftrag: {
  postId: string
  farmId: string
  empfaenger: string[]
  data: BeitragVeroeffentlichenEingabe
}): Promise<void> {
  const { postId, farmId, empfaenger, data } = auftrag
  try {
    const farmFull = await prisma.farm.findUnique({ where: { id: farmId }, select: { name: true, slug: true } })
    if (!farmFull) return

    // Vornamen für {Vorname} im Text
    const nameRows = await prisma.order.findMany({
      where: { farmId, customerEmail: { in: empfaenger } },
      select: { customerEmail: true, customerName: true },
      distinct: ['customerEmail'],
      orderBy: { createdAt: 'desc' },
    })
    const nameMap = new Map(nameRows.map((r) => [r.customerEmail.toLowerCase(), r.customerName.split(' ')[0]]))

    const { sendStatusUpdateEmail } = await import('@/lib/email')
    let angenommen = 0
    // Nacheinander: Resend begrenzt die Anfragen je Sekunde.
    for (const an of empfaenger) {
      try {
        const firstName = nameMap.get(an.toLowerCase()) ?? ''
        const ergebnis = await sendStatusUpdateEmail({
          to: an,
          farmName: farmFull.name,
          farmSlug: farmFull.slug,
          title: data.title,
          body: data.body.replace(/\{Vorname\}/gi, firstName),
          anlass: data.anlass,
          photoUrl: data.photoUrl,
          // Der Knopf führt zu genau diesem Beitrag (T5) — nur, wenn er auf der
          // Hofseite steht (dieselbe Regel wie der WhatsApp-Link je Person).
          beitragId: beitragIdImLink({ id: postId, showOnFarmPage: data.showOnFarmPage }),
          // Aus dem Token baut der Versand Abmeldelink und Abmelde-Kopfzeilen (Nr. 47).
          abmeldeToken: generateUnsubscribeToken(an, farmId),
        })
        if (ergebnis.id) angenommen += 1
        // Ein Resend-Fehler kommt als Ergebnis, nicht als Wurf; gesperrt (Z3) ist kein Fehler.
        else if (ergebnis.error) meldeFehler('versand', Object.assign(new Error('Resend'), { name: 'ResendFehler' }))
      } catch (err) {
        meldeFehler('versand', err)
      }
    }

    await prisma.statusPost.updateMany({ where: { id: postId, farmId }, data: { emailRecipientCount: angenommen } })
  } catch (err) {
    meldeFehler('versand', err)
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
    erneuereListen()
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
    erneuereListen()
    return {}
  } catch (err) {
    meldeFehler('loeschen', err)
    return { error: UNERWARTET.loeschen }
  }
}
