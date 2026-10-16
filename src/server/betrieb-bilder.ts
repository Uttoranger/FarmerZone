import { prisma } from '@/lib/prisma'
import { csvFeld } from '@/lib/finanzen'
import { kalendertagInWien } from '@/lib/wiener-tag'
import {
  BILD_GRUPPE_TEXT,
  bildUrlsAusInhalt,
  bilderOhneVerwendung,
  ohneVerwendungWerte,
  pfadAusAdresse,
  zaehltOhneVerwendung,
  type BetriebArt,
  type BildOhneVerwendung,
  type BildVerwendung,
} from '@/lib/betrieb'

/*
 * Bilder ohne Verwendung (Register N18, Nr. 104): welche Dateien im
 * Bild-Speicher an nichts mehr hängen. Die Regel steht rein in
 * src/lib/betrieb.ts (`bilderOhneVerwendung`); hier nur die Abfragen — eine
 * je Feld, nur die Adressen — und die Kennungen der Höfe DIESER Datenbank.
 *
 * Die Dateien kommen von `listeBilder()` (src/server/betrieb.ts) — dieselbe
 * Auflistung wie die Messung, keine zweite Runde: jede Seite kostet einen
 * Bild-Vorgang bei Vercel. Gelöscht wird hier NICHTS (Quelltext-Wache
 * tests/aufraeumen.test.ts); Löschen kommt erst nach Durchsicht der Liste,
 * mit eigener Freigabe.
 */

type Datei = { pathname: string; url: string; size: number; uploadedAt: Date }

/** Alle gespeicherten Bild-Adressen (als Pfad) und alle Hof-Kennungen — eine Abfrage je Feld, nur die Adressen. */
export async function ladeBildVerwendung(): Promise<BildVerwendung> {
  const [hoefe, logos, banner, bannerWerte, produkte, beitraege, galerie, meldungen, bloecke, fassungen] = await Promise.all([
    prisma.farm.findMany({ select: { id: true } }),
    prisma.farm.findMany({ where: { logoUrl: { not: null } }, select: { logoUrl: true } }),
    prisma.farm.findMany({ where: { bannerUrl: { not: null } }, select: { bannerUrl: true } }),
    // Trägt einen Verlauf oder eine Foto-Adresse; ein Verlauf ist keine Web-Adresse und fällt in pfadAusAdresse weg.
    prisma.farm.findMany({ where: { bannerValue: { not: null } }, select: { bannerValue: true } }),
    prisma.product.findMany({ where: { imageUrl: { not: null } }, select: { imageUrl: true } }),
    prisma.statusPost.findMany({ where: { photoUrl: { not: null } }, select: { photoUrl: true } }),
    prisma.farmPhoto.findMany({ select: { url: true } }),
    prisma.meldung.findMany({ where: { screenshotUrl: { not: null } }, select: { screenshotUrl: true } }),
    prisma.startseiteBlock.findMany({ where: { bildUrl: { not: null } }, select: { bildUrl: true } }),
    prisma.startseiteFassung.findMany({ select: { inhalt: true } }),
  ])
  const adressen: Array<string | null> = [
    ...logos.map((f) => f.logoUrl),
    ...banner.map((f) => f.bannerUrl),
    ...bannerWerte.map((f) => f.bannerValue),
    ...produkte.map((p) => p.imageUrl),
    ...beitraege.map((b) => b.photoUrl),
    ...galerie.map((g) => g.url),
    ...meldungen.map((m) => m.screenshotUrl),
    ...bloecke.map((b) => b.bildUrl),
    ...fassungen.flatMap((f) => bildUrlsAusInhalt(f.inhalt)),
  ]
  const benutzt = new Set<string>()
  for (const adresse of adressen) {
    const pfad = adresse === null ? null : pfadAusAdresse(adresse)
    if (pfad !== null) benutzt.add(pfad)
  }
  return { benutzt, hoefe: new Set(hoefe.map((h) => h.id)) }
}

/** Die Bilder ohne Verwendung und die getrennt geführten aus einer Auflistung. */
export async function findeBilderOhneVerwendung(dateien: readonly Datei[], jetzt: Date): Promise<BildOhneVerwendung[]> {
  return bilderOhneVerwendung(dateien, await ladeBildVerwendung(), jetzt)
}

/** Die Summen für die Messung (BetriebMessung) — aus derselben Auflistung wie `bilderBytes`. */
export async function ohneVerwendungMesswerte(dateien: readonly Datei[], jetzt: Date): Promise<Array<readonly [BetriebArt, number]>> {
  return ohneVerwendungWerte(await findeBilderOhneVerwendung(dateien, jetzt))
}

/**
 * „Liste als CSV“: nur die Bilder ohne Verwendung (unbekannter Hof und
 * Startseite zählen nicht dazu), älteste zuerst — Art, Pfad ohne Domain,
 * Größe in Bytes, hochgeladen (Wiener Tag). UTF-8 mit BOM und Semikolon wie
 * die anderen CSV des Admins; jedes Feld durch `csvFeld` (Formelzeichen).
 */
export function bilderOhneVerwendungCsv(liste: readonly BildOhneVerwendung[]): string {
  const zeilen = [
    ['Art', 'Pfad', 'Größe (Bytes)', 'hochgeladen'],
    ...liste.filter((b) => zaehltOhneVerwendung(b.gruppe)).map((b) => [BILD_GRUPPE_TEXT[b.gruppe], b.pathname, String(b.size), kalendertagInWien(b.uploadedAt)]),
  ]
  return `﻿${zeilen.map((z) => z.map(csvFeld).join(';')).join('\r\n')}\r\n`
}
