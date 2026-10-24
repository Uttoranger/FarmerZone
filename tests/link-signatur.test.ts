/**
 * Eigenes Geheimnis für Links mit Schlüsselkennung (Register S17, Ergänzung
 * 24.10.2026, Nr. 166) — src/lib/link-signatur.ts und die drei Dateien, die
 * damit signieren (bestell-link.ts, reorder-token.ts, unsubscribe.ts).
 *
 * Die ALTEN Werte unten sind fest erzeugt (HMAC mit dem Test-Geheimnis aus
 * vitest.config.ts, so wie die Dateien bis Nr. 166 signiert haben). Sie stehen
 * für Links in Mails, die schon im Postfach liegen: Sie müssen weiter gelten,
 * mit und ohne `LINK_SECRET`. Die erfundenen Geheimnisse bestehen nur aus
 * Buchstaben.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { pruefeLink, signiereLink } from '@/lib/link-signatur'
import { bestellLinkGilt, bestellSignatur, bestellungPfad } from '@/lib/bestell-link'
import { generateReorderToken, verifyReorderToken } from '@/lib/reorder-token'
import { generateUnsubscribeToken, verifyUnsubscribeToken } from '@/lib/unsubscribe'
import { bestaetigungsParameterSchema } from '@/schemas/bestaetigung'
import { neuigkeitenAnmeldenSchema } from '@/schemas/abo'

const LINK_GEHEIMNIS = 'abcdefghijklmnopqrstuvwxyzabcdefgh'
const ANDERES_LINK_GEHEIMNIS = 'zyxwvutsrqponmlkjihgfedcbazyxwvuts'

// Fest erzeugt mit dem bisherigen Verfahren (Geheimnis BETTER_AUTH_SECRET, ohne Kennung).
const ALTE_BESTELL_SIGNATUR = '62803d2a3c6d89bce911334a28fb3726f9688899b9fbaba8063998274dd1a62b'
const ALTER_NACHBESTELL_TOKEN =
  'YmVzdGVsbHVuZy1hbHQ6aG9mLWFsdDoxNzkyODAwMDAwMDAw.d55007dd65f3a43f376b41fd6997c1a118a3a5916b13faea88d3600780a383f7'
const ALTER_NACHBESTELL_ZEITPUNKT = 1792800000000
const ALTER_ABMELDE_TOKEN =
  'a3VuZGluQGV4YW1wbGUuY29tOmhvZi1hbHQ.2731687bd471ed4830476eceba5f842607f80ef06fb5d22e90db1ac4dbb8e88d'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

function mitLinkGeheimnis(wert = LINK_GEHEIMNIS) {
  vi.stubEnv('LINK_SECRET', wert)
}

function alteLinksGelten() {
  expect(bestellLinkGilt('bestellung-alt', ALTE_BESTELL_SIGNATUR)).toBe(true)
  vi.useFakeTimers()
  vi.setSystemTime(new Date(ALTER_NACHBESTELL_ZEITPUNKT + 24 * 60 * 60 * 1000))
  expect(verifyReorderToken(ALTER_NACHBESTELL_TOKEN)).toEqual({ orderId: 'bestellung-alt', farmId: 'hof-alt' })
  vi.useRealTimers()
  expect(verifyUnsubscribeToken(ALTER_ABMELDE_TOKEN)).toEqual({ email: 'kundin@example.com', farmId: 'hof-alt' })
}

describe('Links aus heute verschickten Mails gelten weiter', () => {
  it('ohne LINK_SECRET', () => {
    alteLinksGelten()
  })

  it('mit LINK_SECRET', () => {
    mitLinkGeheimnis()
    alteLinksGelten()
  })

  it('Gegenprobe: eine veränderte alte Signatur gilt nicht', () => {
    mitLinkGeheimnis()
    const ende = ALTE_BESTELL_SIGNATUR.at(-1)
    const gedreht = ALTE_BESTELL_SIGNATUR.slice(0, -1) + (ende === 'a' ? 'b' : 'a')
    expect(bestellLinkGilt('bestellung-alt', gedreht)).toBe(false)
    expect(bestellLinkGilt('bestellung-fremd', ALTE_BESTELL_SIGNATUR)).toBe(false)
  })
})

describe('Ohne LINK_SECRET bleibt alles wie heute', () => {
  it('neue Signaturen tragen keine Kennung und gleichen den alten', () => {
    expect(bestellSignatur('bestellung-alt')).toBe(ALTE_BESTELL_SIGNATUR)
    expect(signiereLink('bestellung-ansehen', 'bestellung-alt')).toBe(ALTE_BESTELL_SIGNATUR)
    expect(generateUnsubscribeToken('kundin@example.com', 'hof-alt')).toBe(ALTER_ABMELDE_TOKEN)
  })
})

describe('Mit LINK_SECRET tragen neue Links die Kennung 2', () => {
  it('Signatur, Bestellpfad und beide Tokens beginnen mit der Kennung und gelten', () => {
    mitLinkGeheimnis()
    const signatur = bestellSignatur('bestellung-neu')
    expect(signatur).toMatch(/^2\.[0-9a-f]{64}$/)
    expect(bestellLinkGilt('bestellung-neu', signatur)).toBe(true)
    expect(bestellungPfad('hof', 'bestellung-neu')).toBe(`/hof/bestellung/bestellung-neu?s=${signatur}`)

    const nachbestellen = generateReorderToken('bestellung-neu', 'hof-neu')
    expect(nachbestellen).toMatch(/^[A-Za-z0-9_-]+\.2\.[0-9a-f]{64}$/)
    expect(verifyReorderToken(nachbestellen)).toEqual({ orderId: 'bestellung-neu', farmId: 'hof-neu' })

    const abmelden = generateUnsubscribeToken('kundin@example.com', 'hof-neu')
    expect(abmelden).toMatch(/^[A-Za-z0-9_-]+\.2\.[0-9a-f]{64}$/)
    expect(verifyUnsubscribeToken(abmelden)).toEqual({ email: 'kundin@example.com', farmId: 'hof-neu' })
  })

  it('Kennung 2 gilt nicht, wenn LINK_SECRET fehlt (Gegenprobe)', () => {
    mitLinkGeheimnis()
    const signatur = bestellSignatur('bestellung-neu')
    const nachbestellen = generateReorderToken('bestellung-neu', 'hof-neu')
    const abmelden = generateUnsubscribeToken('kundin@example.com', 'hof-neu')
    vi.unstubAllEnvs()
    expect(bestellLinkGilt('bestellung-neu', signatur)).toBe(false)
    expect(verifyReorderToken(nachbestellen)).toBeNull()
    expect(verifyUnsubscribeToken(abmelden)).toBeNull()
  })

  it('Kennung 2 gilt nicht mit einem anderen LINK_SECRET', () => {
    mitLinkGeheimnis()
    const signatur = bestellSignatur('bestellung-neu')
    mitLinkGeheimnis(ANDERES_LINK_GEHEIMNIS)
    expect(bestellLinkGilt('bestellung-neu', signatur)).toBe(false)
  })

  it('der Hex-Teil ohne Kennung gilt nicht als alte Signatur', () => {
    mitLinkGeheimnis()
    const hex = bestellSignatur('bestellung-neu').slice(2)
    expect(bestellLinkGilt('bestellung-neu', hex)).toBe(false)
  })

  it('eine unbekannte Kennung gilt nicht', () => {
    mitLinkGeheimnis()
    const hex = bestellSignatur('bestellung-neu').slice(2)
    expect(bestellLinkGilt('bestellung-neu', `3.${hex}`)).toBe(false)
    expect(bestellLinkGilt('bestellung-neu', `.${hex}`)).toBe(false)
    expect(bestellLinkGilt('bestellung-neu', `2.2.${hex}`)).toBe(false)
    expect(bestellLinkGilt('bestellung-neu', '')).toBe(false)
  })
})

describe('Der Zweck trennt die Links', () => {
  it('mit Kennung: eine Signatur gilt nur für ihren Zweck', () => {
    mitLinkGeheimnis()
    const signatur = signiereLink('nachbestellen', 'gleicher-inhalt')
    expect(pruefeLink('nachbestellen', 'gleicher-inhalt', signatur)).toBe(true)
    expect(pruefeLink('abmelden', 'gleicher-inhalt', signatur)).toBe(false)
    expect(pruefeLink('bestellung-ansehen', 'gleicher-inhalt', signatur)).toBe(false)
  })

  it('ohne Kennung: die Bestell-Signatur gilt nicht als Abmelde-Signatur', () => {
    const signatur = signiereLink('bestellung-ansehen', 'gleicher-inhalt')
    expect(pruefeLink('bestellung-ansehen', 'gleicher-inhalt', signatur)).toBe(true)
    expect(pruefeLink('abmelden', 'gleicher-inhalt', signatur)).toBe(false)
  })
})

describe('Die Formprüfung der Adresse lässt die Kennung durch', () => {
  it('Bestätigungsseite und Neuigkeiten nehmen alte und neue Signaturen an', () => {
    mitLinkGeheimnis()
    const neu = bestellSignatur('bestellung-neu')
    for (const sig of [ALTE_BESTELL_SIGNATUR, neu]) {
      expect(bestaetigungsParameterSchema.parse({ sig }).sig).toBe(sig)
      expect(neuigkeitenAnmeldenSchema.safeParse({ orderId: 'bestellung-neu', sig }).success).toBe(true)
    }
  })

  it('Gegenprobe: fremde Formen bleiben draußen', () => {
    const hex = ALTE_BESTELL_SIGNATUR
    for (const sig of [`x.${hex}`, `22.${hex}`, `2.${hex.slice(1)}`, `2.${hex.toUpperCase()}`]) {
      expect(bestaetigungsParameterSchema.parse({ sig }).sig).toBeUndefined()
      expect(neuigkeitenAnmeldenSchema.safeParse({ orderId: 'bestellung-neu', sig }).success).toBe(false)
    }
  })
})
