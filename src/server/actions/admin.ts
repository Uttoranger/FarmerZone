'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { verlangeAdminAktion } from '@/server/admin-wache'
import { sendFreischaltungEmail } from '@/lib/email'
import {
  FARM_REJECT_APPROVED_MESSAGE,
  FARM_REJECT_HAS_DATA_MESSAGE,
  FARM_REJECT_OWNER_IS_ADMIN_MESSAGE,
} from '@/lib/farm-approval'
import { servicegebuehrEinstellungSchema } from '@/schemas/servicegebuehr'
import { wienerMitternacht } from '@/lib/servicegebuehr'
import { triageEingabeSchema } from '@/schemas/meldung'
import { bestaetigungOffen } from '@/lib/email-bestaetigung'
import { FREISCHALTUNG_GEAENDERT_TEXT, freischaltSperre } from '@/lib/admin-hoefe'

function revalidateAll(slug: string) {
  revalidatePath('/admin')
  revalidatePath(`/${slug}`)
}

/**
 * Hof freischalten: ab jetzt öffentlich sichtbar und bestellbar.
 *
 * Dieser EINE Admin-Klick bleibt Absicht — er vergibt den Gründungsplatz und
 * ist die Schleuse gegen Bot-Anmeldungen. Alles davor (Registrierung,
 * Einrichten) und danach (die Zusage-Mail hier) läuft automatisch.
 */
