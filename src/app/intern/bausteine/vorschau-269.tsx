'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Kaestchen } from '@/components/ui/kaestchen'
import { Hinweiskasten, HINWEISKASTEN_LINK } from '@/components/ui/hinweiskasten'
import { LadeFehlerKasten } from '@/components/ui/lade-fehler-kasten'
import { WerkzeugKopf } from '@/components/ui/werkzeug-kopf'
import { RUNDUNG } from '@/components/ui/rundung'
import { FELD, FELD_LABEL, KNOPF_ORANGE, KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'

/**
 * Einhängepunkt der Nr. 269 (Lauf 33) in der Bausteine-Vorschau: Rückweg der Mehr-Blatt-Seiten am Handy (G1-Rest),
 * Hinweiskasten im Warnton (G3), Umriss-Knopf, Feld und Beschriftung nach Board, LadeFehlerKasten aus ui/ und das
 * Kästchen (A-8). Nur diese Datei gehört Nr. 269, nie bausteine-vorschau.tsx. Beispieldaten erfunden.
 */

function Abschnitt269({ id, titel, satz, children }: { id: string; titel: string; satz: string; children: ReactNode }) {
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

export function Vorschau269(): React.JSX.Element {
  const [ladefehler, setLadefehler] = useState(false)
  const [kanaele, setKanaele] = useState({ hofseite: true, mail: false })

  return (
    <>
      <Abschnitt269
        id="rueckweg-mehr-269"
        titel="Rückweg der Mehr-Blatt-Seiten (G1)"
        satz="Kunden, Verkäufe, Auswertung und Postfach haben am Handy „‹“ zurück nach „Mehr“ (Ziel Heute), Meine Meldungen nach „Problem melden“; im Web kein Textlink. Die Leiste steht am Handy fest oben — hier im Kasten scrollen."
      >
        {/* transform-gpu macht den äußeren Kasten zum Bezug der festen Leiste (sonst stünde sie am Fenster). */}
        <div className={cn('relative h-56 transform-gpu overflow-hidden border border-border', RUNDUNG.karte)}>
          <div className="h-full overflow-y-auto bg-background px-4 pt-5 md:px-8 md:pt-8">
            <header>
              <WerkzeugKopf pfad="/customers" titel="Kunden" unterzeile={<p className="text-[13px] text-muted-foreground">Hof Müller · Stand Mittwoch</p>} />
              <p className="text-[13px] text-muted-foreground">Kopf in einem eigenen header wie auf den Werkzeug-Seiten.</p>
            </header>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={cn('mt-3 h-20 border border-border bg-card', RUNDUNG.karte)} />
            ))}
          </div>
        </div>
      </Abschnitt269>

      <Abschnitt269 id="hinweiskasten-269" titel="Hinweiskasten im Warnton (G3)" satz="Titel und Satz im selben Warnton auf der braun getönten Fläche (≥ 4,5:1 in beiden Themes).">
        <Hinweiskasten
          titel="Dein Hof wird noch geprüft"
          aktion={
            <Link href="/intern/bausteine#hinweiskasten-269" className={HINWEISKASTEN_LINK}>
              Frage zur Freischaltung stellen
            </Link>
          }
        >
          <p>Bis dahin sieht deine Kundschaft den Hof noch nicht. Du kannst schon alles einrichten.</p>
        </Hinweiskasten>
      </Abschnitt269>

      <Abschnitt269
        id="knopf-feld-269"
        titel="Umriss-Knopf, Feld und Beschriftung"
        satz="Umriss 52 px, 15 px fett, Rand 1,5 px in Textfarbe (wie „So geht’s“ auf Heute); Feld 48 px mit Feldrand und 10 px Rundung; Beschriftung 15 px halbfett in Textfarbe."
      >
        <div className="flex flex-wrap gap-2">
          <button type="button" className={KNOPF_RAHMEN}>
            Teilen
          </button>
          <button type="button" className={KNOPF_ORANGE}>
            Verkauf eintragen
          </button>
        </div>
        <div className="max-w-sm">
          <label htmlFor="vorschau-269-feld" className={FELD_LABEL}>
            Straße und Hausnummer
          </label>
          <input id="vorschau-269-feld" name="strasse" defaultValue="Dorfstraße 1" className={FELD} />
        </div>
      </Abschnitt269>

      <Abschnitt269
        id="ladefehler-269"
        titel="LadeFehlerKasten (ui/)"
        satz="Orange Kasten mit Titel, Satz und dem Ausweg als Link über die volle Breite; der Fokus springt beim Einhängen auf den Ausweg — deshalb hier erst auf Knopfdruck."
      >
        {ladefehler ? (
          <LadeFehlerKasten titel="Kunden konnten nicht geladen werden" nochmal="/intern/bausteine#ladefehler-269" />
        ) : (
          <button type="button" onClick={() => setLadefehler(true)} className={cn(KNOPF_RAHMEN, 'w-fit')}>
            Ladefehler zeigen
          </button>
        )}
      </Abschnitt269>

      <Abschnitt269
        id="kaestchen-a8"
        titel="Kästchen (A-8)"
        satz="Natives Kästchen mit eigenen Tokens: Rand ≥ 3:1, angehakt grün mit hellem Haken (≥ 4,5:1), Trefferfläche 44 px, Fokusrahmen; Feldfehler mit orangem Rand."
      >
        <div className="flex flex-col gap-1">
          <label className="flex min-h-11 items-center gap-3 text-[15px]">
            <Kaestchen name="kanal" value="hofseite" checked={kanaele.hofseite} onChange={(e) => setKanaele((k) => ({ ...k, hofseite: e.target.checked }))} />
            Auf meiner Hofseite anzeigen
          </label>
          <label className="flex min-h-11 items-center gap-3 text-[15px]">
            <Kaestchen name="kanal" value="mail" checked={kanaele.mail} onChange={(e) => setKanaele((k) => ({ ...k, mail: e.target.checked }))} />
            Per E-Mail an Abonnentinnen
          </label>
          <label className="flex min-h-11 items-center gap-3 text-[15px] text-muted-foreground">
            <Kaestchen name="gesperrt" disabled defaultChecked />
            Gesperrt und angehakt
          </label>
          <label className="flex min-h-11 items-center gap-3 text-[15px]">
            <Kaestchen name="pflicht" aria-invalid="true" />
            Mit Feldfehler
          </label>
        </div>
      </Abschnitt269>
    </>
  )
}
