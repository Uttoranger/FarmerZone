'use server'

import { revalidatePath, updateTag } from 'next/cache'
import * as Sentry from '@sentry/nextjs'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { verlangeAdminAktion, verlangeFrischeBestaetigung } from '@/server/admin-wache'
import { protokolliere } from '@/server/admin-protokoll'
import { plattformBezug } from '@/schemas/admin-aktion'
import {
  FARM_REJECT_APPROVED_MESSAGE,
  FARM_REJECT_HAS_DATA_MESSAGE,
  FARM_REJECT_OWNER_IS_ADMIN_MESSAGE,
} from '@/lib/farm-approval'
import { EINSTELLUNG_UNGUELTIG, GILT_AB_UNGUELTIG, PROZENT_UNGUELTIG, servicegebuehrEinstellungSchema } from '@/schemas/servicegebuehr'
import { wienerMitternacht } from '@/lib/servicegebuehr'
import { ablegenSchema, buendelStandSchema, triageEingabeSchema, trennenSchema, zusammenfassenSchema, type TriageEingabe } from '@/schemas/meldung'
import { BUENDEL_STAND_STATUS, MELDUNG_GEAENDERT, MELDUNG_VERWEIS_GEAENDERT, WUENSCHE_TEXT, triageAufruf, type TriageStand } from '@/lib/meldung'
import { MEINE_MELDUNGEN_HREF } from '@/lib/hof-hilfe'
import { verschickeRundschreiben } from '@/server/rundschreiben'
import { bestaetigungOffen } from '@/lib/email-bestaetigung'
import { FREISCHALTUNG_GEAENDERT_TEXT, freischaltSperre } from '@/lib/admin-hoefe'
import {
  GRUENDUNG_BIS_GEAENDERT,
  GRUENDUNG_BIS_UNGUELTIG,
  GRUENDUNG_BIS_VERGANGEN,
  GRUENDUNG_BIS_ZUSTIMMUNG_FEHLT,
  gruendungBisSchema,
} from '@/schemas/gruendungshof'
import {
  GRUENDUNGSPLAETZE_SPERRE,
  bestimmeGruendungBis,
  bildeGruendungBis,
  gruendungsZusageBeiFreigabe,
  verkuerztGruendung,
  zusageBeiFreischaltung,
} from '@/lib/gruendungshof'
import { kalendertagInWien } from '@/lib/wiener-tag'
import { ladeHoefeFuerGruendung, leseGruendungEinstellung } from '@/server/queries/admin'
import { IM_SHOP_WHERE } from '@/server/queries/einstellungen'
import { GRUENDUNGS_NACHRICHT, GRUENDUNGS_NACHRICHT_LINK, POSTFACH_HREF } from '@/lib/postfach'
import { HOEFE_CACHE_TAG } from '@/lib/hofuebersicht'

function revalidateAll(slug: string) {
  revalidatePath('/admin')
  revalidatePath(`/${slug}`)
}

/**
 * Die EINE Nachricht vom Team an einen frisch freigeschalteten Gründungshof
 * (Register K2-Ergänzung, Punkt 4; Nr. 93): ein Faden ohne Rundschreiben mit
 * einer Nachricht der Art SYSTEM, Text GRUENDUNGS_NACHRICHT, Link „Deine
 * Konditionen". Ohne Platz keine Nachricht. Platz und Ende bestimmt
 * approveFarmAction in ihrer Transaktion unter der Sperre der Gründungsplätze
 * (Nr. 109) und reicht sie herein — die Nachricht rechnet nie mit einem
 * späteren Stand.
 *
 * IDEMPOTENT über eine eigene Prüfung: Der Unique (farmId, rundschreibenId)
 * greift mit NULL nicht — zwei Fäden ohne Rundschreiben wären erlaubt. Gibt es
 * für den Hof schon eine SYSTEM-Nachricht mit diesem Link in einem Faden ohne
 * Rundschreiben (etwa nach Zurücknehmen und erneutem Freischalten), bleibt es
 * bei der einen.
 *
 * NACHLAUF: Ein Fehler hier rollt die Freischaltung nie zurück (CLAUDE.md,
 * Geld und Bestellungen) — er geht mit festem Text und ohne Nachrichtentext
 * nach Sentry, die Nachricht lässt sich notfalls als Rundschreiben nachholen.
 */
