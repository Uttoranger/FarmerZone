/**
 * Tests für die Übergabestelle des Teilen-Ziels: die reine Ablage-Logik
 * (src/lib/teilen-ablage.ts) und der ECHTE Quelltext des Service Workers
 * (public/sw.js) laufen hier gegen dieselbe Cache-Attrappe.
 *
 * Der Service Worker wird nicht nachgebaut, sondern geladen und sein
 * fetch-Handler mit echten Request/FormData/File-Objekten gefahren (Node
 * bringt sie mit). Nur die Umgebung ist eine Attrappe: ein self, das
 * Handler einsammelt, und ein CacheStorage über Maps. So ist belegt, dass
 * beide Seiten des Vertrags — SW schreibt, Seite liest — zusammenpassen,
 * ohne dass ein Browser läuft. Was hier NICHT prüfbar ist (Installation,
 * Androids Teilen-Dialog, der 303 im echten Navigationsfluss), steht in
 * der Prüfanleitung der PR-Beschreibung.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  TEILEN_CACHE,
  teilenSchluessel,
  leseGeteilteFotos,
  leereGeteilteFotos,
} from '@/lib/teilen-ablage'

// ── Cache-Attrappe ───────────────────────────────────────────────────────────
// Schlüssel sind hier rohe Strings. Die echte Cache-API normalisiert Pfade zu
// vollen URLs — da SW und Ablage-Logik exakt DIESELBEN Literale verwenden,
// trifft die Attrappe genau den Punkt, um den es geht: beide meinen denselben
// Eintrag.

function baueCacheAttrappe() {
  const caches = new Map<string, Map<string, Response>>()
  const attrappe = {
    async has(name: string) {
      return caches.has(name)
    },
    async open(name: string) {
      if (!caches.has(name)) caches.set(name, new Map())
      const ablage = caches.get(name)!
      return {
        async match(schluessel: string) {
          return ablage.get(schluessel)
        },
        async put(schluessel: string, antwort: Response) {
          ablage.set(schluessel, antwort)
        },
      }
    },
    async delete(name: string) {
      return caches.delete(name)
    },
  }
  return attrappe as unknown as CacheStorage
}

// ── Der echte Service Worker ────────────────────────────────────────────────

type FetchHandler = (event: {
  request: Request
  respondWith: (antwort: Promise<Response> | Response) => void
}) => void

function ladeServiceWorker(speicher: CacheStorage): FetchHandler {
  const quelle = readFileSync(path.join(process.cwd(), 'public', 'sw.js'), 'utf8')
  const handler: Record<string, unknown> = {}
  const self = {
    addEventListener(name: string, fn: unknown) {
      handler[name] = fn
    },
    skipWaiting() {},
    clients: { claim: async () => {} },
  }
  new Function('self', 'caches', quelle)(self, speicher)
  expect(handler.fetch, 'sw.js muss einen fetch-Handler anmelden').toBeTypeOf('function')
  return handler.fetch as FetchHandler
}

/** Fährt den fetch-Handler mit einem Request und liefert, was er antwortet —
 *  oder null, wenn er die Anfrage (richtigerweise) nicht anfasst. */
async function fahreFetch(handler: FetchHandler, request: Request): Promise<Response | null> {
  let antwort: Promise<Response> | Response | null = null
  handler({
    request,
    respondWith(a) {
      antwort = a
    },
  })
  return antwort === null ? null : await antwort
}

function teilenPost(dateien: File[]): Request {
  const formular = new FormData()
  for (const datei of dateien) formular.append('foto', datei)
  return new Request('https://farmerzone.at/teilen', { method: 'POST', body: formular })
}

// ── Tests ───────────────────────────────────────────────────────────────────

let speicher: CacheStorage

beforeEach(() => {
  speicher = baueCacheAttrappe()
})

