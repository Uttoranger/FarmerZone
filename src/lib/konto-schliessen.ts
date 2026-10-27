import { Prisma } from '@prisma/client'
import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'
import { originalPrefix, zielPrefix } from '@/lib/upload-pfade'
import { OFFENE_BESTELL_STAENDE, endgueltigGrenze } from '@/lib/konto-anfragen'

/*
 * „Konto schließen“ (Register N36, Nachtlauf Nr. 190) in zwei Stufen. Die
 * Sichtbarkeit (offline wie `archivedAt`) steht in src/lib/hof-sichtbar.ts.
 *
 * Stufe 1 (sofort, 30 Tage umkehrbar; src/server/actions/konto-anfragen.ts):
 * `Farm.geschlossenAm` gesetzt → Hofseite offline wie bei `archivedAt` in
 * allen Lesern, Anmelden gesperrt (Hook in src/lib/auth.ts, gleiche Antwort
 * wie ein falsches Passwort), Sitzungen gelöscht, Abos beendet.
 *
 * Stufe 2 (endgültig, nach 30 Tagen; `schliesseEndgueltig`): Kontakt, Fotos
 * und Texte des Hofs löschen bzw. unkenntlich machen — genau die Liste
 * ENDGUELTIG_LOESCHEN. Bestellungen, Positionen und Beträge bleiben
 * (Aufbewahrungspflicht). Läuft NUR, wenn ENDGUELTIG_FREIGEGEBEN wahr ist.
 *
 * Die reinen Regeln und Sätze von Stufe 1 stehen in src/lib/konto-anfragen.ts
 * (ohne Datenbank, auch für die Oberfläche).
 */

// ─── Stufe 1: was das Schließen sperrt ─────────────────────────────────────

/** Offene Bestellungen und Erstattungen eines Hofs — nur die Zahlen (Akte und Action). */
export async function zaehleOffenesFuerSchliessen(
  farmId: string,
  db: Pick<Prisma.TransactionClient, 'order'> = prisma
): Promise<{ bestellungen: number; erstattungen: number }> {
  // Nacheinander: `db` kann der Transaktions-Client sein (tests/transaktion-nacheinander.test.ts).
  const bestellungen = await db.order.count({ where: { farmId, status: { in: [...OFFENE_BESTELL_STAENDE] } } })
  const erstattungen = await db.order.count({ where: { farmId, erstattungOffenSeit: { not: null } } })
  return { bestellungen, erstattungen }
}

/** Was die Akte für die Konto-Knöpfe braucht — Zeitpunkte und die Zahlen, die das Schließen sperren. */
export async function ladeKontoStand(
  farmId: string
): Promise<{ geschlossenAm: Date | null; endgueltigAm: Date | null; offen: { bestellungen: number; erstattungen: number } } | null> {
  const [hof, offen] = await Promise.all([
    prisma.farm.findUnique({ where: { id: farmId }, select: { geschlossenAm: true, endgueltigAm: true } }),
    zaehleOffenesFuerSchliessen(farmId),
  ])
  return hof ? { ...hof, offen } : null
}

// ─── Stufe 2 ────────────────────────────────────────────────────────────────

/**
 * Freigabe der Liste durch die Projektleitung nach Rückmeldung der Anwältin
 * (Register N36). Solange `false`, läuft Stufe 2 nie — das Aufräumen fragt
 * diese Konstante (tests/konto-schliessen.test.ts wacht am Quelltext).
 */
export const ENDGUELTIG_FREIGEGEBEN = false

export type LoeschEintrag = { was: string; wirkung: string }

/**
 * Was Stufe 2 löscht bzw. unkenntlich macht — die Liste, die die Anwältin
 * bestätigt. `schliesseEndgueltig` setzt genau sie um; ein Test gleicht beide ab.
 * Nie: Bestellungen, Positionen, Beträge, Monatsabrechnungen, Verkäufe vor Ort.
 */