async function legeGruendungsNachrichtAn(farmId: string, zusage: { platz: number; bis: Date }): Promise<void> {
  try {
    const schon = await prisma.nachricht.findFirst({
      where: { art: 'SYSTEM', vonFarmId: null, linkUrl: GRUENDUNGS_NACHRICHT_LINK, unterhaltung: { farmId, rundschreibenId: null } },
      select: { id: true },
    })
    if (schon) return

    // Faden und Nachricht in EINER Anweisung (verschachteltes create) — nie ein leerer Faden.
    const jetzt = new Date()
    await prisma.unterhaltung.create({
      data: {
        farmId,
        rundschreibenId: null,
        letzteNachrichtAm: jetzt,
        nachrichten: {
          create: {
            vonFarmId: null,
            text: GRUENDUNGS_NACHRICHT(zusage.platz, zusage.bis),
            linkUrl: GRUENDUNGS_NACHRICHT_LINK,
            art: 'SYSTEM',
            createdAt: jetzt,
          },
        },
      },
      select: { id: true },
    })
    revalidatePath(POSTFACH_HREF)
    revalidatePath('/dashboard')
  } catch (err) {
    const meldung = new Error('Freischaltung: Gründungs-Nachricht nicht angelegt')
    meldung.name = err instanceof Error ? err.name : 'Unbekannt'
    Sentry.captureException(meldung, { level: 'warning', tags: { bereich: 'gruendung', aufgabe: 'nachricht' }, extra: { farmId } })
  }
}

/**
 * Hof freischalten: ab jetzt öffentlich sichtbar und bestellbar.
 *
 * Dieser EINE Admin-Klick bleibt Absicht — er vergibt den Gründungsplatz und
 * ist die Schleuse gegen Bot-Anmeldungen. Alles davor (Registrierung,
 * Einrichten) und danach (die Gründungs-Nachricht im Postfach seit Nr. 93,
 * die Zusage-Mail) läuft automatisch.
 */
