/**
 * Der Fehler aus JAVASCRIPT-NEXTJS-4: foto-quellen.tsx leerte das Datei-Feld
 * im onChange — unmittelbar nach der Auswahl und damit BEVOR die Datei gelesen
 * war. Android-Chrome zieht damit die Leseerlaubnis für ein Foto aus der
 * Galerie zurück: Probe und Volllesen scheiterten nach 84 und 14 ms mit
 * NotReadableError, bei einem Foto, das 0 Tage alt war.
 *
 * Geprüft wird die Reihenfolge, die src/lib/foto-feld.ts festhält: Geleert wird
 * beim Klick, gelesen wird nach der Auswahl. Ein Rendering-Test ist in dieser
 * Umgebung nicht möglich (TESTING_GUIDELINES §1: `node`, kein jsdom) — die
 * Verdrahtung in den Bauteilen hält deshalb je ein Quelltext-Test fest, nach
 * dem Muster aus tests/upload-lesen.test.ts.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { dateienAusFeld, leereDateiFeld, type DateiFeld } from '@/lib/foto-feld'

/** Ein Datei-Feld wie der Browser es hält: `value` der Anzeigename, `files` die Auswahl. */
function feld(): DateiFeld {
  return { value: '', files: null }
}

/** Die Auswahl des Nutzers im Auswahldialog — Browser setzen beides zusammen. */
function waehle(f: DateiFeld, name: string): File {
  const datei = { name, type: 'image/jpeg', size: 6_000_000 } as unknown as File
  f.files = [datei]
  f.value = `C:\\fakepath\\${name}`
  return datei
}

function quelltext(datei: string): string {
  return fs.readFileSync(path.resolve(__dirname, '..', datei), 'utf8')
}

describe('Datei-Feld — geleert wird beim Klick, nicht nach der Auswahl', () => {
  it('lässt den Wert nach der Auswahl stehen: nichts entwertet die Datei', () => {
    const f = feld()
    waehle(f, 'stall.jpg')

    const dateien = dateienAusFeld(f)

    expect(dateien).toHaveLength(1)
    expect(f.value).toBe('C:\\fakepath\\stall.jpg')
  })

  it('leert den Wert erst beim nächsten Klick — vor dem Auswahldialog', () => {
    const f = feld()
    waehle(f, 'stall.jpg')
    dateienAusFeld(f)

    leereDateiFeld(f)

    expect(f.value).toBe('')
  })

  it('lässt dieselbe Datei zweimal hintereinander wählen', () => {
    // Der Grund, aus dem früher sofort geleert wurde: Ein Feld, in dem noch
    // derselbe Name steht, feuert kein `change`. Das Leeren beim Klick erhält
    // diese Eigenschaft — nur eben, ohne die Auswahl zu entwerten.
    const f = feld()

    leereDateiFeld(f)
    const erste = waehle(f, 'stall.jpg')
    expect(dateienAusFeld(f)).toEqual([erste])

    leereDateiFeld(f)
    expect(f.value).toBe('')
    const zweite = waehle(f, 'stall.jpg')

    expect(dateienAusFeld(f)).toEqual([zweite])
  })

  it('gibt eine leere Liste heraus, wo der Nutzer abgebrochen hat', () => {
    expect(dateienAusFeld(feld())).toEqual([])
    expect(dateienAusFeld({ value: '' })).toEqual([])
  })

  it('reicht mehrere Dateien einer Serie unverändert durch', () => {
    const a = { name: 'a.jpg' } as unknown as File
    const b = { name: 'b.jpg' } as unknown as File

    expect(dateienAusFeld({ value: 'x', files: [a, b] })).toEqual([a, b])
  })
})

describe('Verdrahtung in den Bauteilen', () => {
  it('leert in foto-quellen.tsx beim Klick und fasst die Auswahl nicht an', () => {
    const text = quelltext('src/components/shared/foto-quellen.tsx')

    // Das Leeren hängt am Klick — dreimal: Foto wählen, Foto aufnehmen, Rettung.
    expect(text.match(/onClick=\{vorAuswahl\}/g)).toHaveLength(3)
    expect(text).toContain('leereDateiFeld(e.currentTarget)')
    // Und nirgends mehr am Ereignis der Auswahl.
    expect(text).not.toMatch(/\.(?:target|currentTarget)\.value\s*=/)
  })

  it('hängt die Galerie nach einem neuen Foto nicht neu auf', () => {
    // Der key-Wechsel baute GallerySection nach JEDEM hinzugefügten Foto neu
    // auf — mitten in einer Serie, deren restliche Fotos noch am ausgehängten
    // Feld hingen. Die Reihenfolge stellt der Effekt auf farm.farmPhotos
    // richtig; ein Neuaufbau ist dafür nicht nötig.
    const text = quelltext('src/components/farm/farm-page-view.tsx')

    expect(text).not.toContain('key={`gallery-')
    expect(text).not.toContain('onPhotoAdded')
  })

  it('lässt die Datei-Felder der Meldung stehen, auch wenn ein Bildschirmfoto ankommt', () => {
    const text = quelltext('src/components/shared/meldung-form.tsx')

    expect(text.match(/\{upload\.fileInput\}/g)).toHaveLength(1)
    expect(text.indexOf('{upload.fileInput}')).toBeLessThan(text.indexOf('{screenshotUrl ?'))
  })

  it('hält die Datei-Felder des Produktdialogs außerhalb des Akkordeons', () => {
    // Base UI hängt einen geschlossenen Abschnitt aus dem DOM aus
    // (keepMounted ist standardmäßig false). Im Produktdialog wird die Datei
    // erst beim Absenden gelesen — ein zugeklapptes „Grunddaten" hätte das
    // Feld bis dahin ausgehängt, und das ist dasselbe Muster wie das Leeren.
    const text = quelltext('src/components/products/product-dialog.tsx')

    expect(text.indexOf('{fotoQuellen.elemente}')).toBeGreaterThan(-1)
    expect(text.indexOf('{fotoQuellen.elemente}')).toBeLessThan(text.indexOf('<Accordion'))
  })
})
