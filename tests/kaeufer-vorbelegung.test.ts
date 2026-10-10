/**
 * Käuferart „Betrieb" bei Futter kaufen vorbelegen (Nachtlauf Nr. 29, Gate 8,
 * Register F6 „22c Futter kaufen"). Weg: „Region › Futter kaufen" verlinkt die
 * Produktseite mit `?kaeufer=betrieb`, die Produktseite gibt den Wert an
 * „Zur Kasse" weiter, die Kasse belegt den Haken „Ich bestelle als
 * landwirtschaftlicher Betrieb" vor.
 *
 * Beweist:
 *  - Die Links aus „Futter kaufen" tragen den Parameter.
 *  - Die Kasse belegt „Betrieb" vor; die Vorbelegung aus dem eigenen Hof
 *    (mit Nummer) geht vor.
 *  - Ein ungültiger Wert wird ignoriert; ohne Parameter bleibt alles wie bisher.
 *  - Der Server prüft weiter allein: Der Haken ohne Nummer reicht bei
 *    NUR_BETRIEBE nicht, die Anfrage an /api/checkout kennt den Parameter nicht.
 *  - Kein Browser-Speicher: nur die Adresse.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  KAEUFER_PARAMETER,
  kaeuferVorbelegungSchema,
  leseKaeuferVorbelegung,
  mitKaeuferVorbelegung,
} from '@/schemas/kaeufer-vorbelegung'
import { kassenAdresse, kassenVorbelegung } from '@/lib/kasse'
import { baueFutterKaufen, type FutterKaufenEingabe } from '@/lib/futter-kaufen'
import { groesseAdresse } from '@/lib/produktdetail'
import { pruefeBetriebsnachweis } from '@/lib/betriebsnachweis'
import { checkoutFormSchema, checkoutRequestSchema } from '@/schemas/checkout'

const WURZEL = join(__dirname, '..')
const lies = (datei: string): string => readFileSync(join(WURZEL, datei), 'utf8')

/** Die Suchparameter einer Adresse, wie die Seite sie bekommt. */
function suche(href: string): URLSearchParams {
  return new URLSearchParams(href.split('?')[1] ?? '')
}

const FUTTER: FutterKaufenEingabe = {
  hoefe: [
    {
      id: 'hof-a',
      slug: 'bergbauernhof',
      name: 'Bergbauernhof',
      entfernungKm: 6,
      betriebsnummer: 'LFBIS 1234567',
      betriebsstatus: 'PRIMAERPRODUKTION',
      abholfenster: [{ dayOfWeek: 6, startTime: '08:00', endTime: '12:00' }],
    },
  ],
  produkte: [
    {
      id: 'rund',
      farmId: 'hof-a',
      name: 'Heu Rundballen',
      familieId: 'f1',
      category: 'HEU_STROH',
      price: 45,
      isAvailable: true,
      stock: 3,
      reservedStock: 0,
      verpackung: 'LOSE_BALLEN',
      futter: { nettoMenge: 250, nettoEinheit: 'KG', betriebsnummer: '1234567' },
    },
    {
      id: 'klein',
      farmId: 'hof-a',
      name: 'Heu Kleinballen',
      familieId: 'f1',
      category: 'HEU_STROH',
      price: 4.5,
      isAvailable: true,
      stock: 3,
      reservedStock: 0,
      verpackung: 'LOSE_BALLEN',
      futter: { nettoMenge: 15, nettoEinheit: 'KG', betriebsnummer: '1234567' },
    },
  ],
  ohneStandort: [],
  abgeschnitten: false,
  filter: { km: 25, art: null, menge: null },
  jetzt: { wochentag: 6, uhrzeit: '07:00' },
}

describe('Futter kaufen: die Links tragen ?kaeufer=betrieb', () => {
  it('„Bestellen" und jede Größe führen mit dem Parameter zur Produktseite', () => {
    const [karte] = baueFutterKaufen(FUTTER).angebote
    expect(karte.bestellenHref).toBe('/bergbauernhof/produkt/klein?kaeufer=betrieb')
    const hrefs = [karte.bestellenHref, ...karte.groessen.map((g) => g.href)]
    expect(hrefs).toHaveLength(3)
    for (const href of hrefs) {
      expect(leseKaeuferVorbelegung(suche(href).get(KAEUFER_PARAMETER) ?? undefined)).toBe('betrieb')
    }
  })

  it('die Größenwahl auf der Produktseite lässt den Parameter in der Adresse stehen', () => {
    expect(groesseAdresse('/bergbauernhof/produkt/klein', '?kaeufer=betrieb', 'rund', 'klein')).toBe(
      '/bergbauernhof/produkt/klein?kaeufer=betrieb&groesse=rund'
    )
    expect(groesseAdresse('/bergbauernhof/produkt/klein', '?kaeufer=betrieb&groesse=rund', 'klein', 'klein')).toBe(
      '/bergbauernhof/produkt/klein?kaeufer=betrieb'
    )
  })
})

