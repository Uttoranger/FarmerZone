'use client'

import { useId, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pause } from 'lucide-react'
import { setPause } from '@/server/actions/farm'
import { aktionOhneWurf } from '@/components/mein-hof/abschnitt-speichern'
import { PAUSENACHRICHT_MAX } from '@/lib/eingabegrenzen'
import { PAUSE_MELDUNG } from '@/lib/shop-pause'
import { Sheet, SheetBlatt, SheetClose, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { ZeichenZaehler } from '@/components/shared/zeichen-zaehler'
import { KaufSperreHinweis } from '@/components/hofseite/kauf-sperre-hinweis'
import { KNOPF_GRUEN, KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'

/*
 * Pausieren und Fortsetzen im Kopf von Mein Hof am Handy (Nachtlauf Nr. 143,
 * Register N3, Ergänzung 22.10.2026; Board system-h1-mein-hof-v3, Bildschirme C
 * und D). EIN Knopf an derselben Stelle der Zustandszeile: „Pausieren“ öffnet das
 * Blatt mit Bestätigung und Nachricht, „Fortsetzen“ wirkt sofort. Weil es derselbe
 * Knopf bleibt, steht der Fokus nach dem Pausieren auf „Fortsetzen“ und nach
 * „Abbrechen“ wieder auf „Pausieren“ (finalFocus).
 *
 * Form nach DESIGN_SYSTEM „Dialoge und Blätter“, nicht nach dem Board: kein
 * Kreuz, „Pausieren“ über die volle Breite, „Abbrechen“ als Textknopf darunter.
 * Die Vorschau ist die echte Hinweiskarte der Hofseite (KaufSperreHinweis), kein
 * Nachbau. Bestellungen, die schon da sind, berührt setPause nicht.
 */

const BLATT_SAETZE = [
  'Deine Hofseite bleibt sichtbar, mit deiner Nachricht.',
  'Bestellen kann gerade niemand, bis du fortsetzt.',
  'Bestellungen, die schon da sind, bleiben. Die holen deine Kundinnen wie geplant ab.',
] as const

export function PausierenBlatt({
  pausiert,
  text,
  hofName,
  gespeicherteNachricht,
}: {
  /** Pausiert: Der Knopf heißt „Fortsetzen“ und wirkt sofort; sonst öffnet er das Blatt. */
  pausiert: boolean
  /** Die Beschriftung aus der Zustandszeile (ZUSTANDSZEILE_TEXT). */
  text: string
  hofName: string
  gespeicherteNachricht: string | null
}): React.JSX.Element {
  const router = useRouter()
  const [offen, setOffen] = useState(false)
  const [nachricht, setNachricht] = useState(gespeicherteNachricht ?? '')
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, startTransition] = useTransition()
  const knopf = useRef<HTMLButtonElement>(null)
  const titel = useRef<HTMLHeadingElement>(null)
  const feldId = useId()

  function oeffne() {
    setNachricht(gespeicherteNachricht ?? '')
    setFehler(null)
    setOffen(true)
  }

  function fortsetzen() {
    startTransition(async () => {
      // Mit der gespeicherten Nachricht: Sie bleibt für die nächste Pause stehen (setPause).
      // Ohne Wurf (Register N29): Ohne Netz kommt der Netzsatz statt der Fehlerseite.
      const res = await aktionOhneWurf(() => setPause(false, gespeicherteNachricht ?? ''))
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(PAUSE_MELDUNG.fortgesetzt)
      router.refresh()
    })
  }

  function pausieren() {
    startTransition(async () => {
      const res = await aktionOhneWurf(() => setPause(true, nachricht))
      if (res.error) {
        // Im Blatt, die Eingabe bleibt; der Zustand ist unverändert.
        setFehler(res.error)
        return
      }
      setOffen(false)
      toast.success(PAUSE_MELDUNG.pausiert)
      router.refresh()
    })
  }

  return (
    <>
      <button
        ref={knopf}
        type="button"
        onClick={pausiert ? fortsetzen : oeffne}
        disabled={laeuft && !offen}
        aria-busy={(laeuft && !offen) || undefined}
        className={pausiert ? KNOPF_GRUEN : KNOPF_RAHMEN}
      >
        {!pausiert && <Pause className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />}
        {text}
      </button>

      <Sheet
        open={offen}
        onOpenChange={(auf) => {
          // Solange gespeichert wird, schließt nichts (Escape, Tipp daneben, „Abbrechen“).
          if (!auf && !laeuft) setOffen(false)
        }}
      >
        <SheetBlatt initialFocus={titel} finalFocus={knopf} className="gap-4">
          <SheetTitle ref={titel} tabIndex={-1} className="font-heading text-xl leading-tight font-semibold break-words outline-none">
            Bestellungen pausieren?
          </SheetTitle>
          <ul className="flex flex-col gap-2 text-[13.5px] leading-normal text-foreground">
            {BLATT_SAETZE.map((satz) => (
              <li key={satz} className="flex gap-2.5">
                <span aria-hidden="true" className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-muted-foreground" />
                <span>{satz}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={feldId} className="text-[13px] font-semibold text-foreground">
              Nachricht an deine Kundinnen <span className="font-normal text-muted-foreground">(freiwillig)</span>
            </label>
            <Textarea
              id={feldId}
              value={nachricht}
              onChange={(e) => setNachricht(e.target.value)}
              rows={2}
              disabled={laeuft}
              placeholder="Ich bin im Urlaub bis ..."
              className="min-h-11 text-base"
            />
            {/* Zähler statt einer Grenze am Feld (CODING_STANDARDS §8); gezählt wie im Server, getrimmt. */}
            <ZeichenZaehler laenge={nachricht.trim().length} max={PAUSENACHRICHT_MAX} />
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="text-[12.5px] text-muted-foreground">So steht es auf deiner Hofseite</p>
            <KaufSperreHinweis sperre="pause" hofName={hofName} pauseMessage={nachricht} />
          </div>

          {/* Ständig vorhanden, damit der Screenreader die Meldung ansagt, sobald sie kommt. */}
          <p aria-live="polite" className={cn('text-sm leading-snug text-status-offen', !fehler && 'sr-only')}>
            {fehler}
          </p>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={pausieren}
              disabled={laeuft}
              aria-busy={laeuft || undefined}
              className={cn(
                'inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-primary-foreground/25 bg-primary text-[15px] font-semibold text-primary-foreground transition-colors duration-[250ms] hover:bg-primary/90 disabled:opacity-60',
                FOKUS_RAHMEN
              )}
            >
              <Pause className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
              {laeuft ? 'Pausiert …' : 'Pausieren'}
            </button>
            <SheetClose
              disabled={laeuft}
              className={cn('mx-auto min-h-11 rounded-full px-5 text-sm font-semibold text-brand-text hover:bg-muted disabled:opacity-60', FOKUS_RAHMEN)}
            >
              Abbrechen
            </SheetClose>
          </div>
        </SheetBlatt>
      </Sheet>
    </>
  )
}
