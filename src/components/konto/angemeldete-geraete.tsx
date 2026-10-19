'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, LogOut, Monitor, MonitorSmartphone, Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GERAETE_TEXT, alleAnderenSatz, type GeraeteZeile } from '@/lib/geraete'
import { useMindestbreite } from '@/lib/use-mindestbreite'
import { meldeAlleAnderenAb, meldeGeraetAb, type AbmeldenAntwort } from '@/server/actions/geraete'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Marke } from '@/components/ui/marke'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetBlatt, SheetClose, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { KNOPF_ORANGE, KNOPF_ORANGE_RAHMEN, KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'

/*
 * Baustein „Angemeldete Geräte" (Register E7, Ergänzung Lauf 17; Nr. 114;
 * Mockup system-h1-angemeldete-geraete, Schritte 1–3). Eine Zeile je gültiger
 * Sitzung: Gerät und Browser, „zuletzt" und „angemeldet seit" — nie Ort, IP
 * oder Token. Das eigene Gerät hat keinen Knopf. „Alle anderen abmelden" fragt
 * am Handy in einem Blatt, am Computer in einem Dialog und nennt die Geräte.
 *
 * Die Zeilen und ihre Texte rechnet der Server (ladeAngemeldeteGeraete in
 * src/server/geraete.ts); hier wird nur gezeigt und abgemeldet. Abmelden
 * wirkt sofort — die Sitzung wird überall frisch gelesen (kein Cookie-Cache).
 * Auch für Admin › Einstellungen › Anmeldung (Nr. 115): ohne Bezug auf
 * den Hofbereich, die Liste lädt nach dem Abmelden über router.refresh neu.
 */

const KNOPF_KLEIN = cn(KNOPF_RAHMEN, 'min-h-11 shrink-0 px-4 text-[13px] font-semibold')

export function AngemeldeteGeraete({ zeilen }: { zeilen: readonly GeraeteZeile[] }): React.JSX.Element {
  const router = useRouter()
  const breit = useMindestbreite(768)
  const [laeuft, starte] = useTransition()
  const [abmeldend, setAbmeldend] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [frageOffen, setFrageOffen] = useState(false)
  const andere = zeilen.filter((z) => !z.dieses).length

  function fuehreAus(aktion: () => Promise<AbmeldenAntwort>, zeile: string | null): void {
    setFehler(null)
    setAbmeldend(zeile)
    starte(async () => {
      try {
        const antwort = await aktion()
        if ('error' in antwort) setFehler(antwort.error)
        else setFrageOffen(false)
      } catch {
        // Netz weg oder Server-Fehler: Satz mit Ausweg statt Fehlerseite;
        // der Server meldet seine Fehler selbst an Sentry.
        setFehler(GERAETE_TEXT.fehler)
      }
      setAbmeldend(null)
      router.refresh()
    })
  }

  const frage = {
    titel: GERAETE_TEXT.blattTitel,
    satz: alleAnderenSatz(zeilen),
    knopf: (
      <button
        type="button"
        onClick={() => fuehreAus(meldeAlleAnderenAb, null)}
        disabled={laeuft}
        className={cn(KNOPF_ORANGE, 'w-full disabled:opacity-60', breit && 'w-auto')}
      >
        {laeuft ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <LogOut className="size-4" strokeWidth={1.7} aria-hidden="true" />}
        {laeuft ? GERAETE_TEXT.einenMoment : GERAETE_TEXT.alleAnderenAbmelden}
      </button>
    ),
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MonitorSmartphone className="size-4 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
          <CardTitle className="min-w-0 flex-1">{GERAETE_TEXT.titel}</CardTitle>
          <span className="text-xs text-muted-foreground tabular-nums">{zeilen.length}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-y divide-border">
          {zeilen.map((zeile) => {
            const Symbol = zeile.art === 'handy' ? Smartphone : Monitor
            return (
              <li key={zeile.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <Symbol className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold break-words text-foreground">{zeile.name}</p>
                  <p className="text-xs leading-snug text-muted-foreground">{zeile.unterzeile}</p>
                </div>
                {zeile.dieses ? (
                  <Marke art="laeuft" className="shrink-0">
                    {GERAETE_TEXT.diesesGeraet}
                  </Marke>
                ) : (
                  <button
                    type="button"
                    onClick={() => fuehreAus(() => meldeGeraetAb({ sitzungId: zeile.id }), zeile.id)}
                    disabled={laeuft}
                    aria-label={`${zeile.name} abmelden`}
                    className={cn(KNOPF_KLEIN, 'disabled:opacity-60')}
                  >
                    {abmeldend === zeile.id ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : GERAETE_TEXT.abmelden}
                  </button>
                )}
              </li>
            )
          })}
        </ul>

        {fehler && (
          <p role="alert" className="rounded-xl border border-primary/45 bg-primary/12 px-3 py-2.5 text-sm leading-relaxed text-foreground">
            {fehler}
          </p>
        )}

        {andere > 0 && (
          <button type="button" onClick={() => setFrageOffen(true)} disabled={laeuft} className={cn(KNOPF_ORANGE_RAHMEN, 'w-full disabled:opacity-60')}>
            <LogOut className="size-4" strokeWidth={1.7} aria-hidden="true" />
            {GERAETE_TEXT.alleAnderenAbmelden}
          </button>
        )}

        <p className="text-xs leading-relaxed text-muted-foreground">{GERAETE_TEXT.hinweis}</p>
      </CardContent>

      {breit ? (
        <Dialog open={frageOffen} onOpenChange={(auf) => !laeuft && setFrageOffen(auf)}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogTitle className="font-heading text-xl leading-tight font-semibold">{frage.titel}</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-foreground">{frage.satz}</DialogDescription>
            <p className="text-[13px] leading-relaxed text-muted-foreground">{GERAETE_TEXT.blattZusatz}</p>
            <DialogFooter>
              <button type="button" onClick={() => setFrageOffen(false)} disabled={laeuft} className={KNOPF_RAHMEN}>
                {GERAETE_TEXT.abbrechen}
              </button>
              {frage.knopf}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : (
        <Sheet open={frageOffen} onOpenChange={(auf) => !laeuft && setFrageOffen(auf)}>
          <SheetBlatt>
            <SheetTitle className="font-heading text-xl leading-tight font-semibold">{frage.titel}</SheetTitle>
            <SheetDescription className="text-sm leading-relaxed text-foreground">{frage.satz}</SheetDescription>
            <p className="text-[13px] leading-relaxed text-muted-foreground">{GERAETE_TEXT.blattZusatz}</p>
            {frage.knopf}
            <SheetClose disabled={laeuft} className={cn(KNOPF_RAHMEN, 'w-full')}>
              {GERAETE_TEXT.abbrechen}
            </SheetClose>
          </SheetBlatt>
        </Sheet>
      )}
    </Card>
  )
}
