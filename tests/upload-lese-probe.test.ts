/**
 * Tests für die Lese-Probe (canReadFile in src/components/shared/image-upload.tsx).
 *
 * Sie ist die erste der drei Stufen und der Grund dieses Sprints: Bis dahin
 * fasste NIEMAND die Bytes an, bevor über die Datei geurteilt wurde. `file.size`
 * ist ein Metadatum des Datei-Handles — es kommt aus der Verzeichnisauskunft des
 * Speicheranbieters und ist auch dann gefüllt, wenn hinter der Referenz nichts
 * mehr steht. Ein Android-Speicherdienst, der nichts herausgibt, konnte sich
 * deshalb nur als img.onerror äußern, und das ist dasselbe Signal wie
 * „Format unbekannt".
 *
 * Prüfbar ohne Browser, weil der Lesezugriff als `DateiLeser` eingesetzt wird.
 * Genau die drei Ausgänge, auf die es ankommt:
 *   liefert Bytes  → lesbar
 *   wirft          → nicht lesbar
 *   liefert leer   → nicht lesbar
 * Dazu der vierte, der kein Ausgang sein darf: Schnittstelle fehlt → kein Urteil.
 */
import { describe, it, expect, vi } from 'vitest'
import { canReadFile, LESE_PROBE_BYTES, type DateiLeser } from '@/components/shared/image-upload'

/** Eine Datei-Attrappe — der eingesetzte Leser schaut ohnehin nicht hinein. */
const DATEI = { name: 'hof.jpg', type: 'image/jpeg', size: 2_000_000 } as unknown as File

const puffer = (bytes: number) => new ArrayBuffer(bytes)

describe('canReadFile', () => {
  it('gilt als lesbar, wenn der Lesezugriff Bytes liefert', async () => {
    const lies: DateiLeser = async () => puffer(65536)

    expect(await canReadFile(DATEI, lies)).toBe(true)
  })

  it('gilt als NICHT lesbar, wenn der Lesezugriff wirft', async () => {
    // Der gemeldete Android-Fall: Der Speicherdienst gibt beim Zugriff nichts
    // heraus und meldet einen NotReadableError.
    const lies: DateiLeser = async () => {
      throw new Error('NotReadableError: Could not read file')
    }

    expect(await canReadFile(DATEI, lies)).toBe(false)
  })

  it('gilt als NICHT lesbar, wenn der Lesezugriff nichts liefert', async () => {
    // Nicht jeder Anbieter wirft — manche geben still einen leeren Puffer
    // zurück. Ohne die Längenprüfung ginge das als „lesbar" durch.
    const lies: DateiLeser = async () => puffer(0)

    expect(await canReadFile(DATEI, lies)).toBe(false)
  })

  it('urteilt NICHT, wenn die Schnittstelle fehlt', async () => {
    // Safari vor 14 kennt Blob.arrayBuffer nicht. Eine fehlende Schnittstelle
    // ist kein Beweis für eine unlesbare Datei — sonst bekämen alte Geräte
    // pauschal die neue Meldung, obwohl bei ihnen alles funktioniert.
    const lies: DateiLeser = async () => null

    expect(await canReadFile(DATEI, lies)).toBe(true)
  })

  it('fordert nur den Anfang der Datei an, nicht das ganze Foto', async () => {
    // Es geht nicht um den Inhalt, sondern darum, OB der Speicher etwas
    // herausgibt. Ein 12-MP-Foto dafür in den Speicher zu ziehen wäre
    // Verschwendung — auf einem Telefon spürbare.
    const lies = vi.fn<DateiLeser>(async () => puffer(1024))

    await canReadFile(DATEI, lies)

    expect(lies).toHaveBeenCalledTimes(1)
    expect(lies).toHaveBeenCalledWith(DATEI, LESE_PROBE_BYTES)
    expect(LESE_PROBE_BYTES).toBe(65536)
  })

  it('fängt auch eine abgelehnte Zusage ab, die keinen Error trägt', async () => {
    const lies: DateiLeser = () => Promise.reject('kaputt')

    expect(await canReadFile(DATEI, lies)).toBe(false)
  })
})
