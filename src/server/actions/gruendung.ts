'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { verlangeAdminAktion } from '@/server/admin-wache'
import { ladeHoefeFuerFestschreiben, ladeHoefeFuerGruendung, leseGruendungEinstellung } from '@/server/queries/admin'
import { HOEFE_CACHE_TAG } from '@/lib/hofuebersicht'
import { STARTSEITE_CACHE_TAG } from '@/lib/startseite-gestalten'
import { ADMIN_EINSTELLUNGEN_HREF, EINSTELLUNGEN_TEXT, PLATTFORM_EINSTELLUNG_ID, PLATTFORM_EINSTELLUNG_TAG } from '@/lib/plattform-einstellung'
import {
  GRUENDUNGSPLAETZE_SPERRE,
  TESTHOF_ZAEHLT_NIE,
  aktionLaeuft,
  bildeGruendungBis,
  festschreibenBrauchtPlaetze,
  festschreibenListe,
  gruendungAlleVergeben,
  gruendungsplaetze,
  istGruendungshof,
  wiederAufnahmeMoeglich,
  zusageBeiFreischaltung,
} from '@/lib/gruendungshof'
import {
  GRUENDUNG_AKTION_VORBEI,
  GRUENDUNG_AUSNEHMEN_GEAENDERT,
  GRUENDUNG_AUSNEHMEN_ZUSTIMMUNG_FEHLT,
  GRUENDUNG_EINGABE_UNGUELTIG,
  GRUENDUNG_NUR_FREIGESCHALTET,
  TESTHOF_HAKEN_FEHLT,
  TESTHOF_NUR_FREIGESCHALTET,
  markiereAlsTesthofSchema,
  nimmAusGruendungSchema,
  nimmTesthofZurueckSchema,
  nimmWiederAufSchema,
  schreibeZusagenFestSchema,
} from '@/schemas/gruendung'

/*
 * Gründungshöfe: Testhöfe ausnehmen (Register K2, Ergänzung 16.10.2026,
 * Nachtlauf Nr. 109) und — seit Nr. 116 (Register K2, Änderung 19.10.2026) —
 * die Zusagen einmal festschreiben. Vor dem Festschreiben ist die Nummer eine
 * Reihenfolge: Die Höfe danach rücken auf bzw. eine Nummer weiter. Danach
 * steht sie je Hof fest: Ausnehmen gibt den Platz frei, eine Wiederaufnahme
 * bekommt die kleinste freie Nummer, solange die Aktion läuft.
 *
 * SPERRE: Alle Wege (auch approveFarmAction, die Einstellungen und
 * reactivateFarm) nehmen in ihrer Transaktion dieselbe Advisory-Sperre
 * (GRUENDUNGSPLAETZE_SPERRE) und lesen Einstellung und Höfe erst danach — so
 * vergeben zwei Wege nie gleichzeitig denselben letzten Platz. Die Sperre
 * endet mit der Transaktion.
 *
 * Keine Nachricht an einen Hof, keine Mail — auch nicht an einen Hof, der
 * dadurch neu Gründungshof wird (K2).
 */

type Ergebnis = { ok: true } | { error: string }

/** Die Seiten, die Plätze zählen oder zeigen. Der Satz der Startseite kommt frisch aus gruendungFuerSeiten, nicht aus dem Cache der Fassung — ein Pfad genügt. */
function revalidiereGruendung(): void {
  revalidatePath('/admin')
  revalidatePath(ADMIN_EINSTELLUNGEN_HREF)
  revalidatePath('/fuer-hoefe')
  revalidatePath('/register')
  revalidatePath('/konditionen')
  revalidatePath('/')
  // Das Abzeichen hängt am Platz — die Höfe-Liste und die Startseite lesen über den Fünf-Minuten-Cache.
  updateTag(HOEFE_CACHE_TAG)
}

/**
 * „Nicht als Gründungshof zählen“: Hält der Hof gerade einen Platz, nur mit
 * `bestaetigt` (Testhof oder Zustimmung des Hofs — zugesagte Konditionen
 * bleiben sonst, K1). Bedingt geschrieben (`gruendungAusgenommen: false`):
 * Zweimal ausnehmen ändert nichts, auch nicht „zuletzt geändert“.
 * Festgeschrieben gibt das Ausnehmen den Platz frei (`gruendungPlatz` null);
 * das Ende bleibt gespeichert — eine spätere Wiederaufnahme wird nie kürzer.
 */
