/**
 * Testhof und Kartenpunkt im Admin (Register N21, Nr. 119) — die reinen
 * Regeln ohne Mock, dazu die Bestätigung und der Satz beim Festschreiben,
 * gerendert ohne Browser (BestellDialog ersetzt: der Inhalt steht im HTML).
 *
 * Beweist:
 *  - „Als Testhof markieren …“ für jeden freigeschalteten, nicht stillgelegten
 *    Hof, der eigene Haken nur, wenn er einen Platz hält; „Kein Testhof mehr …“
 *    für jeden Testhof; wartend oder stillgelegt kein Eintrag;
 *  - „Wieder als Gründungshof zählen“ ist bei einem Testhof ausgegraut, mit
 *    dem Satz „Ein Testhof zählt nie als Gründungshof.“ — auch bei freiem Platz;
 *  - die Kartenpunkt-Zeile steht nur ohne Punkt, nie bei stillgelegten Höfen
 *    oder Testhöfen, und sperrt das Freischalten nicht;
 *  - beim Festschreiben mit leerer Liste: „alle ausgenommen“, wenn es
 *    ausgenommene gibt, sonst „kein Hof freigeschaltet“.
 */
import { describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))
vi.mock('@/server/actions/gruendung', () => ({ markiereAlsTesthof: vi.fn(), nimmTesthofZurueck: vi.fn(), schreibeZusagenFest: vi.fn() }))
vi.mock('@/server/actions/plattform-einstellung', () => ({ speichereGruendungEinstellung: vi.fn() }))
// Ohne Portal: Der Inhalt eines Dialogs steht im HTML, auch wenn er zu ist (der Festschreiben-Dialog öffnet erst per Knopf).
vi.mock('@/components/hof-bestellungen/bestell-dialog', () => ({
  BestellDialog: ({ titel, children }: { titel: string; children?: ReactNode }) => createElement('section', { 'aria-label': titel }, createElement('h2', null, titel), children),
  DialogFehler: ({ text }: { text: string | null }) => (text ? createElement('p', null, text) : null),
}))

import { GRUENDUNG_BIS_STANDARD, TESTHOF_ZAEHLT_NIE } from '@/lib/gruendungshof'
import { GRUENDUNG_AUSNEHMEN_TEXT, TESTHOF_TEXT, gruendungAenderung, testhofAenderung } from '@/lib/admin-hoefe-seite'
import { KEIN_KARTENPUNKT_TEXT, freischaltSperre, kartenpunktZeile } from '@/lib/admin-hoefe'
import { EINSTELLUNGEN_TEXT } from '@/lib/plattform-einstellung'
import { TesthofDialog } from '@/components/admin/testhof-dialog'
import { EinstellungenGruendung, type GruendungFormularDaten } from '@/components/admin/einstellungen-gruendung'

const T = (tag: number) => new Date(Date.UTC(2026, 0, tag))
function hof(n: number, ueber: { gruendungAusgenommen?: boolean; istTesthof?: boolean; approvedAt?: Date | null; archivedAt?: Date | null } = {}) {
  return {
    id: `hof_${n}`,
    name: `Testhof ${String.fromCharCode(64 + n)}`,
    approvedAt: T(n),
    createdAt: T(1),
    archivedAt: null,
    gruendungAusgenommen: false,
    istTesthof: false,
    gruendungBis: null,
    ...ueber,
  }
}

describe('testhofAenderung — Menüeintrag und Bestätigung', () => {
  it('ein Hof mit Platz: „Als Testhof markieren …“ mit dem Text der Freigabe und dem eigenen Haken', () => {
    const hoefe = [hof(1), hof(2)]
    expect(testhofAenderung(hoefe[1]!, hoefe, 12)).toEqual({
      richtung: 'markieren',
      menue: 'Als Testhof markieren …',
      titel: 'Testhof B als Testhof markieren?',
      satz: 'Er verschwindet aus /hoefe, der Startseite, der Karte, Region und der Suche und bekommt keinen Gründungsplatz. Seine Hofseite bleibt per Link erreichbar.',
      haken: true,
      knopf: 'Als Testhof markieren',
    })
  })

  it('ohne Platz (ausgenommen oder alle vergeben) kein Haken', () => {
    expect(testhofAenderung(hof(1, { gruendungAusgenommen: true }), [hof(1, { gruendungAusgenommen: true })], 12)?.haken).toBe(false)
    const voll = [hof(1), hof(2)]
    expect(testhofAenderung(voll[1]!, voll, 1)?.haken).toBe(false)
  })

  it('ein Testhof: „Kein Testhof mehr …“ ohne Haken, gleich welcher Status', () => {
    const testhof = hof(1, { istTesthof: true, gruendungAusgenommen: true, archivedAt: T(9) })
    expect(testhofAenderung(testhof, [testhof], 12)).toMatchObject({ richtung: 'zuruecknehmen', menue: 'Kein Testhof mehr …', haken: false, knopf: 'Kein Testhof mehr' })
  })

  it('wartend oder stillgelegt: kein Eintrag (wie beim Ausnehmen)', () => {
    expect(testhofAenderung(hof(1, { approvedAt: null }), [hof(1, { approvedAt: null })], 12)).toBeNull()
    expect(testhofAenderung(hof(1, { archivedAt: T(9) }), [hof(1, { archivedAt: T(9) })], 12)).toBeNull()
  })
})

