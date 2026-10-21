'use client'

import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, Check, ChevronRight } from 'lucide-react'
import { zeilenWieAufDerHofseite, type HofseiteFortschritt, type HofseiteZeile } from '@/lib/hofseite-fortschritt'
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
 * „Bearbeiten" in Mein Hof unter lg (Nachtlauf Nr. 50, Register N4; Mockup
 * mobil-h1-mein-hof): oben der Stand „Zu n von 11 fertig", darunter jede
 * Zeile der Hofseite in der Reihenfolge, in der Kundinnen sie sehen
 * (HOFSEITE_REIHENFOLGE) — mit ihrem Stand (Häkchen oder Schild) und
 * „Bearbeiten". Bearbeitet wird in einem Blatt von unten, mit denselben
 * Bausteinen wie der Editor ab lg (AbschnittInhalt). Die alte Hofseite mit
 * Stiften (FarmPageView im Bearbeitungsmodus) ist hier entfallen.
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

/** Der Stand einer Zeile: ein grünes Häkchen (fertig) oder ihr Schild („Fehlt", „Online fehlt", „Pausiert"). */
function Stand({ zeile }: { zeile: HofseiteZeile }): React.JSX.Element {
  if (zeile.marke) return <StatusBadge status={schildTon(zeile.marke.farbe)}>{zeile.marke.text}</StatusBadge>
  return (
    <span className="flex size-[21px] shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
      <Check className="size-3" strokeWidth={2.6} aria-hidden="true" />
      <span className="sr-only">fertig</span>
    </span>
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

  return (
    <div className="flex flex-col gap-3">
      <section aria-labelledby="bearbeiten-stand" className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="bearbeiten-stand" className="font-heading text-[17px] font-semibold text-foreground">
            Zu {fortschritt.erledigt} von {fortschritt.gesamt} fertig
          </h2>
          <p className="shrink-0 text-[13px] font-semibold text-status-fertig tabular-nums">{fortschritt.prozent} %</p>
        </div>
        {/* Der Wert steht daneben als Text; der Balken ist Veranschaulichung. */}
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className="h-full rounded-full bg-accent" style={{ width: `${fortschritt.prozent}%` }} />
        </div>
        <p className="mt-2.5 text-[13.5px] text-muted-foreground">{fortschritt.satz}</p>
      </section>

      <ol aria-label="Abschnitte der Hofseite" className="flex flex-col gap-2.5">
        {aktuell && (
          // Wie auf der Hofseite oben: der laufende Beitrag. Verwaltet wird unter Mein Hof › Beiträge — darum ein Link, kein Blatt.
          <li data-bearbeiten-zeile="aktuell" className="relative flex items-center gap-2.5 rounded-xl border border-border bg-card py-2 pr-1.5 pl-3">
            <CalendarDays className="size-4 shrink-0 text-status-fertig" strokeWidth={1.8} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] leading-snug font-semibold text-foreground">{aktuell.titel}</p>
              <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">{aktuell.wert}</p>
            </div>
            <Link
              href={aktuell.link.href}
              title={`${aktuell.titel}: ${aktuell.wert}`}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center gap-0.5 rounded-lg px-1.5 text-[13.5px] font-semibold whitespace-nowrap text-brand-text after:absolute after:inset-0 after:rounded-xl after:content-['']",
                FOKUS_RAHMEN
              )}
            >
              <span className="sr-only">{aktuell.titel}: </span>
              {aktuell.link.text}
              <ChevronRight className="size-4" strokeWidth={1.7} aria-hidden="true" />
            </Link>
          </li>
        )}
        {zeilen.map((z) => (
          <li key={z.id} data-bearbeiten-zeile={z.id} className="relative flex items-center gap-2.5 rounded-xl border border-border bg-card py-2 pr-1.5 pl-3">
            <div className="min-w-0 flex-1">
              <p className="text-[14px] leading-snug font-semibold text-foreground">{z.titel}</p>
              <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">{z.wert}</p>
            </div>
            <Stand zeile={z} />
            {/* Die ganze Zeile ist der Knopf (::after über der Karte); der volle Wert steht im title. */}
            <button
              type="button"
              onClick={() => oeffne(z.id)}
              title={`${z.titel}: ${z.wert}`}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center gap-0.5 rounded-lg px-1.5 text-[13.5px] font-semibold text-brand-text after:absolute after:inset-0 after:rounded-xl after:content-['']",
                FOKUS_RAHMEN
              )}
            >
              <span className="sr-only">{z.titel}: </span>
              Bearbeiten
              <ChevronRight className="size-4" strokeWidth={1.7} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ol>

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
