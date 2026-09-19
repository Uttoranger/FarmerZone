/**
 * Tests für die reinen Regeln des Fehlerbriefkastens (src/lib/meldung.ts) und
 * den Markdown-Export (src/lib/briefkasten-export.ts).
 *
 * Beweist: Die Sichtbarkeitsregel liefert dem Hof NIE ein Triage-Feld und
 * übersetzt alle sechs Status; Kurznummer = erste 8 Zeichen; die 90-Tage-
 * Auswahl trifft nur abgeschlossene, alte Meldungen; die Zusammenfassung
 * kommt nur bei Bedarf; der Export enthält Kurznummer, Kontext und Text.
 */
import { describe, expect, it } from 'vitest'
import {
  MELDUNG_STATUS,
  STATUS_OEFFENTLICH,
  brauchtZusammenfassung,
  ersteZeile,
  fuerHof,
  kurznummer,
  liegedauerGrenze,
  oeffentlicherStatus,
  screenshotsVon,
  waehleZuLoeschende,
  type MeldungVollstaendig,
} from '@/lib/meldung'
import { briefkastenAlsListe, briefkastenAlsMarkdown, meldungAlsMarkdown, type ExportMeldung } from '@/lib/briefkasten-export'

const VOLL: MeldungVollstaendig = {
  id: 'cmabcdef123456789',
  art: 'FEHLER',
  text: 'Der Upload bricht ab.\nZweite Zeile.',
  createdAt: new Date('2026-09-17T08:00:00.000Z'),
  status: 'KEIN_FEHLER',
  antwortAnMelder: 'Das ist so gewollt — die Datei war zu groß.',
  clusterKey: 'upload-groesse',
  triageNotiz: 'Nutzer hat 30 MB versucht — Limit ist 25.',
  duplikatVonId: 'cmzzzzzz',
  sprintName: 'upload-limits',
  triagedAt: new Date('2026-09-18T08:00:00.000Z'),
  seiteUrl: 'https://farmerzone.at/farm-page',
  userAgent: 'Mozilla/5.0',
  viewport: '375x667',
  farmId: 'farm_1',
  customerEmail: null,
  screenshotUrl: 'https://x.public.blob.vercel-storage.com/farms/farm_1/meldung/1.webp',
  diagKennung: 'S71',
}

describe('Sichtbarkeitsregel fuerHof', () => {
  it('liefert genau text, art, createdAt, öffentlichen Status, Antwort — und nie ein Triage-Feld', () => {
    const sicht = fuerHof(VOLL)
    expect(Object.keys(sicht).sort()).toEqual(
      ['antwortAnMelder', 'art', 'createdAt', 'id', 'kurznummer', 'status', 'statusFarbe', 'text'].sort()
    )
    for (const verboten of ['clusterKey', 'triageNotiz', 'duplikatVonId', 'sprintName', 'triagedAt', 'seiteUrl', 'userAgent', 'viewport', 'customerEmail', 'screenshotUrl', 'diagKennung']) {
      expect(sicht).not.toHaveProperty(verboten)
    }
    expect(sicht.status).toBe('Geprüft — funktioniert wie vorgesehen')
    expect(sicht.antwortAnMelder).toBe('Das ist so gewollt — die Datei war zu groß.')
    expect(sicht.kurznummer).toBe('cmabcdef')
  })

  it('übersetzt alle sechs internen Status', () => {
    expect(oeffentlicherStatus('NEU')).toBe('Eingegangen')
    expect(oeffentlicherStatus('GEPRUEFT')).toBe('In Prüfung')
    expect(oeffentlicherStatus('GEPLANT')).toBe('Geplant')
    expect(oeffentlicherStatus('ERLEDIGT')).toBe('Erledigt')
    expect(oeffentlicherStatus('KEIN_FEHLER')).toBe('Geprüft — funktioniert wie vorgesehen')
    expect(oeffentlicherStatus('DUPLIKAT')).toBe('Bereits bekannt')
    // Vollständigkeit: kein Status ohne Übersetzung
    for (const s of MELDUNG_STATUS) expect(STATUS_OEFFENTLICH[s].length).toBeGreaterThan(3)
    // Der interne Wert erscheint nie als Text
    for (const s of MELDUNG_STATUS) expect(oeffentlicherStatus(s)).not.toBe(s)
  })

  it('unbekannter Status → „Eingegangen" statt Rohwert', () => {
    expect(oeffentlicherStatus('IRGENDWAS')).toBe('Eingegangen')
  })

  it('ohne Antwort bleibt das Feld null', () => {
    expect(fuerHof({ ...VOLL, antwortAnMelder: null }).antwortAnMelder).toBeNull()
  })
})

