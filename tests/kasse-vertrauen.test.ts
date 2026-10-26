/**
 * Kasse: Vertrauen, Grund, Ausweg (Nr. 176; Board system-sterne-kasse-vertrauen).
 *
 * Beweist, mit Gegenprobe:
 *  - Jede Meldung des Kassen-Schemas sagt, was fehlt und wozu der Hof es braucht
 *    — „Pflichtfeld" und „Ungültig" allein gibt es nicht.
 *  - Leer und ungültig sind zwei Meldungen (E-Mail).
 *  - Das Zeitlimit: `bestellungSenden` wirft nie, meldet `zeit`/`netz`, und der
 *    zweite Versuch schickt DENSELBEN Idempotenz-Schlüssel (nichts wird doppelt
 *    bestellt); ein anderer Schlüssel bleibt anderen Bestellungen vorbehalten.
 *  - (Die Kasse selbst — Datenschutz-Link, USt, Tastaturhinweise — steht in kasse-formular.test.ts.)
 *  - Enter in einem Feld geht zum nächsten Feld, bestellt aber nie.
 *  - Der pausierte Hof bekommt die Pausen-Karte mit zwei Wegen, kein 404.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
  usePathname: () => '/hof-test/checkout',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
import { KasseNetzFehler, KassePausiert } from '@/components/checkout/checkout-form'
import { checkoutFormSchema } from '@/schemas/checkout'
import {
  KASSE_NOCHMAL,
  KASSE_ZEITLIMIT_SATZ,
  PREISE_INKL_UST,
  SERVICEGEBUEHR_ZUSATZ,
  bestellungSenden,
  weiterBeiEnter,
} from '@/lib/kasse'
import { publicFarm } from './fabrik/public-farm'

const GUELTIG = {
  customerName: 'Anna Beispiel',
  customerEmail: 'anna@example.com',
  customerPhone: '+43 660 0000000',
  pickupSlotKey: '2026-10-31|09:00|12:00',
  paymentMethod: 'ONLINE' as const,
}

function meldungen(eingabe: Record<string, unknown>): Record<string, string> {
  const r = checkoutFormSchema.safeParse({ ...GUELTIG, ...eingabe })
  if (r.success) return {}
  return Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message]))
}

describe('Meldungen des Kassen-Schemas', () => {
  it('Gegenprobe: gültige Eingaben haben keine Meldung', () => {
    expect(meldungen({})).toEqual({})
  })

  it('jede Meldung nennt, was zu tun ist, und wozu der Hof es braucht', () => {
    const m = meldungen({ customerName: '', customerEmail: '', customerPhone: '', pickupSlotKey: '', paymentMethod: 'X' })
    expect(m.customerName).toBe('Bitte gib deinen Namen an – so weiß der Hof, wer abholt.')
    expect(m.customerEmail).toBe('Bitte gib deine E-Mail-Adresse an – dorthin schicken wir dir die Bestätigung.')
    expect(m.customerPhone).toBe('Bitte gib eine Telefonnummer an – der Hof ruft nur an, falls bei der Abholung etwas ist.')
    expect(m.pickupSlotKey).toBe('Bitte wähle einen Abholtermin – so weiß der Hof, wann du kommst.')
    expect(m.paymentMethod).toBe('Bitte wähle, wie du bezahlen möchtest – online jetzt oder bar bei der Abholung.')
  })

  it('eine E-Mail-Adresse, die nicht stimmt, hat eine andere Meldung als eine leere', () => {
    const leer = meldungen({ customerEmail: '' }).customerEmail
    const falsch = meldungen({ customerEmail: 'anna@' }).customerEmail
    expect(falsch).toBe('Diese E-Mail-Adresse stimmt nicht ganz – bitte prüf sie, zum Beispiel du@beispiel.at.')
    expect(falsch).not.toBe(leer)
  })

  it('die alten Kurztexte sind weg', () => {
    const quelle = readFileSync(join(process.cwd(), 'src/schemas/checkout.ts'), 'utf8')
    for (const alt of ['mindestens 2 Zeichen', 'Ungültige E-Mail-Adresse', 'Telefonnummer ist zu kurz']) expect(quelle).not.toContain(alt)
  })
})

describe('Zeitlimit und zweiter Versuch (Idempotenz)', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const body = (schluessel: string) => ({ farmId: 'f', idempotencyKey: schluessel, items: [] })

  it('ein abgerissener Request wird zu „netz", nie zu einem Wurf', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')))
    const r = await bestellungSenden(body('schluessel-12345'))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.art).toBe('netz')
  })

  it('ohne Antwort bricht das Signal nach dem Zeitlimit ab: „zeit"', async () => {
    vi.stubGlobal('fetch', (_u: string, init: RequestInit) => new Promise((_ok, nein) => init.signal?.addEventListener('abort', () => nein(init.signal?.reason))))
    const r = await bestellungSenden(body('schluessel-12345'), { zeitlimitMs: 20 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.art).toBe('zeit')
  })

  it('der zweite Versuch schickt denselben Schlüssel — ein anderer Aufruf mit anderem Schlüssel bleibt davon getrennt', async () => {
    const geschickt: string[] = []
    vi.stubGlobal('fetch', (_u: string, init: RequestInit) => {
      geschickt.push(JSON.parse(String(init.body)).idempotencyKey)
      return geschickt.length === 1 ? Promise.reject(new TypeError('Failed to fetch')) : Promise.resolve(new Response('{}', { status: 200 }))
    })
    const schluessel = 'schluessel-12345'
    const erster = await bestellungSenden(body(schluessel))
    const zweiter = await bestellungSenden(body(schluessel))
    expect(erster.ok).toBe(false)
    expect(zweiter.ok).toBe(true)
    expect(geschickt).toEqual([schluessel, schluessel])
    // Gegenprobe: eine neue Bestellung mit neuem Schlüssel schickt ihren eigenen.
    await bestellungSenden(body('anderer-schluessel'))
    expect(geschickt[2]).toBe('anderer-schluessel')
  })

  it('die Kasse erzeugt den Schlüssel beim Öffnen und erneuert ihn nur nach nicht möglicher Zahlung', () => {
    const quelle = readFileSync(join(process.cwd(), 'src/components/checkout/checkout-form.tsx'), 'utf8')
    // Zwei Stellen: beim Öffnen (Effekt) und nach „Zahlung nicht möglich" — nie beim erneuten Versuch.
    expect(quelle.match(/idempotencyKeyRef\.current = crypto\.randomUUID\(\)/g)).toHaveLength(2)
    expect(quelle).not.toMatch(/setOhneAntwort\(true\)[\s\S]{0,80}randomUUID/)
    expect(quelle).toContain('idempotencyKey: idempotencyKeyRef.current || undefined')
    expect(quelle).toContain('bestellungSenden(')
    expect(quelle).not.toContain("fetch('/api/checkout'")
  })

  it('der Hinweis nach dem Zeitlimit: Satz und „Nochmal versuchen" mit 44 px, im Versand gesperrt', () => {
    const html = renderToStaticMarkup(createElement(KasseNetzFehler, { onNochmal: () => {}, wirdGesendet: false }))
    expect(html).toContain(KASSE_ZEITLIMIT_SATZ)
    expect(KASSE_ZEITLIMIT_SATZ).toBe('Dauert länger als sonst – nichts wird doppelt bestellt.')
    expect(html).toContain(KASSE_NOCHMAL)
    expect(html).toContain('role="alert"')
    expect(html).toContain('min-h-11')
    expect(html).not.toContain('disabled=""')
    expect(renderToStaticMarkup(createElement(KasseNetzFehler, { onNochmal: () => {}, wirdGesendet: true }))).toContain('disabled=""')
  })
})

describe('Enter geht weiter, bestellt nie', () => {
  const feld = (typ: string, tag = 'INPUT') => ({ tagName: tag, type: typ, focus: vi.fn() })
  function ereignis(ziel: ReturnType<typeof feld>, alle: ReturnType<typeof feld>[], key = 'Enter') {
    return { key, target: ziel, currentTarget: { querySelectorAll: () => alle }, preventDefault: vi.fn() }
  }

  it('Enter im Textfeld: kein Absenden, Fokus ins nächste Feld', () => {
    const a = feld('email')
    const b = feld('text')
    const e = ereignis(a, [a, b])
    weiterBeiEnter(e)
    expect(e.preventDefault).toHaveBeenCalled()
    expect(b.focus).toHaveBeenCalled()
  })

  it('Gegenprobe: andere Tasten, Notizfeld und Haken bleiben unberührt', () => {
    const a = feld('text')
    const b = feld('text')
    for (const e of [ereignis(a, [a, b], 'a'), ereignis(feld('textarea', 'TEXTAREA'), [a, b]), ereignis(feld('checkbox'), [a, b])]) {
      weiterBeiEnter(e)
      expect(e.preventDefault).not.toHaveBeenCalled()
    }
    expect(b.focus).not.toHaveBeenCalled()
  })
})

const HOF = publicFarm({ name: 'Hof Test', slug: 'hof-test', ownerName: 'Max Mustermann', description: '', address: 'Feldweg 1', postalCode: '4910', city: 'Ried', pickupSlots: [{ dayOfWeek: 6, startTime: '14:00', endTime: '16:00' }] })

describe('Pausierter Hof in der Kasse', () => {
  it('Pausen-Karte mit dem Text des Hofs und zwei Wegen', () => {
    const html = renderToStaticMarkup(createElement(KassePausiert, { farm: { ...HOF, pauseMessage: 'Wir sind bis Montag auf der Alm.' } }))
    expect(html).toContain('Hof Test pausiert gerade.')
    expect(html).toContain('Wir sind bis Montag auf der Alm.')
    expect(html).toContain('Zurück zum Hof')
    expect(html).toContain('href="/hof-test"')
    expect(html).toContain('Höfe entdecken')
    expect(html).toContain('href="/hoefe"')
    expect(html).not.toContain('Diesen Hof gibt es')
  })

  it('die Seite zeigt sie bei Pause und lässt einen unbekannten Hof beim 404', () => {
    const quelle = readFileSync(join(process.cwd(), 'src/app/(public)/[farmSlug]/checkout/page.tsx'), 'utf8')
    expect(quelle).toContain("if (!farm) notFound()")
    expect(quelle).toMatch(/if \(sperre === 'pause'\) return <KassePausiert/)
    expect(quelle).not.toMatch(/sperre === 'pause'\) notFound\(\)/)
  })
})