export async function approveFarmAction(farmId: string): Promise<{ error?: string }> {
  const guard = await verlangeAdminAktion()
  if ('error' in guard) return { error: guard.error }

  const farm = await prisma.farm.findUnique({
    where: { id: farmId },
    select: {
      name: true,
      slug: true,
      stripeAccountReady: true,
      owner: { select: { email: true, emailVerified: true, createdAt: true } },
    },
  })
  if (!farm) return { error: 'Hof nicht gefunden.' }

  // Die Sperren aus EINER Regel (freischaltSperre, src/lib/admin-hoefe.ts),
  // alles frisch aus der Datenbank gelesen (oben):
  // - S3 (Nr. 17b): „Hof online stellen" ist bis zur bestätigten E-Mail
  //   gesperrt — und online geht ein Hof nur über diesen Klick. Konten vor dem
  //   Stichtag bleiben unberührt.
  // - Register Z1: Jeder Hof braucht ein fertiges Stripe-Konto — auch einer
  //   mit acceptsOnline false aus der Zeit, als „nur bar" noch ging. Das ist
  //   die serverseitige Schranke für „Hof online stellen".
  // Bereits freigeschaltete Höfe berührt das nicht; es wirkt nur auf diesen Klick.
  const sperre = freischaltSperre({
    emailBestaetigungOffen: bestaetigungOffen(farm.owner),
    stripeBereit: farm.stripeAccountReady === true,
  })
  if (sperre) return { error: sperre }

  // Bedingt schreiben, nicht blind: Die Sperre oben beruht auf einem Lesestand.
  // Fällt Stripe dazwischen weg (account.updated) oder schaltet ein zweiter
  // Klick schon frei, trifft das Schreiben nichts — dann keine Mail, sondern
  // eine Meldung (ARCHITECTURE: der Statuswechsel ist die Sperre).
  const { count } = await prisma.farm.updateMany({
    where: { id: farmId, stripeAccountReady: true, approvedAt: null },
    data: { approvedAt: new Date() },
  })
  if (count === 0) return { error: FREISCHALTUNG_GEAENDERT_TEXT }
  revalidateAll(farm.slug)

  // Die Zusage an den Hof — NACH dem erfolgreichen Update. Ein Mail-Fehler
  // darf die Freischaltung nicht scheitern lassen: Der Hof ist ab hier
  // öffentlich, die Nachricht lässt sich notfalls von Hand nachholen.
  try {
    await sendFreischaltungEmail({
      name: farm.name,
      slug: farm.slug,
      ownerEmail: farm.owner.email,
    })
  } catch (e) {
    // Log-Hygiene wie in onboarding.ts: nur außerhalb der Produktion.
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] Freischalt-Mail fehlgeschlagen: ${e instanceof Error ? e.message : e}`)
    }
  }
  return {}
}

/**
 * Freigabe zurücknehmen: die Hofseite verschwindet wieder, Bestellungen werden
 * abgelehnt. Es wird NICHTS gelöscht — der Bauer behält Zugang zu allen Daten.
 *
 * Bewusst KEINE automatische Mail: Die Zurücknahme ist heikle Kommunikation
 * und gehört dem Betreiber persönlich — ein Automat, der „dein Hof ist wieder
 * offline" verschickt, würde mehr beschädigen als erklären.
 */
export async function revokeFarmApprovalAction(farmId: string): Promise<{ error?: string }> {
  const guard = await verlangeAdminAktion()
  if ('error' in guard) return { error: guard.error }

  const farm = await prisma.farm.findUnique({ where: { id: farmId }, select: { slug: true } })
  if (!farm) return { error: 'Hof nicht gefunden.' }

  await prisma.farm.update({ where: { id: farmId }, data: { approvedAt: null } })
  revalidateAll(farm.slug)
  return {}
}

/**
 * Ablehnen und löschen: entfernt einen WARTENDEN Hof samt Inhaber-Konto.
 * Gegen die Karteileichen, die Bot-Anmeldungen hinterlassen.
 *
 * Abgrenzung zu revokeFarmApprovalAction: Zurücknehmen macht unsichtbar und
 * löscht nichts. Diese Aktion ist endgültig — deshalb hängen drei Guards davor.
 *
 * Warum überhaupt Guards und nicht einfach `farm.delete`: Die Fremdschlüssel
 * geben das Löschen nicht her (belegt in prisma/migrations/0_init/migration.sql).
 *   Order.farmId       → ON DELETE RESTRICT (:440)  ein Hof mit Bestellungen
 *                        lässt sich gar nicht löschen, die DB bricht ab.
 *   OrderItem.productId→ ON DELETE RESTRICT (:449)  dasselbe für die Produkte,
 *                        die per Cascade am Hof hängen.
 *   Order.customerId   → ON DELETE SET NULL (:443)  das Löschen des Users kappt
 *                        die Konto-Verknüpfung alter Bestellungen. Seit E8 liest
 *                        sie niemand mehr — deshalb keine Sperre (Register B4).
 * Die ersten beiden wären ein lauter Fehler. Also wird vorher geprüft statt
 * hinterher aufgeräumt.
 *
 * Reihenfolge beim Löschen ist Pflicht: erst der Hof, dann der User —
 * Farm.ownerId steht ebenfalls auf RESTRICT (:431). Alles Übrige hängt an
 * Cascades und geht von selbst mit: Produkte, Abholzeiten, Fotos, Werte,
 * Status-Beiträge, Abos (am Hof) sowie Sessions und Accounts (am User).
 */
export async function rejectFarmAction(farmId: string): Promise<{ error?: string }> {
  const guard = await verlangeAdminAktion()
  if ('error' in guard) return { error: guard.error }

  const farm = await prisma.farm.findUnique({
    where: { id: farmId },
    select: {
      slug: true,
      approvedAt: true,
      ownerId: true,
      owner: { select: { isAdmin: true } },
      products: { select: { id: true } },
      _count: { select: { orders: true, manualSales: true } },
    },
  })
  if (!farm) return { error: 'Hof nicht gefunden.' }

  // 1. Nur wartende Höfe. Ein freigeschalteter Hof ist ein laufender Betrieb —
  //    für den gibt es das Zurücknehmen, nicht das Löschen.
  if (farm.approvedAt !== null) return { error: FARM_REJECT_APPROVED_MESSAGE }

  // 2. Niemals das Betreiber-Konto. Ein Betreiber darf selbst einen Hof führen
  //    (siehe isAdmin in prisma/schema.prisma) — ein Fehlgriff hier wäre teuer.
  if (farm.owner.isAdmin) return { error: FARM_REJECT_OWNER_IS_ADMIN_MESSAGE }

  // 3. Keine Geschäftsdaten am Hof. Ein wartender Hof KANN welche haben: eine
  //    zurückgenommene Freigabe setzt approvedAt wieder auf null, die
  //    Bestellungen aus der freigeschalteten Zeit bleiben.
  if (farm._count.orders > 0 || farm._count.manualSales > 0) {
    return { error: FARM_REJECT_HAS_DATA_MESSAGE }
  }
  const produktIds = farm.products.map((p) => p.id)
  if (produktIds.length > 0) {
    const positionen = await prisma.orderItem.count({ where: { productId: { in: produktIds } } })
    if (positionen > 0) return { error: FARM_REJECT_HAS_DATA_MESSAGE }
  }

  // Bestellungen am Inhaber-Konto sperren NICHT (mehr) (Register B4, Nr. 27):
  // Seit E8 (Nr. 17a) hängt der Checkout keine Bestellung an ein Konto, und
  // niemand liest `customerId` (Leser gehen nach `customerEmail`). Verknüpft
  // sind nur Altbestellungen; SET NULL kappt beim Löschen diese tote
  // Verknüpfung, die Bestellungen selbst bleiben unverändert stehen.

  // StockReservation hat als einzige Tabelle KEINEN Fremdschlüssel auf Product
  // (prisma/schema.prisma:387–397: productId ist ein blankes String-Feld).
  // Ohne dieses deleteMany blieben verwaiste Reservierungen liegen.
  await prisma.$transaction([
    prisma.stockReservation.deleteMany({ where: { productId: { in: produktIds } } }),
    prisma.farm.delete({ where: { id: farmId } }),
    prisma.user.delete({ where: { id: farm.ownerId } }),
  ])

  revalidateAll(farm.slug)
  return {}
}

/**
 * Servicegebühr eines Hofes einstellen (Sprint servicegebuehr, Teil E).
 *
 * Prozentsatz, Mindestgebühr und „gilt ab" (Kalendertag, als Wiener
 * Mitternacht gespeichert — src/lib/servicegebuehr.ts) oder leer =
 * gebührenfrei. Wirkt NUR auf künftige Bestellungen: jede Bestellung friert
 * ihre Gebühr zur Bestellzeit ein (Order.serviceFee*), bestehende bleiben
 * unverändert.
 *
 * Protokoll außerhalb der Produktion (Log-Hygiene wie approveFarmAction):
 * Zeitstempel, Admin-ID, Hof und die neuen Werte — keine Personendaten.
 */
export async function setServiceFeeAction(
  farmId: string,
  eingabe: { percent: unknown; minCents: unknown; activeFrom: unknown }
): Promise<{ error?: string }> {
  const guard = await verlangeAdminAktion()
  if ('error' in guard) return { error: guard.error }

  const parsed = servicegebuehrEinstellungSchema.safeParse(eingabe)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }

  const giltAb = parsed.data.activeFrom === null ? null : wienerMitternacht(parsed.data.activeFrom)
  if (parsed.data.activeFrom !== null && giltAb === null) return { error: 'Ungültiges Datum.' }

  const farm = await prisma.farm.findUnique({ where: { id: farmId }, select: { slug: true } })
  if (!farm) return { error: 'Hof nicht gefunden.' }

  await prisma.farm.update({
    where: { id: farmId },
    data: {
      serviceFeePercent: parsed.data.percent,
      serviceFeeMinCents: parsed.data.minCents,
      serviceFeeActiveFrom: giltAb,
    },
  })

  if (process.env.NODE_ENV !== 'production') {
    console.log(
      `[DEV] Servicegebühr geändert: ${new Date().toISOString()} admin=${guard.userId} farm=${farmId} ` +
        `percent=${parsed.data.percent} minCents=${parsed.data.minCents} ` +
        `activeFrom=${giltAb ? giltAb.toISOString() : 'gebührenfrei'}`
    )
  }

  revalidatePath('/admin')
  revalidatePath(`/${farm.slug}`)
  revalidatePath(`/${farm.slug}/checkout`)
  return {}
}

/**
 * Triage einer Meldung im Fehlerbriefkasten (Sprint fehlerbriefkasten, Teil D).
 *
 * Der Schreibweg des Menschen für ALLE Triage-Felder, auch die Art. Daneben
 * gibt es nur die Schreibroute /api/triage/status, die genau vier Status
 * setzen kann und nie die Art (Sprint Briefkasten-Rückkopplung). Ein Duplikat-Verweis
 * muss auf eine bestehende, andere Meldung zeigen; sonst stünde ein toter Link
 * in der Triage. antwortAnMelder ist das einzige Triage-Feld, das der Hof sieht.
 */
export async function triageMeldungAction(
  meldungId: string,
  eingabe: {
    status: unknown
    art?: unknown
    clusterKey?: unknown
    triageNotiz?: unknown
    duplikatVonId?: unknown
    sprintName?: unknown
    antwortAnMelder?: unknown
    vorherStatus?: unknown
    vorherNotiz?: unknown
  }
): Promise<{ error?: string }> {
  const guard = await verlangeAdminAktion()
  if ('error' in guard) return { error: guard.error }

  const parsed = triageEingabeSchema.safeParse(eingabe)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
  const triage = parsed.data

  const meldung = await prisma.meldung.findUnique({ where: { id: meldungId }, select: { id: true } })
  if (!meldung) return { error: 'Meldung nicht gefunden.' }

  // Duplikat-Verweis: Kurznummer (Präfix) oder volle ID — gespeichert wird immer
  // die volle ID, und nur, wenn es die Meldung wirklich gibt.
  let duplikatVonId: string | null = null
  if (triage.duplikatVonId !== null) {
    const eingabe = triage.duplikatVonId
    const original = await prisma.meldung.findFirst({
      where: eingabe.length >= 20 ? { id: eingabe } : { id: { startsWith: eingabe } },
      select: { id: true },
    })
    if (!original) return { error: 'Duplikat-Verweis: diese Meldung gibt es nicht.' }
    if (original.id === meldungId) return { error: 'Eine Meldung kann nicht ihr eigenes Duplikat sein.' }
    duplikatVonId = original.id
  }

  // Bedingt schreiben, wenn das Formular seinen Ausgangsstand mitschickt: Hat
  // die Schreibroute (CLI, Deployment) inzwischen etwas gesetzt, würde ein
  // altes Formular sonst Status, PR-Nummer und festen Satz zurückdrehen.
  const { count } = await prisma.meldung.updateMany({
    where: {
      id: meldungId,
      ...(triage.vorherStatus !== undefined ? { status: triage.vorherStatus } : {}),
      ...(triage.vorherNotiz !== undefined ? { triageNotiz: triage.vorherNotiz } : {}),
    },
    data: {
      status: triage.status,
      // Nur der Knopf „Ja, ein Wunsch" schickt eine Art (Sprint Briefkasten-Rückkopplung).
      ...(triage.art ? { art: triage.art } : {}),
      clusterKey: triage.clusterKey,
      triageNotiz: triage.triageNotiz,
      duplikatVonId,
      sprintName: triage.sprintName,
      antwortAnMelder: triage.antwortAnMelder,
      triagedAt: new Date(),
    },
  })
  if (count === 0) return { error: 'Die Meldung hat sich inzwischen geändert — lade die Seite neu und entscheide noch einmal.' }

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DEV] Meldung triagiert: ${new Date().toISOString()} admin=${guard.userId} meldung=${meldungId} status=${triage.status}`)
  }

  revalidatePath('/admin')
  revalidatePath('/admin/meldungen')
  revalidatePath(`/admin/meldungen/${meldungId}`)
  revalidatePath('/meldungen')
  return {}
}
