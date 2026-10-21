'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { draftMode } from 'next/headers'
import type { Prisma, StartseiteArt } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { verlangeAdminAktion } from '@/server/admin-wache'
import { IN_LISTEN_SICHTBAR } from '@/server/queries/farm'
import { ladeEntwurfAdmin, leseEntwurf, leseFassung, leseQuelle, naechsterTermin, type AdminStartseitenZeile } from '@/server/queries/startseite'
import { erzeugeVorschauAbfrage } from '@/server/startseite-vorschau'
import { blobSpeicherAusSchluessel, istEigeneStartseitenBildUrl } from '@/lib/upload-pfade'
import {
  ADMIN_STARTSEITE_HREF,
  ADMIN_STARTSEITE_VORSCHAU_HREF,
  NEUER_BLOCK,
  REIHENFOLGE_FEHLER_TEXT,
  STARTSEITE_CACHE_TAG,
  felderDerVorlage,
  neueZusatzArt,
  pruefeReihenfolge,
  standText,
  standZeitpunkt,
  zeitpunktAusEingabe,
} from '@/lib/startseite-gestalten'
import { entwurfAusBlock, pruefeTermin, standardFassung, veroeffentlichtText } from '@/lib/startseite-fassung'
import {
  EIGENE_STARTSEITE_SAETZE,
  STARTSEITE_SAETZE,
  blockLoeschenSchema,
  startseiteSpeichernSchema,
  vorschauAnfrageSchema,
  type StartseitenBlockGeprueft,
} from '@/schemas/startseite'
import {
  entwurfUebernehmenSchema,
  fassungInhaltSchema,
  fassungWahlSchema,
  veroeffentlichenSchema,
  type FassungInhalt,
} from '@/schemas/startseite-fassung'

/*
 * Admin › Startseite (Register N16, Nr. 96; Entwurf und Fassung seit Nr. 99):
 * Entwurf speichern, Block löschen, Vorschau-Link, Veröffentlichen,
 * Zurückziehen, Als Entwurf übernehmen. Nur der Admin (frisch aus der
 * Datenbank, verlangeAdminAktion); Zod über jede Eingabe; was nur die
 * Datenbank weiß (feste Abschnitte, freigeschaltete Höfe, eigenes Bild),
 * prüft der Server selbst.
 *
 * LIVE-WIRKUNG hat nur „Veröffentlichen …“ (jetzt: updateTag + revalidatePath
 * '/'). Entwurf speichern, Block löschen und Übernehmen ändern nur die
 * Tabellen des Entwurfs und erneuern nur /admin/startseite — eine Wache in
 * tests/startseite-aktion.test.ts hält das fest. Bilddateien löscht hier
 * nichts: Ein Bild kann noch in einer Fassung stehen.
 */

const SATZ = {
  veraltet: 'Die Startseite wurde inzwischen geändert. Lade die Seite neu und versuch es noch einmal.',
  hoefe: 'Wähle nur freigeschaltete Höfe.',
  bild: 'Dieses Bild konnten wir nicht übernehmen. Bitte lade es noch einmal hoch.',
  keinBlock: 'Es ist gerade kein Block geplant.',
  keinTermin: 'Es ist gerade nichts geplant.',
  vergangen: 'Dieser Zeitpunkt ist schon vorbei. Wähle einen späteren.',
  zuWeit: 'So weit voraus geht es nicht – höchstens ein Jahr.',
  entwurfKaputt: 'Der Entwurf lässt sich so nicht veröffentlichen. Lade die Seite neu und versuch es noch einmal.',
  schonLive: 'Diese Fassung ist schon live oder zurückgezogen. Lade die Seite neu.',
  keineFassung: 'Diese Fassung gibt es nicht mehr. Lade die Seite neu.',
} as const

