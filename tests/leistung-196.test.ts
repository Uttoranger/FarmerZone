/**
 * Leistung, Rest aus 180 (Nachtlauf 26, Nr. 196). Beweist am Quelltext:
 *  - Zod liegt in keinem Browser-Bündel der Routen /, /hoefe, Hofseite und
 *    Kasse: Vom ersten `'use client'`-Modul an erreicht kein Import mehr
 *    `zod` oder `@hookform/resolvers` (Importgraph, Server-Actions zählen
 *    als Grenze, weil der Browser nur ihren Aufruf lädt).
 *  - Stripe.js kommt unter src/ nur über `@stripe/stripe-js/pure`.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  ANZEIGE_BEREICHE,
  PRODUCT_CATEGORY_VALUES,
  PRODUCT_LABEL_VALUES,
  PRODUCT_SUBCATEGORY_VALUES,
  TIERART_VALUES,
  gehoertZu,
  istAltlastUnterkategorie,
  type ProductCategoryValue,
} from '@/lib/taxonomie'
import { MELDUNG_KENNUNG_MAX } from '@/lib/meldung'
import { TEILEN_KANAL_CODES } from '@/lib/teilen-kanal'
import { teilenBesuchAusAdresse } from '@/lib/teilen-besuch'
import { BEREIT_TYP, MARKIERUNG_TYP, leseBereit, leseMarkierung } from '@/lib/hofseite-vorschau'
import { CHECKOUT_FELD_REIHENFOLGE, EMAIL_MUSTER, kasseFormularResolver, leseZahlungsBetrag, pruefeKasseFormular, type KasseFormularDaten } from '@/lib/kasse-pruefung'
import { leseWarenkorb } from '@/lib/warenkorb-speicher'
import { bereinigeKennung } from '@/lib/fehlerseite'
import { leseFotoWeg } from '@/lib/foto-weg-speicher'
import {
  CHECKOUT_FELD_REIHENFOLGE as AUS_SCHEMA_REIHENFOLGE,
  checkoutFormSchema,
  checkoutZahlungsBetragSchema,
  type CheckoutFormData,
} from '@/schemas/checkout'
import { bereitSchema, markierungSchema, hofseiteZeileIdSchema } from '@/schemas/hofseite-vorschau'
import { leseHoefeFilter, abgesendeterSuchtext } from '@/schemas/hoefe-filter'
import { leseHofReiter, leseBeitragKennung } from '@/schemas/hofseite-reiter'
import { leseMeinHofReiter } from '@/schemas/mein-hof-reiter'
import { leseKaeuferVorbelegung } from '@/schemas/kaeufer-vorbelegung'
import { leseGroesse } from '@/schemas/produktdetail'
import { UNIT_LABELS, MONTH_SHORT, seasonLabel } from '@/schemas/product'
import * as format from '@/lib/format'

type Quelle = { gibt: (pfad: string) => boolean; lies: (pfad: string) => string }

const PLATTE: Quelle = {
  gibt: (pfad) => existsSync(join(process.cwd(), pfad)) && statSync(join(process.cwd(), pfad)).isFile(),
  lies: (pfad) => readFileSync(join(process.cwd(), pfad), 'utf8'),
}

/** Wert-Importe und Re-Exporte; `import type`/`export type` laufen nicht ins Bündel. */
const STATISCH = /^\s*(?:import|export)\s+(?!type\b)([^;'"]*?\bfrom\s*)?['"]([^'"]+)['"]/gm
const DYNAMISCH = /import\(\s*['"]([^'"]+)['"]\s*\)/g
const DIREKTIVE = (wort: string) => new RegExp(`^(?:\\s*//[^\\n]*\\n|\\s*/\\*[\\s\\S]*?\\*/)*\\s*['"]${wort}['"]`)

/** Nur Typen in geschweiften Klammern (`import { type A, type B } from …`) — fällt im Bündel weg. */
function nurTypen(anweisung: string): boolean {
  if (/^\s*(?:import|export)\s+[\w$]+\s*(?:,|from)/.test(anweisung)) return false
  if (/\*\s+as\b|^\s*export\s*\*/.test(anweisung)) return false
  const klammer = /\{([^}]*)\}/.exec(anweisung)
  if (!klammer) return false
  const namen = klammer[1].split(',').map((n) => n.trim()).filter(Boolean)
  return namen.length > 0 && namen.every((n) => n.startsWith('type '))
}

