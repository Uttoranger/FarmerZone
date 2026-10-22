'use client'

import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, Check, ChevronRight } from 'lucide-react'
import { zeilenNachOrt, zeilenWieAufDerHofseite, type HofseiteFortschritt, type HofseiteZeile } from '@/lib/hofseite-fortschritt'
import { schildTon } from '@/lib/mein-hof'
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

/*
 * „Bearbeiten" in Mein Hof unter lg (Nachtlauf Nr. 50, Register N4; seit
 * Nr. 143 nach dem Board system-h1-mein-hof-v3, Bildschirme E und F, N4-Ergänzung
 * 22.10.2026): oben der Stand — bei 100 % nur die Zeile „Hofseite vollständig",
 * sonst die Karte „Noch n Punkte offen" mit genau diesen Zeilen (Abholzeiten
 * zuerst) —, dann „Aktuell vom Hof", dann die übrigen Zeilen in vier Gruppen nach
 * dem Ort auf der Seite (zeilenNachOrt), je EINE Karte mit Trennlinien. Die Zeile
 * „Bestellungen" (Pause) lebt im Kopf und steht hier nicht.
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

/** „Noch 3 Punkte offen", „Noch 1 Punkt offen". */
function offenTitel(n: number): string {
  return n === 1 ? 'Noch 1 Punkt offen' : `Noch ${n} Punkte offen`
}

/**
 * Eine Zeile als Knopf. Der Wert steht in einer Zeile (gekürzt, ganz im title),
 * in der Karte „offen" bis zwei Zeilen. Ein Schild nur bei der Marke einer
 * gezählten Zeile — Freiwilliges sagt es im Wert („Freiwillig — …").
 */
function Zeile({ zeile, umbrechen, onOeffne }: { zeile: HofseiteZeile; umbrechen: boolean; onOeffne: (id: HofseiteZeileId) => void }) {
  const schild = zeile.freiwillig ? null : zeile.marke
  return (
    <li data-bearbeiten-zeile={zeile.id} className="border-t border-border first:border-t-0">
      <button
        type="button"
        onClick={() => onOeffne(zeile.id)}
        title={`${zeile.titel}: ${zeile.wert}`}
        className={cn('flex min-h-14 w-full items-center gap-2.5 py-2 pr-2.5 pl-3.5 text-left hover:bg-muted/60', FOKUS_RAHMEN, 'focus-visible:-outline-offset-2')}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          {/* `relative` hält das absolute sr-only im Span — sonst steht es am Ende eines langen Werts außerhalb des Schnitts, und die Seite scrollt waagerecht (Nr. 143, Runde 1). */}
          <span className="relative text-[14px] leading-snug font-semibold text-foreground">
            {zeile.titel}
            <span className="sr-only">: </span>
          </span>
          <span className={cn('relative text-[12.5px] text-muted-foreground', umbrechen ? 'line-clamp-2 leading-snug' : 'truncate')}>
            {zeile.wert}
            <span className="sr-only">. Bearbeiten</span>
          </span>
        </span>
        {schild && (
          <StatusBadge status={schildTon(schild.farbe)} className="self-start">
            {schild.text}
          </StatusBadge>
        )}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
      </button>
    </li>
  )
}

