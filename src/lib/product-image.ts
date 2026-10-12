import fs from 'node:fs'
import path from 'node:path'
import type { ProductCategory } from '@prisma/client'
import { KATEGORIE_BILD_SLUG, kategorieBildPfad } from '@/lib/taxonomie'

// Kategorie-Fallback-Bilder: /public/categories/{slug}.webp
// Nur serverseitig verwenden (fs) — Client-Komponenten bekommen die fertige URL
// oder nehmen kategorieBildPfad (taxonomie.ts) ohne Prüfung des Dateisystems.
//
// Die Zuordnung selbst steht seit Nr. 51 in taxonomie.ts (KATEGORIE_BILD_SLUG),
// damit auch der Browser sie kennt; hier bleibt sie unter dem bisherigen Namen
// erreichbar — EINE Liste. Der Rückfall unten bleibt: Fehlt eine Datei, rendert
// die Kachel ohne Bild — kein gebrochenes <img>, kein Fehler im Log.
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

// null bei fehlender Kategorie ODER fehlender Asset-Datei (Assets folgen als eigener Commit)
export function categoryImagePath(
  category: ProductCategory | null | undefined,
  exists: (publicRelPath: string) => boolean = assetExists
): string | null {
  const pfad = kategorieBildPfad(category)
  if (!pfad) return null
  // Die Existenz fragt den Pfad relativ zu public/ ab: „categories/milch.webp".
  return exists(pfad.slice(1)) ? pfad : null
}
