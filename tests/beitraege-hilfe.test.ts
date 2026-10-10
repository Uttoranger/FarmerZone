/**
 * Nr. 22e: Beiträge als Reiter in Mein Hof (E12), Hilfe und Meine Meldungen
 * in der HofShell (Mockups web-/mobil-h6-meldung-abgeben,
 * web-/mobil-h6-meine-meldungen).
 *
 * Beweist:
 *  - Der Reiter „Beiträge" kann alles, was /status konnte: Deaktivieren (nur
 *    aktiv), Löschen (immer, mit Rückfrage), Als Vorlage (nur vergangen),
 *    WhatsApp fortsetzen (nur, wenn noch Nachrichten offen sind).
 *  - /status leitet auf den Reiter um (alte Links funktionieren), „Neuer
 *    Beitrag" und „WhatsApp fortsetzen" liegen unter (hof) und führen nach
 *    dem Speichern zurück in den Reiter.
 *  - /fehler-melden und /meldungen liegen unter (hof); /problem-melden (für
 *    Kundinnen) bleibt beim Bestandsformular.
 *  - Meine Meldungen zeigt Art, Status und Antwort nach der
 *    Sichtbarkeitsregel; Fremdtext bleibt Text (React maskiert).
 *  - Kein Rückruf (Register O5), stattdessen „E-Mail schreiben".
 *  - Alle neuen Dateien zeichnen nur mit Tokens.
 */
import { describe, it, expect, vi } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@/server/actions/status-posts', () => ({
  expireStatusPost: vi.fn(),
  deleteStatusPost: vi.fn(),
}))
vi.mock('@/server/actions/meldung', () => ({ meldungAbsenden: vi.fn() }))
vi.mock('@/components/shared/image-upload', () => ({
  useImageUpload: () => ({ fileInput: null, openFilePicker: () => {}, isUploading: false, progress: null }),
  stufenText: () => '',
}))

import { BEITRAEGE_HREF, HAUPT, elternseite, hofAktiverPunkt } from '@/lib/bauern-navigation'
import { beitraegeUebersicht, type BeitragQuelle } from '@/lib/mein-hof-beitraege'
import { BeitraegeReiter } from '@/components/mein-hof/beitraege-reiter'
import { fuerHof, STATUS_TON, type MeldungVollstaendig } from '@/lib/meldung'
import {
  MEINE_MELDUNGEN_HREF,
  MELDUNG_ART_TON,
  MELDUNG_TEXT_LABEL,
  NEUE_MELDUNG_HREF,
  geraetKurz,
  meldungZeilen,
  meldungenStand,
  seiteKurz,
} from '@/lib/hof-hilfe'
import { MeineMeldungen } from '@/components/hof-hilfe/meine-meldungen'
import { MeldungAbgeben } from '@/components/hof-hilfe/meldung-abgeben'
import { HilfeSeitenspalte } from '@/components/hof-hilfe/hilfe-seitenspalte'

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')
const gibt = (pfad: string) => existsSync(join(process.cwd(), pfad))

const jetzt = '2026-10-06T10:00:00.000Z'
const basis: BeitragQuelle = {
  id: 'b1',
  title: 'Erdbeeren sind da',
  isActive: false,
  isDraft: false,
  publishedAt: '2026-09-20T10:00:00.000Z',
  sentViaEmail: false,
  sentViaWhatsApp: false,
  emailRecipientCount: 0,
  whatsappSentCount: 0,
  whatsappRecipientCount: 0,
}
const eintrag = (q: Partial<BeitragQuelle>) => beitraegeUebersicht([{ ...basis, ...q }], jetzt).gruppen[0].eintraege[0]

