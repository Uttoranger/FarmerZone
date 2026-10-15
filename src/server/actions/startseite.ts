'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { draftMode } from 'next/headers'
import type { Prisma, StartseiteArt } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { verlangeAdminAktion } from '@/server/admin-wache'
import { OEFFENTLICH_SICHTBAR } from '@/server/queries/farm'
import { erzeugeVorschauPfad } from '@/server/startseite-vorschau'
import { blobSpeicherAusSchluessel, istEigeneStartseitenBildUrl } from '@/lib/upload-pfade'
import {
  NEUER_BLOCK,
  REIHENFOLGE_FEHLER_TEXT,
  STARTSEITE_CACHE_TAG,
  pruefeReihenfolge,
  standText,
  standZeitpunkt,
  wienerZeitpunkt,
} from '@/lib/startseite-gestalten'
import {
  EIGENE_STARTSEITE_SAETZE,
  STARTSEITE_SAETZE,
  blockLoeschenSchema,
  startseiteSpeichernSchema,
  vorschauAnfrageSchema,
  type StartseitenBlockGeprueft,
} from '@/schemas/startseite'

/*
 * Admin › Startseite (Register N16, Nr. 96): speichern, Block löschen,
 * Vorschau-Link. Nur der Admin (frisch aus der Datenbank, verlangeAdminAktion);
 * Zod über jede Eingabe; was nur die Datenbank weiß (feste Abschnitte,
 * freigeschaltete Höfe, eigenes Bild), prüft der Server selbst.
 */

const ADMIN_STARTSEITE_HREF = '/admin/startseite'

const SATZ = {
  veraltet: 'Die Startseite wurde inzwischen geändert. Lade die Seite neu und versuch es noch einmal.',
  hoefe: 'Wähle nur freigeschaltete Höfe.',
  bild: 'Dieses Bild konnten wir nicht übernehmen. Bitte lade es noch einmal hoch.',
  keinBlock: 'Es ist gerade kein Block geplant.',
} as const

/** Die Zod-Meldung, wenn sie ein eigener Satz ist — sonst ein fester Satz (sonst käme Zods englischer Text). */
function satzAus(meldung: string | undefined): string {
  return meldung !== undefined && EIGENE_STARTSEITE_SAETZE.has(meldung) ? meldung : STARTSEITE_SAETZE.ungueltig
}

/**
 * Nur die Felder, die zur Vorlage gehören: Höfe nur bei der Höfe-Auswahl,
 * die Kategorie nur beim Kategorie-Hinweis, das Bild nur bei der Saisonkarte,
 * das Hinweisband ist ein Satz (nur Titel und Link) — ein Wechsel der Vorlage
 * lässt keine unsichtbaren Reste stehen.
 */
function blockDaten(b: StartseitenBlockGeprueft, liveAb: Date, liveBis: Date | null) {
  return {
    vorlage: b.vorlage,
    ueberzeile: b.vorlage === 'HINWEISBAND' ? null : b.ueberzeile,
    titel: b.titel,
    text: b.vorlage === 'HINWEISBAND' ? null : b.text,
    bildUrl: b.vorlage === 'SAISONKARTE' ? b.bildUrl : null,
    linkUrl: b.linkUrl,
    linkText: b.linkUrl ? b.linkText : null,
    farmIds: b.vorlage === 'HOEFE_AUSWAHL' ? b.farmIds : [],
    kategorie: b.vorlage === 'KATEGORIE_HINWEIS' ? b.kategorie : null,
    liveAb,
    liveBis,
  } satisfies Prisma.StartseiteBlockUpdateInput
}

/**
 * Speichern = EINE Transaktion: Reihenfolge und Auge aller Abschnitte und
 * höchstens ein Block (neu oder geändert). Die Reihenfolge muss genau die
 * Zeilen der Datenbank enthalten (sonst hat jemand anderes inzwischen
 * gespeichert) und die Regeln der festen Abschnitte erfüllen
 * (pruefeReihenfolge) — geprüft vor dem ersten Schreiben, ein Fehler ändert
 * nichts.
 */