/** Die Zod-Meldung, wenn sie ein eigener Satz ist — sonst ein fester Satz (sonst käme Zods englischer Text). */
function satzAus(meldung: string | undefined): string {
  return meldung !== undefined && EIGENE_STARTSEITE_SAETZE.has(meldung) ? meldung : STARTSEITE_SAETZE.ungueltig
}

/** Die Felder eines Blocks, wie die Tabelle sie speichert — nur die der Vorlage (felderDerVorlage). */
function blockDaten(b: StartseitenBlockGeprueft, liveAb: Date, liveBis: Date | null) {
  const felder = felderDerVorlage(b)
  return {
    vorlage: felder.vorlage,
    ueberzeile: felder.ueberzeile,
    titel: felder.titel,
    text: felder.text,
    bildUrl: felder.bildUrl,
    linkUrl: felder.linkUrl,
    linkText: felder.linkText,
    farmIds: felder.farmIds,
    kategorie: felder.kategorie,
    liveAb,
    liveBis,
  } satisfies Prisma.StartseiteBlockUpdateInput
}

/** Nur die Seite von Admin › Startseite — nie die öffentliche Startseite. */
function erneuereAdmin(): void {
  revalidatePath(ADMIN_STARTSEITE_HREF)
}

export type EntwurfGespeichert = {
  ok: true
  blockId: string | null
  /** Die Zeile eines neu angelegten Blocks — der Browser ersetzt damit `NEUER_BLOCK`. */
  zeilenId: string | null
  /** Hinzugefügte Zusatz-Abschnitte (Nr. 129): Kennung aus NEUER_ABSCHNITT → Kennung der neuen Zeile. */
  neueAbschnitte: Record<string, string>
  gespeichertAm: string
}

/**
 * Entwurf speichern = EINE Transaktion: Reihenfolge und Auge aller
 * Abschnitte und höchstens ein Block (neu oder geändert). Die Reihenfolge
 * muss genau die Zeilen der Datenbank enthalten (sonst hat jemand anderes
 * inzwischen gespeichert) und die Regeln der festen Abschnitte erfüllen
 * (pruefeReihenfolge) — geprüft vor dem ersten Schreiben, ein Fehler ändert
 * nichts. Die öffentliche Startseite bleibt, wie sie ist.
 */
