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
import { jsonLdSicher } from '@/lib/json-ld'

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
