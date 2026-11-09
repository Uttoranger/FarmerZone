/**
 * Mein Hof › Hofseite nach den Boards s1-/w1-mein-hof (Nr. 274): Zeilentitel,
 * Zusammenlegung, Gruppen nach dem Ort, Halbgeviertstrich — und dass der
 * Fortschritt („8 von 11“) dabei unverändert bleibt.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { hofseiteFortschritt, type HofseiteStand } from '@/lib/hofseite-fortschritt'
import { MEIN_HOF_AUFBAU, halbgeviert, meinHofListe } from '@/lib/mein-hof-liste'
import { POSTFACH_ALLES_GELESEN } from '@/lib/postfach'

const STAND: HofseiteStand = {
  name: 'Hof Müller',
  description: 'Heumilch und Käse',
  aboutText: 'Familienbetrieb seit 1987',
  logoUrl: null,
  bannerType: 'GRADIENT',
  bannerUrl: null,
  fotos: 0,
  address: 'Dorfstraße 1',
  postalCode: '4900',
  city: 'Musterdorf',
  hatKoordinaten: true,
  abholzeiten: [{ dayOfWeek: 3, startTime: '15:00', endTime: '18:00' }],
  acceptsOnline: true,
  stripeAccountReady: true,
  phone: '+43 660 0000000',
  email: 'hof@example.com',
  isPaused: false,
  sektionen: [{ key: 'products', visible: true, order: 1 }],
  tagline: 'Heumilch seit drei Generationen',
  foundedYear: 1987,
  werte: ['Regional', 'Saisonal'],
}

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')

describe('meinHofListe (Boards s1-/w1-mein-hof)', () => {
  it('Titel und Gruppen wörtlich nach Board', () => {
    const { gruppen } = meinHofListe(hofseiteFortschritt(STAND))
    expect(gruppen.map((g) => [g.titel, g.zeilen.map((z) => z.titel)])).toEqual([
      ['Oben auf der Seite', ['Titelbild und Logo', 'Name und Leitspruch', 'Adresse und Karte']],
      ['Aufbau und Fotos', ['Fotos', 'Abschnitte']],
      ['Abholen und Bezahlen', ['Abholzeiten', 'Zahlung', 'Kontakt']],
      ['Über uns', ['Über uns']],
    ])
  })

  it('der Fortschritt zählt weiter jeden Abschnitt: zwei fehlende Teile einer Zeile sind zwei Punkte', () => {
    const fortschritt = hofseiteFortschritt(STAND)
    const liste = meinHofListe(fortschritt)
    // Titelbild (Verlauf) und Logo fehlen, Fotos fehlen: drei Punkte, zwei Zeilen.
    expect(liste.anzahlOffen).toBe(3)
    expect(liste.anzahlOffen).toBe(fortschritt.gesamt - fortschritt.erledigt)
    expect(liste.offen.map((z) => z.titel)).toEqual(['Titelbild und Logo', 'Fotos'])
    expect(liste.offen[0]?.teile).toEqual(['titelbild', 'logo'])
    expect(liste.offen[0]?.marke).toEqual({ text: 'Fehlt', farbe: 'bernstein' })
  })

  it('ohne Abholzeiten steht die Zeile in der Karte ganz oben (Register N24)', () => {
    const { offen } = meinHofListe(hofseiteFortschritt({ ...STAND, abholzeiten: [] }))
    expect(offen[0]?.titel).toBe('Abholzeiten')
  })

  it('Halbgeviertstrich statt langem Gedankenstrich in jedem Wert', () => {
    const werte = meinHofListe(hofseiteFortschritt({ ...STAND, description: '', tagline: null, werte: [] })).gruppen.flatMap((g) => g.zeilen.map((z) => z.wert))
    expect(werte.join(' | ')).not.toContain('—')
    expect(werte.join(' | ')).toContain('–')
    expect(halbgeviert('Fehlt — macht')).toBe('Fehlt – macht')
  })

  it('freiwilliges, das fehlt, steht nicht im Wert; gesetztes schon', () => {
    const ohne = meinHofListe(hofseiteFortschritt({ ...STAND, tagline: null, foundedYear: null, werte: [] }))
    const ueber = ohne.gruppen.flatMap((g) => g.zeilen).find((z) => z.id === 'ueber-uns')
    expect(ueber?.wert).toBe('Familienbetrieb seit 1987')
    const mit = meinHofListe(hofseiteFortschritt(STAND)).gruppen.flatMap((g) => g.zeilen)
    expect(mit.find((z) => z.id === 'name')?.wert).toContain('Heumilch seit drei Generationen')
    expect(mit.find((z) => z.id === 'ueber-uns')?.wert).toBe('Familienbetrieb seit 1987 · Regional · Saisonal')
  })

  it('jeder Abschnitt steht in genau einer Zeile', () => {
    const teile = MEIN_HOF_AUFBAU.flatMap((g) => g.zeilen.flatMap((z) => z.teile))
    expect(new Set(teile).size).toBe(teile.length)
  })
})

describe('Darstellung (Nr. 274)', () => {
  it('Liste und Editor nehmen dieselbe Liste und keine Symbole je Zeile', () => {
    const editor = quelle('src/components/farmer/hofseite-editor.tsx')
    const liste = quelle('src/components/mein-hof/abschnitte-liste.tsx')
    for (const q of [editor, liste]) {
      expect(q).toContain('meinHofListe(fortschritt)')
      expect(q).toContain('<AktuellBlock aktuell={aktuell}')
    }
    expect(editor).not.toMatch(/ImageIcon|Stamp|PenLine|SYMBOL\[/)
    expect(editor).not.toContain('fortschritt.gruppen.map')
  })

  it('der Balken ist in beiden Themes die Farbe „läuft“ (im Dunkeln hell), nicht accent', () => {
    expect(quelle('src/components/mein-hof/zeilen-stil.ts')).toContain("FORTSCHRITT_FUELLUNG = 'h-full bg-zustand-laeuft'")
    const css = quelle('src/app/globals.css')
    // Dunkel ist --fz-zustand-laeuft das helle Grün des Boards (#9FD0AF).
    expect(css).toMatch(/--fz-zustand-laeuft: oklch\(0\.8140 0\.0691 155\.1\); \/\* #9FD0AF \*\//)
    for (const datei of ['src/components/farmer/hofseite-editor.tsx', 'src/components/mein-hof/abschnitte-liste.tsx']) {
      expect(quelle(datei)).toContain('FORTSCHRITT_FUELLUNG')
      expect(quelle(datei)).not.toMatch(/rounded-full bg-accent" style/)
    }
  })

  it('die Vorschau ist eine Karte ohne Gerät drumherum, Handy | Web ohne Symbol', () => {
    const rahmen = quelle('src/components/farmer/hofseite-vorschau-rahmen.tsx')
    expect(rahmen).not.toMatch(/bg-primary-foreground p-2|Smartphone|Monitor|Maximize2/)
    expect(rahmen).toContain("wert === id ? 'bg-foreground text-background'")
  })
})

describe('Postfach (Nr. 274)', () => {
  const seite = quelle('src/app/(hof)/postfach/page.tsx')

  it('der Fußtext mit „Problem melden“ steht auch im leeren Postfach (Abnahme Lauf 32 postfach 2)', () => {
    expect(seite.match(/<Fusstext \/>/g)).toHaveLength(2)
    expect(seite).toContain('<Textlink href={NEUE_MELDUNG_HREF} form="im-satz">\n        {PROBLEM_MELDEN}')
  })

  it('„Alles gelesen“ wörtlich nach Board s2-/w2-postfach Bild 5 (B-Zeile „Leer-Zustand …“)', () => {
    expect(POSTFACH_ALLES_GELESEN).toEqual({
      titel: 'Alles gelesen',
      satz: 'Neue Nachrichten vom Team erscheinen hier und als Karte auf Heute.',
      ausweg: 'Alle Nachrichten zeigen',
    })
  })

  it('der Ladefehler kommt aus ui/ (Nacharbeit 251)', () => {
    expect(seite).toContain("import { LadeFehlerKasten } from '@/components/ui/lade-fehler-kasten'")
    expect(seite).not.toContain('hof-hilfe/lade-fehler-kasten')
  })
})
