'use client'

import { useId, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { setPause } from '@/server/actions/farm'
import { aktionOhneWurf } from '@/components/mein-hof/abschnitt-speichern'
import { PAUSENACHRICHT_MAX } from '@/lib/eingabegrenzen'
import { PAUSE_MELDUNG } from '@/lib/shop-pause'
import { Sheet, SheetBlatt, SheetKopf } from '@/components/ui/sheet'
import { Dialog, DialogMitte } from '@/components/ui/dialog'
import { abbrechenIn } from '@/components/hof-bestellungen/bestell-dialog'
import { useMindestbreite } from '@/lib/use-mindestbreite'
import { Textarea } from '@/components/ui/textarea'
import { ZeichenZaehler } from '@/components/shared/zeichen-zaehler'
import { KaufSperreHinweis } from '@/components/hofseite/kauf-sperre-hinweis'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { KICKER_12 } from '@/components/mein-hof/kicker-12'
import { cn } from '@/lib/utils'

/*
 * Pausieren und Fortsetzen im Kopf von Mein Hof am Handy (Nachtlauf Nr. 143,
 * Register N3, Ergänzung 22.10.2026; Board system-h1-mein-hof-v3, Bildschirme C
 * und D). EIN Knopf an derselben Stelle der Zustandszeile: „Pausieren“ öffnet das
 * Blatt mit Bestätigung und Nachricht, „Fortsetzen“ wirkt sofort. Weil es derselbe
 * Knopf bleibt, steht der Fokus nach dem Pausieren auf „Fortsetzen“ und nach
 * „Abbrechen“ wieder auf „Pausieren“ (finalFocus).
 *
 * Seit Nr. 251 nach Board s1-/w1-mein-hof Bild 3 (Liste Lauf 32 mein-hof): ab
 * 768 px ein Dialog in der Mitte (DialogMitte, höchstens 560 px, V11/N41 d),
 * darunter das Blatt; „Abbrechen“ in beiden oben rechts, der Startfokus darauf
 * (Regelvorschlag 239: Dialog mit orangem Hauptknopf). Titel „Hof pausieren“,
 * Kasten „So steht es auf deiner Hofseite“ und der Schluss-Satz zu offenen
 * Bestellungen; „Pausieren“ ohne Symbol über die volle Breite.
 * Die Vorschau ist die echte Hinweiskarte der Hofseite (KaufSperreHinweis), kein
 * Nachbau. Bestellungen, die schon da sind, berührt setPause nicht.
 */

/**
 * „Pausieren“ und „Fortsetzen“ in der Zustandskarte: Umriss in der Textfarbe, 10 px rund, ohne Symbol —
 * wie die Boards s1-/w1-mein-hof (Bild 1 und 4); auf der getönten Karte trägt der Rand.
 */
const ZEILEN_KNOPF = cn(
  'inline-flex min-h-11 shrink-0 items-center justify-center rounded-[10px] border-[1.5px] border-foreground bg-card px-4 text-[15px] font-semibold text-foreground transition-colors duration-[250ms] hover:bg-muted disabled:opacity-60',
  FOKUS_RAHMEN
)

/** Der Titel von Dialog und Blatt (Board s1-/w1-mein-hof Bild 3). */
const TITEL = 'Hof pausieren'

/** Der Schluss-Satz, wörtlich nach Board s1-/w1-mein-hof Bild 3. */
const SCHLUSS_SATZ = 'Offene Bestellungen bleiben bestehen. Neue Bestellungen sind erst nach „Fortsetzen“ möglich.'

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
  const popup = useRef<HTMLDivElement>(null)
  const feldId = useId()
  const breit = useMindestbreite(768)
  // Der Startfokus auf dem einen „Abbrechen“ oben rechts (Dialog bzw. Blatt) — nie auf „Pausieren“.
  const abbrechenFokus = () => abbrechenIn(popup.current)

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

  function schliesse(auf: boolean) {
    // Solange gespeichert wird, schließt nichts (Escape, Tipp daneben, „Abbrechen“).
    if (!auf && !laeuft) setOffen(false)
  }

  const inhalt = (
    <>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={feldId} className="text-[15px] font-semibold text-foreground">
          Nachricht an deine Kundschaft <span className="font-normal text-muted-foreground">(freiwillig)</span>
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
        <p className={KICKER_12}>So steht es auf deiner Hofseite</p>
        <KaufSperreHinweis sperre="pause" hofName={hofName} pauseMessage={nachricht} />
      </div>

      <p className="text-[14px] leading-normal text-foreground">{SCHLUSS_SATZ}</p>

      {/* Ständig vorhanden, damit der Screenreader die Meldung ansagt, sobald sie kommt. */}
      <p aria-live="polite" className={cn('text-sm leading-snug font-semibold text-status-offen', !fehler && 'sr-only')}>
        {fehler}
      </p>

      <button
        type="button"
        onClick={pausieren}
        disabled={laeuft}
        aria-busy={laeuft || undefined}
        className={cn(
          'inline-flex h-12 w-full items-center justify-center rounded-[10px] bg-primary text-[15px] font-semibold text-primary-foreground transition-colors duration-[250ms] hover:bg-primary/90 disabled:opacity-60',
          FOKUS_RAHMEN
        )}
      >
        {laeuft ? 'Pausiert …' : 'Pausieren'}
      </button>
    </>
  )

  return (
    <>
      <button
        ref={knopf}
        type="button"
        onClick={pausiert ? fortsetzen : oeffne}
        disabled={laeuft && !offen}
        aria-busy={(laeuft && !offen) || undefined}
        className={ZEILEN_KNOPF}
      >
        {text}
      </button>

      {breit ? (
        <Dialog open={offen} onOpenChange={schliesse}>
          <DialogMitte ref={popup} titel={TITEL} schliessen="Abbrechen" initialFocus={abbrechenFokus} finalFocus={knopf} className="gap-4">
            {inhalt}
          </DialogMitte>
        </Dialog>
      ) : (
        <Sheet open={offen} onOpenChange={schliesse}>
          <SheetBlatt ref={popup} schleier="abgedunkelt" kopf={<SheetKopf titel={TITEL} schliessen="Abbrechen" />} initialFocus={abbrechenFokus} finalFocus={knopf} className="gap-4">
            {inhalt}
          </SheetBlatt>
        </Sheet>
      )}
    </>
  )
}