export async function speichereEntwurf(eingabe: unknown): Promise<EntwurfGespeichert | { error: string }> {
  const guard = await verlangeAdminAktion()
  if ('error' in guard) return { error: guard.error }

  const geprueft = startseiteSpeichernSchema.safeParse(eingabe)
  if (!geprueft.success) return { error: satzAus(geprueft.error.issues[0]?.message) }
  const { reihenfolge, block } = geprueft.data

  let daten: ReturnType<typeof blockDaten> | null = null
  if (block) {
    const liveAb = zeitpunktAusEingabe(block.liveAbTag, block.liveAbUhrzeit)
    const liveBis = block.liveBisTag ? zeitpunktAusEingabe(block.liveBisTag, block.liveBisUhrzeit ?? '23:59') : null
    // Das Schema hat beide Zeitpunkte schon geprüft; das hier hält nur den Typ.
    if (!liveAb || (block.liveBisTag && !liveBis)) return { error: STARTSEITE_SAETZE.umstellung }
    daten = blockDaten(block, liveAb, liveBis)
    if (daten.farmIds.length > 0) {
      const freigeschaltet = await prisma.farm.count({ where: { id: { in: daten.farmIds }, ...IN_LISTEN_SICHTBAR } })
      if (freigeschaltet !== daten.farmIds.length) return { error: SATZ.hoefe }
    }
  }

  const neuerBlock = block !== null && block.id === undefined
  const neuIndex = reihenfolge.findIndex((r) => r.id === NEUER_BLOCK)
  if (reihenfolge.filter((r) => r.id === NEUER_BLOCK).length > 1 || (neuIndex >= 0) !== neuerBlock) {
    return { error: SATZ.veraltet }
  }
  // Ein hinzugefügter Zusatz-Abschnitt (Nr. 129) steht wie ein neuer Block unter einer festen Kennung (NEUER_ABSCHNITT).
  const neueZusatz = reihenfolge.filter((r) => neueZusatzArt(r.id) !== null).map((r) => r.id)
  if (new Set(neueZusatz).size !== neueZusatz.length) return { error: SATZ.veraltet }
  const istNeu = (id: string): boolean => id === NEUER_BLOCK || neueZusatzArt(id) !== null
  const speicher = blobSpeicherAusSchluessel(process.env.BLOB_READ_WRITE_TOKEN)

  const ergebnis = await prisma.$transaction(async (tx): Promise<Omit<EntwurfGespeichert, 'gespeichertAm'> | { error: string }> => {
    // Zwei Admins fügen denselben Abschnitt gleichzeitig hinzu: Die Sperre auf allen Zeilen reiht die zweite
    // Speicherung hinter die erste, und deren neue Zeile steht dann in der Liste unten — „veraltet“ statt doppelt.
    if (neueZusatz.length > 0) await tx.$queryRaw`SELECT "id" FROM "StartseiteAbschnitt" FOR UPDATE`
    const zeilen = await tx.startseiteAbschnitt.findMany({
      select: { id: true, art: true, blockId: true, block: { select: { bildUrl: true } } },
    })
    const nachId = new Map(zeilen.map((z) => [z.id, z]))
    const bekannte = reihenfolge.filter((r) => !istNeu(r.id)).map((r) => r.id)
    if (new Set(bekannte).size !== bekannte.length || bekannte.length !== zeilen.length || bekannte.some((id) => !nachId.has(id))) {
      return { error: SATZ.veraltet }
    }

    // Jede Kennung außer den neuen steht nach der Prüfung oben in nachId.
    const liste = reihenfolge.map((r) => ({
      art: (r.id === NEUER_BLOCK ? 'BLOCK' : (neueZusatzArt(r.id) ?? nachId.get(r.id)?.art)) as StartseiteArt,
      sichtbar: r.sichtbar,
    }))
    const fehler = pruefeReihenfolge(liste)
    if (fehler) return { error: REIHENFOLGE_FEHLER_TEXT[fehler] }

    let blockId: string | null = block?.id ?? null
    let zeilenId: string | null = null
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
        const zeile = await tx.startseiteAbschnitt.create({
          data: { art: 'BLOCK', position: neuIndex, sichtbar: reihenfolge[neuIndex]?.sichtbar ?? true, blockId: neu.id },
          select: { id: true },
        })
        zeilenId = zeile.id
      }
    }

    // Nacheinander, nie Promise.all im Transaktions-Client (CODING_STANDARDS §4).
    const neueAbschnitte: Record<string, string> = {}
    for (const [position, r] of reihenfolge.entries()) {
      if (r.id === NEUER_BLOCK) continue
      const zusatz = neueZusatzArt(r.id)
      if (zusatz) {
        const zeile = await tx.startseiteAbschnitt.create({ data: { art: zusatz, position, sichtbar: r.sichtbar }, select: { id: true } })
        neueAbschnitte[r.id] = zeile.id
        continue
      }
      await tx.startseiteAbschnitt.update({ where: { id: r.id }, data: { position, sichtbar: r.sichtbar } })
    }
    return { ok: true, blockId, zeilenId, neueAbschnitte }
  })

  if ('error' in ergebnis) return ergebnis
  erneuereAdmin()
  return { ...ergebnis, gespeichertAm: new Date().toISOString() }
}

/**
 * Einen Block aus dem Entwurf löschen — seine Zeile fällt mit (Cascade).
 * Lücken in den Positionen stören nicht. Die öffentliche Startseite bleibt;
 * steht der Block in einer Fassung, bleibt er dort samt Bild.
 */