export async function approveFarmAction(farmId: string): Promise<{ error?: string }> {
  // Heikle Aktion (Register N20, Ergänzung 23.10.2026): nur frisch mit Passkey bestätigt. Diese EINE Wache prüft schon alles von verlangeAdminAktion; Recht nach N35.
  const guard = await verlangeFrischeBestaetigung({ recht: 'hoefe_freischalten' })
  if ('error' in guard) return { error: guard.error }

  const farm = await prisma.farm.findUnique({
    where: { id: farmId },
    select: {
      name: true,
      slug: true,
      stripeAccountReady: true,
      owner: { select: { email: true, emailVerified: true, createdAt: true } },
      // Register K2, Änderung Nr. 116: mindestens ein Produkt im Shop — nur ob, nie welches.
      products: { where: IM_SHOP_WHERE, select: { id: true }, take: 1 },
      // Register Z1, Ergänzung 21.10.2026: die Zahl der aktiven Abholzeiten — „aktiv“ wie in Hofliste und Kasse.
      _count: { select: { pickupSlots: { where: { isActive: true } } } },
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
  // - Register K2 (Nr. 116): mindestens ein Produkt im Shop.
  // - Register Z1, Ergänzung 21.10.2026: mindestens eine aktive Abholzeit —
  //   ohne sie nimmt die Hofseite keine Bestellung an (N24).
  // Bereits freigeschaltete Höfe berührt das nicht; es wirkt nur auf diesen Klick.
  const sperre = freischaltSperre({
    emailBestaetigungOffen: bestaetigungOffen(farm.owner),
    stripeBereit: farm.stripeAccountReady === true,
    produktImShop: farm.products.length > 0,
    abholzeitAktiv: farm._count.pickupSlots > 0,
  })
  if (sperre) return { error: sperre }

  // Freischalten und Platz bestimmen in EINER Transaktion unter der Sperre der
  // Gründungsplätze (Register K2, Nr. 109) — dieselbe wie Ausnehmen,
  // Wiederaufnehmen, Festschreiben, Einstellungen und Wieder-Aktivieren: So
  // vergeben zwei Wege nie gleichzeitig denselben letzten Platz. Einstellung
  // und Höfe werden erst NACH der Sperre gelesen (Nr. 116).
  let freigabe: { zusage: { platz: number; bis: Date } | null } | null
  try {
    freigabe = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${GRUENDUNGSPLAETZE_SPERRE})`
      const einstellung = await leseGruendungEinstellung(tx)
      // Bedingt schreiben, nicht blind: Die Freischalt-Sperre oben beruht auf einem Lesestand.
      // Fällt Stripe dazwischen weg (account.updated), nimmt der Hof sein letztes
      // Produkt aus dem Shop, schaltet er seine letzte Abholzeit ab oder schaltet ein
      // zweiter Klick schon frei, trifft das Schreiben nichts — dann keine Mail,
      // sondern eine Meldung (ARCHITECTURE: der Statuswechsel ist die Sperre).
      // Der Zeitpunkt entsteht NACH der Sperre: Er bestimmt die Reihenfolge der
      // Plätze, und ein Weg, der vor uns vergeben hat, steht so immer vor uns.
      const jetzt = new Date()
      const { count } = await tx.farm.updateMany({
        where: { id: farmId, stripeAccountReady: true, approvedAt: null, products: { some: IM_SHOP_WHERE }, pickupSlots: { some: { isActive: true } } },
        data: { approvedAt: jetzt },
      })
      if (count === 0) return null
      const hoefe = await ladeHoefeFuerGruendung(tx)

      // Vor dem Festschreiben: Platz nach der Reihenfolge, wie bisher.
      if (einstellung.festAm === null) {
        const hof = hoefe.find((h) => h.id === farmId)
        return { zusage: hof ? gruendungsZusageBeiFreigabe(hof, hoefe, einstellung) : null }
      }

      // Festgeschrieben (Nr. 116): Ein Hof mit Platz (erneute Freigabe nach Entzug)
      // behält Platz und Ende; sonst, solange die Aktion läuft, die kleinste freie
      // Nummer und das Ende ab heute. Ausgenommene bekommen keinen.
      const hof = await tx.farm.findUnique({
        where: { id: farmId },
        select: { gruendungPlatz: true, gruendungBis: true, gruendungAusgenommen: true },
      })
      if (!hof || hof.gruendungAusgenommen) return { zusage: null }
      const zusage = zusageBeiFreischaltung({ id: farmId, ...hof }, hoefe, einstellung, jetzt)
      if (zusage === null) return { zusage: null }
      if (zusage.neu) {
        // Bedingt: nur ein Hof ohne Platz bekommt einen. Der eindeutige Index fängt den Rest (P2002 unten).
        await tx.farm.updateMany({
          where: { id: farmId, gruendungPlatz: null },
          data: { gruendungPlatz: zusage.platz, gruendungBis: bildeGruendungBis(zusage.bisTag) },
        })
      }
      return { zusage: { platz: zusage.platz, bis: bildeGruendungBis(zusage.bisTag) } }
    })
  } catch (err) {
    // Zwei Wege mit derselben Nummer schließt die Sperre aus; greift doch der
    // eindeutige Index, rollt die Transaktion ganz zurück (auch die Freischaltung).
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return { error: FREISCHALTUNG_GEAENDERT_TEXT }
    throw err
  }
  if (freigabe === null) return { error: FREISCHALTUNG_GEAENDERT_TEXT }
  // Protokoll nach der Wirkung (N33) — wirft nie.
  await protokolliere({ wer: guard.userId, art: 'hof_freigeschaltet', bezugArt: 'hof', bezugId: farmId, mitPasskey: guard.mitPasskey })
  revalidateAll(farm.slug)
  // Höfe-Liste und Startseite lesen über den Fünf-Minuten-Cache: Der frische Hof und sein Abzeichen
  // erscheinen sofort, ebenso die Zahlen des Erklär-Blatts. /konditionen zeigt den Abschnitt Aktion
  // nur, solange Plätze frei sind.
  updateTag(HOEFE_CACHE_TAG)
  revalidatePath('/konditionen')
  // „Noch n Gründungsplätze" auf Startseite und /fuer-hoefe (K2-Ergänzung) zählt diesen Hof jetzt mit.
  revalidatePath('/')
  revalidatePath('/fuer-hoefe')

  // Erst nach dem erfolgreichen Update und vor der Mail: Der Platz ist vergeben.
  // Ohne Platz (oder ausgenommen) keine Nachricht.
  if (freigabe.zusage) await legeGruendungsNachrichtAn(farmId, freigabe.zusage)

  // Die Zusage an den Hof — NACH dem erfolgreichen Update, als Auftrag der
  // Warteschlange (Wichtig, Nr. 159). Ein Fehler darf die Freischaltung nicht
  // scheitern lassen: Der Hof ist ab hier öffentlich, die Nachricht lässt
  // sich notfalls von Hand nachholen.
  try {
    const [{ stelleMailEin }, { freischaltungAuftrag }] = await Promise.all([import('@/server/mail-warteschlange'), import('@/server/mail-arten/hof')])
    await stelleMailEin(freischaltungAuftrag(farmId, new Date()))
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
  // Heikle Aktion (Register N20, Nr. 115): nur frisch mit Passkey bestätigt. Diese EINE Wache prüft schon alles von verlangeAdminAktion (Nr. 126).
  const frisch = await verlangeFrischeBestaetigung({ recht: 'hoefe_freischalten' })
  if ('error' in frisch) return { error: frisch.error }

  const farm = await prisma.farm.findUnique({ where: { id: farmId }, select: { slug: true } })
  if (!farm) return { error: 'Hof nicht gefunden.' }

  await prisma.farm.update({ where: { id: farmId }, data: { approvedAt: null } })
  await protokolliere({ wer: frisch.userId, art: 'hof_freigabe_entzogen', bezugArt: 'hof', bezugId: farmId, mitPasskey: frisch.mitPasskey })
  revalidateAll(farm.slug)
  // Höfe-Liste und Startseite lesen über den Fünf-Minuten-Cache: Der Hof verschwindet dort sofort.
  updateTag(HOEFE_CACHE_TAG)
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
  // Heikle Aktion (Register N20, Nr. 115): nur frisch mit Passkey bestätigt. Diese EINE Wache prüft schon alles von verlangeAdminAktion (Nr. 126).
  const frisch = await verlangeFrischeBestaetigung({ recht: 'hoefe_freischalten' })
  if ('error' in frisch) return { error: frisch.error }

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
  // Nur die Kennungen — Hof und Konto gibt es danach nicht mehr, der Eintrag bleibt (kein Fremdschlüssel).
  await protokolliere({ wer: frisch.userId, art: 'hof_abgelehnt', bezugArt: 'hof', bezugId: farmId, mitPasskey: frisch.mitPasskey })

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
  // Heikle Aktion (Register N20, Ergänzung 23.10.2026): nur frisch mit Passkey bestätigt. Diese EINE Wache prüft schon alles von verlangeAdminAktion.
  const guard = await verlangeFrischeBestaetigung({ recht: 'hoefe_freischalten' })
  if ('error' in guard) return { error: guard.error }

  const parsed = servicegebuehrEinstellungSchema.safeParse(eingabe)
  if (!parsed.success) {
    // Nach außen nur eigene Sätze, nie eine Zod-Meldung an sich (Nr. 35): Bei
    // falschem Typ oder ohne Feld (Eingabe kein Objekt) stünde sonst Zods
    // englischer Standardtext im Dialog. Nur die Mindestgebühr trägt im
    // Schema für jeden Fall einen eigenen deutschen Satz (Nr. 32).
    const erste = parsed.error.issues[0]
    const feld = erste?.path[0]
    if (feld === 'percent') return { error: PROZENT_UNGUELTIG }
    if (feld === 'activeFrom') return { error: GILT_AB_UNGUELTIG }
    if (feld === 'minCents' && erste) return { error: erste.message }
    return { error: EINSTELLUNG_UNGUELTIG }
  }

  const giltAb = parsed.data.activeFrom === null ? null : wienerMitternacht(parsed.data.activeFrom)
  if (parsed.data.activeFrom !== null && giltAb === null) return { error: GILT_AB_UNGUELTIG }

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
  await protokolliere({ wer: guard.userId, art: 'servicegebuehr_geaendert', bezugArt: 'hof', bezugId: farmId, mitPasskey: guard.mitPasskey })

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

/** Für das Protokoll: der Tag der Spalte oder „Standard" (null). */
function tagOderStandard(datum: Date | null): string {
  return datum ? kalendertagInWien(datum) : 'Standard'
}

/**
 * Gründungs-Enddatum eines Hofs einstellen (Register K2, Nr. 62): ein
 * Kalendertag ab heute oder leer = Standard (null). Ein früheres Ende als das
 * bisher WIRKSAME — auch das Zurücksetzen auf einen früheren Standard — nur
 * mit `bestaetigt` aus dem Dialog: Zugesagte Konditionen ändern sich nur mit
 * Zustimmung des Hofs (K1). Wirksam ist das Datum nur mit Gründungsplatz
 * (bestimmeGruendungBis); ohne Platz gibt es keine Zusage zu verkürzen.
 *
 * Protokoll außerhalb der Produktion wie setServiceFeeAction, dazu der alte
 * Wert (S12: wer, wann, alt → neu) — keine Personendaten. Ein dauerhaftes
 * Protokoll braucht eine Tabelle (Lauf 11).
 */
export async function setzeGruendungBisAction(
  farmId: string,
  eingabe: { gruendungBis: unknown; bestaetigt: unknown }
): Promise<{ error?: string }> {
  // Heikle Aktion (Register N20, Ergänzung 23.10.2026): nur frisch mit Passkey bestätigt. Diese EINE Wache prüft schon alles von verlangeAdminAktion.
  const guard = await verlangeFrischeBestaetigung({ recht: 'hoefe_freischalten' })
  if ('error' in guard) return { error: guard.error }

  const jetzt = new Date()
  const parsed = gruendungBisSchema(jetzt).safeParse(eingabe)
  if (!parsed.success) {
    // Nach außen nur eigene Sätze (Nr. 35) — ohne Objekt oder mit falschem
    // Haken stünde sonst Zods englischer Standardtext im Dialog.
    const erste = parsed.error.issues[0]
    if (erste?.path[0] === 'gruendungBis') {
      return { error: erste.message === GRUENDUNG_BIS_VERGANGEN ? GRUENDUNG_BIS_VERGANGEN : GRUENDUNG_BIS_UNGUELTIG }
    }
    return { error: EINSTELLUNG_UNGUELTIG }
  }

  // VOR dem Schreiben gelesen: der alte Wert fürs Protokoll und das bisher
  // wirksame Datum für die Zustimmungs-Regel.
  const [farm, hoefe] = await Promise.all([
    prisma.farm.findUnique({ where: { id: farmId }, select: { slug: true, gruendungBis: true } }),
    ladeHoefeFuerGruendung(),
  ])
  if (!farm) return { error: 'Hof nicht gefunden.' }

  const neu = parsed.data.gruendungBis === null ? null : bildeGruendungBis(parsed.data.gruendungBis)
  const bisher = bestimmeGruendungBis({ id: farmId, gruendungBis: farm.gruendungBis }, hoefe)
  const kuenftig = bestimmeGruendungBis({ id: farmId, gruendungBis: neu }, hoefe)
  if (verkuerztGruendung(bisher, kuenftig) && !parsed.data.bestaetigt) return { error: GRUENDUNG_BIS_ZUSTIMMUNG_FEHLT }

  // Bedingt schreiben, nicht blind: Die Zustimmungs-Regel beruht auf dem
  // Lesestand oben. Hat ein zweiter Tab das Ende inzwischen verschoben, trifft
  // das Schreiben nichts — sonst könnte ein späteres Ende ohne Haken still
  // verkürzt werden.
  const { count } = await prisma.farm.updateMany({
    where: { id: farmId, gruendungBis: farm.gruendungBis },
    data: { gruendungBis: neu },
  })
  if (count === 0) return { error: GRUENDUNG_BIS_GEAENDERT }
  await protokolliere({ wer: guard.userId, art: 'gruendung_bis_geaendert', bezugArt: 'hof', bezugId: farmId, mitPasskey: guard.mitPasskey })

  if (process.env.NODE_ENV !== 'production') {
    console.log(
      `[DEV] Gründungshof bis geändert: ${jetzt.toISOString()} admin=${guard.userId} farm=${farmId} ` +
        `alt=${tagOderStandard(farm.gruendungBis)} neu=${tagOderStandard(neu)} bestaetigt=${parsed.data.bestaetigt}`
    )
  }

  revalidatePath('/admin')
  revalidatePath('/settings/konditionen')
  // Die Übersicht der Einstellungen nennt den Gründungshof in ihrer Zeile mit.
  revalidatePath('/settings')
  return {}
}

const KEINE_KETTE = 'Diese Meldung ist selbst ein Duplikat – nimm ihre Hauptmeldung.'

/**
 * Keine Kette beim Schreiben (Nr. 105, Nacharbeit 101): Mit Verweis schreibt
 * EINE Anweisung, die nur trifft, solange die Hauptmeldung selbst kein
 * Duplikat ist — die Prüfung davor gibt den Satz, diese Bedingung schließt
 * die Lücke bis zum Schreiben. Prisma kennt für duplikatVonId keine Relation,
 * darum SQL mit Parametern; der Ausgangsstand steht in derselben WHERE wie in
 * updateMany. Gibt die Zahl der geschriebenen Zeilen zurück.
 */
async function schreibeTriageMitVerweis(meldungId: string, triage: TriageEingabe, duplikatVonId: string, jetzt: Date): Promise<number> {
  const bedingungen = [
    Prisma.sql`m."id" = ${meldungId}`,
    Prisma.sql`EXISTS (SELECT 1 FROM "Meldung" h WHERE h."id" = ${duplikatVonId} AND h."status" <> 'DUPLIKAT')`,
  ]
  if (triage.vorherStatus !== undefined) bedingungen.push(Prisma.sql`m."status" = ${triage.vorherStatus}::"MeldungStatus"`)
  if (triage.vorherNotiz !== undefined) {
    bedingungen.push(triage.vorherNotiz === null ? Prisma.sql`m."triageNotiz" IS NULL` : Prisma.sql`m."triageNotiz" = ${triage.vorherNotiz}`)
  }
  return prisma.$executeRaw`
    UPDATE "Meldung" AS m SET
      "status" = ${triage.status}::"MeldungStatus",
      "art" = COALESCE(${triage.art ?? null}::"MeldungArt", m."art"),
      "clusterKey" = ${triage.clusterKey},
      "triageNotiz" = ${triage.triageNotiz},
      "duplikatVonId" = ${duplikatVonId},
      "sprintName" = ${triage.sprintName},
      "antwortAnMelder" = ${triage.antwortAnMelder},
      "triagedAt" = ${jetzt}
    WHERE ${Prisma.join(bedingungen, ' AND ')}`
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
  const guard = await verlangeAdminAktion({ recht: 'ansehen' })
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
      select: { id: true, status: true },
    })
    if (!original) return { error: 'Duplikat-Verweis: diese Meldung gibt es nicht.' }
    if (original.id === meldungId) return { error: 'Eine Meldung kann nicht ihr eigenes Duplikat sein.' }
    if (original.status === 'DUPLIKAT') return { error: KEINE_KETTE }
    duplikatVonId = original.id
  }

  // Bedingt schreiben, wenn das Formular seinen Ausgangsstand mitschickt: Hat
  // die Schreibroute (CLI, Deployment) inzwischen etwas gesetzt, würde ein
  // altes Formular sonst Status, PR-Nummer und festen Satz zurückdrehen.
  const jetzt = new Date()
  const count =
    duplikatVonId === null
      ? (
          await prisma.meldung.updateMany({
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
              duplikatVonId: null,
              sprintName: triage.sprintName,
              antwortAnMelder: triage.antwortAnMelder,
              triagedAt: jetzt,
            },
          })
        ).count
      : await schreibeTriageMitVerweis(meldungId, triage, duplikatVonId, jetzt)
  if (count === 0) {
    return { error: duplikatVonId === null ? MELDUNG_GEAENDERT : MELDUNG_VERWEIS_GEAENDERT }
  }
  // „Ansehen“ genügt (N35), aber mit Protokoll; Zusammenfassen und Trennen schreiben über diesen Weg.
  await protokolliere({ wer: guard.userId, art: 'meldung_triagiert', bezugArt: 'plattform', bezugId: plattformBezug('meldung', meldungId), mitPasskey: guard.mitPasskey })

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DEV] Meldung triagiert: ${new Date().toISOString()} admin=${guard.userId} meldung=${meldungId} status=${triage.status}`)
  }

  revalidatePath('/admin')
  revalidatePath('/admin/meldungen')
  revalidatePath(`/admin/meldungen/${meldungId}`)
  revalidatePath('/meldungen')
  return {}
}

// ─── Reiter „Meldungen": Zusammenfassen, Trennen, Stand für alle ────────────
// (Register N14, Ergänzung; Nachtlauf Nr. 101). triageMeldungAction bleibt der
// eine Schreibweg für eine einzelne Meldung — Zusammenfassen und Trennen rufen
// sie mit dem gespeicherten Stand und dem Ausgangsstand auf.

const TRIAGE_AUSWAHL = { status: true, art: true, clusterKey: true, triageNotiz: true, duplikatVonId: true, sprintName: true, antwortAnMelder: true } as const

const MELDUNG_FEHLT = 'Meldung nicht gefunden.'

/**
 * Zusammenfassen (Mockup admin-postfach-zusammenfassen): die eine Meldung wird
 * Duplikat der anderen — über triageMeldungAction, also mit derselben
 * Existenz- und Selbstprüfung und derselben Bedingung gegen
 * Zwischenänderungen. Keine Kette: Die Hauptmeldung ist weder Duplikat noch
 * abgelegt, und eine Meldung mit eigenen Duplikaten wird nicht selbst eines
 * (sonst zählten deren Stimmen nirgends). Dass die Hauptmeldung kein Duplikat
 * ist, gilt seit Nr. 105 auch beim Schreiben selbst (schreibeTriageMitVerweis,
 * Bedingung derselben Anweisung). Kein Mail an den Hof.
 */
export async function fasseZusammenAction(eingabe: unknown): Promise<{ error?: string }> {
  const guard = await verlangeAdminAktion({ recht: 'ansehen' })
  if ('error' in guard) return { error: guard.error }
  const parsed = zusammenfassenSchema.safeParse(eingabe)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
  const { duplikatId, hauptmeldungId } = parsed.data

  const [stand, haupt, eigeneDuplikate] = await Promise.all([
    prisma.meldung.findUnique({ where: { id: duplikatId }, select: TRIAGE_AUSWAHL }),
    prisma.meldung.findUnique({ where: { id: hauptmeldungId }, select: { status: true } }),
    prisma.meldung.count({ where: { status: 'DUPLIKAT', duplikatVonId: duplikatId } }),
  ])
  if (!stand || !haupt) return { error: MELDUNG_FEHLT }
  if (stand.status === 'DUPLIKAT') return { error: 'Diese Meldung ist schon ein Duplikat – trenn sie zuerst.' }
  if (haupt.status === 'DUPLIKAT' || haupt.status === 'KEIN_FEHLER') return { error: 'Als Hauptmeldung geht nur eine offene oder erledigte Meldung.' }
  if (eigeneDuplikate > 0) return { error: 'An dieser Meldung hängen schon Duplikate – nimm sie als Hauptmeldung (Tauschen).' }

  return triageMeldungAction(duplikatId, triageAufruf(stand satisfies TriageStand, { status: 'DUPLIKAT', duplikatVonId: hauptmeldungId }))
}

/** Trennen in „Woraus": Das Duplikat wird wieder eine eigene, angesehene Meldung (GEPRUEFT, ohne Verweis). */
export async function trenneDuplikatAction(eingabe: unknown): Promise<{ error?: string }> {
  const guard = await verlangeAdminAktion({ recht: 'ansehen' })
  if ('error' in guard) return { error: guard.error }
  const parsed = trennenSchema.safeParse(eingabe)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }

  const stand = await prisma.meldung.findUnique({ where: { id: parsed.data.meldungId }, select: TRIAGE_AUSWAHL })
  if (!stand) return { error: MELDUNG_FEHLT }
  if (stand.status !== 'DUPLIKAT') return { error: 'Diese Meldung ist kein Duplikat mehr – lade die Seite neu.' }
  return triageMeldungAction(parsed.data.meldungId, triageAufruf(stand, { status: 'GEPRUEFT', duplikatVonId: null }))
}

