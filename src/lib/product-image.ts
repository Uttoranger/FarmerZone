import fs from 'node:fs'
import path from 'node:path'
import type { ProductCategory } from '@prisma/client'

// Kategorie-Fallback-Bilder: /public/categories/{slug}.webp
// Nur serverseitig verwenden (fs) — Client-Komponenten bekommen die fertige URL.
//
// Die Zuordnung ist VOLLSTÄNDIG (Record über das Prisma-Enum — TypeScript
// erzwingt jeden Wert), und seit dem Sprint „Marke und Startseite aus einem
// Guss" liegt zu jedem Dateinamen hier eine Illustration in public/categories/
// (tests/product-image.test.ts prüft das). Der Rückfall unten bleibt trotzdem:
// Fehlt eine Datei, rendert die Kachel ohne Bild — kein gebrochenes <img>,
// kein Fehler im Log.
// ACHTUNG Existenz-Cache (unten): Eine einmal als fehlend erkannte Datei
// bleibt für die Lebensdauer des Prozesses „fehlend". Auf Vercel ist das
// egal (jede Ablage ist ein Deployment = neuer Prozess); ein laufender
// `next dev` muss nach dem Ablegen neu gestartet werden.

export const CATEGORY_SLUGS: Record<ProductCategory, string> = {
  MILCH: 'milch',
  EIER: 'eier',
  FLEISCH: 'fleisch',
  FISCH: 'fisch',
  GEMUESE: 'gemuese',
  OBST: 'obst',
  BROT: 'brot',
  HONIG: 'honig',
  GETRAENKE: 'getraenke',
  // Die Altlast aus Taxonomie 1 bekommt keine eigene Illustration: Sie steht
  // nur noch an Bestandsdaten und teilt sich die neutrale Kachel mit Sonstiges.
  FUTTERMITTEL: 'sonstiges',
  // Die vier Futter-Kategorien aus Bereiche 1 — mit eigener Illustration.
  HEU_STROH: 'heu-stroh',
  GETREIDE_KOERNER: 'getreide-koerner',
  MISCHFUTTER: 'mischfutter',
  ERGAENZUNGSFUTTER: 'ergaenzungsfutter',
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
