import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'

// Der Client der Entdecken-Seite zieht Leaflet nur dynamisch; für die reinen Hilfen reicht der Router-Ersatz.
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {} }), usePathname: () => '/hoefe', useSearchParams: () => new URLSearchParams() }))

import { kurzPreis, nameMitGebinde, preisZeilen } from '@/components/hofseite/preis-zeilen'
import { typografischerTitel, umkreisSatz } from '@/components/hoefe/hoefe-client'

/*
 * Finden nach der Abnahme Lauf 32 (Nr. 252, Liste lauf32-board-oder-code.md, Abschnitte
 * startseite, hoefe, hofseite): die Anzeige-Hilfen für Preis und Name, der Titel der Suche
 * und der Satz im Leerzustand des Umkreises. Nur Anzeige — gerechnet wird in format.ts.
 */

const produkt = (teil: Partial<{ price: number; unit: string; unitSize: number | null; futter: null }> = {}) => ({
  price: 1.49,
  unit: 'LITER',
  unitSize: 1,
  futter: null,
  ...teil,
})

describe('preisZeilen (Hofseite und Produktseite)', () => {
  it('Preis oben, Grundpreis darunter — auch bei Größe 1 (Board: „€ 1,49“ und „€ 1,49 / L“)', () => {
    expect(preisZeilen(produkt())).toEqual({ preis: '€ 1,49', grundpreis: '€ 1,49 / L' })
  })

  it('Maß-Gebinde wie bisher über formatGrundpreisZeile, Stück-Gebinde je Stück', () => {
    expect(preisZeilen(produkt({ price: 6.58, unit: 'G', unitSize: 250 })).preis).toBe('€ 6,58')
    // Seit Nr. 282 je kg (Antwort 3, Zwischen-Morgenbericht 33 B): € 6,58 für 250 g = € 26,32 / kg wie das Board.
    expect(preisZeilen(produkt({ price: 6.58, unit: 'G', unitSize: 250 })).grundpreis).toBe('€ 26,32 / kg')
    expect(preisZeilen(produkt({ price: 4.8, unit: 'STUECK', unitSize: 10 }))).toEqual({ preis: '€ 4,80', grundpreis: '€ 0,48 / Stück' })
  })
})

describe('nameMitGebinde und kurzPreis', () => {
  it('Maßeinheit auch bei Größe 1, Stück erst ab zwei, nie doppelt', () => {
    expect(nameMitGebinde('Heumilch frisch', { unit: 'LITER', unitSize: 1 })).toBe('Heumilch frisch, 1 L')
    expect(nameMitGebinde('Freilandeier', { unit: 'STUECK', unitSize: 10 })).toBe('Freilandeier, 10 Stück')
    expect(nameMitGebinde('Brot', { unit: 'STUECK', unitSize: 1 })).toBe('Brot')
    expect(nameMitGebinde('Kartoffeln 2 kg', { unit: 'KG', unitSize: 2 })).toBe('Kartoffeln 2 kg')
    expect(nameMitGebinde('Äpfel', { unit: 'KG', unitSize: null })).toBe('Äpfel')
  })

  it('mit Gebinde der Preis des Gebindes, ohne Gebinde der Preis je Einheit', () => {
    expect(kurzPreis({ name: 'Heumilch frisch', price: 1.49, unit: 'LITER', unitSize: 1 })).toEqual({ name: 'Heumilch frisch, 1 L', preis: '€ 1,49' })
    expect(kurzPreis({ name: 'Äpfel', price: 3.5, unit: 'KG', unitSize: null })).toEqual({ name: 'Äpfel', preis: '€ 3,50 / kg' })
    expect(kurzPreis({ name: 'Ei', price: 0.42, unit: 'STUECK', unitSize: null })).toEqual({ name: 'Ei', preis: '€ 0,42 / Stück' })
  })
})

describe('/hoefe: Titel und Leerzustand', () => {
  it('das schließende Anführungszeichen typografisch, andere Titel unverändert', () => {
    expect(typografischerTitel('„Eier" in deiner Nähe')).toBe('„Eier“ in deiner Nähe')
    expect(typografischerTitel('Höfe in deiner Nähe')).toBe('Höfe in deiner Nähe')
  })

  it('„Mit 25 km sind es 2 Höfe mit …“ — die Kategorie nur bei genau einer Wahl', () => {
    expect(umkreisSatz(25, 2, ['FLEISCH'])).toMatch(/^Mit 25 km sind es 2 Höfe mit .+\.$/)
    expect(umkreisSatz(50, 1, [])).toBe('Mit 50 km sind es 1 Hof.')
    expect(umkreisSatz(25, 3, ['FLEISCH', 'EIER'])).toBe('Mit 25 km sind es 3 Höfe.')
  })

  it('die Vorschläge öffnen nicht beim Fokus (nur beim Tippen) und das Filter-Symbol ist weg', () => {
    const suche = readFileSync('src/components/hoefe/hoefe-suche.tsx', 'utf8')
    expect(suche).not.toMatch(/onFocus=\{\(\) => setVorschlagsLage/)
    expect(suche).toMatch(/onChange=\{\(e\) => \{\s+setVorschlagsLage\(\{ offen: true/)
    expect(readFileSync('src/components/hoefe/entdecken-filterblatt.tsx', 'utf8')).not.toContain('SlidersHorizontal')
  })

  it('bei gesetztem Umkreis bekommt die Karte das Zentrum (Du-Marke und Kreis)', () => {
    const client = readFileSync('src/components/hoefe/hoefe-client.tsx', 'utf8')
    expect(client.match(/zentrum=\{kartenZentrum\}/g)).toHaveLength(2)
    expect(client).toMatch(/bezugspunkt && aktiverUmkreis !== null \?/)
  })
})