export async function speichereStartseite(
  eingabe: unknown
): Promise<{ ok: true; blockId: string | null } | { error: string }> {
  const guard = await verlangeAdminAktion()
  if ('error' in guard) return { error: guard.error }

  const geprueft = startseiteSpeichernSchema.safeParse(eingabe)
  if (!geprueft.success) return { error: satzAus(geprueft.error.issues[0]?.message) }
  const { reihenfolge, block } = geprueft.data

  let daten: ReturnType<typeof blockDaten> | null = null
  if (block) {
    const liveAb = wienerZeitpunkt(block.liveAbTag, block.liveAbUhrzeit)
    const liveBis = block.liveBisTag ? wienerZeitpunkt(block.liveBisTag, block.liveBisUhrzeit ?? '23:59') : null
    // Das Schema hat beide Zeitpunkte schon geprüft; das hier hält nur den Typ.
    if (!liveAb || (block.liveBisTag && !liveBis)) return { error: STARTSEITE_SAETZE.umstellung }
    daten = blockDaten(block, liveAb, liveBis)
    if (daten.farmIds.length > 0) {
      const freigeschaltet = await prisma.farm.count({ where: { id: { in: daten.farmIds }, ...OEFFENTLICH_SICHTBAR } })
      if (freigeschaltet !== daten.farmIds.length) return { error: SATZ.hoefe }
    }
  }

  const neuerBlock = block !== null && block.id === undefined
  const neuIndex = reihenfolge.findIndex((r) => r.id === NEUER_BLOCK)
  if (reihenfolge.filter((r) => r.id === NEUER_BLOCK).length > 1 || (neuIndex >= 0) !== neuerBlock) {
    return { error: SATZ.veraltet }
  }
  const speicher = blobSpeicherAusSchluessel(process.env.BLOB_READ_WRITE_TOKEN)

  const ergebnis = await prisma.$transaction(async (tx): Promise<{ ok: true; blockId: string | null } | { error: string }> => {
    const zeilen = await tx.startseiteAbschnitt.findMany({
      select: { id: true, art: true, blockId: true, block: { select: { bildUrl: true } } },
    })
    const nachId = new Map(zeilen.map((z) => [z.id, z]))
    const bekannte = reihenfolge.filter((r) => r.id !== NEUER_BLOCK).map((r) => r.id)
    if (new Set(bekannte).size !== bekannte.length || bekannte.length !== zeilen.length || bekannte.some((id) => !nachId.has(id))) {
      return { error: SATZ.veraltet }
    }

    // Jede Kennung außer NEUER_BLOCK steht nach der Prüfung oben in nachId.
    const liste = reihenfolge.map((r) => ({
      art: (r.id === NEUER_BLOCK ? 'BLOCK' : nachId.get(r.id)?.art) as StartseiteArt,
      sichtbar: r.sichtbar,
    }))
    const fehler = pruefeReihenfolge(liste)
    if (fehler) return { error: REIHENFOLGE_FEHLER_TEXT[fehler] }

    let blockId: string | null = block?.id ?? null
    if (block && daten) {
      const bisher = block.id ? zeilen.find((z) => z.blockId === block.id) : undefined
      if (block.id && !bisher) return { error: SATZ.veraltet }
      // Nur eigene Startseiten-Bilder — oder das schon gespeicherte unverändert.
      if (daten.bildUrl && !istEigeneStartseitenBildUrl(daten.bildUrl, speicher) && daten.bildUrl !== bisher?.block?.bildUrl) {
        return { error: SATZ.bild }
      }
      if (block.id) {
        await tx.startseiteBlock.update({ where: { id: block.id }, data: daten })
      } else {
        const neu = await tx.startseiteBlock.create({ data: { ...daten, erstelltVonUserId: guard.userId }, select: { id: true } })
        blockId = neu.id
        await tx.startseiteAbschnitt.create({
          data: { art: 'BLOCK', position: neuIndex, sichtbar: reihenfolge[neuIndex]?.sichtbar ?? true, blockId: neu.id },
        })
      }
    }

    // Nacheinander, nie Promise.all im Transaktions-Client (CODING_STANDARDS §4).
    for (const [position, r] of reihenfolge.entries()) {
      if (r.id === NEUER_BLOCK) continue
      await tx.startseiteAbschnitt.update({ where: { id: r.id }, data: { position, sichtbar: r.sichtbar } })
    }
    return { ok: true, blockId }
  })

  if ('error' in ergebnis) return ergebnis
  // updateTag statt revalidateTag: In Next 16 verlangt revalidateTag ein Profil (wie Nr. 93/95).
  updateTag(STARTSEITE_CACHE_TAG)
  revalidatePath('/')
  revalidatePath(ADMIN_STARTSEITE_HREF)
  return ergebnis
}

/** Einen Block löschen — seine Zeile in der Liste fällt mit (Cascade). Lücken in den Positionen stören nicht. */
export async function loescheStartseitenBlock(eingabe: unknown): Promise<{ ok: true } | { error: string }> {
  const guard = await verlangeAdminAktion()
  if ('error' in guard) return { error: guard.error }
  const geprueft = blockLoeschenSchema.safeParse(eingabe)
  if (!geprueft.success) return { error: STARTSEITE_SAETZE.ungueltig }

  const { count } = await prisma.startseiteBlock.deleteMany({ where: { id: geprueft.data.blockId } })
  if (count === 0) return { error: SATZ.veraltet }
  updateTag(STARTSEITE_CACHE_TAG)
  revalidatePath('/')
  revalidatePath(ADMIN_STARTSEITE_HREF)
  return { ok: true }
}

/**
 * „Vorschau öffnen" und „So sieht's die Kundin": der signierte Link für den
 * gewählten Stand (heute, +1 Woche, nächster Block). Schaltet für den
 * Browser des Admins den Draft Mode ein — nur dann rendert die sonst
 * statische Startseite je Anfrage und liest den Link (src/app/page.tsx).
 */
export async function erzeugeStartseitenVorschau(
  eingabe: unknown
): Promise<{ ok: true; pfad: string; stand: string } | { error: string }> {
  const guard = await verlangeAdminAktion()
  if ('error' in guard) return { error: guard.error }
  const geprueft = vorschauAnfrageSchema.safeParse(eingabe)
  if (!geprueft.success) return { error: STARTSEITE_SAETZE.ungueltig }

  const jetzt = new Date()
  const bloecke = geprueft.data.stand === 'block' ? await prisma.startseiteBlock.findMany({ select: { liveAb: true, liveBis: true } }) : []
  const datum = standZeitpunkt(geprueft.data.stand, jetzt, bloecke)
  if (!datum) return { error: SATZ.keinBlock }

  ;(await draftMode()).enable()
  return { ok: true, pfad: erzeugeVorschauPfad({ datum, blockEntwurfId: geprueft.data.blockEntwurfId }, jetzt), stand: standText(datum) }
}