function aufloesen(quelle: Quelle, von: string, spez: string): string | null {
  let basis: string
  if (spez.startsWith('@/')) basis = `src/${spez.slice(2)}`
  else if (spez.startsWith('.')) basis = join(von, '..', spez)
  else return `paket:${spez}`
  for (const endung of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
    if (quelle.gibt(basis + endung)) return basis + endung
  }
  return null
}

function abhaengigkeiten(quelle: Quelle, pfad: string): string[] {
  const text = quelle.lies(pfad)
  const ziele: string[] = []
  for (const treffer of text.matchAll(STATISCH)) {
    if (nurTypen(treffer[0])) continue
    const ziel = aufloesen(quelle, pfad, treffer[2])
    if (ziel) ziele.push(ziel)
  }
  for (const treffer of text.matchAll(DYNAMISCH)) {
    const ziel = aufloesen(quelle, pfad, treffer[1])
    if (ziel) ziele.push(ziel)
  }
  return ziele
}

/** Pakete, die Zod ins Browser-Bündel tragen. */
const ZOD_PAKET = /^paket:(?:zod(?:\/|$)|@hookform\/resolvers(?:\/|$))/

/**
 * Alle Wege vom Einstieg einer Route bis zu Zod, die im Browser landen. Ein
 * Weg zählt ab dem ersten `'use client'`-Modul; eine `'use server'`-Datei ist
 * aus Sicht des Browsers nur ein Aufruf und endet den Weg.
 */
function zodWege(quelle: Quelle, einstiege: readonly string[]): string[][] {
  const wege: string[][] = []
  const gesehen = new Set<string>()
  const stapel: { pfad: string; client: boolean; weg: string[] }[] = einstiege.map((pfad) => ({ pfad, client: false, weg: [pfad] }))
  while (stapel.length > 0) {
    const { pfad, client: vorher, weg } = stapel.pop()!
    if (pfad.startsWith('paket:')) {
      if (vorher && ZOD_PAKET.test(pfad)) wege.push(weg)
      continue
    }
    const text = quelle.lies(pfad)
    if (vorher && DIREKTIVE('use server').test(text)) continue
    const client = vorher || DIREKTIVE('use client').test(text)
    const schluessel = `${client}:${pfad}`
    if (gesehen.has(schluessel)) continue
    gesehen.add(schluessel)
    for (const ziel of abhaengigkeiten(quelle, pfad)) stapel.push({ pfad: ziel, client, weg: [...weg, ziel] })
  }
  return wege
}

const GEMEINSAM = ['src/app/layout.tsx', 'src/app/error.tsx', 'src/app/not-found.tsx']
const HOF = 'src/app/(public)/[farmSlug]'
const ROUTEN: Record<string, string[]> = {
  '/': [...GEMEINSAM, 'src/app/page.tsx'],
  '/hoefe': [...GEMEINSAM, 'src/app/(public)/hoefe/page.tsx', 'src/app/(public)/hoefe/loading.tsx'],
  Hofseite: [...GEMEINSAM, `${HOF}/page.tsx`, `${HOF}/not-found.tsx`],
  Kasse: [...GEMEINSAM, `${HOF}/checkout/page.tsx`, `${HOF}/checkout/loading.tsx`, `${HOF}/not-found.tsx`],
}

