'use client'

import { useState, type ReactNode } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { GroessenWahl, Groessenkachel } from '@/components/ui/groessenkachel'
import { Stepper } from '@/components/ui/stepper'
import { ILLUSTRATION_BILD, ILLUSTRATION_HUELLE, PLATZHALTER_FLAECHE } from '@/components/ui/bild-dunkel'
import { DIAGRAMM_BALKEN, DIAGRAMM_LEER, DIAGRAMM_VERGLEICH } from '@/components/ui/diagramm-farbe'
import { RUNDUNG } from '@/components/ui/rundung'
import { positionszeile } from '@/lib/positionszeile'
import { kurznummerAus } from '@/lib/kurznummer'
import { geldsaetzeFuer, type GeldsatzHof } from '@/lib/plattformgebuehr'

/**
 * Einhängepunkt der Nr. 248 (Lauf 32) in der Bausteine-Vorschau: G5 Größenkachel, G12 Bilder im Dunkeln,
 * G13 Stepper und Diagrammfarbe, G14 Positionszeile und Kurznummer, Geldsätze nach V1. Nur diese Datei gehört
 * Nr. 248, nie bausteine-vorschau.tsx. Beispieldaten erfunden; Zeitpunkte fest (kein Hydration-Unterschied).
 */

/** Fester Zeitpunkt nach dem Stichtag — wie die Boards (März 2027). */
const JETZT = new Date('2027-03-03T10:00:00Z')
const EINSTELLUNG = { hofpreisModellAb: new Date('2027-01-31T23:00:00Z') }
/** Ein Gründungshof: letzter Gründungstag 31. Jänner 2028 (gespeichert wie Farm.gruendungBis, Mitternacht UTC). */
const GRUENDUNG_BIS = new Date('2028-01-31T00:00:00Z')
const HOF: GeldsatzHof = { plattformgebuehrProzent: null, einzugAb: null }

const BALKEN = [
  { tag: 'Mo', jetzt: 0, vorher: 40 },
  { tag: 'Di', jetzt: 55, vorher: 35 },
  { tag: 'Mi', jetzt: 80, vorher: 60 },
  { tag: 'Do', jetzt: 30, vorher: 45 },
  { tag: 'Fr', jetzt: 100, vorher: 70 },
]

const POSITIONEN = [
  { name: 'Heumilch frisch', quantity: 4, unit: 'LITER', unitSize: 1 },
  { name: 'Bergkäse', quantity: 2, unit: 'G', unitSize: 250 },
  { name: 'Freilandeier', quantity: 3, unit: 'STUECK', unitSize: null },
]