describe('Der Adressparameter: nur erlaubte Werte (Zod)', () => {
  it('„betrieb" gilt; steht er mehrfach da, zählt der letzte', () => {
    expect(leseKaeuferVorbelegung('betrieb')).toBe('betrieb')
    expect(leseKaeuferVorbelegung(['privat', 'betrieb'])).toBe('betrieb')
  })

  it('alles andere fällt still weg — kein Fehler, keine Vorbelegung', () => {
    for (const roh of ['BETRIEB', 'Betrieb', 'privat', 'PRIVAT', '', ' betrieb', 'betrieb ', '<script>', 'x'.repeat(5000)]) {
      expect(leseKaeuferVorbelegung(roh)).toBeNull()
    }
    expect(leseKaeuferVorbelegung(undefined)).toBeNull()
    expect(leseKaeuferVorbelegung([])).toBeNull()
    expect(leseKaeuferVorbelegung(['betrieb', 'privat'])).toBeNull()
    expect(kaeuferVorbelegungSchema.parse(42)).toBeNull()
  })

  it('mitKaeuferVorbelegung hängt an, behält andere Parameter und lässt ohne Wert alles, wie es ist', () => {
    expect(mitKaeuferVorbelegung('/hof/produkt/p1', 'betrieb')).toBe('/hof/produkt/p1?kaeufer=betrieb')
    expect(mitKaeuferVorbelegung('/hof/produkt/p1?vorschau=1', 'betrieb')).toBe('/hof/produkt/p1?vorschau=1&kaeufer=betrieb')
    expect(mitKaeuferVorbelegung('/hof/produkt/p1?kaeufer=betrieb', 'betrieb')).toBe('/hof/produkt/p1?kaeufer=betrieb')
    expect(mitKaeuferVorbelegung('/hof/produkt/p1', null)).toBe('/hof/produkt/p1')
  })
})

describe('Die Kasse belegt „Betrieb" vor', () => {
  it('die Adresse der Kasse trägt den Wert weiter; ohne Wert die bisherige Adresse', () => {
    expect(kassenAdresse('bergbauernhof', 'betrieb')).toBe('/bergbauernhof/checkout?kaeufer=betrieb')
    expect(kassenAdresse('bergbauernhof', null)).toBe('/bergbauernhof/checkout')
  })

  it('aus der Adresse: Haken an, Nummer leer', () => {
    expect(kassenVorbelegung(null, 'betrieb')).toEqual({ kaeuferArt: 'BETRIEB', betriebsnummer: '' })
  })

  it('die Vorbelegung aus dem eigenen Hof (mit Nummer) geht vor', () => {
    const ausHof = { kaeuferArt: 'BETRIEB' as const, betriebsnummer: 'LFBIS 7654321' }
    expect(kassenVorbelegung(ausHof, 'betrieb')).toBe(ausHof)
    expect(kassenVorbelegung(ausHof, null)).toBe(ausHof)
  })

  it('ohne Parameter und ohne Hof: keine Vorbelegung — die Kasse startet mit PRIVAT wie bisher', () => {
    expect(kassenVorbelegung(null, null)).toBeNull()
    expect(kassenVorbelegung(null, leseKaeuferVorbelegung('irgendwas'))).toBeNull()
  })

  it('die Kasse liest den Parameter nur über das Schema und reicht das Ergebnis als Startwert ins Formular', () => {
    const seite = lies('src/app/(public)/[farmSlug]/checkout/page.tsx')
    expect(seite).toContain('leseKaeuferVorbelegung(suche[KAEUFER_PARAMETER])')
    expect(seite).toContain('kassenVorbelegung(')
    const formular = lies('src/components/checkout/checkout-form.tsx')
    expect(formular).toContain("kaeuferArt: vorbelegung?.kaeuferArt ?? 'PRIVAT'")
  })
})

describe('Die Produktseite gibt den Wert an „Zur Kasse" weiter', () => {
  it('Seite liest über das Schema, Korb-Blatt und Mini-Warenkorb bekommen kassenAdresse', () => {
    const seite = lies('src/app/(public)/[farmSlug]/produkt/[id]/page.tsx')
    expect(seite).toContain('leseKaeuferVorbelegung(suche[KAEUFER_PARAMETER])')
    const kunde = lies('src/components/produktdetail/produktdetail-kunde.tsx')
    expect(kunde).toContain('kassenAdresse(farm.slug, kaeufer)')
    expect(kunde.match(/kasseHref=\{kasse\}/g)).toHaveLength(2)
    expect(lies('src/components/farm/cart-sheet.tsx')).toContain('href={kasseHref ?? `/${farmSlug}/checkout`}')
    expect(lies('src/components/hofseite/hofseite-seitenspalte.tsx')).toContain('href={kasseHref ?? `/${slug}/checkout`}')
  })
})

