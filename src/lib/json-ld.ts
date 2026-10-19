/**
 * Strukturierte Daten (JSON-LD) für ein <script type="application/ld+json">.
 *
 * Warum nicht JSON.stringify allein: Der Browser beendet den Script-Block beim
 * ersten `</script>` — egal, ob es in einem JSON-Text steht. Ein Hofname wie
 * `</script><script>…` liefe sonst als Skript (die Texte kommen vom Hof, also
 * von außen). Deshalb werden `<`, `>` und `&` als \u-Folgen geschrieben, dazu
 * U+2028/U+2029 (in JavaScript-Text Zeilenenden). Für JSON ist das
 * gleichbedeutend: JSON.parse liefert dieselben Daten (tests/json-ld.test.ts).
 */
import { MARKE } from '@/lib/marke'
import { titelbildFoto } from '@/lib/mein-hof'
import { alsCents, type DecimalEingabe } from '@/lib/order-totals'
import { produktPfad } from '@/lib/produktdetail'

const MASKE: Record<string, string> = {
  '<': '\\u003c',
  '>': '\\u003e',
  '&': '\\u0026',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
}

export function jsonLdSicher(daten: unknown): string {
  return JSON.stringify(daten).replace(/[<>&\u2028\u2029]/g, (zeichen) => MASKE[zeichen] ?? zeichen)
}

/*
 * Angaben für Suchmaschinen (Nr. 117): volle Adressen und die Blöcke für
 * Hofseite, Produktseite und Startseite. Rein — die Basis (`metadatenBasis`,
 * dieselbe wie `metadataBase` im Root-Layout) gibt der Aufrufer mit.
 */

/**
 * Sprache und Land für Open Graph. Ein `openGraph` einer Seite ersetzt das des
 * Root-Layouts ganz (Next mischt Metadaten flach) — wer eines setzt, nimmt sie mit.
 */
export const OG_LOCALE = 'de_AT'

/** Ein Pfad der App als volle Adresse; ohne bekannte Basis bleibt er, wie er ist. Volle Adressen (Blob) bleiben unverändert. */
export function absoluteAdresse(pfad: string, basis: URL | undefined): string {
  return basis ? new URL(pfad, basis).toString() : pfad
}

/** Ganze Cent als Preis für schema.org: Punkt, zwei Stellen, ohne Zeichen (1999 → „19.99"). */
function preisText(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
}

type HofFuerJsonLd = {
  slug: string
  name: string
  description: string
  address: string
  postalCode: string
  city: string
  bannerType: string
  bannerUrl: string | null
  logoUrl: string | null
}

/**
 * Die Hofseite als `LocalBusiness`. BEWUSST OHNE `telephone` und `email`
 * (Nr. 60): Die Nummer gibt es erst nach dem Kauf — der Typ nimmt sie gar nicht erst an.
 */
export function hofJsonLd(
  hof: HofFuerJsonLd,
  geo: { latitude: number; longitude: number } | null,
  basis: URL | undefined
): Record<string, unknown> {
  const bild = titelbildFoto(hof) ?? hof.logoUrl
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: hof.name,
    description: hof.description,
    url: absoluteAdresse(`/${hof.slug}`, basis),
    ...(bild && { image: absoluteAdresse(bild, basis) }),
    address: {
      '@type': 'PostalAddress',
      streetAddress: hof.address,
      postalCode: hof.postalCode,
      addressLocality: hof.city,
      addressCountry: 'AT',
    },
    ...(geo && { geo: { '@type': 'GeoCoordinates', latitude: geo.latitude, longitude: geo.longitude } }),
  }
}

type ProduktFuerJsonLd = {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  categoryImageUrl: string | null
  price: DecimalEingabe
  stock: number
}

/**
 * Die Produktseite als `Product` mit Angebot. Der Preis geht über ganze Cent
 * (`alsCents`), nie über eine Rechnung mit Kommazahlen; verfügbar heißt Vorrat über null.
 */
export function produktJsonLd(
  produkt: ProduktFuerJsonLd,
  hof: { slug: string; name: string },
  basis: URL | undefined
): Record<string, unknown> {
  const bild = produkt.imageUrl ?? produkt.categoryImageUrl
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: produkt.name,
    ...(produkt.description && { description: produkt.description }),
    ...(bild && { image: absoluteAdresse(bild, basis) }),
    offers: {
      '@type': 'Offer',
      url: absoluteAdresse(produktPfad(hof.slug, produkt.id), basis),
      price: preisText(alsCents(produkt.price)),
      priceCurrency: 'EUR',
      availability: produkt.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: { '@type': 'LocalBusiness', name: hof.name, url: absoluteAdresse(`/${hof.slug}`, basis) },
    },
  }
}

/** Das Zeichen der Marke als Bild (dasselbe wie im Manifest). */
const MARKE_LOGO = '/icons/icon-512.png'

/**
 * Die Startseite: `Organization` und `WebSite`. BEWUSST OHNE `SearchAction`:
 * Die Suche lebt in /hoefe?…, und das sperrt robots.txt (Register N19).
 */
export function startseiteJsonLd(basis: URL | undefined): Record<string, unknown> {
  const url = absoluteAdresse('/', basis)
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', name: MARKE, url, logo: absoluteAdresse(MARKE_LOGO, basis) },
      { '@type': 'WebSite', name: MARKE, url, inLanguage: 'de-AT' },
    ],
  }
}