export async function nimmAusGruendung(eingabe: unknown): Promise<Ergebnis> {
  const guard = await verlangeAdminAktion()
  if ('error' in guard) return { error: guard.error }

  const parsed = nimmAusGruendungSchema.safeParse(eingabe)
  if (!parsed.success) return { error: GRUENDUNG_EINGABE_UNGUELTIG }
  const { farmId, bestaetigt } = parsed.data

  const ergebnis = await prisma.$transaction(async (tx): Promise<Ergebnis> => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${GRUENDUNGSPLAETZE_SPERRE})`
    // Nach der Sperre gelesen: die Einstellung und der Stand nach jedem anderen Weg, der gerade vergab.
    const { plaetze } = await leseGruendungEinstellung(tx)
    const hoefe = await ladeHoefeFuerGruendung(tx)
    const hof = hoefe.find((h) => h.id === farmId)
    if (!hof || hof.approvedAt === null || hof.archivedAt !== null) return { error: GRUENDUNG_NUR_FREIGESCHALTET }
    if (istGruendungshof(farmId, hoefe, plaetze) && !bestaetigt) return { error: GRUENDUNG_AUSNEHMEN_ZUSTIMMUNG_FEHLT }

    const { count } = await tx.farm.updateMany({
      where: { id: farmId, gruendungAusgenommen: false, approvedAt: { not: null }, archivedAt: null },
      data: { gruendungAusgenommen: true, gruendungPlatz: null, gruendungGeaendertAm: new Date(), gruendungGeaendertVonUserId: guard.userId },
    })
    return count === 0 ? { error: GRUENDUNG_AUSNEHMEN_GEAENDERT } : { ok: true }
  })
  if ('error' in ergebnis) return ergebnis

  revalidiereGruendung()
  return { ok: true }
}

/**
 * „Wieder als Gründungshof zählen“. Vor dem Festschreiben nur, wenn danach
 * höchstens so viele Höfe im Rennen sind, wie die Einstellung Plätze hat —
 * so verliert nie ein anderer Hof seine Zusage. Danach nur, solange die
 * Aktion läuft und ein Platz frei ist: die kleinste freie Nummer, Ende nach
 * `zusageEnde` ab heute, nie kürzer als ein noch gespeichertes Ende (K1).
 * Bedingt geschrieben (`gruendungAusgenommen: true`).
 */
export async function nimmWiederAuf(eingabe: unknown): Promise<Ergebnis> {
  const guard = await verlangeAdminAktion()
  if ('error' in guard) return { error: guard.error }

  const parsed = nimmWiederAufSchema.safeParse(eingabe)
  if (!parsed.success) return { error: GRUENDUNG_EINGABE_UNGUELTIG }
  const { farmId } = parsed.data

  let ergebnis: Ergebnis
  try {
    ergebnis = await prisma.$transaction(async (tx): Promise<Ergebnis> => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${GRUENDUNGSPLAETZE_SPERRE})`
      const einstellung = await leseGruendungEinstellung(tx)
      const hoefe = await ladeHoefeFuerGruendung(tx)
      const hof = hoefe.find((h) => h.id === farmId)
      if (!hof || hof.approvedAt === null || hof.archivedAt !== null) return { error: GRUENDUNG_NUR_FREIGESCHALTET }
      // Ein Testhof ist immer ausgenommen (Register N21) — wieder zählen erst nach „Kein Testhof mehr“.
      const merkmal = await tx.farm.findUnique({ where: { id: farmId }, select: { istTesthof: true } })
      if (merkmal?.istTesthof === true) return { error: TESTHOF_ZAEHLT_NIE }

      // Festgeschrieben: Platz nur, solange die Aktion läuft und eine Nummer frei ist.
      let platz: { gruendungPlatz: number; gruendungBis: Date } | null = null
      if (einstellung.festAm !== null && hof.gruendungAusgenommen) {
        const jetzt = new Date()
        const vergeben = gruendungsplaetze(hoefe).size
        if (!aktionLaeuft(jetzt, einstellung, vergeben)) {
          return { error: vergeben >= einstellung.plaetze ? gruendungAlleVergeben(einstellung.plaetze) : GRUENDUNG_AKTION_VORBEI }
        }
        const zusage = zusageBeiFreischaltung({ id: farmId, gruendungPlatz: null, gruendungBis: hof.gruendungBis }, hoefe, einstellung, jetzt)
        if (zusage === null) return { error: gruendungAlleVergeben(einstellung.plaetze) }
        platz = { gruendungPlatz: zusage.platz, gruendungBis: bildeGruendungBis(zusage.bisTag) }
      } else if (hof.gruendungAusgenommen && !wiederAufnahmeMoeglich(farmId, hoefe, einstellung.plaetze)) {
        // Dieselbe Regel wie der Menüeintrag im Admin (folgenDerAenderung), hier mit dem Stand nach der Sperre.
        return { error: gruendungAlleVergeben(einstellung.plaetze) }
      }

      const { count } = await tx.farm.updateMany({
        where: { id: farmId, gruendungAusgenommen: true, istTesthof: false, approvedAt: { not: null }, archivedAt: null },
        data: { gruendungAusgenommen: false, ...platz, gruendungGeaendertAm: new Date(), gruendungGeaendertVonUserId: guard.userId },
      })
      return count === 0 ? { error: GRUENDUNG_AUSNEHMEN_GEAENDERT } : { ok: true }
    })
  } catch (err) {
    // Die Sperre schließt eine doppelte Nummer aus; greift doch der eindeutige Index, ändert sich nichts.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return { error: GRUENDUNG_AUSNEHMEN_GEAENDERT }
    throw err
  }
  if ('error' in ergebnis) return ergebnis

  revalidiereGruendung()
  return { ok: true }
}