describe('Beiträge: Aktionen je Eintrag (E12, was /status konnte)', () => {
  it('aktiv: Deaktivieren, keine Vorlage', () => {
    const e = eintrag({ isActive: true, publishedAt: jetzt })
    expect(e.aktionen.deaktivieren).toBe(true)
    expect(e.aktionen.vorlage).toBeNull()
  })

  it('vergangen: Als Vorlage nach /status/new?from=<id>, kein Deaktivieren', () => {
    const e = eintrag({})
    expect(e.aktionen.deaktivieren).toBe(false)
    expect(e.aktionen.vorlage).toBe('/status/new?from=b1')
  })

  it('Entwurf: weder Deaktivieren noch Vorlage noch WhatsApp', () => {
    const e = eintrag({ isDraft: true, publishedAt: null, sentViaWhatsApp: true, whatsappRecipientCount: 3 })
    expect(e.aktionen).toEqual({ deaktivieren: false, vorlage: null, whatsapp: null })
  })

  it('WhatsApp fortsetzen nur, solange noch Nachrichten offen sind — mit Stand im Text', () => {
    expect(eintrag({ sentViaWhatsApp: true, whatsappSentCount: 2, whatsappRecipientCount: 5 }).aktionen.whatsapp).toEqual({
      href: '/status/b1/send-whatsapp',
      text: 'WhatsApp fortsetzen · 2 von 5',
    })
    // Gegenprobe: alle verschickt bzw. nie per WhatsApp → nichts fortzusetzen.
    expect(eintrag({ sentViaWhatsApp: true, whatsappSentCount: 5, whatsappRecipientCount: 5 }).aktionen.whatsapp).toBeNull()
    expect(eintrag({ sentViaWhatsApp: false, whatsappSentCount: 0, whatsappRecipientCount: 5 }).aktionen.whatsapp).toBeNull()
  })
})

describe('Reiter „Beiträge" (gerendert)', () => {
  const html = renderToStaticMarkup(
    createElement(BeitraegeReiter, {
      uebersicht: beitraegeUebersicht(
        [
          { ...basis, id: 'a1', title: 'Spargel ab heute', isActive: true, publishedAt: jetzt },
          { ...basis, id: 'v1', title: 'Kürbisse', sentViaWhatsApp: true, whatsappSentCount: 1, whatsappRecipientCount: 4 },
        ],
        jetzt
      ),
    })
  )

  it('trägt die Aktionen selbst — kein Umweg mehr über /status', () => {
    expect(html).toContain('Spargel ab heute')
    expect(html).toContain('href="/status/new"')
    expect(html).toContain('Deaktivieren')
    expect(html).toContain('href="/status/new?from=v1"')
    expect(html).toContain('href="/status/v1/send-whatsapp"')
    expect(html).toContain('WhatsApp fortsetzen · 1 von 4')
    expect(html.match(/>Löschen</g)).toHaveLength(2)
    expect(html).not.toContain('href="/status"')
  })

  it('Knöpfe nennen den Beitrag für den Screenreader', () => {
    expect(html).toContain('aria-label="Spargel ab heute deaktivieren"')
    expect(html).toContain('aria-label="Kürbisse löschen"')
  })

  it('genau ein orange gefüllter Knopf (Neuer Beitrag)', () => {
    // bg-primary ohne Deckkraft-Zusatz (hover:bg-primary/90 zählt nicht mit).
    expect(html.match(/(?<![:\w-])bg-primary(?![/\w-])/g)).toHaveLength(1)
  })
})

describe('/status leitet in den Reiter um, Unterseiten unter (hof)', () => {
  it('der Reiter hat genau eine Adresse', () => {
    expect(BEITRAEGE_HREF).toBe('/farm-page?reiter=beitraege')
  })

  it('/status ist eine Umleitung unter (hof) — ohne eigenen Inhalt', () => {
    expect(gibt('src/app/(farmer)/status')).toBe(false)
    const seite = quelle('src/app/(hof)/status/page.tsx')
    expect(seite).toContain('redirect(BEITRAEGE_HREF)')
    expect(seite).not.toMatch(/prisma|getStatusPostsForFarm/)
  })

  it('Neuer Beitrag und WhatsApp fortsetzen liegen unter (hof) und führen zurück in den Reiter', () => {
    expect(gibt('src/app/(hof)/status/new/page.tsx')).toBe(true)
    expect(gibt('src/app/(hof)/status/[id]/send-whatsapp/page.tsx')).toBe(true)
    const client = quelle('src/app/(hof)/status/new/status-new-client.tsx')
    expect(client).toContain('router.push(BEITRAEGE_HREF)')
    expect(client).not.toContain("router.push('/status')")
    // Seit Nr. 44 kommt der Rückweg aus dem UnterseitenKopf — Ziel weiter der Reiter.
    const whatsapp = quelle('src/app/(hof)/status/[id]/send-whatsapp/page.tsx')
    expect(whatsapp).toContain('<UnterseitenKopf')
    expect(elternseite('/status/abc/send-whatsapp')?.href).toBe(BEITRAEGE_HREF)
    expect(elternseite('/status/new')?.href).toBe(BEITRAEGE_HREF)
  })

  it('„Mein Hof" leuchtet auf dem Reiter und auf allen /status-Unterseiten', () => {
    expect(HAUPT.find((p) => p.id === 'mein-hof')?.href).toBe('/farm-page')
    for (const pfad of ['/farm-page', '/status', '/status/new', '/status/abc/send-whatsapp']) {
      expect(hofAktiverPunkt(pfad), pfad).toBe('mein-hof')
    }
  })

  it('der Bestandskopf von /status ist weg', () => {
    expect(gibt('src/components/farmer/mein-hof-kopf.tsx')).toBe(false)
  })
})