describe('Der Server prüft weiter — die Vorbelegung ist keine Wahrheit', () => {
  it('der vorbelegte Haken ohne Nummer reicht bei NUR_BETRIEBE nicht (gleiche Regel in Formular und Handler)', () => {
    const vorbelegt = kassenVorbelegung(null, 'betrieb')!
    expect(pruefeBetriebsnachweis({ ...vorbelegt, nurBetriebeImKorb: true })).toMatchObject({ ok: false, feld: 'betriebsnummer' })
    expect(pruefeBetriebsnachweis({ ...vorbelegt, betriebsnummer: '1234567', nurBetriebeImKorb: true })).toEqual({ ok: true })
  })

  it('die Kundin kann umstellen: PRIVAT bei NUR_BETRIEBE lehnt die Regel weiter ab', () => {
    expect(pruefeBetriebsnachweis({ kaeuferArt: 'PRIVAT', betriebsnummer: '', nurBetriebeImKorb: true })).toMatchObject({
      ok: false,
      feld: 'kaeuferArt',
    })
  })

  it('das Formular-Schema prüft den vorbelegten Stand wie jeden anderen', () => {
    const basis = {
      customerName: 'Erika Muster',
      customerEmail: 'kundin@example.com',
      customerPhone: '0664 000000',
      pickupSlotKey: '2026-10-10|08:00|12:00',
      paymentMethod: 'ONLINE',
      kaeuferArt: 'BETRIEB',
      betriebsnummer: '',
    }
    expect(checkoutFormSchema.safeParse({ ...basis, nurBetriebeImKorb: true }).success).toBe(false)
    expect(checkoutFormSchema.safeParse({ ...basis, nurBetriebeImKorb: false }).success).toBe(true)
  })

  it('die Anfrage an /api/checkout kennt den Parameter nicht — ein mitgeschicktes „kaeufer" fällt weg', () => {
    const anfrage = checkoutRequestSchema.parse({
      farmId: 'hof-a',
      farmSlug: 'bergbauernhof',
      sessionId: 'sitzung-1',
      customerName: 'Erika Muster',
      customerEmail: 'kundin@example.com',
      customerPhone: '0664 000000',
      pickupDate: '2026-10-10',
      pickupTimeStart: '08:00',
      pickupTimeEnd: '12:00',
      paymentMethod: 'ONLINE',
      kaeufer: 'betrieb',
      items: [{ productId: 'klein', name: 'Heu', quantity: 1, unitPrice: 4.5 }],
    })
    expect(anfrage).not.toHaveProperty('kaeufer')
    expect(anfrage.kaeuferArt).toBe('PRIVAT')
    expect(lies('src/app/api/checkout/route.ts')).not.toMatch(/kaeufer-vorbelegung|KAEUFER_PARAMETER|kassenVorbelegung/)
  })

  it('ein verborgener Abschnitt „Betrieb" schickt weiter PRIVAT — die Vorbelegung läuft nie unbemerkt mit', () => {
    const formular = lies('src/components/checkout/checkout-form.tsx')
    expect(formular).toContain("kaeuferArt: betriebAbschnitt ? data.kaeuferArt : 'PRIVAT'")
  })
})

describe('Kein Browser-Speicher — nur die Adresse', () => {
  const DATEIEN = ['src/schemas/kaeufer-vorbelegung.ts', 'src/lib/futter-kaufen.ts', 'src/app/(public)/[farmSlug]/produkt/[id]/page.tsx']
  const SPEICHER = /localStorage|sessionStorage|document\.cookie|indexedDB|cookies\(\)/

  it('Gegenprobe: das Muster schlägt an', () => {
    expect(SPEICHER.test('window.sessionStorage.setItem')).toBe(true)
  })

  it('weder Schema noch Futter kaufen noch Produktseite speichern etwas', () => {
    for (const datei of DATEIEN) expect(lies(datei), datei).not.toMatch(SPEICHER)
  })

  it('der Parameter steht nur an den erlaubten Stellen — kein zweiter Leser', () => {
    // Wer `kaeufer` sonst liest, umginge das Schema.
    expect(lies('src/components/checkout/checkout-form.tsx')).not.toMatch(/KAEUFER_PARAMETER|searchParams|useSearchParams/)
  })
})