export async function loescheStartseitenBlock(eingabe: unknown): Promise<{ ok: true } | { error: string }> {
  const guard = await verlangeAdminAktion()
  if ('error' in guard) return { error: guard.error }
  const geprueft = blockLoeschenSchema.safeParse(eingabe)
  if (!geprueft.success) return { error: STARTSEITE_SAETZE.ungueltig }

  const { count } = await prisma.startseiteBlock.deleteMany({ where: { id: geprueft.data.blockId } })
  if (count === 0) return { error: SATZ.veraltet }
  erneuereAdmin()
  return { ok: true }
}

/**
 * „Veröffentlichen …": liest den Entwurf und schreibt daraus eine Fassung in
 * EINER Transaktion — jetzt oder zu Datum und Uhrzeit in Wiener Zeit
 * (zeitpunktAusEingabe: dieselbe Umrechnung und dieselbe Prüfung der
 * Sommerzeit-Lücke wie beim Zeitraum eines Blocks). Ein Termin liegt höchstens
 * eine Minute zurück und höchstens 365 Tage voraus. Wer veröffentlicht hat,
 * steht in der Fassung.
 *
 * Jetzt: Datencache und Seite neu (updateTag + revalidatePath '/'). Termin:
 * nur der Datencache — er trägt den Zeitpunkt der nächsten Planung
 * (ladeStartseite), die Seite selbst ändert sich bis dahin nicht.
 */
export async function veroeffentlicheStartseite(
  eingabe: unknown
): Promise<{ ok: true; id: string; liveAb: string; text: string } | { error: string }> {
  const guard = await verlangeAdminAktion()
  if ('error' in guard) return { error: guard.error }
  const geprueft = veroeffentlichenSchema.safeParse(eingabe)
  if (!geprueft.success) return { error: STARTSEITE_SAETZE.ungueltig }

  const jetzt = new Date()
  let liveAb = jetzt
  if (geprueft.data.wann === 'termin') {
    const termin = zeitpunktAusEingabe(geprueft.data.datum, geprueft.data.uhrzeit)
    if (!termin) return { error: STARTSEITE_SAETZE.umstellung }
    const fehler = pruefeTermin(termin, jetzt)
    if (fehler) return { error: fehler === 'vergangen' ? SATZ.vergangen : SATZ.zuWeit }
    liveAb = termin
  }

  const fassung = await prisma.$transaction(async (tx) => {
    const inhalt = fassungInhaltSchema.safeParse(await leseEntwurf(tx))
    if (!inhalt.success) return null
    return tx.startseiteFassung.create({
      data: { inhalt: inhalt.data, liveAb, erstelltVonUserId: guard.userId },
      select: { id: true },
    })
  })
  if (!fassung) return { error: SATZ.entwurfKaputt }

  // updateTag statt revalidateTag: In Next 16 verlangt revalidateTag ein Profil (wie Nr. 93/95).
  updateTag(STARTSEITE_CACHE_TAG)
  if (geprueft.data.wann === 'jetzt') revalidatePath('/')
  erneuereAdmin()
  const termin = geprueft.data.wann === 'termin' ? liveAb : null
  return { ok: true, id: fassung.id, liveAb: liveAb.toISOString(), text: veroeffentlichtText(termin) }
}

/**
 * Eine geplante Fassung zurückziehen — nur, solange ihre Zeit nicht erreicht
 * ist. Die Bedingung steht in der WHERE-Klausel, nicht in einem if davor:
 * Zwischen Prüfen und Schreiben könnte die Zeit sonst gerade erreicht sein.
 * Der Datencache vergisst damit den Termin; live ändert sich nichts.
 */
