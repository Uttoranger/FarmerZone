'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronRight } from 'lucide-react'
import { ZEILE_TITEL, type HofseiteFortschritt } from '@/lib/hofseite-fortschritt'
import { HOFSEITE_VOLLSTAENDIG, punkteOffenTitel, schildTon } from '@/lib/mein-hof'
import { meinHofListe, type MeinHofZeile } from '@/lib/mein-hof-liste'
import type { AktuellZeile } from '@/lib/mein-hof-ansicht'
import type { HofseiteZeileId } from '@/schemas/hofseite-vorschau'
import type { FarmSettings } from '@/server/queries/farm'
import type { AppearanceData } from '@/server/queries/appearance'
import { AbschnittInhalt, SOFORT_GESPEICHERT, type AbschnittHof } from '@/components/mein-hof/abschnitt-inhalt'
import { useMeinHofAnsicht } from '@/components/mein-hof/mein-hof-ansicht'
import { meldeGespeichertAnsehen } from '@/components/mein-hof/gespeichert-ansehen'
import { Sheet, SheetBlatt, SheetClose, SheetTitle } from '@/components/ui/sheet'
import { StatusBadge } from '@/components/ui/status-badge'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'
import { RUNDUNG } from '@/components/ui/rundung'
import { AktuellBlock } from '@/components/mein-hof/aktuell-block'
import {
  FORTSCHRITT_FUELLUNG,
  FORTSCHRITT_SPUR,
  MEIN_HOF_GRUPPE_TITEL,
  MEIN_HOF_ZEILE_TITEL,
  MEIN_HOF_ZEILE_WERT,
} from '@/components/mein-hof/zeilen-stil'

/*
 * „Bearbeiten" in Mein Hof unter lg (Nachtlauf Nr. 50, Register N4; seit
 * Nr. 143 nach dem Board system-h1-mein-hof-v3, Bildschirme E und F, N4-Ergänzung
 * 22.10.2026): oben der Stand — bei 100 % nur die Zeile „Hofseite vollständig",
 * sonst die Karte „Noch n Punkte offen" mit genau diesen Zeilen (Abholzeiten
 * zuerst) —, dann die übrigen Zeilen in vier Gruppen nach dem Ort auf der Seite
 * (zeilenNachOrt), je EINE Karte mit Trennlinien, und seit Nr. 251 zuletzt
 * „Aktuell vom Hof" (Board s1-mein-hof: letzter Abschnitt). Die Zeile
 * „Bestellungen" (Pause) lebt im Kopf und steht hier nicht.
 *
 * Seit Nr. 274 Titel, Zusammenlegung und Reihenfolge nach den Boards
 * (meinHofListe, src/lib/mein-hof-liste.ts): „Titelbild und Logo“, „Name und
 * Leitspruch“, „Über uns“ öffnen die Bausteine aller ihrer Teile im selben Blatt.
 *
 * Jede Zeile ist EIN Knopf: Titel, Wert, Schild (nur bei der Marke einer
 * gezählten Zeile), Pfeil. „Bearbeiten" hört nur der Screenreader. Bearbeitet
 * wird in einem Blatt von unten, mit denselben Bausteinen wie der Editor ab lg
 * (AbschnittInhalt).
 *
 * Nach dem Speichern „Gespeichert · Ansehen" (Nr. 49): „Ansehen" schließt ein
 * offenes Blatt und schaltet dann auf „So sieht’s die Kundin", die den
 * Abschnitt kurz umrandet. Solange ein Foto hochlädt, bleibt das Blatt offen
 * — das Datei-Feld darf bis zum fertigen Upload nicht aushängen
 * (CODING_STANDARDS §8).
 */

type Props = {
  fortschritt: HofseiteFortschritt
  hof: AbschnittHof
  einstellungen: FarmSettings
  auftritt: AppearanceData
  /**
   * „Aktuell vom Hof“ als erste Zeile (Register E12, Nr. 129; aktuellZeile in
   * src/lib/mein-hof-ansicht.ts) — der laufende Beitrag bzw. „Kein Beitrag“.
   * Fehlt die Angabe, steht die Zeile nicht da.
   */
  aktuell?: AktuellZeile
}


/**
 * Eine Zeile als Knopf. Der Wert steht in einer Zeile (gekürzt, ganz im title),
 * in der Karte „offen" bis zwei Zeilen. Ein Schild nur bei der Marke eines
 * gezählten Teils.
 */
