'use client'

import { useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { RUNDUNG } from '@/components/ui/rundung'
import { EmptyState } from '@/components/ui/empty-state'
import { HinweiskarteFehler } from '@/components/ui/hinweiskarte'
import { FeldMitFehler } from '@/components/ui/feld-fehler'
import { Input } from '@/components/ui/input'
import { Dialog, DialogMitte, DialogTrigger } from '@/components/ui/dialog'
import { FormularPruefen, SpeicherFehler } from '@/components/shared/formular-meldungen'
import { KNOPF_ORANGE, KNOPF_ORANGE_RAHMEN, KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'
import { NETZ_SATZ, NETZ_SATZ_UNSICHER } from '@/lib/netz'
import { PRODUKTE_LEER } from '@/lib/produkte-hof'

/**
 * Die Abschnitte der Nr. 246 (Lauf 32) in der Bausteine-Vorschau: G4 Leerzustand, G6 Formularfehler und
 * „Nochmal", G7 Meldung (Toast) und der Startfokus auf „Abbrechen". Nur zum Ansehen — kein Knopf ruft eine
 * Aktion; „Nochmal" und „Rückgängig" tun hier nichts. Der Fehlerkasten mit „Nochmal" erscheint erst auf
 * Tipp: Er nimmt beim Erscheinen den Fokus (G6), beim Laden der Seite würde er sonst dorthin springen.
 */
export function Vorschau246(): React.JSX.Element {
  return (
    <>
      <Leerzustand />
      <Formularfehler />
      <Meldung />
      <Startfokus />
    </>
  )
}

/** Derselbe Rahmen wie die Abschnitte von bausteine-vorschau.tsx (die Datei ändert 246 nicht). */
function Abschnitt({ id, titel, satz, children }: { id: string; titel: string; satz: string; children: ReactNode }) {
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

const RAHMEN_KNOPF_BREIT = cn(KNOPF_RAHMEN, 'h-12 justify-center text-[15px] font-semibold')
const ORANGE_KNOPF_BREIT = cn(KNOPF_ORANGE, 'h-12 justify-center text-[15px] font-semibold')

function Leerzustand() {
  return (
    <Abschnitt
      id="leerzustand-246"
      titel="Leerzustand ohne Symbol (G4)"
      satz="Linksbündige Karte, durchgezogener Rand, Titel fett in der Grundschrift, ein Satz, ein Knopf über die volle Breite — im Hof orange, wo es die Hauptaktion ist."
    >
      <div className="grid gap-3 md:grid-cols-2">
        <EmptyState
          titel={PRODUKTE_LEER.titel}
          satz={PRODUKTE_LEER.satz}
          ausweg={
            <Link href="/intern/bausteine#leerzustand-246" className={ORANGE_KNOPF_BREIT}>
              Produkt anlegen
            </Link>
          }
        />
        <EmptyState
          titel="Keine Höfe in diesem Umkreis"
          satz="Erweitere den Umkreis oder such nach einem anderen Ort."
          ausweg={
            <Link href="/intern/bausteine#leerzustand-246" className={RAHMEN_KNOPF_BREIT}>
              Umkreis auf 25 km erweitern
            </Link>
          }
        />
      </div>
    </Abschnitt>
  )
}

function Formularfehler() {
  const [netz, setNetz] = useState(false)
  return (
    <Abschnitt
      id="formularfehler-246"
      titel="Formularfehler und „Nochmal“ (G6)"
      satz="Zusammenfassung oben, Feldfehler unter dem Feld (orange Rand, aria-invalid, 14 px halbfett), Netzfehler als Kasten am Formular. „Nochmal“ klein, linksbündig, Warnfarbe, nie deaktiviert — nicht bei unsicheren Aktionen, nicht in Verkäufe, nicht beim Anlegen eines Produkts."
    >
      <div className="flex max-w-xl flex-col gap-3">
        <FormularPruefen anzahl={1} />
        <FeldMitFehler id="vorschau-246-plz" label="Postleitzahl" fehler="Die Postleitzahl hat in Österreich 4 Ziffern.">
          {(feld) => <Input {...feld} defaultValue="528" className={cn('h-12 text-base', feld.className)} />}
        </FeldMitFehler>
        {netz ? (
          <SpeicherFehler text={NETZ_SATZ} nochmal onNochmal={() => undefined} />
        ) : (
          <button type="button" onClick={() => setNetz(true)} className={cn(KNOPF_RAHMEN, 'self-start')}>
            Netzfehler zeigen
          </button>
        )}
        <HinweiskarteFehler>{NETZ_SATZ_UNSICHER}</HinweiskarteFehler>
      </div>
    </Abschnitt>
  )
}

function Meldung() {
  return (
    <Abschnitt
      id="meldung-246"
      titel="Meldung (G7)"
      satz="Dunkler Balken unten über Unter- und Aktionsleiste, verdeckt nie die h1; „Rückgängig“ als oranger Textknopf, ≥ 4,5:1 in beiden Themes."
    >
      <button
        type="button"
        onClick={() => toast('Als gepackt markiert', { action: { label: 'Rückgängig', onClick: () => undefined } })}
        className={cn(KNOPF_RAHMEN, 'self-start')}
      >
        Meldung zeigen
      </button>
    </Abschnitt>
  )
}

function Startfokus() {
  const abbrechenRef = useRef<HTMLButtonElement>(null)
  const [offen, setOffen] = useState(false)
  return (
    <Abschnitt
      id="startfokus-246"
      titel="Startfokus auf „Abbrechen“"
      satz="Rückfragen mit orangem Hauptknopf (löschen, stornieren, pausieren, stilllegen) öffnen mit dem Fokus auf „Abbrechen“ — ein Enter zu viel löst nichts aus."
    >
      <Dialog open={offen} onOpenChange={setOffen}>
        <DialogTrigger className={cn(KNOPF_RAHMEN, 'self-start')}>Rückfrage öffnen</DialogTrigger>
        <DialogMitte
          titel="Ganze Bestellung stornieren?"
          initialFocus={abbrechenRef}
          aktionen={
            <>
              <button type="button" ref={abbrechenRef} onClick={() => setOffen(false)} className={cn(RAHMEN_KNOPF_BREIT, FOKUS_RAHMEN)}>
                Abbrechen
              </button>
              <button type="button" onClick={() => setOffen(false)} className={cn(KNOPF_ORANGE_RAHMEN, 'h-12 justify-center text-[15px] font-semibold')}>
                Stornieren
              </button>
            </>
          }
        >
          <p className="text-muted-foreground">Die Ware kommt zurück in den Vorrat. Die Kundin bekommt eine Mail.</p>
        </DialogMitte>
      </Dialog>
    </Abschnitt>
  )
}