describe('Hilfe und Meine Meldungen unter (hof)', () => {
  it('beide Routen samt Ladeansicht liegen unter (hof), nicht mehr unter (farmer)', () => {
    for (const route of ['fehler-melden', 'meldungen']) {
      expect(gibt(`src/app/(hof)/${route}/page.tsx`), route).toBe(true)
      expect(gibt(`src/app/(hof)/${route}/loading.tsx`), route).toBe(true)
      expect(gibt(`src/app/(farmer)/${route}`), route).toBe(false)
    }
  })

  it('/problem-melden (Kundinnen) bleibt beim Bestandsformular', () => {
    const seite = quelle('src/app/(public)/problem-melden/page.tsx')
    expect(seite).toContain('<MeldungForm')
    expect(seite).not.toContain('hof-hilfe')
  })

  it('/fehler-melden nimmt die Fehlernummer aus der Adresse nur geprüft', () => {
    const seite = quelle('src/app/(hof)/fehler-melden/page.tsx')
    expect(seite).toContain('bereinigeKennung(')
    expect(seite).toContain('generateFormToken(\'meldung\')')
    expect(seite).toContain('<MeldungAbgeben')
  })

  it('das neue Formular und das Bestandsformular teilen dieselbe Logik', () => {
    expect(quelle('src/components/shared/meldung-form.tsx')).toContain('useMeldungFormular(')
    expect(quelle('src/components/hof-hilfe/meldung-abgeben.tsx')).toContain('useMeldungFormular(')
  })

  it('die Datei-Felder stehen außerhalb der Fallunterscheidung (PR 135)', () => {
    const text = quelle('src/components/hof-hilfe/meldung-abgeben.tsx')
    expect(text.match(/\{upload\.fileInput\}/g)).toHaveLength(1)
    expect(text.indexOf('{upload.fileInput}')).toBeLessThan(text.indexOf('{screenshotUrl ?'))
  })
})

const VOLL: MeldungVollstaendig = {
  id: 'cmabcdef123456789',
  art: 'FEHLER',
  text: 'Foto lädt nicht hoch\nZweite Zeile',
  createdAt: new Date('2026-10-06T08:00:00.000Z'),
  status: 'GEPLANT',
  antwortAnMelder: 'Liegt am Bildformat — eine Umwandlung kommt.',
  triageNotiz: 'intern',
}