export async function zieheFassungZurueck(eingabe: unknown): Promise<{ ok: true } | { error: string }> {
  const guard = await verlangeAdminAktion()
  if ('error' in guard) return { error: guard.error }
  const geprueft = fassungWahlSchema.safeParse(eingabe)
  if (!geprueft.success) return { error: STARTSEITE_SAETZE.ungueltig }

  const jetzt = new Date()
  const { count } = await prisma.startseiteFassung.updateMany({
    where: { id: geprueft.data.id, liveAb: { gt: jetzt }, zurueckgezogenAm: null },
    data: { zurueckgezogenAm: jetzt },
  })
  if (count === 0) return { error: SATZ.schonLive }
  updateTag(STARTSEITE_CACHE_TAG)
  erneuereAdmin()
  return { ok: true }
}

/**
 * „Als Entwurf übernehmen" (und „Entwurf verwerfen" = die Live-Fassung bzw.
 * ohne Fassung `id: null`, die Standard-Reihenfolge): schreibt die Tabellen des
 * Entwurfs aus der Fassung in EINER Transaktion. Blöcke behalten ihre
 * Kennung (gleicher Block = keine Änderung gegenüber live); Blöcke des
 * Entwurfs, die die Fassung nicht kennt, fallen weg (ihre Bilder bleiben).
 * Live ändert sich nichts.
 */
export async function uebernehmeFassungAlsEntwurf(eingabe: unknown): Promise<{ ok: true; zeilen: AdminStartseitenZeile[] } | { error: string }> {
  const guard = await verlangeAdminAktion()
  if ('error' in guard) return { error: guard.error }
  const geprueft = entwurfUebernehmenSchema.safeParse(eingabe)
  if (!geprueft.success) return { error: STARTSEITE_SAETZE.ungueltig }

  let inhalt: FassungInhalt = standardFassung()
  if (geprueft.data.id !== null) {
    const fassung = await prisma.startseiteFassung.findUnique({ where: { id: geprueft.data.id }, select: { id: true, inhalt: true } })
    const gelesen = fassung && leseFassung(fassung.inhalt, fassung.id)
    if (!gelesen) return { error: SATZ.keineFassung }
    inhalt = gelesen
  }

  await prisma.$transaction(async (tx) => {
    const zeilen = await tx.startseiteAbschnitt.findMany({ select: { id: true, art: true, blockId: true } })
    const behalten = new Set(inhalt.zeilen.flatMap((z) => (z.art === 'BLOCK' && z.block.id ? [z.block.id] : [])))
    // Erst die Blöcke, die die Fassung nicht kennt (Cascade nimmt ihre Zeile mit).
    await tx.startseiteBlock.deleteMany({ where: { id: { notIn: [...behalten] } } })
    const vorhanden = new Set((await tx.startseiteBlock.findMany({ select: { id: true } })).map((b) => b.id))

    // Nacheinander, nie Promise.all im Transaktions-Client (CODING_STANDARDS §4).
    for (const [position, zeile] of inhalt.zeilen.entries()) {
      if (zeile.art !== 'BLOCK') {
        const abschnitt = zeilen.find((z) => z.art === zeile.art)
        if (abschnitt) {
          await tx.startseiteAbschnitt.update({ where: { id: abschnitt.id }, data: { position, sichtbar: zeile.sichtbar } })
        } else {
          await tx.startseiteAbschnitt.create({ data: { art: zeile.art, position, sichtbar: zeile.sichtbar } })
        }
        continue
      }
      const { id, ...felder } = entwurfAusBlock(zeile.block)
      const daten = { ...felder, liveAb: new Date(felder.liveAb), liveBis: felder.liveBis ? new Date(felder.liveBis) : null }
      let blockId = id
      if (blockId && vorhanden.has(blockId)) {
        await tx.startseiteBlock.update({ where: { id: blockId }, data: daten })
      } else {
        const neu = await tx.startseiteBlock.create({
          data: { ...(blockId ? { id: blockId } : {}), ...daten, erstelltVonUserId: guard.userId },
          select: { id: true },
        })
        blockId = neu.id
      }
      // Die Zeile des Blocks: vorhanden (gleicher Block) oder neu.
      if (zeilen.some((z) => z.blockId === blockId)) {
        await tx.startseiteAbschnitt.update({ where: { blockId }, data: { position, sichtbar: zeile.sichtbar } })
      } else {
        await tx.startseiteAbschnitt.create({ data: { art: 'BLOCK', position, sichtbar: zeile.sichtbar, blockId } })
      }
    }
  })

  erneuereAdmin()
  // Die neue Liste gleich mit: Der Browser ersetzt damit seinen Entwurf (Admin › Startseite übernimmt Props sonst nicht).
  return { ok: true, zeilen: await ladeEntwurfAdmin() }
}