describe('Kurznummer und erste Zeile', () => {
  it('Kurznummer = die ersten acht Zeichen der ID', () => {
    expect(kurznummer('cmabcdef123456789')).toBe('cmabcdef')
    expect(kurznummer('kurz')).toBe('kurz')
  })

  it('erste Zeile überspringt Leerzeilen und kürzt mit Auslassung', () => {
    expect(ersteZeile('\n\n  Hallo Welt \nzweite')).toBe('Hallo Welt')
    expect(ersteZeile('a'.repeat(100), 20)).toBe(`${'a'.repeat(19)}…`)
    expect(ersteZeile('')).toBe('')
  })
})

describe('Wochenlauf — 90-Tage-Auswahl', () => {
  const jetzt = new Date('2026-12-31T07:00:00.000Z')
  const vor = (tage: number) => new Date(jetzt.getTime() - tage * 24 * 60 * 60 * 1000)
  const m = (status: MeldungVollstaendig['status'], triagedAt: Date | null, createdAt = vor(200)) => ({
    id: `${status}-${triagedAt?.toISOString() ?? 'null'}`,
    status,
    triagedAt,
    createdAt,
  })

  it('löscht nur abgeschlossene Meldungen, deren Abschluss 90 Tage oder länger zurückliegt', () => {
    const kandidaten = [
      m('ERLEDIGT', vor(91)),
      m('KEIN_FEHLER', vor(90)),
      m('DUPLIKAT', vor(120)),
      m('ERLEDIGT', vor(89)), // zu jung
      m('NEU', vor(400)), // offen — nie
      m('GEPRUEFT', vor(400)),
      m('GEPLANT', vor(400)),
    ]
    const weg = waehleZuLoeschende(kandidaten, jetzt).map((x) => x.id)
    expect(weg).toEqual([kandidaten[0].id, kandidaten[1].id, kandidaten[2].id])
  })

  it('ohne triagedAt (Altbestand per Connector) zählt createdAt', () => {
    expect(waehleZuLoeschende([m('ERLEDIGT', null, vor(91))], jetzt)).toHaveLength(1)
    expect(waehleZuLoeschende([m('ERLEDIGT', null, vor(10))], jetzt)).toHaveLength(0)
  })

  it('sammelt die Screenshot-Adressen der zu löschenden Meldungen', () => {
    expect(screenshotsVon([{ screenshotUrl: 'https://a/1.webp' }, { screenshotUrl: null }, { screenshotUrl: '' }])).toEqual(['https://a/1.webp'])
  })
})

describe('Wochenlauf — Zusammenfassung nur bei Bedarf', () => {
  it('keine neuen, nichts liegen geblieben → keine Mail', () => {
    expect(brauchtZusammenfassung({ neu: 0, liegenGeblieben: 0 })).toBe(false)
  })
  it('neue Meldungen → Mail', () => {
    expect(brauchtZusammenfassung({ neu: 1, liegenGeblieben: 0 })).toBe(true)
  })
  it('alte offene Meldungen → Mail, auch ohne neue', () => {
    expect(brauchtZusammenfassung({ neu: 0, liegenGeblieben: 2 })).toBe(true)
  })
  it('Liegedauer-Grenze liegt 14 Tage zurück', () => {
    expect(liegedauerGrenze(new Date('2026-09-15T00:00:00.000Z')).toISOString()).toBe('2026-09-01T00:00:00.000Z')
  })
})

