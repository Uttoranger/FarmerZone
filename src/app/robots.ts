import type { MetadataRoute } from 'next'
import { gesperrtePfade } from '@/lib/robots'

/**
 * /robots.txt (Register N19) — statisch, gebaut beim Deploy. Ohne diese Datei
 * fiel /robots.txt in die Hofseite ([farmSlug]) und antwortete mit HTML.
 *
 * Robots ist kein Schutz, nur eine Bitte an Crawler: Geschützt wird weiter
 * über die Anmeldung und signierte Links (src/lib/robots.ts). Keine
 * Sitemap-Zeile — die Sitemap kommt mit dem SEO-Auftrag.
 *
 * BEWUSST OHNE „Allow: /": Erlaubt ist ohne passende Regel ohnehin alles. Next
 * schriebe die Zeile vor alle Disallow-Zeilen, und ein einfacher Crawler, bei
 * dem die erste passende Regel gilt, dürfte dann alles — auch /hoefe?….
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', disallow: gesperrtePfade() },
  }
}
