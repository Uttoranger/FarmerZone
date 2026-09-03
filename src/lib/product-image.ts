import fs from 'node:fs'
import path from 'node:path'
import type { ProductCategory } from '@prisma/client'

// Kategorie-Fallback-Bilder: /public/categories/{slug}.webp
// Nur serverseitig verwenden (fs) — Client-Komponenten bekommen die fertige URL.
//
// Die Zuordnung ist VOLLSTÄNDIG (Record über das Prisma-Enum — TypeScript
// erzwingt jeden Wert), die Dateien sind es noch nicht: Heute liegen in
// public/categories/ nur brennholz, eier, fleisch, milch und sonstiges. Für
// fisch, gemuese, obst, brot, honig und getraenke steht der Dateiname hier
// schon fest; der Betreiber muss die Illustration nur noch unter genau diesem
// Namen ablegen. Bis dahin greift der Rückfall unten (null → die Kachel
// rendert ohne Bild, kein gebrochenes <img>, kein Fehler im Log).
// ACHTUNG Existenz-Cache (unten): Eine einmal als fehlend erkannte Datei
// bleibt für die Lebensdauer des Prozesses „fehlend". Auf Vercel ist das
// egal (jede Ablage ist ein Deployment = neuer Prozess); ein laufender
// `next dev` muss nach dem Ablegen neu gestartet werden.

const CATEGORY_SLUGS: Record<ProductCategory, string> = {
  MILCH: 'milch',
  EIER: 'eier',
  FLEISCH: 'fleisch',
  FISCH: 'fisch',
  GEMUESE: 'gemuese',
  OBST: 'obst',
  BROT: 'brot',
  HONIG: 'honig',
  GETRAENKE: 'getraenke',
  BRENNHOLZ: 'brennholz',
  SONSTIGES: 'sonstiges',
}

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
  if (!category) return null
  const rel = `categories/${CATEGORY_SLUGS[category]}.webp`
  return exists(rel) ? `/${rel}` : null
}
