import { del } from '@vercel/blob'
import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'
import { istEigenesBild } from '@/server/bild-url'
import { bildUrlsAusInhalt, pfadAusAdresse } from '@/lib/betrieb'

/*
 * Ersetzte Bilder verlassen den Bild-Speicher (Audit A8, Nr. 206; seit Nr. 213.4
 * EINMAL hier statt je einer Kopie in appearance.ts und products.ts). Keine
 * 'use server'-Datei: Ein Export dort wäre ein öffentlicher Endpunkt, der fremde
 * Dateien löschen ließe — hier prüft der Aufrufer Anmeldung und Hof, diese
 * Funktion nur Ordner, Speicher und Verwendung.
 *
 * Aufrufer: saveAppearanceAction, updateFarmLogoAction, updateFarmBannerAction
 * (Logo, Titelbild) und updateProduct, updateProductImageAction, deleteProduct
 * (Produktbild, gelöschtes Produkt). Beitragsfotos und Startseiten-Bilder
 * löschen ersetzte Bilder bewusst nicht (Register N17, Ergänzung 31.10.2026).
 */

/** Wofür gelöscht wird — nur als Merkmal in der Sentry-Meldung. */
export type BildLoeschAnlass = 'logo' | 'titelbild' | 'produktbild' | 'produkt-geloescht'

/**
 * Löscht das alte Bild `alt`, wenn es durch `neu` ersetzt (oder mit seinem
 * Produkt gelöscht) wurde. Erst NACH dem erfolgreichen Schreiben in der
 * Datenbank aufrufen: Scheitert das Speichern, zeigt die Seite weiter das alte
 * Bild (deshalb löscht der Upload es nicht, Nr. 108). Nur eine Datei im Ordner
 * DIESES Hofs aus unserem Speicher (`istEigenesBild`) — nie eine fremde
 * Adresse. Und nur, wenn keine Zeile mehr auf die Datei zeigt (ein Galeriefoto
 * als Titelbild, das Logo auch als Titelbild). Die Felder sind dieselben wie in
 * ladeBildVerwendung (src/server/betrieb-bilder.ts); ein neues Bildfeld gehört
 * hierher UND dorthin (Wache tests/bild-ersetzen-loeschen.test.ts). Ein
 * archiviertes Produkt (mit Bestellungen) behält sein Bild — die Aufrufer rufen
 * das hier dann nicht. Scheitert das Löschen, gilt die Aktion trotzdem: eine
 * Meldung nach Sentry, ohne Adresse und ohne Fehlertext; die Datei bleibt als
 * „Bild ohne Verwendung“ (N18).
 */
export async function entferneAltesBild(alt: string | null | undefined, neu: string | null | undefined, farmId: string, anlass: BildLoeschAnlass): Promise<void> {
  if (!alt || alt === neu || !istEigenesBild(alt, farmId)) return
  try {
    const verwendet = await Promise.all([
      prisma.farm.count({ where: { OR: [{ logoUrl: alt }, { bannerUrl: alt }, { bannerValue: alt }] } }),
      prisma.product.count({ where: { imageUrl: alt } }),
      prisma.farmPhoto.count({ where: { url: alt } }),
      prisma.statusPost.count({ where: { photoUrl: alt } }),
      prisma.meldung.count({ where: { screenshotUrl: alt } }),
      // Die Startseite (Blöcke und Fassungen) zählt mit wie in ladeBildVerwendung (src/server/betrieb-bilder.ts):
      // startseite.ts lässt eine unveränderte alte Adresse stehen, auch ein Hofbild.
      prisma.startseiteBlock.count({ where: { bildUrl: alt } }),
      prisma.startseiteFassung
        .findMany({ select: { inhalt: true } })
        .then((fassungen) => fassungen.filter((f) => bildUrlsAusInhalt(f.inhalt).some((u) => pfadAusAdresse(u) === pfadAusAdresse(alt))).length),
    ])
    if (verwendet.some((n) => n > 0)) return
    await del(alt, { token: process.env.BLOB_READ_WRITE_TOKEN })
  } catch (fehler) {
    Sentry.captureMessage('Ersetztes Bild nicht aus dem Speicher gelöscht', {
      level: 'warning',
      tags: { bereich: 'bild-loeschen', anlass, klasse: fehler instanceof Error ? fehler.name : typeof fehler },
    })
  }
}
