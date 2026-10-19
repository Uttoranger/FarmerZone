/**
 * Strukturierte Daten (JSON-LD) im <script> — Nachtlauf Nr. 10, Nachbesserung 1.
 *
 * Beweist: Text des Hofs (Name, Beschreibung) kann den <script>-Block nicht
 * verlassen. JSON.stringify allein maskiert `<` nicht — ein Hofname mit
 * `</script>` schlösse den Block, und was danach steht, liefe als Skript.
 * jsonLdSicher maskiert `<`, `>`, `&` und U+2028/U+2029 als \u-Folgen; das
 * JSON bleibt gleichbedeutend (JSON.parse liefert dieselben Daten).
 */
import { describe, it, expect } from 'vitest'
import { absoluteAdresse, hofJsonLd, jsonLdSicher, produktJsonLd, startseiteJsonLd } from '@/lib/json-ld'
import { MARKE } from '@/lib/marke'

const ANGRIFF = '</script><script>alert(1)</script>'

describe('jsonLdSicher', () => {
  it('Gegenprobe: JSON.stringify allein lässt </script> stehen', () => {
    expect(JSON.stringify({ name: ANGRIFF })).toContain('</script>')
  })

  it('maskiert <, >, & und die Zeilentrenner — kein </script> und kein <!-- mehr im Text', () => {
    const text = jsonLdSicher({ name: ANGRIFF, description: 'Milch & Käse <!-- \u2028\u2029' })
    expect(text).not.toMatch(/[<>&\u2028\u2029]/)
    expect(text).toContain('\\u003c/script\\u003e')
    expect(text).toContain('\\u0026')
    expect(text).toContain('\\u2028')
    expect(text).toContain('\\u2029')
  })

  it('bleibt gleichbedeutend: JSON.parse liefert dieselben Daten', () => {
    const daten = { '@type': 'LocalBusiness', name: ANGRIFF, description: 'Milch & Käse <!-- \u2028\u2029', telephone: '+43 660 0000000' }
    expect(JSON.parse(jsonLdSicher(daten))).toEqual(daten)
  })
})

// ─── Nr. 117: die Blöcke für Hofseite, Produktseite und Startseite ───────────

const BASIS = new URL('https://hof.example')
const TELEFON = '+43 660 0000000'
/** Ein Hof wie aus getPublicFarm — MIT Telefon und E-Mail: Der Block darf sie trotzdem nie tragen. */
const HOF = {
  slug: 'hof-test', name: 'Hof Test', description: 'Gemüse aus Musterdorf', address: 'Musterweg 1', postalCode: '4900', city: 'Musterdorf',
  bannerType: 'PHOTO', bannerUrl: 'https://blob.example/titel.jpg', logoUrl: '/logo.png', phone: TELEFON, email: 'hof@example.com',
}
const PRODUKT = { id: 'p_eier', name: 'Freilandeier', description: 'Zehn Stück', imageUrl: null, categoryImageUrl: '/categories/eier.webp', price: 4.5, stock: 3 }

describe('absoluteAdresse', () => {
  it('macht aus einem Pfad die volle Adresse; volle Adressen bleiben; ohne Basis bleibt der Pfad', () => {
    expect(absoluteAdresse('/hof-test', BASIS)).toBe('https://hof.example/hof-test')
    expect(absoluteAdresse('/', BASIS)).toBe('https://hof.example/')
    expect(absoluteAdresse('https://blob.example/a.jpg', BASIS)).toBe('https://blob.example/a.jpg')
    expect(absoluteAdresse('/hof-test', undefined)).toBe('/hof-test')
  })
})

describe('hofJsonLd', () => {
  it('LocalBusiness mit Adresse, voller URL und Titelbild — nie Telefon oder E-Mail, auch wenn der Hof sie trägt', () => {
    const daten = hofJsonLd(HOF, null, BASIS)
    const text = JSON.stringify(daten)
    expect(text).not.toContain(TELEFON)
    expect(text).not.toContain('hof@example.com')
    expect(daten).not.toHaveProperty('telephone')
    expect(daten).not.toHaveProperty('email')
    expect(daten).toMatchObject({
      '@type': 'LocalBusiness', name: 'Hof Test', url: 'https://hof.example/hof-test', image: 'https://blob.example/titel.jpg',
      address: { streetAddress: 'Musterweg 1', postalCode: '4900', addressLocality: 'Musterdorf', addressCountry: 'AT' },
    })
  })

  it('ohne Titelfoto das Logo, ohne beides kein Bild; geo nur mit Koordinaten', () => {
    expect(hofJsonLd({ ...HOF, bannerType: 'GRADIENT' }, null, BASIS).image).toBe('https://hof.example/logo.png')
    expect(hofJsonLd({ ...HOF, bannerType: 'GRADIENT', logoUrl: null }, null, BASIS)).not.toHaveProperty('image')
    expect(hofJsonLd(HOF, null, BASIS)).not.toHaveProperty('geo')
    expect(hofJsonLd(HOF, { latitude: 48.2, longitude: 13.1 }, BASIS).geo).toEqual({ '@type': 'GeoCoordinates', latitude: 48.2, longitude: 13.1 })
  })
})

describe('produktJsonLd', () => {
  it('Product mit Angebot: Preis mit Punkt und zwei Stellen, EUR, auf Vorrat, verkauft vom Hof', () => {
    expect(produktJsonLd(PRODUKT, HOF, BASIS)).toMatchObject({
      '@type': 'Product', name: 'Freilandeier', description: 'Zehn Stück', image: 'https://hof.example/categories/eier.webp',
      offers: {
        '@type': 'Offer', url: 'https://hof.example/hof-test/produkt/p_eier', price: '4.50', priceCurrency: 'EUR',
        availability: 'https://schema.org/InStock', seller: { '@type': 'LocalBusiness', name: 'Hof Test', url: 'https://hof.example/hof-test' },
      },
    })
  })

  it('der Preis kommt centgenau aus dem gespeicherten Wert — auch wo Kommazahlen krumm würden', () => {
    const preis = (price: number | string) => (produktJsonLd({ ...PRODUKT, price }, HOF, BASIS).offers as { price: string }).price
    expect(preis(19.99)).toBe('19.99')
    expect(preis(0.1 + 0.2)).toBe('0.30')
    expect(preis('1234.05')).toBe('1234.05')
    expect(preis(0)).toBe('0.00')
  })

  it('ohne Vorrat OutOfStock; ohne Beschreibung und Bild fehlen die Felder', () => {
    const daten = produktJsonLd({ ...PRODUKT, stock: 0, description: null, categoryImageUrl: null }, HOF, BASIS)
    expect((daten.offers as { availability: string }).availability).toBe('https://schema.org/OutOfStock')
    expect(daten).not.toHaveProperty('description')
    expect(daten).not.toHaveProperty('image')
  })
})

describe('startseiteJsonLd', () => {
  it('Organization und WebSite der Marke — ohne SearchAction, weil /hoefe? in robots.txt gesperrt ist', () => {
    const daten = startseiteJsonLd(BASIS)
    const graph = daten['@graph'] as Record<string, unknown>[]
    expect(graph.map((g) => g['@type'])).toEqual(['Organization', 'WebSite'])
    expect(graph[0]).toMatchObject({ name: MARKE, url: 'https://hof.example/', logo: 'https://hof.example/icons/icon-512.png' })
    expect(JSON.stringify(daten)).not.toContain('SearchAction')
    expect(JSON.stringify(daten)).not.toContain('potentialAction')
  })
})
