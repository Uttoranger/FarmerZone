/**
 * Wache (Register N38, Nr. 197, Punkt 7): Im Hofpreis-Modell zeigt keine
 * Kundenansicht einen Produktpreis ohne die Endpreis-Funktion.
 *
 * Jede Datei der Kundenansichten und Kunden-Mails, die einen Preis-Formatierer
 * ruft, nennt eine Endpreis-Funktion bzw. die Preisanzeige
 * (src/lib/plattformgebuehr.ts) — oder steht mit Grund in BESTAND. Der Bestand
 * schrumpft nur: Ein Eintrag, der nicht mehr gebraucht wird, fällt auf.
 * Gegenprobe: ein Schnipsel mit formatEuro(p.price) ohne Endpreis fällt auf.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const WURZEL = process.cwd()

/** Wo Kundinnen Preise sehen: Hofseite, Korb, Produktseite, Kasse, Listen, Bestätigung, Mails, Teilen-Bild. */
const ORDNER = [
  'src/components/hofseite',
  'src/components/farm',
  'src/components/produktdetail',
  'src/components/checkout',
  'src/components/hoefe',
  'src/components/bestaetigung',
  'src/components/startseite',
  'src/emails',
  'src/app/(public)',
]
const EINZELN = ['src/lib/teilen-bild.ts']

const FORMATIERER = /format(Euro|Grundpreis|GrundpreisZeile|Kilopreis)\(|zweitePreiszeile\(|<GrundpreisZeile/
const ENDPREIS = /mitEndpreis|endpreisEuro|anzeigePreisCents|usePreisAnzeige|kassenBetraege|inklPlattformgebuehr|preisAnzeige|gebuehrBezeichnungFuer|gebuehrWort/

/** Dateien mit Preisen, die die Endpreis-Funktion nicht brauchen — je mit Grund. */
const BESTAND: Record<string, string> = {
  'src/components/checkout/stripe-payment.tsx': 'zeigt den Betrag, den /api/checkout an Stripe gab (ZahlungsBetrag) — schon mit Gebühr',
  'src/components/startseite/startseite-abschnitte.tsx': 'Beispielrechnung der Konditionen für Höfe, kein Produktpreis',
  'src/emails/order-cancelled.tsx': 'Storno: erstattete Summe aus dem Snapshot',
  'src/emails/zahlung-zu-spaet.tsx': 'Erstattete Summe aus dem Snapshot',
  'src/lib/teilen-bild.ts': 'bekommt preisCents schon als Endpreis (getPublicFarmMitTeilen, anzeigePreisCents)',
}

function dateienUnter(ordner: string): string[] {
  return readdirSync(ordner).flatMap((n) => {
    const pfad = join(ordner, n)
    return statSync(pfad).isDirectory() ? dateienUnter(pfad) : /\.(ts|tsx)$/.test(n) ? [pfad] : []
  })
}

function maengel(dateien: ReadonlyArray<{ datei: string; text: string }>, bestand: Record<string, string>): string[] {
  return dateien
    .filter(({ datei, text }) => FORMATIERER.test(text) && !ENDPREIS.test(text) && !(datei in bestand))
    .map(({ datei }) => `${datei}: Preis ohne Endpreis-Funktion (mitEndpreis, anzeigePreisCents …) — oder mit Grund in BESTAND`)
}

const ALLE = [...ORDNER.flatMap((o) => dateienUnter(join(WURZEL, o))), ...EINZELN.map((d) => join(WURZEL, d))].map((pfad) => ({
  datei: relative(WURZEL, pfad).split(sep).join('/'),
  text: readFileSync(pfad, 'utf8'),
}))

describe('Wache: Kundenansichten zeigen im Hofpreis-Modell den Endpreis', () => {
  it('jede Datei mit Preis-Formatierer nennt die Endpreis-Funktion oder steht mit Grund im Bestand', () => {
    expect(maengel(ALLE, BESTAND)).toEqual([])
  })

  it('der Bestand schrumpft nur: jeder Eintrag zeigt noch Preise ohne Endpreis-Funktion', () => {
    const veraltet = Object.keys(BESTAND).filter((d) => {
      const datei = ALLE.find((a) => a.datei === d)
      return !datei || !FORMATIERER.test(datei.text) || ENDPREIS.test(datei.text)
    })
    expect(veraltet).toEqual([])
  })

  it('Gegenprobe: formatEuro(p.price) ohne Endpreis fällt auf, mit mitEndpreis nicht', () => {
    const ohne = { datei: 'src/components/hofseite/neu.tsx', text: 'export const P = ({ p }) => formatEuro(p.price)' }
    const mit = { datei: 'src/components/hofseite/neu.tsx', text: 'const q = mitEndpreis(p, a); export const P = () => formatEuro(q.price)' }
    expect(maengel([ohne], BESTAND)).toHaveLength(1)
    expect(maengel([mit], BESTAND)).toEqual([])
  })
})
