/**
 * Zahlarten der Kasse (Fix Kasse-Zahlarten, 30.10.2026).
 *
 * Ursache: Der PaymentIntent der Kasse nannte keine Zahlarten. Dann gilt die
 * Konfiguration „Default“ des Plattformkontos im Stripe-Dashboard — und dort
 * muss SEPA-Lastschrift für die Monatsabrechnung der Höfe (Nr. 198) an sein.
 * Die Kundschaft konnte so SEPA wählen; die Bestellung verfiel, bevor die
 * Zahlung bestätigt war, und das Geld ging automatisch zurück.
 *
 * Beweist: Die Kasse kennt genau Karte (Apple Pay und Google Pay laufen als
 * Wallet darüber) und EPS, aus einer Quelle; und kein PaymentIntent unter
 * src/ wird ohne `payment_method_types` angelegt (Quelltext-Wache mit
 * Gegenprobe). SetupIntents und Rechnungen der Monatsabrechnung
 * (`sepa_debit`) sind keine PaymentIntents und bleiben erlaubt.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { KASSE_ZAHLARTEN } from '@/lib/kasse'

const WURZEL = process.cwd()

function dateien(ordner: string): string[] {
  return readdirSync(ordner, { withFileTypes: true }).flatMap((e) => {
    const pfad = join(ordner, e.name)
    if (e.isDirectory()) return dateien(pfad)
    return /\.(ts|tsx)$/.test(e.name) ? [pfad] : []
  })
}

/** Kommentare raus — ein Kommentar mit dem Wort zählt weder als Aufruf noch als Parameter. */
function ohneKommentare(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

/** Das erste Argument eines Aufrufs ab `start` (direkt nach der öffnenden Klammer), bis zum Komma oder zur Klammer auf oberster Ebene. */
function erstesArgument(code: string, start: number): string {
  let tiefe = 0
  for (let i = start; i < code.length; i++) {
    const z = code[i]
    if (z === '(' || z === '{' || z === '[') tiefe++
    else if (z === ')' || z === '}' || z === ']') {
      if (tiefe === 0) return code.slice(start, i).trim()
      tiefe--
    } else if (z === ',' && tiefe === 0) return code.slice(start, i).trim()
  }
  return code.slice(start).trim()
}

/**
 * Legt diese Datei einen PaymentIntent an, ohne Zahlarten zu nennen? Je
 * AUFRUF: ein Objekt im Aufruf muss `payment_method_types` tragen; ein Name
 * muss aus `intentParameter(…)` stammen (dort stehen die Zahlarten, die
 * Prüfung unten sieht sie).
 */
function intentOhneZahlarten(text: string): boolean {
  const code = ohneKommentare(text)
  const aufruf = /paymentIntents\s*\.\s*create\s*\(/g
  for (let treffer = aufruf.exec(code); treffer; treffer = aufruf.exec(code)) {
    const argument = erstesArgument(code, treffer.index + treffer[0].length)
    if (argument.startsWith('{')) {
      if (!/payment_method_types\s*:/.test(argument)) return true
    } else if (!new RegExp(`\\b(?:const|let)\\s+${argument}\\s*=\\s*intentParameter\\(`).test(code)) {
      return true
    }
  }
  return false
}

describe('Zahlarten der Kasse', () => {
  it('genau Karte und EPS — kein SEPA, keine Zahlart aus dem Dashboard', () => {
    expect([...KASSE_ZAHLARTEN]).toEqual(['card', 'eps'])
    expect(KASSE_ZAHLARTEN).not.toContain('sepa_debit')
  })
})

describe('Wache: kein PaymentIntent ohne payment_method_types', () => {
  it('jede Datei unter src/, die einen PaymentIntent anlegt, nennt die Zahlarten', () => {
    const funde = dateien(join(WURZEL, 'src'))
      .filter((p) => intentOhneZahlarten(readFileSync(p, 'utf8')))
      .map((p) => relative(WURZEL, p).split(sep).join('/'))
    expect(funde).toEqual([])
  }, 30_000)

  it('intentParameter nennt die festen Zahlarten der Kasse', () => {
    const route = ohneKommentare(readFileSync(join(WURZEL, 'src/app/api/checkout/route.ts'), 'utf8'))
    const rumpf = route.slice(route.indexOf('function intentParameter('))
    expect(rumpf.slice(0, rumpf.indexOf('\n}\n'))).toMatch(/payment_method_types:\s*\[\.\.\.KASSE_ZAHLARTEN\]/)
  })

  it('es gibt mindestens eine Stelle, die einen PaymentIntent anlegt — sonst bewiese die Wache nichts', () => {
    const anleger = dateien(join(WURZEL, 'src')).filter((p) => /paymentIntents\s*\.\s*create\s*\(/.test(ohneKommentare(readFileSync(p, 'utf8'))))
    expect(anleger.length).toBeGreaterThan(0)
  }, 30_000)

  it('Gegenprobe: ein neuer Aufruf ohne Zahlarten schlägt an, einer mit nicht; Kommentare zählen nicht', () => {
    expect(intentOhneZahlarten('await stripe.paymentIntents.create({ amount: 100, currency: "eur" })')).toBe(true)
    expect(intentOhneZahlarten('await stripe.paymentIntents.create({ amount: 100, payment_method_types: ["card"] })')).toBe(false)
    expect(intentOhneZahlarten('await stripe.paymentIntents.create(p) // payment_method_types: fehlt hier')).toBe(true)
    // Je Aufruf, nicht je Datei: zwei Aufrufe, einer ohne — schlägt an, obwohl die Datei das Wort kennt.
    expect(intentOhneZahlarten('await stripe.paymentIntents.create({ payment_method_types: ["card"] })\nawait stripe.paymentIntents.create({ amount: 1 })')).toBe(true)
    // Ein Name muss aus intentParameter stammen.
    expect(intentOhneZahlarten('const parameter = intentParameter(b, k)\nawait stripe.paymentIntents.create(parameter, optionen)')).toBe(false)
    expect(intentOhneZahlarten('const parameter = andereParameter(b)\nawait stripe.paymentIntents.create(parameter, optionen)')).toBe(true)
    expect(intentOhneZahlarten('// stripe.paymentIntents.create(p)\nconst x = 1')).toBe(false)
    // SetupIntent und Rechnung (Monatsabrechnung, sepa_debit) sind keine PaymentIntents.
    expect(intentOhneZahlarten('await stripe.setupIntents.create({ payment_method_types: ["sepa_debit"] })')).toBe(false)
  })
})

describe('Skript: EPS-Fähigkeit nachfordern (bestehende Hofkonten)', () => {
  it('fordert nur nach, wenn EPS nie angefordert wurde — ein zweiter Lauf ändert nichts', async () => {
    const { brauchtEpsNachforderung } = await import('../scripts/eps-faehigkeit-nachfordern')
    expect(brauchtEpsNachforderung(undefined)).toBe(true)
    expect(brauchtEpsNachforderung('unrequested')).toBe(true)
    // Gegenprobe: schon angefordert, gleich mit welchem Stand.
    for (const stand of ['active', 'inactive', 'pending'] as const) expect(brauchtEpsNachforderung(stand)).toBe(false)
  })

  it('bereit für die Kasse im Hofpreis-Modell nur mit aktiver Fähigkeit — pending und inactive gelten als Problem', async () => {
    const { epsKasseBereit } = await import('../scripts/eps-faehigkeit-nachfordern')
    expect(epsKasseBereit('active')).toBe(true)
    // Gegenprobe: angefordert, aber nicht aktiv — dort scheiterte die ganze Online-Zahlung.
    for (const stand of [undefined, 'unrequested', 'pending', 'inactive'] as const) expect(epsKasseBereit(stand)).toBe(false)
  })
})
