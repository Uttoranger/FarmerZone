/**
 * Admin › Betrieb › Überblick: Karten „Dienste“, „Version“ und „Alarm-Matrix“
 * (Register N18, Ergänzung 26.10.2026; Nr. 184; Board admin-betrieb-neu).
 *
 * Beweist ohne Datenbank (src/app/admin/betrieb/dienste.ts ist rein):
 *  - Je Dienst eine Zeile mit Prüfweg in der Reihenfolge des Boards; was die
 *    App nicht sieht (Sentry, GitHub), heißt „bei Sentry“/„bei GitHub“.
 *  - Der Uptime-Dienst: nie gerufen → „noch nicht eingerichtet“ (keine
 *    Warnung), pünktlich → „ok“ mit „zuletzt“, still → „ansehen“.
 *  - Stripe ohne Schlüssel, offene Mail-Warnung, ausgefallener Ablauf und
 *    eine Datenbank ohne Antwort → „ansehen“ (Gegenproben).
 *  - Version: kurzer Commit mit Branch, letzte Migration oder ein Satz,
 *    der Weg zurück.
 *  - Gerendert (renderToStaticMarkup): das Zustandswort steht als Text in
 *    der Marke, die Alarm-Matrix als Tabelle mit Zeilenköpfen.
 */
import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ALARM_MATRIX } from '@/lib/betrieb'
import { NOCH_NICHT_EINGERICHTET, dienstZeilen, versionZeilen, type DiensteEingabe } from '@/app/admin/betrieb/dienste'
import { AlarmMatrixListe, AlarmMatrixTabelle, DiensteInhalt, VersionInhalt } from '@/app/admin/betrieb/betrieb-teile'

const JETZT = new Date('2026-10-26T08:40:00.000Z') // 09:40 in Wien

const GUT: DiensteEingabe = {
  stripe: { text: 'Stripe Test', ton: 'offen' } as DiensteEingabe['stripe'],
  testbetrieb: true,
  mailWarnungOffen: false,
  datenbank: '15 MB von 8 GB',
  antwortMs: 38,
  ablaeufe: { puenktlich: 5, von: 5, ausgefallen: false },
  vonAussen: { stand: 'puenktlich', gestartetAm: new Date('2026-10-26T08:38:00.000Z') },
}

