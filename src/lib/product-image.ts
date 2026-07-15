import fs from 'node:fs'
import path from 'node:path'
import type { ProductCategory } from '@prisma/client'

// Kategorie-Fallback-Bilder: /public/categories/{slug}.webp
// Nur serverseitig verwenden (fs) — Client-Komponenten bekommen die fertige URL.

const CATEGORY_SLUGS: Record<ProductCategory, string> = {
  MILCH: 'milch',
  EIER: 'eier',
  FLEISCH: 'fleisch',
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
