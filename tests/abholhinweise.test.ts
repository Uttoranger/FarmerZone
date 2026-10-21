/**
 * Abholhinweise (Register N23, Nr. 123): EINE Quelle für Werte, Wörter und
 * Symbole (src/lib/abholhinweise.ts), das Zod-Feld (höchstens drei, keine
 * Doppelten, Standard leer) und alle Einstiege, die das Feld tragen — neues
 * Futter (FutterFormular → legeFutterFamilieAn), Bearbeiten (Produktdialog →
 * updateProduct) und jede Größe einer neuen Familie. Das Schreiben selbst
 * prüfen tests/products-action.test.ts, tests/produktfamilie-aktion.test.ts
 * und tests/integration/abholhinweise.int.test.ts.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { $Enums } from '@prisma/client'
import { ABHOLHINWEIS_TEXT, ABHOLHINWEIS_VALUES, ABHOLUNG_ABSCHNITT, ordneAbholhinweise, schalteAbholhinweis } from '@/lib/abholhinweise'
import { ABHOLHINWEIS_DOPPELT, abholhinweiseSchema, productFormSchema } from '@/schemas/product'
import { AbholhinweisWahl } from '@/components/produkte/familien-teile'

const lies = (datei: string) => fs.readFileSync(path.resolve(__dirname, '..', datei), 'utf8')

describe('Eine Quelle', () => {
  it('die Werte spiegeln das Prisma-Enum in derselben Reihenfolge', () => {
    expect([...ABHOLHINWEIS_VALUES]).toEqual(Object.values($Enums.Abholhinweis))
  })

  it('die Wörter der Wortliste', () => {
    expect(ABHOLHINWEIS_TEXT).toEqual({
      ANHAENGER_NOETIG: 'Anhänger nötig',
      FRONTLADER: 'Verladen mit Frontlader',
      NACH_ABSPRACHE: 'Abholung nach Absprache',
    })
  })

  it('an- und abwählen hält die Folge der Auswahl, ordnen entfernt Doppelte', () => {
    expect(schalteAbholhinweis(['NACH_ABSPRACHE'], 'ANHAENGER_NOETIG')).toEqual(['ANHAENGER_NOETIG', 'NACH_ABSPRACHE'])
    expect(schalteAbholhinweis(['ANHAENGER_NOETIG', 'NACH_ABSPRACHE'], 'ANHAENGER_NOETIG')).toEqual(['NACH_ABSPRACHE'])
    expect(ordneAbholhinweise(['FRONTLADER', 'ANHAENGER_NOETIG', 'FRONTLADER'])).toEqual(['ANHAENGER_NOETIG', 'FRONTLADER'])
  })
})

describe('Zod-Feld', () => {
  it('nimmt die Werte, ohne Angabe die leere Liste', () => {
    expect(abholhinweiseSchema.parse(['FRONTLADER', 'ANHAENGER_NOETIG'])).toEqual(['FRONTLADER', 'ANHAENGER_NOETIG'])
    expect(abholhinweiseSchema.parse(undefined)).toEqual([])
  })

  it('weist Doppelte mit einem deutschen Satz ab', () => {
    const ergebnis = abholhinweiseSchema.safeParse(['FRONTLADER', 'FRONTLADER'])
    expect(ergebnis.success).toBe(false)
    expect(ergebnis.error?.issues[0]?.message).toBe(ABHOLHINWEIS_DOPPELT)
  })

  it('weist einen Wert außerhalb der Liste ab („staubarm" gibt es nicht, Freigabe §1 Abweichung 6)', () => {
    expect(abholhinweiseSchema.safeParse(['STAUBARM']).success).toBe(false)
    expect(abholhinweiseSchema.safeParse('ANHAENGER_NOETIG').success).toBe(false)
  })

  it('steht im Produktschema (das Familienschema prüft tests/produktfamilie-aktion.test.ts über die Aktion)', () => {
    expect(productFormSchema.safeParse({ name: 'Eier', price: 3, unit: 'STUECK', category: 'EIER', abholhinweise: ['STAUBARM'] }).success).toBe(false)
    const ohne = productFormSchema.parse({ name: 'Eier', price: 3, unit: 'STUECK', category: 'EIER' })
    expect(ohne.abholhinweise).toEqual([])
  })
})

describe('Alle Einstiege tragen das Feld', () => {
  it('neues Futter: das Formular schickt die Wahl an legeFutterFamilieAn und zeigt den Abschnitt „Abholung"', () => {
    const formular = lies('src/components/produkte/futter-formular.tsx')
    expect(formular).toMatch(/abholhinweise,\n\s*kennzeichnung,/)
    expect(formular).toContain('<AbholhinweisWahl wert={abholhinweise} onWert={setAbholhinweise} />')
    expect(formular).toContain('legeFutterFamilieAn(eingabe)')
  })

  it('Bearbeiten: der Produktdialog belegt das Feld aus dem Produkt vor und zeigt denselben Abschnitt', () => {
    const dialog = lies('src/components/products/product-dialog.tsx')
    expect(dialog).toContain('abholhinweise: p.abholhinweise,')
    expect(dialog).toContain('abholhinweise: [],')
    expect(dialog).toMatch(/name="abholhinweise"[\s\S]{0,200}<AbholhinweisWahl wert=\{field\.value \?\? \[\]\} onWert=\{field\.onChange\} \/>/)
  })

  it('jede Größe einer neuen Familie übernimmt die Hinweise der Familie; Lesen für Liste und Produktseite', () => {
    expect(lies('src/server/actions/produktfamilie.ts')).toContain('abholhinweise: abholhinweiseDaten(v.category, v.abholhinweise),')
    expect(lies('src/server/actions/products.ts')).toContain('abholhinweise: abholhinweiseDaten(v.category ?? null, v.abholhinweise),')
    expect(lies('src/server/queries/products.ts')).toContain('abholhinweise: p.abholhinweise,')
    expect(lies('src/server/queries/farm.ts')).toMatch(/abholhinweise: true,/)
  })
})

describe('Der Abschnitt „Abholung"', () => {
  it('drei Ankreuzfelder als Chips in fieldset/legend, darunter der Satz zur Abholzeit', () => {
    const html = renderToStaticMarkup(createElement(AbholhinweisWahl, { wert: ['FRONTLADER'], onWert: () => undefined }))
    expect(html).toMatch(/<fieldset[^>]*><legend[^>]*>Abholung<\/legend>/)
    expect(html.match(/type="checkbox"/g)).toHaveLength(3)
    expect(html.match(/checked=""/g)).toHaveLength(1)
    for (const text of Object.values(ABHOLHINWEIS_TEXT)) expect(html).toContain(text)
    expect(html).toContain(ABHOLUNG_ABSCHNITT.satz)
    expect(html).toContain('min-h-11')
  })
})