/**
 * „So sieht's die Kundin" und „Vorschau öffnen": der signierte Link für den
 * gewählten Stand (heute, +1 Woche, nächster Block, geplanter Termin) und die
 * Quelle (Entwurf, Live oder eine Fassung des Zeitplans). Schaltet für den
 * Browser des Admins den Draft Mode ein — nur dann rendert die sonst
 * statische Startseite je Anfrage und liest den Link (src/app/page.tsx).
 * `pfad` lädt der Rahmen in diesem Browser; `link` führt über die Route, die
 * den Draft Mode auf jedem Gerät mit Admin-Sitzung einschaltet (am Handy).
 */
export async function erzeugeStartseitenVorschau(
  eingabe: unknown
): Promise<{ ok: true; pfad: string; link: string; stand: string } | { error: string }> {
  const guard = await verlangeAdminAktion()
  if ('error' in guard) return { error: guard.error }
  const geprueft = vorschauAnfrageSchema.safeParse(eingabe)
  if (!geprueft.success) return { error: STARTSEITE_SAETZE.ungueltig }
  const { stand, quelle, blockEntwurfId } = geprueft.data

  const jetzt = new Date()
  let datum: Date | null = jetzt
  if (stand === 'woche') datum = standZeitpunkt('woche', jetzt, [])
  if (stand === 'block') {
    const inhalt = await leseQuelle(quelle, jetzt)
    const bloecke = inhalt.zeilen.flatMap((z) =>
      z.art === 'BLOCK' ? [{ liveAb: new Date(z.block.liveAb), liveBis: z.block.liveBis ? new Date(z.block.liveBis) : null }] : []
    )
    datum = standZeitpunkt('block', jetzt, bloecke)
    if (!datum) return { error: SATZ.keinBlock }
  }
  if (stand === 'termin') {
    const fassung = quelle.startsWith('fassung:')
      ? await prisma.startseiteFassung.findUnique({ where: { id: quelle.slice('fassung:'.length) }, select: { liveAb: true } })
      : null
    const termin = fassung ? fassung.liveAb : await naechsterTermin(jetzt)
    datum = standZeitpunkt('termin', jetzt, [], termin && termin.getTime() > jetzt.getTime() ? termin : null)
    if (!datum) return { error: SATZ.keinTermin }
  }
  if (!datum) return { error: STARTSEITE_SAETZE.ungueltig }

  ;(await draftMode()).enable()
  const abfrage = erzeugeVorschauAbfrage({ datum, blockEntwurfId, quelle }, jetzt)
  return { ok: true, pfad: `/?${abfrage}`, link: `${ADMIN_STARTSEITE_VORSCHAU_HREF}?${abfrage}`, stand: standText(datum) }
}

/**
 * Zurück auf „Bearbeiten" oder weg von Admin › Startseite: Draft Mode aus —
 * sonst rendert dieser Browser jede statische Seite bis zum Ende der Sitzung
 * ohne Cache. Ohne Admin-Prüfung mit Absicht: Die Action löscht nur das
 * Draft-Mode-Cookie des Aufrufers selbst und liest oder schreibt sonst nichts;
 * auch ein abgelaufener Admin soll es loswerden.
 */
export async function beendeStartseitenVorschau(): Promise<{ ok: true }> {
  ;(await draftMode()).disable()
  return { ok: true }
}