function Zeile({ zeile, umbrechen, onOeffne }: { zeile: MeinHofZeile; umbrechen: boolean; onOeffne: (id: HofseiteZeileId) => void }) {
  return (
    <li data-bearbeiten-zeile={zeile.id} className="border-t border-border first:border-t-0">
      <button
        type="button"
        onClick={() => onOeffne(zeile.id)}
        title={`${zeile.titel}: ${zeile.wert}`}
        className={cn('flex min-h-14 w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-muted/60', FOKUS_RAHMEN, 'focus-visible:-outline-offset-2')}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          {/* `relative` hält das absolute sr-only im Span — sonst steht es am Ende eines langen Werts außerhalb des Schnitts, und die Seite scrollt waagerecht (Nr. 143, Runde 1). */}
          <span className={cn('relative', MEIN_HOF_ZEILE_TITEL)}>
            {zeile.titel}
            <span className="sr-only">: </span>
          </span>
          <span className={cn('relative', MEIN_HOF_ZEILE_WERT, umbrechen ? 'line-clamp-2 leading-snug' : 'truncate')}>
            {zeile.wert}
            <span className="sr-only">. Bearbeiten</span>
          </span>
        </span>
        {zeile.marke && (
          <StatusBadge status={schildTon(zeile.marke.farbe)} className="self-start">
            {zeile.marke.text}
          </StatusBadge>
        )}
        <ChevronRight className="size-[18px] shrink-0 text-muted-foreground" strokeWidth={2} aria-hidden="true" />
      </button>
    </li>
  )
}