export const ENDGUELTIG_LOESCHEN: readonly LoeschEintrag[] = [
  { was: 'Farm.name, Farm.ownerName', wirkung: 'ersetzt durch „Geschlossener Hof“ bzw. leer' },
  { was: 'Farm.slug', wirkung: 'ersetzt durch „geschlossen-<Kennung>“ (der alte Name steckt im Slug)' },
  { was: 'Farm.description, aboutText, tagline, foundedYear, pauseMessage, adminSperrGrund', wirkung: 'leer bzw. null' },
  { was: 'Farm.address, postalCode, city, latitude, longitude', wirkung: 'leer bzw. null (Land bleibt)' },
  { was: 'Farm.phone, Farm.email', wirkung: 'leer' },
  { was: 'Farm.betriebsnummer, betriebsstatus', wirkung: 'null' },
  { was: 'Farm.logoUrl, bannerUrl, bannerValue, logoAusschnitt, bannerAusschnitt, sectionsConfig', wirkung: 'null; Titelbild auf Verlauf' },
  { was: 'FarmPhoto, FarmValue, StatusPost (Beiträge)', wirkung: 'Zeilen gelöscht' },
  { was: 'Product.description, imageUrl, bildAusschnitt', wirkung: 'null, nicht mehr verfügbar (Name bleibt für die Positionen)' },
  { was: 'CustomerFarmSubscription (Abos)', wirkung: 'Zeilen gelöscht' },
  { was: 'Unterhaltung mit Nachrichten (Postfach)', wirkung: 'Zeilen gelöscht' },
  { was: 'Meldung des Hofs', wirkung: 'Zeilen gelöscht, Bildschirmfoto im Bild-Speicher gelöscht' },
  { was: 'User des Hofs: email, name, phone, image', wirkung: 'E-Mail ersetzt durch „geschlossen-<Kennung>@geschlossen.invalid“, Rest null' },
  { was: 'Session, Account, Passkey, BekanntesGeraet, EinmalLink, AdminErsatzcode des Hofs', wirkung: 'Zeilen gelöscht' },
  { was: 'Bild-Speicher originals/<farmId>/', wirkung: 'alle Dateien gelöscht' },
  { was: 'Bild-Speicher farms/<farmId>/', wirkung: 'alle Dateien gelöscht' },
  { was: 'Farm.endgueltigAm', wirkung: 'gesetzt (jetzt)' },
]

/** Die Ordner des Hofs im Bild-Speicher — Stufe 2 leert sie ganz. */
export function blobOrdnerDesHofs(farmId: string): string[] {
  return [originalPrefix(farmId), zielPrefix(farmId)]
}

/** Platzhalter-Adresse nach Stufe 2 — eindeutig je Konto, nie zustellbar (.invalid, RFC 2606). */
export function geschlosseneAdresse(userId: string): string {
  return `geschlossen-${userId.toLowerCase()}@geschlossen.invalid`
}

export const GESCHLOSSENER_HOF_NAME = 'Geschlossener Hof'

type BlobWerkzeug = {
  /** Alle Adressen unter einem Ordner. */
  liste: (prefix: string) => Promise<string[]>
  loesche: (urls: string[]) => Promise<void>
}

async function echterBlob(): Promise<BlobWerkzeug> {
  const { list, del } = await import('@vercel/blob')
  const token = process.env.BLOB_READ_WRITE_TOKEN
  return {
    liste: async (prefix) => {
      const urls: string[] = []
      let cursor: string | undefined
      do {
        const seite = await list({ prefix, cursor, token })
        urls.push(...seite.blobs.map((b) => b.url))
        cursor = seite.hasMore ? seite.cursor : undefined
      } while (cursor)
      return urls
    },
    loesche: async (urls) => {
      if (urls.length > 0) await del(urls, { token })
    },
  }
}

export type EndgueltigErgebnis = { ok: true; dateien: number } | { ok: false; grund: 'nicht-faellig' }

/**
 * Stufe 2 für einen Hof: in EINER Transaktion die Felder und Zeilen aus
 * ENDGUELTIG_LOESCHEN, bedingt (`geschlossenAm` gesetzt und älter als 30 Tage,
 * `endgueltigAm` leer) — ein zweiter Lauf ändert nichts. Danach die Ordner im
 * Bild-Speicher; scheitert das, bleibt die Datenbank, wie sie ist, und es geht
 * eine Meldung ohne Kennung nach Sentry (fail-open, der nächste Lauf findet
 * den Hof nicht mehr — die Dateien entfernt dann die Durchsicht der Bilder).
 * Bestellungen, Positionen und Beträge fasst die Funktion nie an.
 */
