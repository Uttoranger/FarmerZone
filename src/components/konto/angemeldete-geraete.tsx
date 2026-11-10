'use client'

import { useRouter } from 'next/navigation'
import { useId, useState, useTransition } from 'react'
import { Loader2, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GERAETE_TEXT, alleAnderenSatz, geraeteHinweise, type GeraeteZeile } from '@/lib/geraete'
import { useMindestbreite } from '@/lib/use-mindestbreite'
import { KUNDIN_GERAETE_TEXT } from '@/lib/sitzung-dauer'
import { meldeAlleAnderenAb, meldeGeraetAb, meldeUeberallAb, type AbmeldenAntwort } from '@/server/actions/geraete'
import { Marke } from '@/components/ui/marke'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetBlatt, SheetClose, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { KNOPF_ORANGE, KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'
import { HELLER_KNOPF } from '@/components/hof-einstellungen/knopf'
import { RUNDUNG } from '@/components/ui/rundung'
import { KNOPF_UMRISS } from '@/components/anmelden/stil'

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
 * Kennzeile, Gerätekarte und eigener neutraler Knopf, ohne „Was wir speichern". Seit Nr. 278 (Boards
 * s2-/w2-konto-hof Bild 2) gilt dieser Aufbau auch für Hof und Admin: Kennzeile statt Kartentitel, Liste
 * ohne Symbole, „dieses Gerät" als Pille ohne Rand, „Alle anderen abmelden" als heller Knopf unter der
 * Liste. `satz` (Konto und Sicherheit der Höfe) hängt am Hinweis: die Höchstdauer.
 */

const KNOPF_KLEIN = cn(KNOPF_RAHMEN, 'min-h-11 shrink-0 px-4 text-[13px] font-semibold')

/** Kennzeile über einem Abschnitt von „Mein Konto“ (Board s2-/w2-kundenkonto): 13 px fett, Großbuchstaben, leise. */
export const KONTO_ETIKETT = 'text-[13px] font-bold tracking-[0.5px] text-muted-foreground uppercase'

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
  // Eigene Kennung je Einbau: Die Seite darf den Baustein nicht zweimal mit derselben id tragen.
  const titelId = useId()
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
      {zeilen.map((zeile) => (
        // Zeilen ohne Symbol, Name 15 px fett, Unterzeile 13 px (Boards s2-/w2-konto-hof Bild 2, s2-kundenkonto).
        <li key={zeile.id} className="flex min-h-[60px] items-center gap-2.5 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold break-words text-foreground">{zeile.name}</p>
            <p className="text-[13px] leading-snug text-muted-foreground">{zeile.unterzeile}</p>
          </div>
          {zeile.dieses ? (
            // Pille ohne Rand: 22 px, fett (Board konto-hof Bild 2).
            <Marke art="laeuft" form="schild" className="shrink-0">
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
      ))}
    </ul>
  )
  const fehlerZeile = (
    <>
      {fehler && (
        <p role="alert" className={cn(RUNDUNG.hinweis, 'border border-primary/45 bg-primary/12 px-3 py-2.5 text-sm leading-relaxed text-foreground')}>
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

  // Kennzeile über der Liste, die Karte nur mit den Geräten, darunter der helle Knopf und der Satz — ohne
  // Titelkarte, Symbol und Zähler (Boards s2-/w2-konto-hof Bild 2, s2-/w2-kundenkonto Bild 3/5). Gilt für
  // Hof, Kundin und Admin › Anmeldung gleich; die Kundin hat „Überall abmelden“ und ihren eigenen Satz.
  const zeigeKnopf = fuerKundin || andere > 0
  return (
    <section aria-labelledby={titelId} className="flex flex-col gap-3">
      <h2 id={titelId} className={KONTO_ETIKETT}>
        {GERAETE_TEXT.titel}
      </h2>
      <div className={cn(RUNDUNG.karte, 'border border-border bg-card px-3 py-1 dark:ring-0')}>{liste}</div>
      {fehlerZeile}
      {zeigeKnopf && (
        <button
          type="button"
          onClick={() => setFrageOffen(true)}
          disabled={laeuft}
          className={cn(fuerKundin ? KNOPF_UMRISS : HELLER_KNOPF, 'disabled:opacity-60')}
        >
          {knopfText}
        </button>
      )}
      <p className="text-[13px] leading-normal text-muted-foreground">
        {fuerKundin ? KUNDIN_GERAETE_TEXT.hinweis : satz ? `${hinweise.hinweis} ${satz}` : hinweise.hinweis}
      </p>
      {frageDialog}
    </section>
  )
}