describe('Ablage-Logik (rein)', () => {
  it('liefert eine leere Liste, solange nie etwas abgelegt wurde', async () => {
    expect(await leseGeteilteFotos(speicher)).toEqual([])
  })

  it('führt das Schlüsselschema pfadförmig und fortlaufend', () => {
    expect(teilenSchluessel(0)).toBe('/geteilte-fotos/0')
    expect(teilenSchluessel(7)).toBe('/geteilte-fotos/7')
  })

  it('leert die Ablage vollständig', async () => {
    const ablage = await speicher.open(TEILEN_CACHE)
    await ablage.put(teilenSchluessel(0), new Response('x'))

    await leereGeteilteFotos(speicher)
    expect(await leseGeteilteFotos(speicher)).toEqual([])
  })
})

describe('Der echte sw.js gegen die echte Lese-Seite', () => {
  it('legt geteilte Fotos so ab, dass die Seite sie 1:1 zurückliest — samt Umlaut im Namen', async () => {
    const handler = ladeServiceWorker(speicher)

    const antwort = await fahreFetch(
      handler,
      teilenPost([
        new File(['erstes-foto'], 'Kürbisernte.jpg', { type: 'image/jpeg' }),
        new File(['zweites-foto'], 'stall.png', { type: 'image/png' }),
      ])
    )

    // Der 303 führt auf die /teilen-Seite
    expect(antwort).not.toBeNull()
    expect(antwort!.status).toBe(303)
    expect(antwort!.headers.get('location')).toBe('/teilen')

    // Und die Seite liest exakt das, was geteilt wurde — in Reihenfolge
    const fotos = await leseGeteilteFotos(speicher)
    expect(fotos.map((f) => f.name)).toEqual(['Kürbisernte.jpg', 'stall.png'])
    expect(fotos.map((f) => f.type)).toEqual(['image/jpeg', 'image/png'])
    expect(await fotos[0].text()).toBe('erstes-foto')
    expect(await fotos[1].text()).toBe('zweites-foto')
  })

  it('räumt Reste einer früheren Teilen-Aktion weg, bevor es neu ablegt', async () => {
    // Sonst stünden hinter EINEM neuen Foto noch alte unter höheren Schlüsseln
    const alt = await speicher.open(TEILEN_CACHE)
    await alt.put(teilenSchluessel(0), new Response('alt-0'))
    await alt.put(teilenSchluessel(1), new Response('alt-1'))
    await alt.put(teilenSchluessel(2), new Response('alt-2'))

    const handler = ladeServiceWorker(speicher)
    await fahreFetch(handler, teilenPost([new File(['neu'], 'neu.jpg', { type: 'image/jpeg' })]))

    const fotos = await leseGeteilteFotos(speicher)
    expect(fotos).toHaveLength(1)
    expect(await fotos[0].text()).toBe('neu')
  })

  it('fasst alles andere NICHT an — kein respondWith außerhalb von POST /teilen', async () => {
    // Die dokumentierte Grenze des Service Workers: keine Navigation, kein
    // Asset, keine fremde Route. Ein respondWith hier wäre der erste Schritt
    // zurück in die Stale-Client-Falle.
    const handler = ladeServiceWorker(speicher)

    expect(await fahreFetch(handler, new Request('https://farmerzone.at/teilen'))).toBeNull()
    expect(
      await fahreFetch(handler, new Request('https://farmerzone.at/dashboard'))
    ).toBeNull()
    expect(
      await fahreFetch(
        handler,
        new Request('https://farmerzone.at/api/upload/verarbeiten', { method: 'POST', body: '{}' })
      )
    ).toBeNull()
  })

  it('cached nichts außer der Teilen-Ablage — der Quelltext kennt nur diesen einen Cache-Namen', () => {
    // Zweite Verteidigungslinie neben dem Verhaltens-Test darüber: Im
    // Quelltext existiert genau EIN caches.open, und es öffnet die Ablage.
    const quelle = readFileSync(path.join(process.cwd(), 'public', 'sw.js'), 'utf8')
    const oeffnungen = quelle.match(/caches\.open\([^)]*\)/g) ?? []
    expect(oeffnungen).toEqual(['caches.open(TEILEN_CACHE)'])
    expect(quelle).toContain(`const TEILEN_CACHE = '${TEILEN_CACHE}'`)
  })
})