export async function schliesseEndgueltig(
  farmId: string,
  optionen: { jetzt?: Date; db?: typeof prisma; blob?: BlobWerkzeug } = {}
): Promise<EndgueltigErgebnis> {
  const jetzt = optionen.jetzt ?? new Date()
  const db = optionen.db ?? prisma
  const ergebnis = await db.$transaction(async (tx) => {
    const hof = await tx.farm.findFirst({
      where: { id: farmId, geschlossenAm: { not: null, lt: endgueltigGrenze(jetzt) }, endgueltigAm: null },
      select: { id: true, ownerId: true },
    })
    if (!hof) return null
    const { count } = await tx.farm.updateMany({
      where: { id: farmId, endgueltigAm: null },
      data: {
        name: GESCHLOSSENER_HOF_NAME,
        ownerName: '',
        slug: `geschlossen-${farmId.toLowerCase()}`,
        description: '',
        aboutText: null,
        tagline: null,
        foundedYear: null,
        pauseMessage: null,
        adminSperrGrund: null,
        address: '',
        postalCode: '',
        city: '',
        latitude: null,
        longitude: null,
        phone: '',
        email: '',
        betriebsnummer: null,
        betriebsstatus: null,
        logoUrl: null,
        bannerUrl: null,
        bannerValue: null,
        bannerType: 'GRADIENT',
        logoAusschnitt: Prisma.DbNull,
        bannerAusschnitt: Prisma.DbNull,
        sectionsConfig: Prisma.DbNull,
        endgueltigAm: jetzt,
      },
    })
    if (count === 0) return null
    await tx.farmPhoto.deleteMany({ where: { farmId } })
    await tx.farmValue.deleteMany({ where: { farmId } })
    await tx.statusPost.deleteMany({ where: { farmId } })
    await tx.product.updateMany({ where: { farmId }, data: { description: null, imageUrl: null, bildAusschnitt: Prisma.DbNull, isAvailable: false } })
    await tx.customerFarmSubscription.deleteMany({ where: { farmId } })
    await tx.unterhaltung.deleteMany({ where: { farmId } })
    const meldungen = await tx.meldung.findMany({ where: { farmId }, select: { screenshotUrl: true } })
    await tx.meldung.deleteMany({ where: { farmId } })
    const userId = hof.ownerId
    await tx.session.deleteMany({ where: { userId } })
    await tx.account.deleteMany({ where: { userId } })
    await tx.passkey.deleteMany({ where: { userId } })
    await tx.bekanntesGeraet.deleteMany({ where: { userId } })
    await tx.einmalLink.deleteMany({ where: { userId } })
    await tx.adminErsatzcode.deleteMany({ where: { userId } })
    await tx.user.update({ where: { id: userId }, data: { email: geschlosseneAdresse(userId), name: null, phone: null, image: null } })
    return { screenshots: meldungen.flatMap((m) => (m.screenshotUrl ? [m.screenshotUrl] : [])) }
  })
  if (!ergebnis) return { ok: false, grund: 'nicht-faellig' }

  let dateien = 0
  try {
    const blob = optionen.blob ?? (await echterBlob())
    const urls = [...ergebnis.screenshots]
    for (const ordner of blobOrdnerDesHofs(farmId)) urls.push(...(await blob.liste(ordner)))
    await blob.loesche(urls)
    dateien = urls.length
  } catch (err) {
    const meldung = new Error('Konto schließen Stufe 2: Bild-Speicher nicht geleert')
    meldung.name = err instanceof Error ? err.name : 'Unbekannt'
    Sentry.captureException(meldung, { level: 'warning', tags: { bereich: 'konto-schliessen' } })
  }
  return { ok: true, dateien }
}

/**
 * Aus dem täglichen Aufräumen: alle fälligen Höfe — NUR mit Freigabe.
 * `freigegeben` ist für den Integrationstest einstellbar; der Code-Wert bleibt
 * ENDGUELTIG_FREIGEGEBEN. Gibt die Zahl der endgültig geschlossenen Höfe zurück.
 */
export async function schliesseFaelligeEndgueltig(
  jetzt: Date,
  optionen: { freigegeben?: boolean; db?: typeof prisma; blob?: BlobWerkzeug } = {}
): Promise<number> {
  const freigegeben = optionen.freigegeben ?? ENDGUELTIG_FREIGEGEBEN
  if (!freigegeben) return 0
  const db = optionen.db ?? prisma
  const faellig = await db.farm.findMany({
    where: { geschlossenAm: { not: null, lt: endgueltigGrenze(jetzt) }, endgueltigAm: null },
    select: { id: true },
  })
  let anzahl = 0
  for (const { id } of faellig) {
    const r = await schliesseEndgueltig(id, { jetzt, db, blob: optionen.blob })
    if (r.ok) anzahl += 1
  }
  return anzahl
}