export function AbschnitteListe({ fortschritt, hof, einstellungen, auftritt, aktuell }: Props): React.JSX.Element {
  const router = useRouter()
  const ansicht = useMeinHofAnsicht()
  const zeilen = zeilenWieAufDerHofseite(fortschritt)
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

  function gespeichert(id: HofseiteZeileId) {
    router.refresh()
    if (!SOFORT_GESPEICHERT.has(id)) setzeOffen(null)
  }

  const zeile = zeilen.find((z) => z.id === imBlatt) ?? null
  const { offen: offeneZeilen, gruppen } = zeilenNachOrt(fortschritt)
  const vollstaendig = offeneZeilen.length === 0

  return (
    <div className="flex flex-col gap-2.5">
      {vollstaendig ? (
        <p className="flex min-h-12 items-center gap-2.5 rounded-[14px] border border-accent/50 bg-accent/15 px-3.5 text-[14px]">
          <span aria-hidden="true" className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Check className="size-3" strokeWidth={2.6} />
          </span>
          <span className="font-semibold text-foreground">Hofseite vollständig</span>
          <span className="text-[13px] text-muted-foreground">
            · {fortschritt.erledigt} von {fortschritt.gesamt}
          </span>
        </p>
      ) : (
        <section aria-labelledby="bearbeiten-stand" className="overflow-hidden rounded-2xl border border-primary/45 bg-card">
          <div className="flex flex-col gap-2.5 px-3.5 pt-3.5 pb-3">
            <div className="flex items-baseline gap-2.5">
              <h2 id="bearbeiten-stand" className="flex-1 font-heading text-[17px] font-semibold text-foreground">
                {offenTitel(offeneZeilen.length)}
              </h2>
              <p className="shrink-0 text-[13px] font-semibold text-muted-foreground tabular-nums">
                {fortschritt.erledigt} von {fortschritt.gesamt}
              </p>
            </div>
            {/* Der Wert steht daneben als Text; der Balken ist Veranschaulichung. */}
            <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div className="h-full rounded-full bg-accent" style={{ width: `${fortschritt.prozent}%` }} />
            </div>
          </div>
          <ul className="border-t border-border">
            {offeneZeilen.map((z) => (
              <Zeile key={z.id} zeile={z} umbrechen onOeffne={oeffne} />
            ))}
          </ul>
        </section>
      )}

      {aktuell && (
        // Wie auf der Hofseite oben: der laufende Beitrag. Verwaltet wird unter Mein Hof › Beiträge — darum ein Link, kein Blatt.
        <Link
          href={aktuell.link.href}
          data-bearbeiten-zeile="aktuell"
          title={`${aktuell.titel}: ${aktuell.wert}`}
          className={cn('flex min-h-14 items-center gap-2.5 rounded-2xl border border-border bg-card py-2 pr-2.5 pl-3.5 hover:bg-muted/60', FOKUS_RAHMEN)}
        >
          <CalendarDays className="size-4 shrink-0 text-status-fertig" strokeWidth={1.8} aria-hidden="true" />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[14px] leading-snug font-semibold text-foreground">
              {aktuell.titel}
              <span className="sr-only">: </span>
            </span>
            <span className="truncate text-[12.5px] text-muted-foreground">{aktuell.wert}</span>
          </span>
          <span className="shrink-0 text-[13.5px] font-semibold text-brand-text">{aktuell.link.text}</span>
          <ChevronRight className="size-4 shrink-0 text-brand-text" strokeWidth={1.7} aria-hidden="true" />
        </Link>
      )}

      {gruppen.map((g) => (
        <section key={g.id} aria-labelledby={`bearbeiten-ort-${g.id}`} className="flex flex-col">
          <h2 id={`bearbeiten-ort-${g.id}`} className="px-1 pt-3.5 pb-2 text-xs font-bold tracking-[1px] text-muted-foreground uppercase">
            {g.titel}
          </h2>
          <ul className="overflow-hidden rounded-2xl border border-border bg-card">
            {g.zeilen.map((z) => (
              <Zeile key={z.id} zeile={z} umbrechen={false} onOeffne={oeffne} />
            ))}
          </ul>
        </section>
      ))}

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
              <AbschnittInhalt
                id={zeile.id}
                hof={hof}
                einstellungen={einstellungen}
                auftritt={auftritt}
                darstellung="blatt"
                onGespeichert={() => gespeichert(zeile.id)}
                onAbbrechen={() => setzeOffen(null)}
                meldeErfolg={ansicht ? () => meldeGespeichertAnsehen({ abschnitt: zeile.id, onAnsehen: () => ansehen(zeile.id) }) : undefined}
                onHochladen={meldeHochladen}
              />
              {SOFORT_GESPEICHERT.has(zeile.id) && (
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