describe('Zod bleibt aus den Browser-Bündeln der Kundenrouten', () => {
  it('die Einstiege gibt es', () => {
    for (const pfad of Object.values(ROUTEN).flat()) expect(PLATTE.gibt(pfad), pfad).toBe(true)
  })

  it.each(Object.entries(ROUTEN))('%s: kein Weg vom Browser-Code zu Zod', (_route, einstiege) => {
    const wege = zodWege(PLATTE, einstiege).map((weg) => weg.join(' > '))
    expect(wege).toEqual([])
  }, 30_000) // liest den Importgraph der Route

  describe('Gegenprobe am nachgebauten Graphen', () => {
    const baue = (dateien: Record<string, string>): Quelle => ({
      gibt: (pfad) => pfad in dateien,
      lies: (pfad) => dateien[pfad] ?? '',
    })

    it('findet Zod hinter einem Client-Modul, auch über eine reine Hilfsdatei und einen Re-Export', () => {
      const quelle = baue({
        'src/app/page.tsx': "import { Knopf } from '@/components/knopf'\n",
        'src/components/knopf.tsx': "'use client'\nimport { lies } from '../lib/lies'\n",
        'src/lib/lies.ts': "export { schema } from '@/schemas/x'\n",
        'src/schemas/x.ts': "import { z } from 'zod'\nexport const schema = z.string()\n",
      })
      expect(zodWege(quelle, ['src/app/page.tsx'])).toEqual([
        ['src/app/page.tsx', 'src/components/knopf.tsx', 'src/lib/lies.ts', 'src/schemas/x.ts', 'paket:zod'],
      ])
    })

    it('findet den Resolver von react-hook-form und einen dynamischen Import', () => {
      const quelle = baue({
        'src/app/page.tsx': "/* Kopf */\n'use client'\nimport { zodResolver } from '@hookform/resolvers/zod'\nconst x = () => import('@/lib/y')\n",
        'src/lib/y.ts': "import * as z from 'zod/mini'\n",
      })
      expect(zodWege(quelle, ['src/app/page.tsx']).map((w) => w.at(-1))).toEqual(['paket:zod/mini', 'paket:@hookform/resolvers/zod'])
    })

    it('lässt Server-Code, Typ-Importe und Server-Actions durch', () => {
      const quelle = baue({
        'src/app/page.tsx': "import { z } from 'zod'\nimport { Knopf } from '@/components/knopf'\n",
        'src/components/knopf.tsx':
          "'use client'\nimport type { X } from '@/schemas/x'\nimport { type Y, type W } from '@/schemas/x'\nimport { speichern } from '@/server/actions/a'\n",
        'src/server/actions/a.ts': "'use server'\nimport { schema } from '@/schemas/x'\n",
        'src/schemas/x.ts': "import { z } from 'zod'\n",
      })
      expect(zodWege(quelle, ['src/app/page.tsx'])).toEqual([])
    })

    it('ein Name neben dem Typ ist ein Wert-Import', () => {
      expect(nurTypen("import { type A, b } from '@/schemas/x'")).toBe(false)
      expect(nurTypen("import C, { type A } from '@/schemas/x'")).toBe(false)
      expect(nurTypen("import { type A } from '@/schemas/x'")).toBe(true)
    })
  })
})

describe('Stripe.js nur über den Eingang ohne Laden beim Import', () => {
  /** Der Haupteingang hängt Stripe.js schon beim Import an die Seite. */
  const HAUPTEINGANG = /from\s*['"]@stripe\/stripe-js['"]|import\(\s*['"]@stripe\/stripe-js['"]\s*\)|require\(\s*['"]@stripe\/stripe-js['"]\s*\)/

  /** Wert-Importe aus dem Haupteingang; `import type` lädt nichts. */
  const laedtHaupteingang = (text: string): boolean =>
    text
      .split('\n')
      .filter((zeile) => HAUPTEINGANG.test(zeile))
      .some((zeile) => !/^\s*import\s+type\b/.test(zeile))

  function alleQuellen(ordner: string): string[] {
    return readdirSync(join(process.cwd(), ordner), { withFileTypes: true }).flatMap((eintrag) => {
      const pfad = `${ordner}/${eintrag.name}`
      if (eintrag.isDirectory()) return alleQuellen(pfad)
      return /\.(ts|tsx)$/.test(eintrag.name) ? [pfad] : []
    })
  }

  it('die Spürprobe findet den Haupteingang und lässt /pure und Typen durch (Gegenprobe)', () => {
    expect(laedtHaupteingang("import { loadStripe } from '@stripe/stripe-js'")).toBe(true)
    expect(laedtHaupteingang("const s = await import('@stripe/stripe-js')")).toBe(true)
    expect(laedtHaupteingang("import { loadStripe } from '@stripe/stripe-js/pure'")).toBe(false)
    expect(laedtHaupteingang("import type { Stripe } from '@stripe/stripe-js'")).toBe(false)
  })

  it('keine Datei unter src/ lädt den Haupteingang', () => {
    const treffer = alleQuellen('src').filter((pfad) => laedtHaupteingang(PLATTE.lies(pfad)))
    expect(treffer).toEqual([])
  }, 30_000) // liest jede Datei unter src/

  it('loadStripe kommt aus /pure', () => {
    expect(PLATTE.lies('src/lib/stripe-client.ts')).toMatch(/import \{ loadStripe \} from '@stripe\/stripe-js\/pure'/)
  })
})