export type BuendelStandErgebnis = { ok: true; meldungen: number; hoefe: number; kundinnen: number } | { error: string }

/** Ein Fehler beim Bescheid an Kundinnen geht ohne Adresse und ohne Text nach Sentry — nur Zahlen. */
function meldeBescheid(err: unknown, gescheitert: number): void {
  const meldung = new Error('Meldungen: Bescheid an Kundinnen nicht verschickt')
  meldung.name = err instanceof Error ? err.name : 'Unbekannt'
  Sentry.captureException(meldung, { level: 'warning', tags: { bereich: 'meldungen', aufgabe: 'bescheid-mail' }, extra: { gescheitert } })
}

/** Ein geworfenes Rundschreiben des Bescheids geht nur als Klasse nach Sentry — ohne Antwort, ohne Höfe. */
function meldeHofBescheid(err: unknown): void {
  const meldung = new Error('Meldungen: Bescheid an die Höfe nicht verschickt')
  meldung.name = err instanceof Error ? err.name : 'Unbekannt'
  Sentry.captureException(meldung, { level: 'warning', tags: { bereich: 'meldungen', aufgabe: 'bescheid-hoefe' } })
}

/**
 * Die Betriebsmail an Kundinnen mit Adresse für Rückfragen — je Kundin EIN
 * Auftrag der Warteschlange (Kann warten, Nr. 159), nie eine Schleife über
 * den Versand. Je Adresse zählt eine Meldung: Wer mehrere Wünsche im Bündel
 * hat, bekommt den Bescheid einmal. Adresse und Antwort lädt der Renderer
 * aus der Meldung.
 */