function Abschnitt248({ id, titel, satz, children }: { id: string; titel: string; satz: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-titel`} className={cn('flex min-w-0 flex-col gap-3 border border-border bg-card p-4 md:p-5', RUNDUNG.karte)}>
      <div>
        <h2 id={`${id}-titel`} className="font-heading text-lg font-semibold">
          {titel}
        </h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{satz}</p>
      </div>
      {children}
    </section>
  )
}

/** Der grüne Kasten unter dem Preis im Produktformular (Board s1-/w1-produkt-neu) — nur zum Ansehen. */
function GeldKasten({ satz, bar }: { satz: string; bar: string | null }) {
  return (
    <div className={cn('flex flex-col gap-0.5 border border-status-fertig/40 bg-status-fertig/10 px-3.5 py-2.5 text-[14px]', RUNDUNG.hinweis)}>
      <p className="font-semibold text-foreground">{satz}</p>
      {bar && <p className="text-muted-foreground">{bar}</p>}
    </div>
  )
}

export function Vorschau248(): React.JSX.Element {
  const [groesse, setGroesse] = useState('sack')
  const [menge, setMenge] = useState(1)

  const gruendungshof = geldsaetzeFuer({ art: 'angebot', positionen: [{ preisCents: 750, menge: 1 }] }, HOF, EINSTELLUNG, GRUENDUNG_BIS, JETZT)
  const ohneGruendung = geldsaetzeFuer({ art: 'angebot', positionen: [{ preisCents: 250, menge: 1 }], ab: true }, HOF, EINSTELLUNG, null, JETZT)
  const online = geldsaetzeFuer(
    { art: 'bestellung', bestellung: { totalAmount: '18.00', serviceFeeCents: 112, paymentMethod: 'ONLINE', gebuehrModell: 'hofpreis', gebuehrEinzug: 'stripe', serviceFeeRefundedAt: null } },
    HOF,
    EINSTELLUNG,
    GRUENDUNG_BIS,
    JETZT
  )
  const barErlassen = geldsaetzeFuer(
    { art: 'bestellung', bestellung: { totalAmount: '16.33', serviceFeeCents: 98, paymentMethod: 'ONSITE_CASH', gebuehrModell: 'hofpreis', gebuehrEinzug: 'erlassen', serviceFeeRefundedAt: null } },
    HOF,
    EINSTELLUNG,
    GRUENDUNG_BIS,
    JETZT
  )

  return (
    <>
      <Abschnitt248 id="groessenkachel-g5" titel="Größenkachel (G5)" satz="Radio links, Name mit Menge, darunter Grundpreis und Vorrat bzw. „gerade nicht da“, Preis rechts — auch die leere Größe zeigt ihren Preis.">
        <GroessenWahl form="zeile" beschriftung="Größe wählen" wert={groesse} onWertChange={setGroesse}>
          <Groessenkachel form="zeile" wert="sack" name="Sack" hinweis="25 kg" preis="€ 12,72" grundpreis="€ 0,51 / kg" vorrat="noch 14" />
          <Groessenkachel form="zeile" wert="bigbag" name="Big Bag" hinweis="500 kg" preis="€ 212,00" grundpreis="€ 0,42 / kg" vorrat="nur noch 2" zustand="knapp" />
          <Groessenkachel form="zeile" wert="lose" name="Lose" hinweis="1 t" preis="€ 371,00" grundpreis="€ 0,37 / kg" vorrat="ausverkauft" zustand="ausverkauft" />
        </GroessenWahl>
      </Abschnitt248>

      <Abschnitt248 id="stepper-g13" titel="Stepper und Diagrammfarbe (G13)" satz="Gerahmte Pille „− n +“ mit Einheit; Balken im Dunkeln helles Mint, der Vergleich leichter, aber sichtbar.">
        <div className="flex flex-wrap items-center gap-4">
          <Stepper form="pille" beschriftung="Menge Heumilch" wert={menge} onWertChange={setMenge} min={1} max={9} einheit="L" />
          <Stepper form="pille" beschriftung="Vorrat Bergkäse" standardWert={3} min={0} gross einheit="Stück" inputMode="numeric" />
        </div>
        <div aria-hidden="true" className="flex h-24 items-end gap-2">
          {BALKEN.map((b) => (
            <div key={b.tag} className="flex h-full flex-1 items-end justify-center gap-0.5">
              <div className={cn('w-full max-w-4 rounded-t-[4px]', DIAGRAMM_VERGLEICH)} style={{ height: `${b.vorher}%` }} />
              <div className={cn('w-full max-w-4 rounded-t-[4px]', b.jetzt > 0 ? DIAGRAMM_BALKEN : DIAGRAMM_LEER)} style={{ height: b.jetzt > 0 ? `${b.jetzt}%` : '3px' }} />
            </div>
          ))}
        </div>
        <p className="text-[13px] text-muted-foreground">Mo–Fr: diese Woche (kräftig) und letzte Woche (leicht).</p>
      </Abschnitt248>

      <Abschnitt248 id="bilder-g12" titel="Bilder im Dunkeln (G12)" satz="Platzhalter ohne Foto auf der gedämpften Fläche, Illustration mit der Fläche multipliziert — kein heller Fleck.">
        <div className="flex flex-wrap gap-3">
          <div className={cn('size-24', PLATZHALTER_FLAECHE, RUNDUNG.karte)} aria-label="Platzhalter ohne Foto" role="img" />
          <div className={cn('size-24 overflow-hidden', PLATZHALTER_FLAECHE, ILLUSTRATION_HUELLE, RUNDUNG.karte)}>
            <Image src="/categories/eier.webp" alt="Illustration Eier" width={96} height={96} className={cn('size-full object-cover', ILLUSTRATION_BILD)} />
          </div>
        </div>
      </Abschnitt248>

      <Abschnitt248 id="positionszeile-g14" titel="Positionszeile und Kurznummer (G14)" satz="Menge fett vorn, Gebinde in Klammern; Kurznummer groß, aus dem Ende derselben ID.">
        <ul className="flex flex-col gap-1 text-[15px]">
          {POSITIONEN.map((p) => {
            const z = positionszeile(p)
            return (
              <li key={p.name}>
                <strong className="font-bold tabular-nums">{z.anzahl}</strong> × {z.name}
                {z.gebinde && <span className="text-muted-foreground"> ({z.gebinde})</span>}
              </li>
            )
          })}
        </ul>
        <p className="text-[15px]">
          Deine Kurznummer: <strong className="font-mono tracking-wide">{kurznummerAus('cmw4fc4j0000beispiel4f8m2q')}</strong>
        </p>
      </Abschnitt248>

      <Abschnitt248 id="geldsaetze-v1" titel="Geldsätze nach V1" satz="Was der Hof bekommt und die Kundin zahlt — Satz aus der Hof-Einstellung, nach dem Stichtag (März 2027).">
        {gruendungshof && <GeldKasten satz={gruendungshof.satz} bar={gruendungshof.barOhneGebuehr} />}
        {ohneGruendung && <GeldKasten satz={ohneGruendung.satz} bar={ohneGruendung.barOhneGebuehr} />}
        {online && <p className="text-[14px]">{online.satz}</p>}
        {barErlassen && <p className="text-[14px]">{barErlassen.satz}</p>}
      </Abschnitt248>
    </>
  )
}