describe('Dienste', () => {
  it('sieben Zeilen in der Reihenfolge des Boards, je mit Prüfweg', () => {
    const zeilen = dienstZeilen(GUT, JETZT)
    expect(zeilen.map((z) => z.dienst)).toEqual(['Stripe', 'Resend', 'Datenbank', 'Abläufe', 'Fehler (Sentry)', 'Uptime-Dienst', 'Lebenszeichen (GitHub)'])
    expect(zeilen.map((z) => z.marke)).toEqual(['ok', 'ok', 'ok', 'ok', 'bei Sentry', 'ok', 'bei GitHub'])
    expect(zeilen[0].satz).toBe('Stripe Test · jede Zahlung meldet sich über den Webhook · Testmodus (bekannt)')
    expect(zeilen[2].satz).toBe('15 MB von 8 GB · Antwort 38 ms')
    expect(zeilen[3].satz).toBe('5 von 5 pünktlich · E-Mails jede Minute')
    expect(zeilen[4].satz).toContain('höchstens einmal je Tag und Deploy')
    expect(zeilen[5].satz).toBe('ruft /api/gesund alle 5 Min. · zuletzt heute 09:38 · Push an dein Handy')
    expect(zeilen[6].satz).toContain('alle 15 Min.')
  })

  it('Uptime-Dienst nie gerufen: „noch nicht eingerichtet“, keine Aufforderung; still: „ansehen“', () => {
    const nie = dienstZeilen({ ...GUT, vonAussen: { stand: 'nochKeinLauf', gestartetAm: null } }, JETZT)[5]
    expect(nie).toMatchObject({ marke: NOCH_NICHT_EINGERICHTET, art: 'erledigt' })
    expect(nie.satz).toMatch(/^Noch nicht eingerichtet/)
    const still = dienstZeilen({ ...GUT, vonAussen: { stand: 'ueberfaellig', gestartetAm: new Date('2026-10-26T07:50:00.000Z') } }, JETZT)[5]
    expect(still).toMatchObject({ marke: 'ansehen', art: 'tun' })
    expect(still.satz).toContain('Still seit heute 08:50')
  })

  it('Gegenproben: ohne Stripe-Schlüssel, Mail-Warnung, Ablauf ausgefallen, Datenbank ohne Antwort → „ansehen“', () => {
    const z = dienstZeilen({ ...GUT, stripe: null, mailWarnungOffen: true, antwortMs: null, ablaeufe: { puenktlich: 4, von: 5, ausgefallen: true } }, JETZT)
    expect(z.slice(0, 4).map((d) => d.marke)).toEqual(['ansehen', 'ansehen', 'ansehen', 'ansehen'])
    expect(z[0].satz).toMatch(/Kein Schlüssel/)
    // Mit Live-Schlüssel kein „Testmodus“.
    expect(dienstZeilen({ ...GUT, testbetrieb: false }, JETZT)[0].satz).not.toContain('Testmodus')
  })

  it('gerendert: das Zustandswort steht als Text, nicht nur als Farbe', () => {
    const html = renderToStaticMarkup(createElement(DiensteInhalt, { zeilen: dienstZeilen({ ...GUT, vonAussen: { stand: 'nochKeinLauf', gestartetAm: null } }, JETZT) }))
    expect(html).toContain('Uptime-Dienst')
    expect(html).toContain(NOCH_NICHT_EINGERICHTET)
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}\b/)
  })
})

describe('Version', () => {
  it('Commit kurz mit Branch, letzte Migration, Weg zurück', () => {
    const zeilen = versionZeilen('7f073ae80a51fc5c3f470d2758b5d8c2b1a0099c', 'main', { name: '20261026100000_regelbetrieb', am: new Date('2026-10-26T06:00:00.000Z') }, JETZT)
    expect(zeilen).toEqual([
      { name: 'Commit', wert: '7f073ae · main' },
      { name: 'Letzte Migration', wert: '20261026100000_regelbetrieb · angewandt heute 07:00' },
      { name: 'Zurück', wert: 'Vercel › Deployments › „Instant Rollback“' },
    ])
  })

  it('lokal ohne Commit; Migration nicht lesbar bzw. keine', () => {
    expect(versionZeilen(null, null, undefined, JETZT).map((z) => z.wert).slice(0, 2)).toEqual(['lokal – ohne Commit von Vercel', 'gerade nicht lesbar'])
    expect(versionZeilen('abc1234def', null, null, JETZT).map((z) => z.wert).slice(0, 2)).toEqual(['abc1234', 'keine'])
  })

  it('gerendert als Beschreibungsliste', () => {
    const html = renderToStaticMarkup(createElement(VersionInhalt, { zeilen: versionZeilen(null, null, null, JETZT) }))
    expect(html).toContain('<dt')
    expect(html).toContain('Instant Rollback')
  })
})

describe('Alarm-Matrix', () => {
  it('Tabelle mit Spaltenköpfen und je Signal einem Zeilenkopf; am Handy dieselben Zeilen als Liste', () => {
    const tabelle = renderToStaticMarkup(createElement(AlarmMatrixTabelle))
    expect(tabelle).toContain('<caption')
    expect((tabelle.match(/<th scope="row"/g) ?? []).length).toBe(ALARM_MATRIX.length)
    expect(tabelle).toContain('Uptime-Dienst selbst still &gt; 30 Min.')
    const liste = renderToStaticMarkup(createElement(AlarmMatrixListe))
    expect((liste.match(/<li/g) ?? []).length).toBe(ALARM_MATRIX.length)
  })
})
