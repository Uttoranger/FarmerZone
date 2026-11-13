/**
 * Kein Hof-Code im Paket der Hofseite (Nr. 306).
 *
 * `scripts/pruefung/paket-hofseite.mjs` läuft in der CI nach „Build“: Es liest das
 * Client-Manifest der Hofseite, sammelt deren Chunks und schlägt an, sobald einer eine
 * Marke des toten Bearbeitungsmodus trägt (dnd-kit, Produktbild-Knopf, Titelbild-Knopf).
 * Geprüft wird hier der reine Teil: Marken im Text finden und das Manifest lesen —
 * jeweils mit Gegenprobe (TESTING_GUIDELINES §2). Kein Build nötig.
 */
import { describe, expect, it } from 'vitest'
import { MARKEN, chunksAusManifest, findeMarken, leseManifest } from '../scripts/pruefung/paket-hofseite.mjs'

/** Ein Manifest in der Form, die `next build` schreibt (Next 16), mit erfundenen Chunk-Namen. */
const MANIFEST = [
  'globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {};',
  'globalThis.__RSC_MANIFEST["/(public)/[farmSlug]/page"] = ' +
    JSON.stringify({
      moduleLoading: { prefix: '' },
      clientModules: {
        '[project]/a.js': { id: 1, name: '*', chunks: ['/_next/static/chunks/aaa.js', '/_next/static/chunks/bbb.js'], async: false },
        '[project]/b.js': { id: 2, name: '*', chunks: ['/_next/static/chunks/bbb.js', '/_next/static/chunks/ccc.js'], async: false },
      },
    }) +
    ';',
].join('\n')

describe('findeMarken', () => {
  it('schlägt bei „DndDescribedBy“ an (dnd-kit im Paket)', () => {
    expect(findeMarken('var a="DndDescribedBy-"+n;')).toEqual(['DndDescribedBy'])
  })

  it('findet auch die Texte der zwei Bild-Knöpfe', () => {
    expect(findeMarken('toast.success("Produktbild aktualisiert");x("Titelbild ersetzen")')).toEqual([
      'Produktbild aktualisiert',
      'Titelbild ersetzen',
    ])
  })

  it('bleibt bei einem Text ohne Marke leer', () => {
    expect(findeMarken('In den Warenkorb · Titelbild · Produktbild')).toEqual([])
  })

  it('kennt genau die drei Marken aus dem Auftrag', () => {
    expect([...MARKEN]).toEqual(['DndDescribedBy', 'Produktbild aktualisiert', 'Titelbild ersetzen'])
  })
})

describe('leseManifest und chunksAusManifest', () => {
  it('liest das Manifest und gibt jeden Chunk einmal zurück, als Pfad unter .next/', () => {
    expect(chunksAusManifest(leseManifest(MANIFEST))).toEqual([
      'static/chunks/aaa.js',
      'static/chunks/bbb.js',
      'static/chunks/ccc.js',
    ])
  })

  it('führt den Text des Manifests nicht im eigenen Kontext aus', () => {
    leseManifest(MANIFEST)
    expect((globalThis as { __RSC_MANIFEST?: unknown }).__RSC_MANIFEST).toBeUndefined()
  })

  it('leeres Manifest ist ein Fehler, kein stilles Grün', () => {
    expect(() => chunksAusManifest(leseManifest(''))).toThrow(/Manifest/)
  })

  it('Manifest ohne Chunks ist ein Fehler', () => {
    const ohneChunks = 'globalThis.__RSC_MANIFEST = { "/x/page": { clientModules: {} } };'
    expect(() => chunksAusManifest(leseManifest(ohneChunks))).toThrow(/keine Chunks/)
  })

  it('ein Manifest, das beim Ausführen wirft, ist ein Fehler mit klarer Meldung', () => {
    expect(() => leseManifest('throw new Error("kaputt")')).toThrow(/Manifest nicht lesbar/)
  })

  it('ein Chunk außerhalb von /_next/static/ ist ein Fehler (kein Pfad aus dem Ordner hinaus)', () => {
    const fremd = 'globalThis.__RSC_MANIFEST = { "/x/page": { clientModules: { a: { chunks: ["/_next/../../etc/passwd"] } } } };'
    expect(() => chunksAusManifest(leseManifest(fremd))).toThrow(/Chunk/)
  })
})