// ─── Gleiches Verhalten wie der Zod-Stand vor Nr. 196 ──────────────────────────
// Die Zod-Fassungen unten sind Abschriften aus 8212c743 (Basis von Nr. 196). Jede
// reine Prüfung muss an denselben Eingaben dasselbe liefern.

/** Kleiner fester Zufall, damit jeder Lauf dieselben Fälle prüft. */
function zufall(saat: number): () => number {
  let x = saat
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648
    return x / 2147483648
  }
}

const SONDERWERTE: unknown[] = [undefined, null, '', ' ', 0, 1, -1, 1.5, NaN, Infinity, true, false, [], {}, ['a'], new Date(0), 'x'.repeat(200)]

describe('Gleichheit mit dem Zod-Stand', () => {
  it('Vorschau-Nachrichten: Markierung und Bereit wie markierungSchema und bereitSchema', () => {
    const daten: unknown[] = [
      ...SONDERWERTE,
      { typ: MARKIERUNG_TYP, abschnitt: 'titelbild' },
      { typ: MARKIERUNG_TYP, abschnitt: null },
      { typ: MARKIERUNG_TYP },
      { typ: MARKIERUNG_TYP, abschnitt: 'gibtsnicht' },
      { typ: MARKIERUNG_TYP, abschnitt: 'aktuell', extra: 1 },
      { typ: 'fremd', abschnitt: 'logo' },
      { typ: BEREIT_TYP },
      { typ: BEREIT_TYP, abschnitt: 'logo' },
      [MARKIERUNG_TYP],
      ...hofseiteZeileIdSchema.options.map((abschnitt) => ({ typ: MARKIERUNG_TYP, abschnitt })),
    ]
    for (const data of daten) {
      const zod = markierungSchema.safeParse(data)
      expect(leseMarkierung({ origin: 'o', data }, 'o'), JSON.stringify(data)).toBe(zod.success ? zod.data.abschnitt : null)
      expect(leseBereit({ origin: 'o', data }, 'o'), JSON.stringify(data)).toBe(bereitSchema.safeParse(data).success)
    }
    // Gegenprobe: ein fremder Ursprung zählt nie.
    expect(leseMarkierung({ origin: 'fremd', data: { typ: MARKIERUNG_TYP, abschnitt: 'logo' } }, 'o')).toBeNull()
  })

  it('Reiter, Beitrag, Mein-Hof-Reiter, Käufer, Größe, Fehlernummer, Foto-Weg, Teilen-Kürzel', () => {
    const alt = {
      reiter: z.enum(['uebersicht', 'produkte']).nullable().catch(null),
      beitrag: z.string().regex(/^[a-z0-9]{1,40}$/).nullable().catch(null),
      meinHof: z.enum(['hofseite', 'beitraege']).catch('hofseite'),
      kaeufer: z.enum(['betrieb']).nullable().catch(null),
      groesse: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).nullable().catch(null),
      kennung: z
        .string()
        .trim()
        .transform((wert) => wert.replace(/[^A-Za-z0-9_-]/g, ''))
        .pipe(z.string().min(1).max(MELDUNG_KENNUNG_MAX))
        .catch(''),
      fotoWeg: z.enum(['galerie', 'dateien']),
      kanal: z.enum(TEILEN_KANAL_CODES),
    }
    const werte: unknown[] = [
      ...SONDERWERTE,
      'uebersicht', 'produkte', 'beitraege', 'hofseite', 'betrieb', 'galerie', 'dateien', 'kamera',
      'cbeitragaaaa', 'a'.repeat(40), 'a'.repeat(41), 'A1', 'p_5kg', 'x'.repeat(64), 'x'.repeat(65), '<script>',
      ' 12-ab_C ', '[L135]', 'ä', '1'.repeat(MELDUNG_KENNUNG_MAX), '1'.repeat(MELDUNG_KENNUNG_MAX + 1),
      ...TEILEN_KANAL_CODES, 'WA', 'wa ',
    ]
    for (const w of werte) {
      const n = JSON.stringify(w) ?? String(w)
      expect(leseHofReiter(w), n).toBe(alt.reiter.parse(w))
      expect(leseBeitragKennung(w), n).toBe(alt.beitrag.parse(w))
      expect(leseMeinHofReiter(w), n).toBe(alt.meinHof.parse(w))
      expect(bereinigeKennung(w), n).toBe(alt.kennung.parse(w))
      if (typeof w === 'string' || w === undefined) {
        expect(leseKaeuferVorbelegung(w), n).toBe(alt.kaeufer.parse(w ?? null))
        expect(leseGroesse(w), n).toBe(alt.groesse.parse(w ?? null))
      }
      const speicher = { getItem: () => w as string | null, setItem: () => {}, removeItem: () => {} }
      const fotoWeg = alt.fotoWeg.safeParse(w)
      expect(leseFotoWeg(speicher), n).toBe(fotoWeg.success ? fotoWeg.data : null)
      if (typeof w === 'string') {
        const kanal = alt.kanal.safeParse(w)
        const besuch = teilenBesuchAusAdresse(`https://hof.example/h?k=${encodeURIComponent(w)}`)
        expect(besuch.kanal, n).toBe(kanal.success ? kanal.data : null)
      }
    }
    // Listen-Eingaben wie aus den Suchparametern: der letzte zählt.
    expect(leseKaeuferVorbelegung(['privat', 'betrieb'])).toBe('betrieb')
    expect(leseGroesse(['p_a', 'p_b'])).toBe('p_b')
  })

  it('Warenkorb im Speicher: Hülle und Positionen wie die früheren Schemas', () => {
    const position = z.object({
      productId: z.string().min(1),
      name: z.string(),
      price: z.number().nonnegative(),
      unit: z.string(),
      unitSize: z.number().nullable(),
      quantity: z.number().int().positive(),
      imageUrl: z.string().nullable(),
    })
    const huelle = z.object({
      farmId: z.string().min(1),
      farmSlug: z.string().max(100).regex(/^[a-z0-9-]+$/).optional().catch(undefined),
      items: z.array(z.unknown()),
    })
    const altLesen = (roh: string): unknown => {
      let daten: unknown
      try {
        daten = JSON.parse(roh)
      } catch {
        return null
      }
      const h = huelle.safeParse(daten)
      if (!h.success) return null
      const items = h.data.items.flatMap((p) => {
        const r = position.safeParse(p)
        return r.success ? [r.data] : []
      })
      return { farmId: h.data.farmId, farmSlug: h.data.farmSlug, items }
    }
    const gut = { productId: 'p1', name: 'Eier', price: 4.5, unit: 'STUECK', unitSize: null, quantity: 2, imageUrl: null }
    const abwandlungen: unknown[] = [
      gut,
      { ...gut, extra: 'weg' },
      { ...gut, price: 0 },
      { ...gut, price: -1 },
      { ...gut, price: '4.5' },
      { ...gut, quantity: 0 },
      { ...gut, quantity: 1.5 },
      { ...gut, quantity: 2 ** 53 },
      { ...gut, unitSize: 0.5 },
      { ...gut, unitSize: undefined },
      { ...gut, imageUrl: 'https://bild' },
      { ...gut, imageUrl: 3 },
      { ...gut, productId: '' },
      { ...gut, name: undefined },
      null,
      [],
      'text',
    ]
    const korbe: string[] = [
      'kein json',
      'null',
      '[]',
      '{}',
      JSON.stringify({ farmId: 'f1', items: abwandlungen }),
      JSON.stringify({ farmId: 'f1', farmSlug: 'hof-a', items: [gut] }),
      JSON.stringify({ farmId: 'f1', farmSlug: 'Hof A', items: [gut] }),
      JSON.stringify({ farmId: 'f1', farmSlug: 'a'.repeat(101), items: [] }),
      JSON.stringify({ farmId: 'f1', farmSlug: 5, items: [] }),
      JSON.stringify({ farmId: '', items: [] }),
      JSON.stringify({ farmId: 'f1', items: {} }),
      JSON.stringify({ farmId: 'f1' }),
    ]
    for (const roh of korbe) expect(leseWarenkorb(roh), roh).toEqual(altLesen(roh))
    // Gegenprobe: eine gültige Position kommt ohne fremde Felder an.
    expect(leseWarenkorb(JSON.stringify({ farmId: 'f1', items: [{ ...gut, extra: 1 }] }))?.items).toEqual([gut])
  })

  it('Filter von /hoefe: wie der Zod-Stand an 600 Adressen', () => {
    const SUCHTEXT_MAX = 100
    const kategorie = z.enum(PRODUCT_CATEGORY_VALUES)
    const sorte = z.enum(PRODUCT_SUBCATEGORY_VALUES)
    const siegel = z.enum(PRODUCT_LABEL_VALUES)
    const tier = z.enum(TIERART_VALUES)
    const such = z.string().trim().min(1).max(SUCHTEXT_MAX)
    const liste = <T,>(roh: string | null, schema: z.ZodType<T>): T[] => {
      if (!roh) return []
      const werte: T[] = []
      for (const teil of roh.split(',')) {
        const r = schema.safeParse(teil.trim())
        if (r.success && !werte.includes(r.data)) werte.push(r.data)
      }
      return werte
    }
    const altLese = (params: URLSearchParams) => {
      const bereich = z.enum(['futter']).nullable().catch(null).parse(params.get('bereich') ?? null) === 'futter' ? 'FUTTERMITTEL' : 'LEBENSMITTEL'
      const imBereich = ANZEIGE_BEREICHE[bereich].kategorien as readonly ProductCategoryValue[]
      const kategorien = liste(params.get('kat'), kategorie).filter((k) => imBereich.includes(k))
      const sorten = liste(params.get('sorte'), sorte).filter((s) => !istAltlastUnterkategorie(s) && kategorien.some((k) => gehoertZu(k, s)))
      const futter = bereich === 'FUTTERMITTEL'
      const gebinde = z.enum(['klein', 'gross']).nullable().catch(null).parse(params.get('gebinde'))
      const suchtext = such.safeParse(params.get('q') ?? '')
      const suchMarken: string[] = []
      for (const roh of params.getAll('such')) {
        const m = such.safeParse(roh)
        if (m.success && !suchMarken.includes(m.data) && suchMarken.length < 10) suchMarken.push(m.data)
      }
      return {
        bereich,
        kategorien,
        sorten,
        siegel: liste(params.get('siegel'), siegel),
        tiere: futter ? liste(params.get('tiere'), tier) : [],
        gebinde: !futter || gebinde === null ? null : gebinde === 'klein' ? 'KLEIN' : 'GROSS',
        sortierung: futter && z.enum(['grundpreis']).nullable().catch(null).parse(params.get('sort')) === 'grundpreis' ? 'GRUNDPREIS' : null,
        suchtext: suchtext.success ? (params.get('q') ?? '') : '',
        suchMarken,
        abholung: z.enum(['heute', 'morgen', 'wochenende']).nullable().catch(null).parse(params.get('abholung')),
        ansicht: z.enum(['liste', 'karte']).catch('liste').parse(params.get('ansicht')),
      }
    }
    const zz = zufall(196)
    const eins = <T,>(xs: readonly T[]): T => xs[Math.floor(zz() * xs.length)]
    const etwas = (xs: readonly string[]): string =>
      Array.from({ length: 1 + Math.floor(zz() * 4) }, () => eins([...xs, ' ', 'quatsch', ''])).map((w) => (zz() < 0.2 ? ` ${w} ` : w)).join(',')
    for (let i = 0; i < 600; i++) {
      const params = new URLSearchParams()
      if (zz() < 0.5) params.set('bereich', eins(['futter', 'FUTTER', 'x', '']))
      if (zz() < 0.6) params.set('kat', etwas(PRODUCT_CATEGORY_VALUES))
      if (zz() < 0.5) params.set('sorte', etwas(PRODUCT_SUBCATEGORY_VALUES))
      if (zz() < 0.4) params.set('siegel', etwas(PRODUCT_LABEL_VALUES))
      if (zz() < 0.4) params.set('tiere', etwas(TIERART_VALUES))
      if (zz() < 0.4) params.set('gebinde', eins(['klein', 'gross', 'KLEIN', '']))
      if (zz() < 0.3) params.set('sort', eins(['grundpreis', 'preis']))
      if (zz() < 0.5) params.set('q', eins(['Eier', ' Eier ', '   ', '', 'x'.repeat(100), 'x'.repeat(101), ` ${'x'.repeat(100)} `]))
      if (zz() < 0.3) params.set('t', '1')
      for (let m = 0; m < Math.floor(zz() * 13); m++) params.append('such', eins(['a', 'b', ' a ', '', 'x'.repeat(101), `w${m}`]))
      if (zz() < 0.4) params.set('abholung', eins(['heute', 'morgen', 'wochenende', 'gestern']))
      if (zz() < 0.4) params.set('ansicht', eins(['karte', 'liste', 'KARTE']))
      const adresse = params.toString()
      expect(leseHoefeFilter(params), adresse).toEqual(altLese(params))
      expect(abgesendeterSuchtext(params), adresse).toBe(params.get('t') === null ? altLese(params).suchtext : '')
    }
  })

  it('Einheiten, Monate und Saison-Zeile: dieselben Werte aus format.ts und dem Schema', () => {
    expect(UNIT_LABELS).toBe(format.UNIT_LABELS)
    expect(MONTH_SHORT).toBe(format.MONTH_SHORT)
    expect(seasonLabel).toBe(format.seasonLabel)
    expect(seasonLabel(3, 10)).toBe('Saisonal verfügbar: Mär bis Okt')
    expect(UNIT_LABELS.KG).toBe('kg')
  })
})