describe('Meldungen: Ton, Zähler, Zeilen', () => {
  it('Status-Ton: In Arbeit und Erledigt grün, sonst neutral — nie orange (nichts wartet auf den Hof)', () => {
    expect(STATUS_TON.GEPLANT).toBe('fertig')
    expect(STATUS_TON.ERLEDIGT).toBe('fertig')
    expect(STATUS_TON.NEU).toBe('neutral')
    expect(STATUS_TON.GEPRUEFT).toBe('neutral')
    expect(Object.values(STATUS_TON)).not.toContain('offen')
  })

  it('Art-Ton wie im Mockup: Fehler orange, Wunsch grün, Frage neutral', () => {
    expect(MELDUNG_ART_TON).toEqual({ FEHLER: 'offen', WUNSCH: 'fertig', FRAGE: 'neutral' })
  })

  it('die Hof-Sicht trägt Ton und offen, aber weiter kein Triage-Feld', () => {
    const sicht = fuerHof(VOLL)
    expect(sicht.statusTon).toBe('fertig')
    expect(sicht.offen).toBe(true)
    expect(fuerHof({ ...VOLL, status: 'ERLEDIGT' }).offen).toBe(false)
    expect(sicht).not.toHaveProperty('triageNotiz')
  })

  it('Zähler: offen = nicht abgeschlossen, beantwortet = mit Antwort', () => {
    const liste = [
      fuerHof(VOLL),
      fuerHof({ ...VOLL, id: 'x2', status: 'ERLEDIGT', antwortAnMelder: null }),
      fuerHof({ ...VOLL, id: 'x3', status: 'NEU', antwortAnMelder: '  ' }),
    ]
    expect(meldungenStand(liste)).toEqual({ offen: 2, beantwortet: 1 })
    expect(meldungenStand([])).toEqual({ offen: 0, beantwortet: 0 })
  })

  it('Zeile: Art, erste Zeile, Wiener Tag, Status und Antwort', () => {
    const [z] = meldungZeilen([fuerHof(VOLL)], new Date('2026-10-06T21:00:00.000Z'))
    expect(z).toMatchObject({
      art: 'Fehler',
      artTon: 'offen',
      titel: 'Foto lädt nicht hoch',
      datum: 'Heute',
      status: 'In Arbeit',
      statusTon: 'fertig',
      antwort: 'Liegt am Bildformat — eine Umwandlung kommt.',
      kurznummer: 'cmabcdef',
    })
    // 23:30 Uhr in Wien am Folgetag = schon „Gestern" (Wiener Tag, nie UTC).
    expect(meldungZeilen([fuerHof(VOLL)], new Date('2026-10-07T21:30:00.000Z'))[0].datum).toBe('Gestern')
    // Eine leere Antwort ist keine Antwort.
    expect(meldungZeilen([fuerHof({ ...VOLL, antwortAnMelder: ' ' })], new Date(jetzt))[0].antwort).toBeNull()
  })

  it('Gerät in Worten, Seite ohne Herkunft', () => {
    expect(geraetKurz('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36')).toBe(
      'Chrome, Windows'
    )
    expect(geraetKurz('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1')).toBe(
      'Safari, iPhone'
    )
    expect(geraetKurz('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36 EdgA/129.0')).toBe(
      'Edge, Android'
    )
    expect(geraetKurz('Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:131.0) Gecko/20100101 Firefox/131.0')).toBe('Firefox, macOS')
    expect(geraetKurz('')).toBe('–')
    expect(seiteKurz('http://localhost:3000/orders?filter=heute')).toBe('/orders?filter=heute')
    expect(seiteKurz('')).toBe('–')
  })

  it('das Textfeld fragt passend zur Art', () => {
    expect(MELDUNG_TEXT_LABEL.FEHLER).toBe('Was ist passiert?')
    expect(new Set(Object.values(MELDUNG_TEXT_LABEL)).size).toBe(3)
  })
})

