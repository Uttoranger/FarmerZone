'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, LogOut, Monitor, MonitorSmartphone, Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GERAETE_TEXT, alleAnderenSatz, geraeteHinweise, type GeraeteZeile } from '@/lib/geraete'
import { useMindestbreite } from '@/lib/use-mindestbreite'
import { KUNDIN_GERAETE_TEXT } from '@/lib/sitzung-dauer'
import { meldeAlleAnderenAb, meldeGeraetAb, meldeUeberallAb, type AbmeldenAntwort } from '@/server/actions/geraete'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
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
 * den Hofbereich, die Liste lädt nach dem Abmelden über router.refresh neu;
 * dort mit `fuerAdmin` (Nr. 126): Hinweis und Zusatz nennen auch die Passkeys.
 * Unter /account mit `fuerKundin` (Register S18; Nr. 178, Board
 * SterneSicherheit, rechtes Handy): „Überall abmelden" statt „Alle anderen
 * abmelden" — meldet auch dieses Gerät ab und führt zur Anmeldung —, dazu
 * der Satz zum Abmelden; seit Nr. 239 (Boards s2-/w2-kundenkonto) als
 * Kennzeile, Gerätekarte und eigener neutraler Knopf, ohne „Was wir speichern". `satz` (Konto und
 * Sicherheit der Höfe) steht als letzte Zeile der Karte: die Höchstdauer.
 */

const KNOPF_KLEIN = cn(KNOPF_RAHMEN, 'min-h-11 shrink-0 px-4 text-[13px] font-semibold')

/** Kennzeile über einem Abschnitt von „Mein Konto“ (Board s2-/w2-kundenkonto): 13 px fett, Großbuchstaben, leise. */
export const KONTO_ETIKETT = 'text-[13px] font-bold tracking-[0.5px] text-muted-foreground uppercase'

/** „Überall abmelden“ der Kundin: neutraler Umriss über die volle Breite (Board s2-/w2-kundenkonto, Bild 3/5). */
const KNOPF_UEBERALL = cn(
  'inline-flex min-h-[50px] w-full items-center justify-center rounded-[14px] border border-foreground/70 bg-card px-4 text-[15px] font-bold text-foreground transition-colors duration-[250ms] hover:bg-muted disabled:opacity-60',
  FOKUS_RAHMEN
)