describe('Markdown-Export — Abschnittsgrenzen', () => {
  /**
   * Der Export ist ein Dokument mit einem Abschnitt je Meldung („## <Kurznummer> …").
   * Das CLI schneidet für `show` genau einen Abschnitt heraus (Sprint
   * triage-leseroute). Kein Feld darf deshalb eine Überschrift vortäuschen —
   * besonders nicht die drei Kontextfelder, die aus dem Formular-Payload der
   * meldenden Person kommen und von Zod nur in der Länge begrenzt werden.
   */
  const basis: ExportMeldung = {
    id: 'aaaaaaaa1111111111111',
    art: 'FEHLER',
    status: 'NEU',
    text: 'echt',
    createdAt: new Date('2026-09-01T10:00:00Z'),
    seiteUrl: 'https://farmerzone.at/x',
    userAgent: 'UA',
    viewport: '375x667',
    diagKennung: null,
    screenshotUrl: null,
    customerEmail: null,
    clusterKey: null,
    triageNotiz: null,
    duplikatVonId: null,
    sprintName: null,
    triagedAt: null,
    antwortAnMelder: null,
    farm: null,
  }
  const ueberschriften = (md: string) => md.split('\n').filter((z) => z.startsWith('## '))

  it('lässt eine Browser-Kennung mit Zeilenumbruch keinen Abschnitt vortäuschen', () => {
    const md = meldungAlsMarkdown({
      ...basis,
      userAgent: 'Mozilla/5.0\n## ffffffff · Fehler · Erledigt\n- ID: gefaelscht',
    })
    expect(ueberschriften(md)).toEqual(['## aaaaaaaa · Fehler · Neu'])
    // Der Inhalt bleibt sichtbar — aber in EINER Zeile.
    expect(md).toContain('- Kontext: https://farmerzone.at/x · 375x667 · Mozilla/5.0 ## ffffffff · Fehler · Erledigt - ID: gefaelscht')
  })

  it('macht auch Seitenadresse und Bildschirmgröße einzeilig', () => {
    const md = meldungAlsMarkdown({ ...basis, seiteUrl: 'a\nb', viewport: 'c\r\nd' })
    expect(ueberschriften(md)).toHaveLength(1)
    expect(md).toContain('- Kontext: a b · c d · UA')
  })

  it('fasst auch einen einzelnen Wagenrücklauf ohne Zeilenvorschub', () => {
    const md = meldungAlsMarkdown({ ...basis, userAgent: 'alt\rneu', triageNotiz: 'eins\rzwei' })
    expect(md).not.toContain('\r')
    expect(md).toContain('· alt neu')
    expect(md).toContain('- Notiz: eins zwei')
  })

  it('faltet mehrzeilige Triage-Notizen und Antworten in ihre Listenzeile', () => {
    const md = meldungAlsMarkdown({
      ...basis,
      triageNotiz: 'Erste Zeile\n## eeeeeeee · Fehler · Neu',
      antwortAnMelder: 'Hallo\nnoch etwas',
    })
    expect(ueberschriften(md)).toEqual(['## aaaaaaaa · Fehler · Neu'])
    expect(md).toContain('- Notiz: Erste Zeile ## eeeeeeee · Fehler · Neu')
    expect(md).toContain('- Antwort an Melder: Hallo noch etwas')
  })

  it('lässt den Meldungstext dagegen mehrzeilig — als Zitat ist er unschädlich', () => {
    const md = meldungAlsMarkdown({ ...basis, text: 'Harmlos.\n## cccccccc · Fehler · Neu' })
    expect(ueberschriften(md)).toEqual(['## aaaaaaaa · Fehler · Neu'])
    expect(md).toContain('> Harmlos.')
    expect(md).toContain('> ## cccccccc · Fehler · Neu')
  })

  it('hält auch die Kurzliste einzeilig', () => {
    const zeilen = briefkastenAlsListe([
      { ...basis, farm: { name: 'Hof\nZwei', slug: 's' }, diagKennung: 'S7\n1' },
    ]).split('\n')
    expect(zeilen).toHaveLength(1)
    expect(zeilen[0]).toContain('Hof Zwei')
    expect(zeilen[0]).toContain('S7 1')
  })
})