describe('Kassenformular ohne Zod: wie checkoutFormSchema', () => {
  it('Feldreihenfolge und Datenform sind dieselben', () => {
    expect(AUS_SCHEMA_REIHENFOLGE).toBe(CHECKOUT_FELD_REIHENFOLGE)
    expectTypeOf<KasseFormularDaten>().toEqualTypeOf<CheckoutFormData>()
  })

  it('das Muster der E-Mail ist Zods eigenes', () => {
    expect(EMAIL_MUSTER.source).toBe(z.regexes.email.source)
  })

  const GUT = {
    customerName: 'Mia Muster',
    customerEmail: ' Mia@Beispiel.AT ',
    customerPhone: '0664 000000',
    customerNote: '',
    pickupSlotKey: '2026-11-02|09:00|10:00',
    paymentMethod: 'ONSITE_CASH',
    kaeuferArt: 'PRIVAT',
    betriebsnummer: '',
    nurBetriebeImKorb: false,
  }

  /** Was zodResolver aus dem Schema macht: je Feld der erste Satz, oder die Ausgabe. */
  async function zodErgebnis(werte: Record<string, unknown>) {
    const ergebnis = await zodResolver(checkoutFormSchema)(werte as never, undefined, { fields: {}, shouldUseNativeValidation: false })
    const fehler = Object.fromEntries(Object.entries(ergebnis.errors).map(([feld, f]) => [feld, (f as { message?: string }).message]))
    return Object.keys(fehler).length > 0 ? { fehler } : { werte: ergebnis.values }
  }
  async function reinesErgebnis(werte: Record<string, unknown>) {
    const ergebnis = await kasseFormularResolver(werte as never, undefined, { fields: {}, shouldUseNativeValidation: false })
    const fehler = Object.fromEntries(Object.entries(ergebnis.errors).map(([feld, f]) => [feld, (f as { message?: string }).message]))
    return Object.keys(fehler).length > 0 ? { fehler } : { werte: ergebnis.values }
  }

  const ABWANDLUNGEN: Record<string, unknown[]> = {
    customerName: ['', 'M', 'Mi', 'x'.repeat(80), 'x'.repeat(81), '  '],
    customerEmail: ['', '   ', 'mia', 'mia@', 'mia@hof', 'mia@hof.at', 'MIA@HOF.AT', '.mia@hof.at', 'm..a@hof.at', `${'a'.repeat(250)}@b.at`, `${'a'.repeat(245)}@hof.at`],
    customerPhone: ['', '123', '1234', 'x'.repeat(30), 'x'.repeat(31)],
    customerNote: [undefined, '', 'x'.repeat(500), 'x'.repeat(501)],
    pickupSlotKey: ['', 'k'],
    paymentMethod: ['ONLINE', 'ONSITE_CASH'],
    kaeuferArt: [undefined, 'PRIVAT', 'BETRIEB'],
    betriebsnummer: [undefined, '', '1234', ' 12345 ', '12345', 'x'.repeat(100), ` ${'x'.repeat(100)} `],
    nurBetriebeImKorb: [undefined, false, true],
  }

  it('jede Abwandlung eines Felds einzeln: dieselben Sätze, dieselbe Ausgabe', async () => {
    for (const [feld, werte] of Object.entries(ABWANDLUNGEN)) {
      for (const wert of werte) {
        const eingabe = { ...GUT, [feld]: wert }
        expect(await reinesErgebnis(eingabe), `${feld}=${JSON.stringify(wert)}`).toEqual(await zodErgebnis(eingabe))
      }
    }
  })

  it('400 gemischte Eingaben: dieselben Sätze, dieselbe Ausgabe', async () => {
    const zz = zufall(1960)
    for (let i = 0; i < 400; i++) {
      const eingabe: Record<string, unknown> = {}
      for (const [feld, werte] of Object.entries(ABWANDLUNGEN)) eingabe[feld] = werte[Math.floor(zz() * werte.length)]
      expect(await reinesErgebnis(eingabe), JSON.stringify(eingabe)).toEqual(await zodErgebnis(eingabe))
    }
  })

  it('Gegenprobe: ein Betrieb ohne Nummer fällt auf, ein guter Stand geht durch', () => {
    const betrieb = pruefeKasseFormular({ ...GUT, nurBetriebeImKorb: true, kaeuferArt: 'BETRIEB', betriebsnummer: '12' })
    expect(betrieb.ok).toBe(false)
    const gut = pruefeKasseFormular(GUT)
    expect(gut.ok && gut.daten.customerEmail).toBe('mia@beispiel.at')
  })

  it('Betrag aus der Antwort wie checkoutZahlungsBetragSchema', () => {
    const faelle: unknown[] = [
      ...SONDERWERTE,
      { clientSecret: 'x', amountCents: 1082, serviceFeeCents: 52 },
      { clientSecret: 'x' },
      { amountCents: 10.5, serviceFeeCents: 0 },
      { amountCents: 100, serviceFeeCents: 101 },
      { amountCents: 100, serviceFeeCents: 100 },
      { amountCents: 0, serviceFeeCents: 0 },
      { amountCents: 1, serviceFeeCents: -1 },
      { amountCents: '100', serviceFeeCents: 0 },
      { amountCents: 2 ** 53, serviceFeeCents: 0 },
      [100, 0],
    ]
    for (const roh of faelle) {
      const zod = checkoutZahlungsBetragSchema.safeParse(roh)
      expect(leseZahlungsBetrag(roh), JSON.stringify(roh)).toEqual(zod.success ? zod.data : null)
    }
  })
})