export function AngemeldeteGeraete({
  zeilen,
  fuerAdmin = false,
  fuerKundin = false,
  satz,
}: {
  zeilen: readonly GeraeteZeile[]
  fuerAdmin?: boolean
  fuerKundin?: boolean
  satz?: string
}): React.JSX.Element {
  const router = useRouter()
  // Im Admin-Bereich kommt der Blick auf die Passkeys dazu (N20); für Höfe bleibt der Text, wie er war.
  const hinweise = geraeteHinweise(fuerAdmin)
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

  /** „Überall abmelden": danach ist auch dieses Gerät abgemeldet — weiter zur Anmeldung. */
  function meldeUeberallAbUndWeiter(): void {
    setFehler(null)
    starte(async () => {
      try {
        const antwort = await meldeUeberallAb()
        if ('error' in antwort) {
          setFehler(antwort.error)
          return
        }
        setFrageOffen(false)
        router.replace('/account/login')
      } catch {
        setFehler(GERAETE_TEXT.fehler)
      }
    })
  }

  const knopfText = fuerKundin ? KUNDIN_GERAETE_TEXT.ueberallAbmelden : GERAETE_TEXT.alleAnderenAbmelden
  const frage = {
    titel: fuerKundin ? KUNDIN_GERAETE_TEXT.blattTitel : GERAETE_TEXT.blattTitel,
    satz: fuerKundin ? KUNDIN_GERAETE_TEXT.blattSatz : alleAnderenSatz(zeilen),
    zusatz: fuerKundin ? null : hinweise.blattZusatz,
    knopf: (
      <button
        type="button"
        onClick={() => (fuerKundin ? meldeUeberallAbUndWeiter() : fuehreAus(meldeAlleAnderenAb, null))}
        disabled={laeuft}
        className={cn(KNOPF_ORANGE, 'w-full disabled:opacity-60', breit && 'w-auto')}
      >
        {laeuft ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <LogOut className="size-4" strokeWidth={1.7} aria-hidden="true" />}
        {laeuft ? GERAETE_TEXT.einenMoment : knopfText}
      </button>
    ),
  }

  const liste = (
    <ul className="divide-y divide-border">
      {zeilen.map((zeile) => {
        const Symbol = zeile.art === 'handy' ? Smartphone : Monitor
        return (
          <li key={zeile.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            {/* Die Kundin sieht die Zeilen ohne Symbol (Board s2-kundenkonto). */}
            {!fuerKundin && <Symbol className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />}
            <div className="min-w-0 flex-1">
              <p className={cn('font-semibold break-words text-foreground', fuerKundin ? 'text-[15px]' : 'text-sm')}>{zeile.name}</p>
              <p className={cn('leading-snug text-muted-foreground', fuerKundin ? 'text-[13px]' : 'text-xs')}>{zeile.unterzeile}</p>
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
  )
  const fehlerZeile = (
    <>
      {fehler && (
        <p role="alert" className="rounded-xl border border-primary/45 bg-primary/12 px-3 py-2.5 text-sm leading-relaxed text-foreground">
          {fehler}
        </p>
      )}
    </>
  )
  const frageDialog = (
    <>
      {breit ? (
        <Dialog open={frageOffen} onOpenChange={(auf) => !laeuft && setFrageOffen(auf)}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogTitle className="font-heading text-xl leading-tight font-semibold">{frage.titel}</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-foreground">{frage.satz}</DialogDescription>
            {frage.zusatz && <p className="text-[13px] leading-relaxed text-muted-foreground">{frage.zusatz}</p>}
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
            {frage.zusatz && <p className="text-[13px] leading-relaxed text-muted-foreground">{frage.zusatz}</p>}
            {frage.knopf}
            <SheetClose disabled={laeuft} className={cn(KNOPF_RAHMEN, 'w-full')}>
              {GERAETE_TEXT.abbrechen}
            </SheetClose>
          </SheetBlatt>
        </Sheet>
      )}
    </>
  )

  // Kundin (/account): Kennzeile über der Karte, die Karte nur mit den Geräten, darunter „Überall abmelden“
  // als eigener neutraler Knopf und der Satz (Board s2-/w2-kundenkonto, Bild 3/5) — ohne Titel, Symbol und Zähler.
  if (fuerKundin) {
    return (
      <section aria-labelledby="geraete-titel" className="flex flex-col gap-3">
        <h2 id="geraete-titel" className={KONTO_ETIKETT}>
          {GERAETE_TEXT.titel}
        </h2>
        <div className="rounded-2xl border border-border bg-card px-4 py-3.5 dark:ring-0">{liste}</div>
        {fehlerZeile}
        <button type="button" onClick={() => setFrageOffen(true)} disabled={laeuft} className={KNOPF_UEBERALL}>
          {knopfText}
        </button>
        <p className="text-[13px] leading-normal text-muted-foreground">{KUNDIN_GERAETE_TEXT.hinweis}</p>
        {frageDialog}
      </section>
    )
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
        {liste}
        {fehlerZeile}

        {andere > 0 && (
          <button type="button" onClick={() => setFrageOffen(true)} disabled={laeuft} className={cn(KNOPF_ORANGE_RAHMEN, 'w-full disabled:opacity-60')}>
            <LogOut className="size-4" strokeWidth={1.7} aria-hidden="true" />
            {knopfText}
          </button>
        )}

        <p className="text-xs leading-relaxed text-muted-foreground">{hinweise.hinweis}</p>
        {satz && <p className="text-xs leading-relaxed text-muted-foreground">{satz}</p>}
      </CardContent>
      {frageDialog}
    </Card>
  )
}