async function schreibeKundinnen(meldungIds: readonly string[], gespeichertAm: Date): Promise<void> {
  try {
    const [{ stelleMailEin }, { bescheidAuftraege }] = await Promise.all([import('@/server/mail-warteschlange'), import('@/server/mail-arten/kundin')])
    await stelleMailEin(bescheidAuftraege(meldungIds, gespeichertAm))
  } catch (err) {
    meldeBescheid(err, meldungIds.length)
  }
}

/**
 * „Stand für alle" eines Bündels (Mockup admin-postfach-wuensche): EINE
 * Transaktion über genau die Meldungen des Bündels — Wünsche mit diesem
 * Stichwort, keine Duplikate. Duplikate bleiben Duplikat und zeigen den
 * neuen Stand über ihre Hauptmeldung (oeffentlicherStatus); sie bekommen nur
 * die Antwort, damit ihr Hof sie bei seiner Meldung liest. Bescheid an die
 * Höfe über die bestehende Rundschreiben-Logik mit „Ausgewählte" (eine
 * Nachricht je Hof, kein Massenmail), an Kundinnen mit Adresse als
 * Betriebsmail (je Kundin ein Auftrag der Warteschlange, Nr. 159). Ein gescheiterter Bescheid dreht den
 * gespeicherten Stand nicht zurück; die Kundinnen-Mail und das Neuladen
 * laufen trotzdem, erst danach kommt der Satz (Nr. 105). Die 90-Tage-Uhr
 * (triagedAt) läuft nur neu, wo sich der Stand ändert; zurück auf Gesammelt
 * leert „Geplant in".
 */
