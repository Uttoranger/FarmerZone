import type { MetadataRoute } from 'next'
import { gesperrtePfade } from '@/lib/robots'
import { absoluteAdresse } from '@/lib/json-ld'
import { UMGEBUNG } from '@/lib/umgebung-server'
import { metadatenBasis } from '@/lib/vorschaubild'

/**
 * /robots.txt (Register N19) — statisch, gebaut beim Deploy. Ohne diese Datei
 * fiel /robots.txt in die Hofseite ([farmSlug]) und antwortete mit HTML.
 *
 * Robots ist kein Schutz, nur eine Bitte an Crawler: Geschützt wird weiter
 * über die Anmeldung und signierte Links (src/lib/robots.ts). Die Zeile
 * „Sitemap:" nennt /sitemap.xml (Nr. 117) als volle Adresse — aus derselben
 * Basis wie `metadataBase` im Root-Layout, gebaut beim Deploy. Ohne bekannte
 * Basis fehlt sie: Eine relative Adresse ließe die Zeile ungültig.
 *
 * BEWUSST OHNE „Allow: /": Erlaubt ist ohne passende Regel ohnehin alles. Next
 * schriebe die Zeile vor alle Disallow-Zeilen, und ein einfacher Crawler, bei
 * dem die erste passende Regel gilt, dürfte dann alles — auch /hoefe?….
 */
export default function robots(): MetadataRoute.Robots {
  const basis = metadatenBasis(UMGEBUNG.appUrl)
  return {
    rules: { userAgent: '*', disallow: gesperrtePfade() },
    ...(basis && { sitemap: absoluteAdresse('/sitemap.xml', basis) }),
  }
}
