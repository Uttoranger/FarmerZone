/**
 * Tests für den Hofseiten-Editor im Browser — am Quelltext, weil die
 * Node-Umgebung nichts rendert (TESTING_GUIDELINES §1).
 *
 * Beweist:
 *  - /farm-page zeigt unter lg die alte Hofseite mit Stiften und ab lg den
 *    Editor — der Kopf steht nur einmal.
 *  - Der Kopf von Mein Hof hat zwei Fassungen: die Karte unter lg, die
 *    kompakte Zeile ab lg mit genau zwei Knöpfen (Teilen, Kundenansicht in
 *    neuem Tab).
 *  - „Hofseite ansehen" in der Seitenleiste entfällt ab lg.
 *  - Der Editor speichert nur über die vorhandenen Aktionen aus farm.ts und
 *    appearance.ts — keine neue Server-Aktion.
 *  - Die Vorschau ist die echte Hofseite im Vorschau-Modus, 390 px breit,
 *    und die Markierung geht nur an den eigenen Ursprung.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { hofseiteStand } from '@/lib/hofseite-fortschritt'

const quelltext = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')

describe('/farm-page', () => {
  const seite = quelltext('src/app/(farmer)/farm-page/page.tsx')

  it('unter lg die alte Hofseite, ab lg der Editor', () => {
    expect(seite).toMatch(/<div className="lg:hidden">\s*<FarmPageClient/)
    expect(seite).toMatch(/<div className="hidden px-8 pb-12 lg:block">\s*<HofseiteEditor/)
  })

  it('der Kopf steht genau einmal', () => {
    expect(seite.match(/<MeinHofKopf /g)).toHaveLength(1)
  })

  it('der Editor bekommt keinen ganzen Hof mit Date oder Decimal, nur seine Felder', () => {
    expect(seite).not.toMatch(/<HofseiteEditor[^>]*\shof=\{farm\}/)
    expect(seite).toContain('bannerFocusY: farm.bannerFocusY')
  })
})

describe('Kopf von Mein Hof', () => {
  const kopf = quelltext('src/components/farmer/mein-hof-kopf.tsx')

  it('die Karte mit Streifen nur unter lg, die kompakte Zeile nur ab lg', () => {
    expect(kopf).toMatch(/dark:ring-border lg:hidden/)
    expect(kopf).toMatch(/dark:ring-border lg:flex/)
  })

  it('die kompakte Zeile: Teilen und Kundenansicht in neuem Tab, nur wenn öffentlich', () => {
    const zeile = kopf.slice(kopf.indexOf('Ab lg: eine kompakte Zeile'), kopf.indexOf('<nav aria-label="Mein Hof"'))
    expect(zeile).toContain('{hof.zustand.oeffentlich && (')
    expect(zeile).toContain('label="Teilen"')
    expect(zeile).toMatch(/target="_blank"[^>]*>\s*Kundenansicht/)
    expect(zeile.match(/<Link /g)).toHaveLength(1)
    expect(zeile.match(/<HofTeilenKnopf /g)).toHaveLength(1)
  })

  it('die Zahl am Reiter „Beiträge" nur ab lg — unter lg bleibt der Reiter, wie er war', () => {
    expect(kopf).toMatch(/reiter\.id === 'beitraege' && beitraegeZahl != null && \(\s*<span className="hidden lg:inline"/)
  })
})

describe('Seitenleiste', () => {
  it('„Hofseite ansehen" entfällt ab lg', () => {
    const karte = quelltext('src/components/farmer/farm-identity-card.tsx')
    expect(karte).toMatch(/href="\/farm-page"\s*className="[^"]*\blg:hidden\b/)
  })
})

describe('Editor', () => {
  const editor = quelltext('src/components/farmer/hofseite-editor.tsx')

  it('speichert nur über die vorhandenen Aktionen', () => {
    const aktionen = [...editor.matchAll(/from '@\/server\/actions\/([a-z-]+)'/g)].map((m) => m[1])
    expect(aktionen.toSorted()).toEqual(['appearance', 'farm'])
  })

  it('reicht das ganze Profil und den ganzen Auftritt mit — die Zeile ändert nur ihre Felder', () => {
    expect(editor).toContain('updateProfile({ ...profilBasis(einstellungen), ...teil })')
    expect(editor).toMatch(/saveAppearanceAction\(\{ \.\.\.auftrittBasis\(auftritt\), aboutText/)
    expect(editor).toMatch(/saveAppearanceAction\(\{ \.\.\.auftrittBasis\(auftritt\), sectionsConfig/)
  })

  it('schickt Logo und Titelbild nicht mit — die lädt der Editor über eigene Aktionen, die Props wären veraltet', () => {
    const basis = editor.slice(editor.indexOf('function auftrittBasis'), editor.indexOf('// ── Formular-Bausteine'))
    expect(basis).not.toMatch(/bannerType|bannerUrl|bannerValue|logoUrl/)
  })

  it('prüft die Felder mit den Schemas der Aktionen selbst, nicht mit einer Abschrift', () => {
    expect(editor).toContain("from '@/schemas/hofprofil'")
    expect(editor).toContain("from '@/schemas/auftritt'")
    expect(editor.match(/profileSchema\.pick\(/g)).toHaveLength(3)
    expect(editor).toContain('appearanceSchema.pick({ aboutText: true })')
    expect(editor).not.toMatch(/z\.object\(/)
  })

  it('nur eine Zeile offen zugleich, und die geht an die Vorschau', () => {
    expect(editor).toContain("setOffen((jetzt) => (jetzt === zeile.id ? null : zeile.id))")
    expect(editor).toMatch(/<HofseiteVorschauRahmen slug=\{hof\.slug\} stand=\{stand\} markiert=\{offen\} \/>/)
  })
})

describe('Vorschau-Rahmen', () => {
  const rahmen = quelltext('src/components/farmer/hofseite-vorschau-rahmen.tsx')

  it('390 px breite Seite, verkleinert in den Rahmen; die Markierung nur an den eigenen Ursprung', () => {
    expect(rahmen).toContain('const SEITEN_BREITE = 390')
    // Der erste Stand im src, jeder weitere per location.replace — sonst
    // legte jedes Speichern einen Eintrag im Browserverlauf an.
    expect(rahmen).toMatch(/src=\{vorschauAdresse\(slug, anfang\)\}/)
    expect(rahmen).toContain('location.replace(vorschauAdresse(slug, stand))')
    expect(rahmen.match(/postMessage\([^)]*window\.location\.origin\)/g)).toHaveLength(1)
    expect(rahmen).not.toMatch(/postMessage\([^)]*'\*'/)
  })

  it('schickt die Markierung nach dem Laden noch einmal — auf die Bereit-Meldung der eigenen Seite, nicht auf onLoad', () => {
    expect(rahmen).not.toContain('onLoad=')
    expect(rahmen).toContain('leseBereit(ereignis, window.location.origin)')
    expect(rahmen).toContain('ereignis.source !== rahmen.current?.contentWindow')
    const empfaenger = quelltext('src/components/farm/vorschau-im-rahmen.tsx')
    expect(empfaenger).toMatch(/window\.parent\.postMessage\(\{ typ: BEREIT_TYP \}, window\.location\.origin\)/)
    // Das eigene Fenster scrollen, nicht scrollIntoView — das zöge die Editor-Seite mit.
    expect(empfaenger).not.toMatch(/\.scrollIntoView\(/)
    expect(empfaenger).toContain('window.scrollTo(')
  })
})

describe('hofseiteStand', () => {
  it('bildet Hofseite und Kartenpunkt auf den Stand ab', () => {
    const stand = hofseiteStand(
      {
        name: 'Hof Test',
        description: 'Gemüse aus Musterdorf',
        aboutText: null,
        logoUrl: null,
        bannerType: 'GRADIENT',
        bannerUrl: null,
        farmPhotos: [{}, {}],
        address: 'Musterweg 1',
        postalCode: '4900',
        city: 'Musterdorf',
        pickupSlots: [{ dayOfWeek: 6, startTime: '09:00', endTime: '12:00' }],
        acceptsOnline: false,
        stripeAccountReady: false,
        phone: '+43 660 0000000',
        email: 'hof@example.com',
        isPaused: true,
        sectionsConfig: [{ key: 'products', visible: true, order: 1 }],
      },
      { latitude: 48.2, longitude: 13.4 }
    )
    expect(stand).toMatchObject({ fotos: 2, hatKoordinaten: true, isPaused: true, name: 'Hof Test' })
    expect(stand.abholzeiten).toHaveLength(1)
    expect(hofseiteStand({ ...standOhnePunkt(), farmPhotos: [] }, { latitude: null, longitude: 13.4 }).hatKoordinaten).toBe(false)
  })
})

function standOhnePunkt() {
  return {
    name: 'Hof Test',
    description: '',
    aboutText: null,
    logoUrl: null,
    bannerType: 'GRADIENT',
    bannerUrl: null,
    farmPhotos: [],
    address: '',
    postalCode: '',
    city: '',
    pickupSlots: [],
    acceptsOnline: false,
    stripeAccountReady: false,
    phone: '',
    email: '',
    isPaused: false,
    sectionsConfig: [],
  }
}
