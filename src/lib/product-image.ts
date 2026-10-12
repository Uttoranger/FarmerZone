import fs from 'node:fs'
import path from 'node:path'
import type { ProductCategory, ProductSubcategory } from '@prisma/client'
import { KATEGORIE_BILD_SLUG, illustrationPfad } from '@/lib/taxonomie'

// Illustrationen: /public/categories/{slug}.webp (Kategorie) und
// /public/categories/{slug}/{datei}.webp (Unterkategorie, Register I1).
// Nur serverseitig verwenden (fs) — Client-Komponenten bekommen die fertige URL
// oder nehmen illustrationPfad (taxonomie.ts) ohne Prüfung des Dateisystems.
//
// Die Zuordnung selbst steht seit Nr. 51 in taxonomie.ts (KATEGORIE_BILD_SLUG),
// damit auch der Browser sie kennt; hier bleibt sie unter dem bisherigen Namen
// erreichbar — EINE Liste. Der Rückfall unten bleibt: Fehlt eine Datei, rendert
// die Kachel mit der nächsten Stufe — kein gebrochenes <img>, kein Fehler im Log.
// ACHTUNG Existenz-Cache (unten): Eine einmal als fehlend erkannte Datei
// bleibt für die Lebensdauer des Prozesses „fehlend". Auf Vercel ist das
// egal (jede Ablage ist ein Deployment = neuer Prozess); ein laufender
// `next dev` muss nach dem Ablegen neu gestartet werden.

export const CATEGORY_SLUGS: Record<ProductCategory, string> = KATEGORIE_BILD_SLUG

// Existenz-Cache: Assets ändern sich nur per Deployment
const existsCache = new Map<string, boolean>()

function assetExists(publicRelPath: string): boolean {
  let cached = existsCache.get(publicRelPath)
  if (cached === undefined) {
    cached = fs.existsSync(path.join(process.cwd(), 'public', publicRelPath))
    existsCache.set(publicRelPath, cached)
  }
  return cached
}

/**
 * Die Illustration eines Produkts ohne Foto (Register I1): Unterkategorie →
 * Kategorie → „Sonstiges", jede Stufe nur, wenn ihre Datei liegt. Ohne
 * Unterkategorie (Startseite, „Für Höfe") beginnt es bei der Kategorie.
 * null nur, wenn nicht einmal „Sonstiges" liegt (Assets noch nicht abgelegt).
 */
export function categoryImagePath(
  category: ProductCategory | null | undefined,
  subcategory?: ProductSubcategory | null,
  exists: (publicRelPath: string) => boolean = assetExists
): string | null {
  // Ein Set lässt doppelte Stufen weg (ohne eigene Illustration ist die erste
  // schon die Kategorie) und behält die Reihenfolge.
  const stufen = new Set([illustrationPfad(category, subcategory), illustrationPfad(category), illustrationPfad(null)])
  // Die Existenz fragt den Pfad relativ zu public/ ab: „categories/milch.webp".
  return [...stufen].find((pfad) => exists(pfad.slice(1))) ?? null
}