export async function setzeBuendelStandAction(eingabe: unknown): Promise<BuendelStandErgebnis> {
  const guard = await verlangeAdminAktion({ recht: 'ansehen' })
  if ('error' in guard) return { error: guard.error }
  const parsed = buendelStandSchema.safeParse(eingabe)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
  const { clusterKey, stand, sprintName, antwort, bescheid } = parsed.data
  if (stand === 'nichtGeplant' && antwort === null) return { error: WUENSCHE_TEXT.antwortPflicht }
  if (bescheid === 'hoefe' && antwort === null) return { error: WUENSCHE_TEXT.bescheidBrauchtAntwort }

  const jetzt = new Date()
  const betroffen = await prisma.$transaction(async (tx) => {
    const buendel = { clusterKey, art: 'WUNSCH', status: { not: 'DUPLIKAT' } } as const
    const eigene = await tx.meldung.findMany({ where: buendel, select: { id: true, farmId: true, customerEmail: true } })
    if (eigene.length === 0) return null
    const ids = eigene.map((m) => m.id)
    const duplikate = await tx.meldung.findMany({ where: { status: 'DUPLIKAT', duplikatVonId: { in: ids } }, select: { id: true, farmId: true, customerEmail: true } })
    const ziel = BUENDEL_STAND_STATUS[stand]
    // Nur wessen Stand sich ändert, bekommt einen neuen Abschluss: triagedAt
    // ist die 90-Tage-Uhr bis zum Löschen (Nr. 105, Nacharbeit 101) —
    // erneutes Speichern ohne Wechsel stellt sie nicht zurück.
    await tx.meldung.updateMany({ where: { ...buendel, id: { in: ids }, AND: [{ status: { not: ziel } }] }, data: { status: ziel, triagedAt: jetzt } })
    // „Geplant in" gilt nur für Geplant; zurück auf Gesammelt ist der Wunsch nicht mehr eingeplant.
    const sprint = stand === 'gesammelt' ? { sprintName: null } : stand === 'geplant' && sprintName !== null ? { sprintName } : {}
    const rest = { ...sprint, ...(antwort !== null ? { antwortAnMelder: antwort } : {}) }
    if (Object.keys(rest).length > 0) await tx.meldung.updateMany({ where: { ...buendel, id: { in: ids } }, data: rest })
    if (antwort !== null && duplikate.length > 0) {
      await tx.meldung.updateMany({ where: { id: { in: duplikate.map((d) => d.id) }, status: 'DUPLIKAT' }, data: { antwortAnMelder: antwort } })
    }
    return [...eigene, ...duplikate]
  })
  if (!betroffen) return { error: 'Dieses Bündel gibt es nicht mehr – lade die Seite neu.' }
  // Bezug ist die erste Meldung des Bündels (eine Kennung) — das Stichwort ist Freitext und bleibt draußen.
  await protokolliere({ wer: guard.userId, art: 'meldung_buendel_stand', bezugArt: 'plattform', bezugId: plattformBezug('meldung', betroffen[0].id), mitPasskey: guard.mitPasskey })

  const hofIds = [...new Set(betroffen.flatMap((m) => (m.farmId ? [m.farmId] : [])))]
  // Je Adresse eine Meldung — eine Kundin bekommt den Bescheid einmal.
  const kundinnen = [...new Map(betroffen.flatMap((m) => (!m.farmId && m.customerEmail ? [[m.customerEmail.trim().toLowerCase(), m.id] as const] : []))).values()]
  const geschrieben = { hoefe: 0, kundinnen: 0 }
  let hofBescheidGescheitert = false
  if (bescheid === 'hoefe' && antwort !== null) {
    if (hofIds.length > 0) {
      // Eigener try (Nr. 105, Nacharbeit 101): Der Stand ist schon gespeichert —
      // scheitert das Rundschreiben, laufen Kundinnen-Mail und Neuladen trotzdem.
      try {
        // Derselbe Versand wie ein Rundschreiben, aber mit der Wache DIESER Aktion (N20, Ergänzung 23.10.2026) — keine eigene frische Bestätigung.
        const gesendet = await verschickeRundschreiben(
          {
            titel: WUENSCHE_TEXT.bescheidTitel,
            text: antwort,
            art: 'INFO',
            link: MEINE_MELDUNGEN_HREF,
            perMail: false,
            antwortMoeglich: false,
            empfaenger: { art: 'ausgewaehlt', hofIds },
          },
          guard.userId
        )
        // Die Rundschreiben-Logik schreibt nur nicht stillgelegten Höfen — gezählt wird, wer die Nachricht wirklich bekam.
        if ('error' in gesendet) hofBescheidGescheitert = true
        else geschrieben.hoefe = gesendet.empfaenger
      } catch (err) {
        hofBescheidGescheitert = true
        meldeHofBescheid(err)
      }
    }
    if (kundinnen.length > 0) await schreibeKundinnen(kundinnen, jetzt)
    geschrieben.kundinnen = kundinnen.length
  }

  revalidatePath('/admin')
  revalidatePath('/admin/postfach')
  revalidatePath('/meldungen')
  if (hofBescheidGescheitert) return { error: WUENSCHE_TEXT.bescheidNichtGesendet }
  return { ok: true, meldungen: betroffen.length, ...geschrieben }
}