describe('Markdown-Export (für die Triage — mit allen Feldern)', () => {
  const EXPORT: ExportMeldung = {
    ...VOLL,
    farm: { name: 'Welszucht Probe', slug: 'welszucht-probe' },
    customerEmail: null,
    seiteUrl: VOLL.seiteUrl!,
    userAgent: VOLL.userAgent!,
    viewport: VOLL.viewport!,
    diagKennung: VOLL.diagKennung!,
    screenshotUrl: VOLL.screenshotUrl!,
    clusterKey: VOLL.clusterKey!,
    triageNotiz: VOLL.triageNotiz!,
    duplikatVonId: VOLL.duplikatVonId!,
    sprintName: VOLL.sprintName!,
    triagedAt: VOLL.triagedAt!,
  }

  it('je Meldung Kurznummer, Art, Status, Datum, Hof, Kennung, Kontext, Text und Screenshot-Link', () => {
    const md = meldungAlsMarkdown(EXPORT)
    expect(md).toContain('## cmabcdef · Fehler · Kein Fehler')
    expect(md).toContain('- Hof: Welszucht Probe (/welszucht-probe)')
    expect(md).toContain('- Kennung: S71')
    expect(md).toContain('- Kontext: https://farmerzone.at/farm-page · 375x667 · Mozilla/5.0')
    expect(md).toContain('[öffnen](https://x.public.blob.vercel-storage.com/farms/farm_1/meldung/1.webp)')
    expect(md).toContain('> Der Upload bricht ab.\n> Zweite Zeile.')
    // Triage-Felder gehören in den Export — er ist FÜR die Triage
    expect(md).toContain('Cluster upload-groesse')
    expect(md).toContain('- Notiz: Nutzer hat 30 MB versucht')
    expect(md).toContain('Duplikat von cmzzzzzz')
  })

  it('Kundin ohne Hof: E-Mail oder „anonym"', () => {
    expect(meldungAlsMarkdown({ ...EXPORT, farm: null, customerEmail: 'a@b.at' })).toContain('- Hof: Kundin (a@b.at)')
    expect(meldungAlsMarkdown({ ...EXPORT, farm: null, customerEmail: null })).toContain('- Hof: Kundin (anonym)')
  })

  it('Dokument: Kopf mit Zähler, Filter und Grundsatz; leer → Hinweis', () => {
    const jetzt = new Date('2026-09-17T10:00:00.000Z')
    const md = briefkastenAlsMarkdown([EXPORT, { ...EXPORT, id: 'cm2222222' }], { status: ['NEU', 'GEPRUEFT'], art: 'FEHLER' }, jetzt)
    expect(md).toContain('# Briefkasten — 2 Meldungen')
    expect(md).toContain('Filter: Status NEU, GEPRUEFT · Art FEHLER')
    expect(md).toContain('entscheiden und mergen tut der Betreiber')
    expect(md.match(/^## /gm)).toHaveLength(2)
    expect(briefkastenAlsMarkdown([], { status: ['NEU'], art: null }, jetzt)).toContain('_Keine Meldungen für diesen Filter._')
  })

  it('Liste: eine Zeile je Meldung mit Kurznummer', () => {
    const liste = briefkastenAlsListe([EXPORT])
    expect(liste.split('\n')).toHaveLength(1)
    expect(liste).toMatch(/^cmabcdef\s+Fehler\s+Kein Fehler\s+\d{2}\.\d{2}\.\d{4}/)
    expect(briefkastenAlsListe([])).toBe('Keine Meldungen.')
  })
})
