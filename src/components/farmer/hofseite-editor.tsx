'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, ChevronRight } from 'lucide-react'
import type { FarmSettings } from '@/server/queries/farm'
import type { AppearanceData } from '@/server/queries/appearance'
import { ZEILE_TITEL, type HofseiteFortschritt } from '@/lib/hofseite-fortschritt'
import { meinHofListe, type MeinHofZeile } from '@/lib/mein-hof-liste'
import type { HofseiteZeileId } from '@/schemas/hofseite-vorschau'
import type { AktuellZeile } from '@/lib/mein-hof-ansicht'
import {
  EDITOR_ABSTAND,
  EDITOR_LISTE_HANDY_MAX,
  VORSCHAU_WEB_MINDESTBREITE,
  editorSpalten,
  type VorschauGeraet,
} from '@/lib/hofseite-vorschau'
import { MEIN_HOF_HINWEIS, PRODUKTE_HREF } from '@/lib/bauern-navigation'
import { useMindestbreite } from '@/lib/use-mindestbreite'
import { AbschnittInhalt, SOFORT_GESPEICHERT, type AbschnittHof } from '@/components/mein-hof/abschnitt-inhalt'
import { StatusBadge } from '@/components/ui/status-badge'
import { FOKUS_RAHMEN, FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'
import { HOFSEITE_VOLLSTAENDIG, punkteOffenTitel, schildTon } from '@/lib/mein-hof'
import { AktuellBlock } from '@/components/mein-hof/aktuell-block'
import {
  FORTSCHRITT_FUELLUNG,
  FORTSCHRITT_SPUR,
  MEIN_HOF_GRUPPE_TITEL,
  MEIN_HOF_ZEILE_TITEL,
  MEIN_HOF_ZEILE_WERT,
} from '@/components/mein-hof/zeilen-stil'
import { HofseiteVorschauRahmen } from '@/components/farmer/hofseite-vorschau-rahmen'
import { useElementGroesse } from '@/lib/use-element-groesse'
import { cn } from '@/lib/utils'
import { RUNDUNG } from '@/components/ui/rundung'

/*
 * Der Reiter „Hofseite" von Mein Hof ab lg: links die Hofseite als Liste mit
 * Fortschritt, rechts die echte Seite als Handy-Vorschau. Was die Liste sagt,
 * entscheidet src/lib/hofseite-fortschritt.ts; hier wird gezeichnet.
 *
 * Jede Zeile öffnet ihren Baustein (AbschnittInhalt,
 * components/mein-hof/abschnitt-inhalt.tsx) — seit Nr. 50 dieselben Bausteine
 * wie unter lg im Blatt von unten (components/mein-hof/abschnitte-liste.tsx),
 * dazu Leitspruch/Gründungsjahr und Werte aus dem früheren „Mein Auftritt".
 * Gespeichert wird ausschließlich über die vorhandenen Server-Aktionen, jeder
 * Abschnitt mit frischem Stand vom Server (components/mein-hof/abschnitt-speichern.ts).
 *
 * Seit Nr. 274 nach Board w1-mein-hof: dieselben Zeilen und Gruppen nach dem Ort
 * wie unter lg (meinHofListe), ohne Symbole, Häkchen rechts; der Fortschritt als
 * Zeile mit flachem Balken; „Aktuell vom Hof“ als erste Zeile vor den Gruppen (Register E12).
 *
 * Die Breiten der beiden Spalten kommen aus EINER Regel (editorSpalten in
 * src/lib/hofseite-vorschau.ts, Register N7): Der Editor ist auf 2 000 px
 * begrenzt und zentriert, die Vorschau nie breiter als die Seite (1 440 px),
 * die Liste 400 bis 560 px neben Web bzw. höchstens 720 px neben Handy. Hier
 * wird gemessen und gesetzt, nicht gerechnet.
 */

type Props = {
  fortschritt: HofseiteFortschritt
  hof: AbschnittHof
  einstellungen: FarmSettings
  auftritt: AppearanceData
  /** „Aktuell vom Hof“ als erste Zeile (Register E12, Nr. 129) — wie in der Liste unter lg; fehlt die Angabe, steht sie nicht da. */
  aktuell?: AktuellZeile
}

// ── Zeile und Gruppe ──────────────────────────────────────────────────────────

function Zeile({
  zeile,
  offen,
  onToggle,
  children,
}: {
  zeile: MeinHofZeile
  offen: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  const inhaltId = `hofseite-zeile-${zeile.id}`
  return (
    <li className={cn('border-t border-border first:border-t-0', offen && 'bg-muted/30')}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={offen}
        aria-controls={inhaltId}
        title={`${zeile.titel}: ${zeile.wert}`}
        className={cn('flex min-h-14 w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-muted', FOKUS_RAHMEN_INNEN)}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={MEIN_HOF_ZEILE_TITEL}>{zeile.titel}</span>
          <span className={cn('truncate', MEIN_HOF_ZEILE_WERT)}>{zeile.wert}</span>
        </span>
        {zeile.marke ? (
          <StatusBadge status={schildTon(zeile.marke.farbe)}>{zeile.marke.text}</StatusBadge>
        ) : (
          <>
            <Check className="size-4 shrink-0 text-status-fertig" strokeWidth={2.6} aria-hidden="true" />
            <span className="sr-only">erledigt</span>
          </>
        )}
        <ChevronRight
          className={cn('size-[18px] shrink-0 text-muted-foreground transition-transform', offen && 'rotate-90')}
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>
      {offen && (
        <div id={inhaltId} className="flex flex-col gap-5 px-3 pb-5">
          {children}
        </div>
      )}
    </li>
  )
}

export function HofseiteEditor({ fortschritt, hof, einstellungen, auftritt, aktuell }: Props): React.JSX.Element {
  const router = useRouter()
  // Nur eine Zeile offen zugleich — und genau die markiert die Vorschau.
  const [offen, setOffen] = useState<HofseiteZeileId | null>(null)
  // Solange ein Foto hochlädt, bleibt die Zeile offen: Das Datei-Feld darf bis
  // zum fertigen Upload nicht aushängen (CODING_STANDARDS §8).
  const [hochladen, setHochladen] = useState(false)
  // Zählt bei jedem erfolgreichen Speichern hoch; die Vorschau lädt dann neu.
  const [stand, setStand] = useState(0)
  // Das Gerät der Vorschau. Web passt erst ab 1280 px neben die Bearbeitung
  // (dann rückt sie auf ~400 px zusammen); darunter zeigt der Rahmen Web im Overlay.
  const [geraet, setGeraet] = useState<VorschauGeraet>('handy')
  const breit = useMindestbreite(VORSCHAU_WEB_MINDESTBREITE)
  const webInline = geraet === 'web' && breit
  // Die Breite, die dem Editor bleibt — höchstens EDITOR_BREITE_MAX, denn der
  // äußere Rahmen unten begrenzt sie; 0, solange nichts gemessen ist.
  const { ref: flaeche, breite: gemessen } = useElementGroesse()
  const spalten = gemessen > 0 ? editorSpalten(gemessen, webInline ? 'web' : 'handy', breit) : null

  // Formulare schließen sich nach dem Speichern: Der Refresh liefert neue
  // Startwerte, und ein offenes Formular hielte die alten fest. Was sofort
  // speichert (Bilder, Abholzeiten, Pause), bleibt offen.
  // Eine Zeile mit mehreren Teilen (Titelbild und Logo, …) bleibt nach dem Speichern offen: Man ändert oft beide.
  function gespeichert(zeile: MeinHofZeile, teil: HofseiteZeileId) {
    setStand((s) => s + 1)
    router.refresh()
    if (zeile.teile.length === 1 && !SOFORT_GESPEICHERT.has(teil)) setOffen(null)
  }

  const liste = meinHofListe(fortschritt)

  function umschalten(id: HofseiteZeileId) {
    if (hochladen) return
    setOffen((jetzt) => (jetzt === id ? null : id))
  }

  return (
    // data-app-palette: Die eingebundenen Formulare der Einstellungen (Abholzeiten,
    // Pause) zeichnen noch mit --app-*; hier nehmen sie die Werte des
    // Design-Systems an (globals.css).
    // Das Paar steht zentriert (justify-center); was über die Breite hinausgeht,
    // bleibt links und rechts leer (mx-auto, max-w).
    <div
      ref={flaeche}
      data-app-palette="neu"
      className="mx-auto flex w-full max-w-[2000px] items-start justify-center"
      style={{ gap: EDITOR_ABSTAND }}
    >
      {/* Die Liste: Breite aus editorSpalten. Bis zur ersten Messung (Server, erster
          Frame) füllt sie den Rest neben der Vorschau, höchstens so breit wie neben
          Handy — dieselbe Regel in CSS, damit beim Hydrieren nichts springt. */}
      <div
        className={cn('flex min-w-0 flex-col gap-2.5 transition-[width] duration-200 motion-reduce:transition-none', !spalten && 'flex-1')}
        style={spalten ? { width: spalten.liste } : { maxWidth: EDITOR_LISTE_HANDY_MAX }}
      >
        {/* Fortschritt ab lg als Zeile mit flachem Balken (Board w1-mein-hof, Liste Lauf 32 mein-hof): Satz, darunter der Balken;
            den Stand „8 von 11“ trägt der Balken für den Screenreader. */}
        <div className="flex flex-col gap-1">
          <p className="text-[15px] font-semibold text-foreground">
            {liste.anzahlOffen > 0 ? punkteOffenTitel(liste.anzahlOffen) : HOFSEITE_VOLLSTAENDIG}
          </p>
          <div role="img" aria-label={`${fortschritt.erledigt} von ${fortschritt.gesamt} Punkten erledigt`} className={FORTSCHRITT_SPUR}>
            <div className={cn(FORTSCHRITT_FUELLUNG, 'transition-[width] duration-500')} style={{ width: `${fortschritt.prozent}%` }} />
          </div>
        </div>

        {/* Register E12 (Ergänzungen 20.10. und 22.10.2026): den laufenden Beitrag nennt die erste Zeile von Mein Hof ›
            Hofseite — vor den Gruppen (Register vor Liste und Board, Runde 1 Nr. 274). Ein Tipp markiert den Abschnitt in
            der Vorschau, ein zweiter gibt ihn frei (Freigabe 129.4); der Link führt zu Mein Hof › Beiträge. */}
        {aktuell && (
          <AktuellBlock aktuell={aktuell} kennung="hofseite-editor-aktuell" markiert={offen === 'aktuell'} onUmschalten={() => umschalten('aktuell')} />
        )}

        {liste.gruppen.map((gruppe) => (
          <section key={gruppe.id} aria-labelledby={`hofseite-gruppe-${gruppe.id}`} className="flex flex-col">
            <h2 id={`hofseite-gruppe-${gruppe.id}`} className={MEIN_HOF_GRUPPE_TITEL}>
              {gruppe.titel}
            </h2>
            <ul className={cn('overflow-hidden border border-border bg-card', RUNDUNG.karte)}>
              {gruppe.zeilen.map((zeile) => (
                <Zeile key={zeile.id} zeile={zeile} offen={offen === zeile.id} onToggle={() => umschalten(zeile.id)}>
                  {zeile.teile.map((teil) => (
                    <div key={teil} className="flex flex-col gap-3">
                      {/* Mehrere Teile in einer Zeile: je Teil sein Name als Zwischentitel (Titelbild, Logo, …). */}
                      {zeile.teile.length > 1 && <h3 className="text-[15px] font-semibold text-foreground">{ZEILE_TITEL[teil]}</h3>}
                      <AbschnittInhalt
                        id={teil}
                        hof={hof}
                        einstellungen={einstellungen}
                        auftritt={auftritt}
                        darstellung="zeile"
                        onGespeichert={() => gespeichert(zeile, teil)}
                        onAbbrechen={() => setOffen(null)}
                        onHochladen={setHochladen}
                      />
                    </div>
                  ))}
                </Zeile>
              ))}
            </ul>
          </section>
        ))}

        {/* Wo Produkte liegen — leise, am Ende der Liste (Register N7). */}
        <p className="px-1">
          <Link
            href={PRODUKTE_HREF}
            className={cn(
              'inline-flex min-h-11 items-center rounded-sm text-[13px] text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground',
              FOKUS_RAHMEN
            )}
          >
            {MEIN_HOF_HINWEIS}
          </Link>
        </p>
      </div>

      {/* Die Vorschau-Spalte: Breite aus editorSpalten — neben der Liste fürs
          Handy 320 px (ab xl 360 px), im Web-Modus alles außer der Liste, nie
          mehr als die Seite breit ist; mit einer kurzen Breiten-Transition, die
          Liste rückt mit. Bis zur ersten Messung die Klassen für Handy. */}
      <div
        className={cn('shrink-0 transition-[width] duration-200 motion-reduce:transition-none', !spalten && 'w-[320px] xl:w-[360px]')}
        style={spalten ? { width: spalten.vorschau } : undefined}
      >
        <HofseiteVorschauRahmen
          slug={hof.slug}
          stand={stand}
          markiert={offen}
          hofName={hof.name}
          adresse={hof.adresse}
          geraet={geraet}
          onGeraet={setGeraet}
          webInlineMoeglich={breit}
        />
      </div>
    </div>
  )
}