/**
 * „Zusagen festschreiben“ (Register K2, Änderung Nr. 116) — heikle Aktion,
 * genau einmal. In EINER Transaktion unter der Sperre: Zuerst wird
 * `gruendungFestAm` bedingt gesetzt (nur, solange es leer ist — zweimal trifft
 * nichts und wird abgewiesen), dann bekommt jeder Hof der Liste
 * (`festschreibenListe`: alle freigeschalteten, nicht ausgenommenen in der
 * heutigen Reihenfolge, auch stillgelegte, bis zur Zahl der Plätze) seinen
 * Platz und das spätere von bisherigem und neuem Ende — nie kürzer (K1).
 * Verlöre ein Hof dabei seinen Platz, geht es nicht (erst die Plätze erhöhen).
 * Keine Nachricht, keine Mail: Für die Höfe ändert sich nur das Datum.
 */
export async function schreibeZusagenFest(eingabe: unknown): Promise<Ergebnis> {
  const guard = await verlangeAdminAktion()
  if ('error' in guard) return { error: guard.error }

  const parsed = schreibeZusagenFestSchema.safeParse(eingabe)
  if (!parsed.success) return { error: GRUENDUNG_EINGABE_UNGUELTIG }

  const TEXT = EINSTELLUNGEN_TEXT.gruendung
  let ergebnis: Ergebnis
  try {
    ergebnis = await prisma.$transaction(async (tx): Promise<Ergebnis> => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${GRUENDUNGSPLAETZE_SPERRE})`
      const einstellung = await leseGruendungEinstellung(tx)
      if (einstellung.festAm !== null) return { error: TEXT.festschreibenSchon }
      const hoefe = await ladeHoefeFuerFestschreiben(tx)
      const noetig = festschreibenBrauchtPlaetze(hoefe, einstellung)
      if (noetig !== null) return { error: TEXT.festschreibenPlaetze(noetig) }

      // Bedingt: Nur wer als Erster kommt, setzt den Zeitpunkt. Ohne Zeile legt
      // die Migration sie an; fehlt sie doch, gibt es nichts festzuschreiben.
      const { count } = await tx.plattformEinstellung.updateMany({
        where: { id: PLATTFORM_EINSTELLUNG_ID, gruendungFestAm: null },
        data: { gruendungFestAm: new Date(), geaendertVonUserId: guard.userId },
      })
      if (count === 0) return { error: TEXT.festschreibenSchon }

      // Nacheinander, nie Promise.all (eine Abfrage zur Zeit in der Transaktion).
      for (const zeile of festschreibenListe(hoefe, einstellung)) {
        await tx.farm.update({
          where: { id: zeile.id },
          data: { gruendungPlatz: zeile.platz, gruendungBis: bildeGruendungBis(zeile.neuTag) },
        })
      }
      return { ok: true }
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return { error: TEXT.festschreibenFehler }
    throw err
  }
  if ('error' in ergebnis) return ergebnis

  updateTag(PLATTFORM_EINSTELLUNG_TAG)
  revalidiereGruendung()
  // Tarif-Zeile und „Dein Stand“ aller Höfe lesen das neue Ende.
  revalidatePath('/', 'layout')
  return { ok: true }
}

// === TESTHOF (Register N21, Nr. 119) ===

/** Wie `Ergebnis`, dazu der Slug für die Hofseite, die danach neu gebaut wird. */
type TesthofErgebnis = { ok: true; slug: string } | { error: string }

/**
 * Was ein Testhof-Wechsel ändert: alles, was Plätze zählt (revalidiereGruendung,
 * samt Höfe-Liste), dazu die Sitemap (sonst bis zu einer Stunde alt), die
 * Startseite (Fassungen mit diesem Hof) und seine Hofseite (Hinweis, noindex).
 */
function revalidiereTesthof(slug: string): void {
  revalidiereGruendung()
  revalidatePath('/sitemap.xml')
  updateTag(STARTSEITE_CACHE_TAG)
  revalidatePath(`/${slug}`)
}

/**
 * „Als Testhof markieren“: Der Hof verschwindet aus jeder Liste, Karte,
 * Zählung und Auswahl (IN_LISTEN_SICHTBAR) und ist zugleich ausgenommen — so
 * bleiben alle Regeln der Gründung, wie sie sind. Wie beim Ausnehmen nur für
 * einen freigeschalteten, nicht stillgelegten Hof, in EINER Transaktion unter
 * der Sperre; hält er einen Platz, nur mit dem eigenen Haken (`bestaetigt`),
 * und der Platz wird frei. Bedingt geschrieben (`istTesthof: false`): Zweimal
 * markieren ändert nichts, auch nicht „geändert am“. Keine Nachricht an den Hof.
 */
export async function markiereAlsTesthof(eingabe: unknown): Promise<Ergebnis> {
  const guard = await verlangeAdminAktion()
  if ('error' in guard) return { error: guard.error }

  const parsed = markiereAlsTesthofSchema.safeParse(eingabe)
  if (!parsed.success) return { error: GRUENDUNG_EINGABE_UNGUELTIG }
  const { farmId, bestaetigt } = parsed.data

  const ergebnis = await prisma.$transaction(async (tx): Promise<TesthofErgebnis> => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${GRUENDUNGSPLAETZE_SPERRE})`
    // Nach der Sperre gelesen: ob der Hof gerade einen Platz hält, nach jedem anderen Weg, der gerade vergab.
    const { plaetze } = await leseGruendungEinstellung(tx)
    const hoefe = await ladeHoefeFuerGruendung(tx)
    const hof = hoefe.find((h) => h.id === farmId)
    if (!hof || hof.approvedAt === null || hof.archivedAt !== null) return { error: TESTHOF_NUR_FREIGESCHALTET }
    if (istGruendungshof(farmId, hoefe, plaetze) && !bestaetigt) return { error: TESTHOF_HAKEN_FEHLT }

    const jetzt = new Date()
    const { count } = await tx.farm.updateMany({
      where: { id: farmId, istTesthof: false, approvedAt: { not: null }, archivedAt: null },
      data: {
        istTesthof: true,
        testhofGeaendertAm: jetzt,
        testhofGeaendertVonUserId: guard.userId,
        gruendungAusgenommen: true,
        gruendungPlatz: null,
        gruendungGeaendertAm: jetzt,
        gruendungGeaendertVonUserId: guard.userId,
      },
    })
    if (count === 0) return { error: GRUENDUNG_AUSNEHMEN_GEAENDERT }
    const { slug } = await tx.farm.findUniqueOrThrow({ where: { id: farmId }, select: { slug: true } })
    return { ok: true, slug }
  })
  if ('error' in ergebnis) return ergebnis

  revalidiereTesthof(ergebnis.slug)
  return { ok: true }
}

