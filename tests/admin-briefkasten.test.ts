/**
 * Der Briefkasten im Admin (Nachtlauf Nr. 22f) — die reinen Regeln aus
 * src/lib/admin-briefkasten.ts und die Fremdtext-Regel der Admin-Ansichten.
 *
 * Die Aussagen, die zählen:
 *  - Die Filter zählen und markieren genau die Status, die die Liste zeigt;
 *    ein alter Link mit einem einzelnen Status filtert weiter, nur ohne Chip.
 *  - Die Zeile „woher" zeigt die Seite ohne Abfrage und ohne E-Mail, eine
 *    Kundin ohne Adresse.
 *  - Meldungstext wird nie als Markup gedeutet: kein dangerouslySetInnerHTML
 *    unter src/app/admin und src/components/admin.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
  ADMIN_STATUS_TON,
  STATUS_GRUPPEN,
  adminStatusText,
  aktiveStatusGruppe,
  artUmschalten,
  bildschirmText,
  briefkastenAdresse,
  herkunftZeile,
  zaehleStatusGruppen,
} from '@/lib/admin-briefkasten'
import { MELDUNG_STATUS, STATUS_OFFEN, STATUS_ZU_ENTSCHEIDEN } from '@/lib/meldung'
import { filterAusParametern } from '@/server/queries/meldung'

describe('Marken', () => {
  it('Orange heißt „wartet auf dich" — Neu und der Vorschlag der KI', () => {
    expect(MELDUNG_STATUS.filter((s) => ADMIN_STATUS_TON[s] === 'offen')).toEqual(['NEU', 'VERMUTLICH_WUNSCH'])
  })
  it('der Vorschlag der KI ist als solcher erkennbar, ein geplanter nennt den Sprint', () => {
    expect(adminStatusText('VERMUTLICH_WUNSCH', null)).toBe('Vermutlich Wunsch · KI')
    expect(adminStatusText('GEPLANT', ' Sprint 14 ')).toBe('Geplant · Sprint 14')
    expect(adminStatusText('GEPLANT', null)).toBe('Geplant')
    expect(adminStatusText('ERLEDIGT', 'egal')).toBe('Erledigt')
  })
})

describe('Status-Filter', () => {
  it('ohne Parameter gilt „Zu entscheiden" — dieselbe Voreinstellung wie die Liste', () => {
    const filter = filterAusParametern({}, STATUS_ZU_ENTSCHEIDEN)
    expect(aktiveStatusGruppe(undefined, filter.status)).toBe('zu-entscheiden')
    expect(STATUS_GRUPPEN[0].status).toEqual(STATUS_ZU_ENTSCHEIDEN)
  })
  it('jede Gruppe erkennt ihren eigenen Wert wieder (Reihenfolge egal)', () => {
    for (const g of STATUS_GRUPPEN.slice(1)) {
      const filter = filterAusParametern({ status: g.wert }, STATUS_ZU_ENTSCHEIDEN)
      expect(aktiveStatusGruppe(g.wert, filter.status)).toBe(g.id)
    }
    const umgedreht = [...STATUS_OFFEN].reverse().join(',')
    expect(aktiveStatusGruppe(umgedreht, filterAusParametern({ status: umgedreht }).status)).toBe('offen')
  })
  it('ein alter Link mit einem einzelnen Status: kein Chip leuchtet', () => {
    expect(aktiveStatusGruppe('GEPLANT', ['GEPLANT'])).toBeNull()
  })
  it('zählt je Gruppe aus den Zahlen je Status', () => {
    const zahlen = zaehleStatusGruppen({ NEU: 2, VERMUTLICH_WUNSCH: 1, GEPRUEFT: 4, GEPLANT: 3, ERLEDIGT: 10, DUPLIKAT: 1 })
    expect(zahlen).toEqual({ 'zu-entscheiden': 3, offen: 7, abgeschlossen: 11, alle: 21 })
  })
  it('die Adresse behält den übrigen Filter; der Art-Chip schaltet um', () => {
    expect(briefkastenAdresse({ status: 'NEU', art: 'FEHLER' }, { art: undefined })).toBe('/admin/meldungen?status=NEU')
    expect(briefkastenAdresse({ art: 'WUNSCH' }, { status: 'ERLEDIGT' })).toBe('/admin/meldungen?status=ERLEDIGT&art=WUNSCH')
    expect(briefkastenAdresse({}, {})).toBe('/admin/meldungen')
    expect(artUmschalten('FEHLER', 'FEHLER')).toBeUndefined()
    expect(artUmschalten(null, 'FRAGE')).toBe('FRAGE')
  })
})

describe('Zeile „woher"', () => {
  const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
  it('Hof, Pfad ohne Abfrage, Gerät in Worten', () => {
    expect(herkunftZeile({ hofName: 'Hof Test', customerEmail: null, seiteUrl: 'https://farmerzone.example/products?suche=karotte', userAgent: ua })).toBe(
      'Hof Test · /products · Safari, iPhone'
    )
  })
  it('eine Kundin steht ohne Adresse da, eine E-Mail im Pfad wird ersetzt', () => {
    const zeile = herkunftZeile({ hofName: null, customerEmail: 'max@example.com', seiteUrl: 'https://x.example/kunde/max@example.com', userAgent: '' })
    expect(zeile).toBe('Kundin · /kunde/(E-Mail)')
    expect(zeile).not.toContain('example.com')
  })
  it('ohne alles: Anonym', () => {
    expect(herkunftZeile({ hofName: null, customerEmail: null, seiteUrl: ' ', userAgent: '' })).toBe('Anonym')
  })
  it('Bildschirm mit Malzeichen, leer als Strich', () => {
    expect(bildschirmText('390x844')).toBe('390 × 844')
    expect(bildschirmText('')).toBe('–')
  })
})

describe('Fremdtext bleibt Text', () => {
  function* dateien(ordner: string): Generator<string> {
    for (const name of readdirSync(ordner)) {
      const pfad = join(ordner, name)
      if (statSync(pfad).isDirectory()) yield* dateien(pfad)
      else if (/\.(ts|tsx)$/.test(name)) yield pfad
    }
  }
  const MARKUP = /dangerouslySetInnerHTML/

  it('kein dangerouslySetInnerHTML unter src/app/admin und src/components/admin', () => {
    const treffer = ['src/app/admin', 'src/components/admin']
      .flatMap((o) => [...dateien(join(process.cwd(), o))])
      .filter((d) => MARKUP.test(readFileSync(d, 'utf8')))
      .map((d) => relative(process.cwd(), d))
    expect(treffer).toEqual([])
  })

  it('Gegenprobe: die Suche schlägt an', () => {
    expect(MARKUP.test('<p dangerouslySetInnerHTML={{ __html: m.text }} />')).toBe(true)
  })
})