/**
 * Ablegen aus dem Kartenmenü (Mockup admin-postfach-meldungen-ablauf; Nr. 105,
 * Nacharbeit 101): eine schmale Action statt des vollen Triage-Wegs. Sie setzt
 * nur KEIN_FEHLER, die Antwort an den Melder (Pflicht, geprüft am Server) und
 * den Abschluss — und nur, solange die Meldung noch den Status hat, den die
 * Karte zeigte. Schon Abgelegtes und Duplikate legt sie nie ab.
 */
export async function legeMeldungAbAction(eingabe: unknown): Promise<{ error?: string }> {
  // Heikel (Audit D10; Nr. 188): Ablegen schließt die Meldung und schreibt dem Hof — frisch mit Passkey bestätigt, „ansehen“ genügt.
  const guard = await verlangeFrischeBestaetigung({ recht: 'ansehen' })
  if ('error' in guard) return { error: guard.error }
  const parsed = ablegenSchema.safeParse(eingabe)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
  const { meldungId, antwort, vorherStatus } = parsed.data

  const { count } = await prisma.meldung.updateMany({
    where: { id: meldungId, status: { equals: vorherStatus, notIn: ['KEIN_FEHLER', 'DUPLIKAT'] } },
    data: { status: 'KEIN_FEHLER', antwortAnMelder: antwort, triagedAt: new Date() },
  })
  if (count === 0) return { error: MELDUNG_GEAENDERT }
  await protokolliere({ wer: guard.userId, art: 'meldung_abgelegt', bezugArt: 'plattform', bezugId: plattformBezug('meldung', meldungId), mitPasskey: guard.mitPasskey })

  revalidatePath('/admin')
  revalidatePath('/admin/postfach')
  revalidatePath('/meldungen')
  return {}
}