export function AbschnitteListe({ fortschritt, hof, einstellungen, auftritt, aktuell }: Props): React.JSX.Element {
  const router = useRouter()
  const ansicht = useMeinHofAnsicht()
  const liste = meinHofListe(fortschritt)
  const zeilen = liste.gruppen.flatMap((g) => g.zeilen)
  // Offen ist das Blatt; `imBlatt` bleibt nach dem Schließen stehen, damit der
  // Inhalt beim Hinausgleiten nicht leer wird.
  const [offen, setOffen] = useState<HofseiteZeileId | null>(null)
  const [imBlatt, setImBlatt] = useState<HofseiteZeileId | null>(null)
  const [hochladen, setHochladen] = useState(false)
  // Für Rückrufe, die später kommen (der Toast „Ansehen"): der Stand von jetzt, nicht der beim Anlegen.
  const offenJetzt = useRef<HofseiteZeileId | null>(null)
  const hochladenJetzt = useRef(false)
  const nachDemSchliessen = useRef<(() => void) | null>(null)
  // Beim Öffnen steht der Fokus auf dem Titel: Der Screenreader liest, wo man ist, am Handy geht keine
  // Tastatur auf, und keine Kachel sieht schon gewählt aus. Weiter geht es mit Tab bzw. Wischen.
  const titel = useRef<HTMLHeadingElement>(null)

  function setzeOffen(id: HofseiteZeileId | null) {
    offenJetzt.current = id
    setOffen(id)
  }

  function oeffne(id: HofseiteZeileId) {
    setImBlatt(id)
    setzeOffen(id)
  }

  // Stabil: Die Bausteine melden in einem Effekt, der an diesem Rückruf hängt.
  const meldeHochladen = useCallback((laeuft: boolean) => {
    hochladenJetzt.current = laeuft
    setHochladen(laeuft)
  }, [])

  // Erst schließen, dann umschalten: Unter dem offenen Blatt sähe niemand die Kundenansicht.
  function ansehen(id: HofseiteZeileId) {
    if (!ansicht || hochladenJetzt.current) return
    if (offenJetzt.current === null) {
      ansicht.zeigeKundin(id)
      return
    }
    nachDemSchliessen.current = () => ansicht.zeigeKundin(id)
    setzeOffen(null)
  }

  // Eine Zeile mit mehreren Teilen (Titelbild und Logo, …) bleibt nach dem Speichern offen: Man ändert oft beide.
  function gespeichert(zeile: MeinHofZeile, teil: HofseiteZeileId) {
    router.refresh()
    if (zeile.teile.length === 1 && !SOFORT_GESPEICHERT.has(teil)) setzeOffen(null)
  }

  const zeile = zeilen.find((z) => z.id === imBlatt) ?? null
  const offeneZeilen = liste.offen
  // Eine offene Zeile steht nicht noch einmal in ihrer Gruppe; leere Gruppen entfallen.
  const gruppen = liste.gruppen.map((g) => ({ ...g, zeilen: g.zeilen.filter((z) => !z.offen) })).filter((g) => g.zeilen.length > 0)
  const vollstaendig = liste.anzahlOffen === 0
  const schliessenKnopf = zeile !== null && (zeile.teile.length > 1 || zeile.teile.some((t) => SOFORT_GESPEICHERT.has(t)))

  return (
    <div className="flex flex-col gap-2.5">
      {vollstaendig ? (
        <p className={cn('flex min-h-12 items-center gap-2.5 border border-accent/50 bg-accent/15 px-3.5 text-[14px]', RUNDUNG.karte)}>
          <span aria-hidden="true" className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Check className="size-3" strokeWidth={2.6} />
          </span>
          <span className="font-semibold text-foreground">{HOFSEITE_VOLLSTAENDIG}</span>
          <span className="text-[13px] text-muted-foreground">
            · {fortschritt.erledigt} von {fortschritt.gesamt}
          </span>
        </p>
      ) : (
        <section aria-labelledby="bearbeiten-stand" className={cn('overflow-hidden border border-primary/45 bg-card', RUNDUNG.karte)}>
          <div className="flex flex-col gap-2.5 px-3.5 pt-3.5 pb-3">
            <div className="flex items-baseline gap-2.5">
              <h2 id="bearbeiten-stand" className="flex-1 font-heading text-[17px] font-semibold text-foreground">
                {punkteOffenTitel(liste.anzahlOffen)}
              </h2>
              <p className="shrink-0 text-[13px] font-semibold text-muted-foreground tabular-nums">
                {fortschritt.erledigt} von {fortschritt.gesamt}
              </p>
            </div>
            {/* Der Wert steht daneben als Text; der Balken ist Veranschaulichung. */}
            <div className={FORTSCHRITT_SPUR} aria-hidden="true">
              <div className={FORTSCHRITT_FUELLUNG} style={{ width: `${fortschritt.prozent}%` }} />
            </div>
          </div>
          <ul className="border-t border-border">
            {offeneZeilen.map((z) => (
              <Zeile key={z.id} zeile={z} umbrechen onOeffne={oeffne} />
            ))}
          </ul>
        </section>
      )}

      {gruppen.map((g) => (
        <section key={g.id} aria-labelledby={`bearbeiten-ort-${g.id}`} className="flex flex-col">
          <h2 id={`bearbeiten-ort-${g.id}`} className={MEIN_HOF_GRUPPE_TITEL}>
            {g.titel}
          </h2>
          <ul className={cn('overflow-hidden border border-border bg-card', RUNDUNG.karte)}>
            {g.zeilen.map((z) => (
              <Zeile key={z.id} zeile={z} umbrechen={false} onOeffne={oeffne} />
            ))}
          </ul>
        </section>
      ))}

      {/* Der letzte Abschnitt, unter „Über uns“ (Board s1-mein-hof, Liste Lauf 32). */}
      {aktuell && <AktuellBlock aktuell={aktuell} kennung="bearbeiten-aktuell" />}

      <Sheet
        open={offen !== null}
        onOpenChange={(auf) => {
          // Solange ein Foto hochlädt, schließt nichts (Escape, Tipp daneben, „Schließen").
          if (!auf && !hochladenJetzt.current) setzeOffen(null)
        }}
        onOpenChangeComplete={(auf) => {
          if (auf) return
          const danach = nachDemSchliessen.current
          nachDemSchliessen.current = null
          danach?.()
        }}
      >
        <SheetBlatt initialFocus={titel}>
          {zeile && (
            <>
              <SheetTitle ref={titel} tabIndex={-1} className="font-heading text-xl leading-tight font-semibold break-words outline-none">
                {zeile.titel}
              </SheetTitle>
              {zeile.teile.map((teil) => (
                <div key={teil} className="flex flex-col gap-3">
                  {/* Mehrere Teile in einer Zeile: je Teil sein Name als Zwischentitel (Titelbild, Logo, …). */}
                  {zeile.teile.length > 1 && <h3 className="text-[15px] font-semibold text-foreground">{ZEILE_TITEL[teil]}</h3>}
                  <AbschnittInhalt
                    id={teil}
                    hof={hof}
                    einstellungen={einstellungen}
                    auftritt={auftritt}
                    darstellung="blatt"
                    onGespeichert={() => gespeichert(zeile, teil)}
                    onAbbrechen={() => setzeOffen(null)}
                    meldeErfolg={ansicht ? () => meldeGespeichertAnsehen({ abschnitt: teil, onAnsehen: () => ansehen(teil) }) : undefined}
                    onHochladen={meldeHochladen}
                  />
                </div>
              ))}
              {schliessenKnopf && (
                <SheetClose
                  disabled={hochladen}
                  className={cn('mx-auto min-h-11 rounded-full px-5 text-sm font-semibold text-brand-text hover:bg-muted disabled:opacity-60', FOKUS_RAHMEN)}
                >
                  {hochladen ? 'Foto lädt noch …' : 'Schließen'}
                </SheetClose>
              )}
            </>
          )}
        </SheetBlatt>
      </Sheet>
    </div>
  )
}