describe('Meine Meldungen (gerendert)', () => {
  const zeilen = meldungZeilen(
    [
      fuerHof(VOLL),
      fuerHof({ ...VOLL, id: 'cmfrage00000', art: 'FRAGE', text: '<script>alert(1)</script>', status: 'NEU', antwortAnMelder: null }),
    ],
    new Date(jetzt)
  )
  const html = renderToStaticMarkup(createElement(MeineMeldungen, { zeilen }))

  it('h1, „+ Neue Meldung" nach /fehler-melden, Marken und Antwort', () => {
    expect(NEUE_MELDUNG_HREF).toBe('/fehler-melden')
    expect(html).toMatch(/<h1[^>]*>Meine Meldungen<\/h1>/)
    expect(html).toContain(`href="${NEUE_MELDUNG_HREF}"`)
    expect(html).toContain('data-status="offen"')
    expect(html).toContain('In Arbeit')
    expect(html).toContain('Antwort:')
    expect(html).toContain('Liegt am Bildformat')
  })

  it('F6 (22e): je Meldung „Tag · Nr. <Kurznummer>" bleibt', () => {
    expect(zeilen[0].kurznummer).toMatch(/\S/)
    expect(html).toContain(`Nr. <span class="font-mono">${zeilen[0].kurznummer}</span>`)
  })

  it('Fremdtext bleibt Text', () => {
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('leer: EmptyState mit Ausweg', () => {
    const leer = renderToStaticMarkup(createElement(MeineMeldungen, { zeilen: [] }))
    expect(leer).toContain('data-slot="empty-state"')
    expect(leer).toContain(`href="${NEUE_MELDUNG_HREF}"`)
  })
})

describe('Meldung abgeben (gerendert)', () => {
  const html = renderToStaticMarkup(createElement(MeldungAbgeben, { formToken: 't', hofName: 'Hof Test', kennungVorbelegt: '' }))

  it('drei Arten als Knöpfe mit aria-pressed, Fehler vorgewählt', () => {
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1)
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(2)
    expect(html).toContain('Etwas funktioniert nicht')
    expect(html).toContain('Was ist passiert?')
  })

  it('Absenden, Abbrechen nach Meine Meldungen, Honigtopf, was automatisch mitgeht', () => {
    expect(MEINE_MELDUNGEN_HREF).toBe('/meldungen')
    expect(html).toContain('Absenden')
    expect(html).toContain(`href="${MEINE_MELDUNGEN_HREF}"`)
    expect(html).toContain('name="website"')
    expect(html).toContain('Das schicken wir automatisch mit')
    expect(html).toContain('Keine IP-Adresse, keine Cookies.')
    expect(html).toContain('Bildschirmfoto hinzufügen')
  })

  it('kein Rückruf (O5) — weder im Formular noch in der Seitenspalte', () => {
    const spalte = renderToStaticMarkup(
      createElement(HilfeSeitenspalte, { stand: { offen: 2, beantwortet: 1 }, mailto: 'mailto:support@example.com' })
    )
    expect(html + spalte).not.toMatch(/Rückruf/i)
    expect(spalte).toContain('E-Mail schreiben')
    expect(spalte).toContain(`href="${MEINE_MELDUNGEN_HREF}"`)
    expect(spalte).toContain('Offen')
    expect(spalte).toContain('Beantwortet')
  })

  it('ohne Stand (Ladefehler) bleibt der Weg zu den Meldungen', () => {
    const spalte = renderToStaticMarkup(createElement(HilfeSeitenspalte, { stand: null, mailto: 'mailto:support@example.com' }))
    expect(spalte).toContain(`href="${MEINE_MELDUNGEN_HREF}"`)
    expect(spalte).not.toContain('Beantwortet')
  })
})

describe('Tokens statt Farbwerte (neue und umgezogene Dateien)', () => {
  const dateien = [
    'src/components/mein-hof/beitraege-reiter.tsx',
    'src/components/mein-hof/beitrag-zeile.tsx',
    'src/components/hof-hilfe/meine-meldungen.tsx',
    'src/components/hof-hilfe/meldung-abgeben.tsx',
    'src/components/hof-hilfe/hilfe-seitenspalte.tsx',
    'src/components/hof-hilfe/hilfe-laden.tsx',
    'src/components/hofbereich/unterseiten-kopf.tsx',
    'src/app/(hof)/fehler-melden/page.tsx',
    'src/app/(hof)/meldungen/page.tsx',
    'src/app/(hof)/status/new/status-new-client.tsx',
    'src/app/(hof)/status/[id]/send-whatsapp/page.tsx',
    'src/app/(hof)/status/[id]/send-whatsapp/whatsapp-tap-client.tsx',
  ]

  it.each(dateien)('%s: keine Farbliterale, keine Tailwind-Palette, kein black/white, keine Bestandspalette', (datei) => {
    const text = quelle(datei)
    expect(text).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?|oklch)\(/)
    expect(text).not.toMatch(/\b(bg|text|border|ring|from|to)-(green|emerald|amber|blue|red)-\d/)
    expect(text).not.toMatch(/\b(bg|text|border|ring|shadow|from|to|via|outline)-(black|white)\b/)
    expect(text).not.toMatch(/\bapp-(ink|page|chip|trough|bar|button|line)/)
  })

  it('Gegenprobe: die Suche findet die Tailwind-Palette', () => {
    expect('text-green-600').toMatch(/\b(bg|text|border|ring|from|to)-(green|emerald|amber|blue|red)-\d/)
  })
})