describe('gruendungAenderung bei einem Testhof', () => {
  it('„Wieder als Gründungshof zählen“ ausgegraut mit „Ein Testhof zählt nie als Gründungshof.“ — auch bei freiem Platz', () => {
    const hoefe = [hof(1, { istTesthof: true, gruendungAusgenommen: true }), hof(2)]
    const a = gruendungAenderung(hoefe[0]!, hoefe, 12, GRUENDUNG_BIS_STANDARD)
    expect(a.richtung).toBe('aufnehmen')
    expect(a.gesperrt).toBe(TESTHOF_ZAEHLT_NIE)
  })

  it('Gegenprobe: derselbe Hof nur ausgenommen ist bei freiem Platz nicht gesperrt', () => {
    const hoefe = [hof(1, { gruendungAusgenommen: true }), hof(2)]
    expect(gruendungAenderung(hoefe[0]!, hoefe, 12, GRUENDUNG_BIS_STANDARD).gesperrt).toBeNull()
  })
})

describe('Kartenpunkt-Zeile', () => {
  it('ohne Punkt der Satz, mit Punkt keiner', () => {
    expect(kartenpunktZeile({ archivedAt: null, istTesthof: false, hatKartenpunkt: false })).toBe(KEIN_KARTENPUNKT_TEXT)
    expect(kartenpunktZeile({ archivedAt: null, istTesthof: false, hatKartenpunkt: true })).toBeNull()
  })

  it('nicht bei stillgelegten Höfen und nicht bei Testhöfen — die stehen ohnehin auf keiner Karte', () => {
    expect(kartenpunktZeile({ archivedAt: T(9), istTesthof: false, hatKartenpunkt: false })).toBeNull()
    expect(kartenpunktZeile({ archivedAt: null, istTesthof: true, hatKartenpunkt: false })).toBeNull()
  })

  it('sperrt das Freischalten nicht: freischaltSperre kennt den Kartenpunkt nicht', () => {
    expect(freischaltSperre({ emailBestaetigungOffen: false, stripeBereit: true, produktImShop: true })).toBeNull()
  })
})

describe('TesthofDialog', () => {
  const render = (n: number, hoefe: ReturnType<typeof hof>[], plaetze = 12): string => {
    const h = hoefe[n - 1]!
    const aenderung = testhofAenderung(h, hoefe, plaetze)
    if (!aenderung) throw new Error('kein Eintrag')
    return renderToStaticMarkup(createElement(TesthofDialog, { hof: { id: h.id, name: h.name, aenderung }, onClose: () => {} }))
  }

  it('mit Platz: Titel, Satz und der eigene Haken (nicht der des Ausnehmens)', () => {
    const html = render(2, [hof(1), hof(2)])
    expect(html).toContain('Testhof B als Testhof markieren?')
    expect(html).toContain(TESTHOF_TEXT.satz.markieren)
    expect(html).toContain('type="checkbox"')
    expect(html).toContain(TESTHOF_TEXT.haken)
    expect(html).not.toContain(GRUENDUNG_AUSNEHMEN_TEXT.haken)
  })

  it('Gegenprobe: ohne Platz und beim Zurücknehmen kein Haken', () => {
    expect(render(2, [hof(1), hof(2)], 1)).not.toContain('type="checkbox"')
    const zurueck = render(1, [hof(1, { istTesthof: true, gruendungAusgenommen: true })])
    expect(zurueck).toContain('Testhof A nicht mehr als Testhof führen?')
    expect(zurueck).toContain(TESTHOF_TEXT.satz.zuruecknehmen)
    expect(zurueck).not.toContain('type="checkbox"')
  })
})

describe('Satz beim Festschreiben (Nr. 119)', () => {
  const daten: GruendungFormularDaten = {
    gespeichert: { plaetze: 12, monate: 24, aktionBisTag: null, anzeige: true, bisTag: '2027-12-31', festAm: null },
    vergeben: 0,
    ausgenommen: 0,
    jetzt: '2026-10-14T08:00:00.000Z',
    protokoll: 'Noch nie geändert – es gelten die Standardwerte.',
    festschreiben: [],
    festschreibenPlaetze: null,
    festgeschrieben: null,
  }
  const TEXT = EINSTELLUNGEN_TEXT.gruendung

  it('leere Liste, aber ausgenommene Höfe: „Alle freigeschalteten Höfe sind ausgenommen …“', () => {
    const html = renderToStaticMarkup(createElement(EinstellungenGruendung, { daten: { ...daten, ausgenommen: 2 } }))
    expect(html).toContain(TEXT.festschreibenAlleAusgenommen)
    expect(html).not.toContain(TEXT.festschreibenLeer)
  })

  it('Gegenprobe: leere Liste ohne ausgenommene bleibt „Bisher ist kein Hof freigeschaltet …“', () => {
    const html = renderToStaticMarkup(createElement(EinstellungenGruendung, { daten }))
    expect(html).toContain(TEXT.festschreibenLeer)
    expect(html).not.toContain(TEXT.festschreibenAlleAusgenommen)
  })
})