/**
 * „Kein Testhof mehr“: setzt nur das Merkmal zurück. Der Hof bleibt
 * ausgenommen — wieder zählen geht danach über „Wieder als Gründungshof
 * zählen“. Unter derselben Sperre wie Markieren und Wiederaufnahme, bedingt
 * geschrieben (`istTesthof: true`): Zweimal zurücknehmen ändert nichts.
 */
export async function nimmTesthofZurueck(eingabe: unknown): Promise<Ergebnis> {
  const guard = await verlangeAdminAktion()
  if ('error' in guard) return { error: guard.error }

  const parsed = nimmTesthofZurueckSchema.safeParse(eingabe)
  if (!parsed.success) return { error: GRUENDUNG_EINGABE_UNGUELTIG }
  const { farmId } = parsed.data

  const ergebnis = await prisma.$transaction(async (tx): Promise<TesthofErgebnis> => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${GRUENDUNGSPLAETZE_SPERRE})`
    const { count } = await tx.farm.updateMany({
      where: { id: farmId, istTesthof: true },
      data: { istTesthof: false, testhofGeaendertAm: new Date(), testhofGeaendertVonUserId: guard.userId },
    })
    if (count === 0) return { error: GRUENDUNG_AUSNEHMEN_GEAENDERT }
    const { slug } = await tx.farm.findUniqueOrThrow({ where: { id: farmId }, select: { slug: true } })
    return { ok: true, slug }
  })
  if ('error' in ergebnis) return ergebnis

  revalidiereTesthof(ergebnis.slug)
  return { ok: true }
}
