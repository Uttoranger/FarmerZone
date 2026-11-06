'use client'

import { createContext, useContext, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { RUECKWEG_PRAEFIX, elternseite } from '@/lib/bauern-navigation'
import { beimTipp, zielMitSuche } from '@/components/ui/rueckweg-tipp'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { RUNDUNG } from '@/components/ui/rundung'
import { WERKZEUG_KOPF_LEISTE, WERKZEUG_KOPF_SPALTE, WERKZEUG_KOPF_TITEL } from '@/components/ui/werkzeug-kopf-stil'
import { cn } from '@/lib/utils'

/**
 * Werkzeug-Kopf (Baustein G1, Nr. 245): der Kopf der Hof-Werkzeuge am Handy (feste Leiste) und im Web in
 * einem Baustein, mit dem Hof-Balken (G3) darunter; löst UnterseitenKopf ab.
 */

/*
 * Was unter dem Kopf in der Inhaltsspalte steht, bevor die Seite beginnt —
 * im Hofbereich der Hof-Balken (G3), gesetzt vom Layout der Routengruppe
 * (src/app/(hof)/layout.tsx), Quelle bleibt `ladeHofbereich`. Ein Kontext statt
 * eines Props, damit keine Seite den Balken vergessen kann: Wer den
 * Werkzeug-Kopf nimmt, bekommt den Balken darunter. Der Baustein selbst kennt
 * den Hofbereich nicht.
 */
const UnterKopfKontext = createContext<ReactNode>(null)

/** Gibt allen Werkzeug-Köpfen darunter ihren Inhalt unter dem Kopf (im Hofbereich: den Hof-Balken). */
export function UnterDemWerkzeugKopf({ inhalt, children }: { inhalt: ReactNode; children?: ReactNode }): React.JSX.Element {
  return <UnterKopfKontext.Provider value={inhalt}>{children}</UnterKopfKontext.Provider>
}

/**
 * Werkzeug-Kopf (Baustein G1, Nr. 245; Liste Lauf 32, Abschnitt 3.2) — der
 * Kopf der Hof-Werkzeuge und ihrer Unterseiten, am Handy und im Web in EINEM
 * Baustein. Löst `UnterseitenKopf` ab (hofbereich/unterseiten-kopf.tsx); die
 * alten Aufrufer stehen in tests/bestandslisten/unterseiten-kopf.ts.
 *
 * Handy (unter 768 px): feste Leiste oben, 56 px, `bg-card`, Linie unten;
 * links „‹“ (44 px, für den Screenreader „Zurück zu <Elternseite>“), daneben
 * der Titel als h1 und die Unterzeile, rechts höchstens eine Aktion (Telefon,
 * Postfach). Web: grüner, unterstrichener Textlink „‹ <Elternseite>“, darunter
 * h1 und Unterzeile, die Aktion bündig rechts.
 *
 * Wohin der Rückweg führt und wie die Elternseite heißt, entscheidet allein
 * `elternseite` (lib/bauern-navigation.ts); ohne Elternseite (Seiten der Leiste
 * und des Mehr-Blatts) gibt es keinen Rückweg, nur Titel und Unterzeile. Der
 * Tipp auf den Rückweg folgt derselben Regel wie beim alten Kopf
 * (`beimTipp`, ui/rueckweg-tipp.ts).
 *
 * Die h1 steht immer sichtbar, auch wenn sie wie die Elternseite heißt — die
 * Regel „h1 sr-only, wenn Titel = Elternseite“ (Nr. 56) gilt hier nicht mehr:
 * Der Rückweg zeigt am Handy nur „‹“, der Name steht nicht zweimal da.
 */
export function WerkzeugKopf({
  titel,
  unterzeile,
  aktion,
  suche,
  pfad,
}: {
  /** Der Seitentitel (h1). */
  titel: ReactNode
  /** Die Zeile unter dem Titel, im Hofbereich `HofUnterzeile` („<Hof> · Stand …“ am Handy, im Web der Hofname). */
  unterzeile?: ReactNode
  /** Höchstens EINE Aktion rechts (Telefon, Postfach) — am Handy in der Leiste, im Web bündig rechts. */
  aktion?: ReactNode
  /** Filter der Elternseite, der erhalten bleibt (z. B. `?filter=heute`). */
  suche?: string
  /** Nur für die Vorschau unter /intern: der Pfad, dessen Elternseite gezeigt wird. Echte Seiten lassen ihn weg. */
  pfad?: string
}): React.JSX.Element {
  const aktuellerPfad = usePathname()
  const eltern = elternseite(pfad ?? aktuellerPfad)
  const ziel = eltern ? zielMitSuche(eltern, suche) : null
  const unterKopf = useContext(UnterKopfKontext)

  return (
    <>
      {/* data-werkzeug-kopf: Das Layout blendet den Balken über der Seite aus, sobald ein Werkzeug-Kopf ihn trägt
          (hof-balken.tsx). data-unterseiten-leiste: Der Fokus scrollt am Handy nie unter diese Leiste
          (scroll-padding in globals.css). */}
      <div className={WERKZEUG_KOPF_LEISTE} data-werkzeug-kopf="" data-unterseiten-leiste="">
        {eltern && ziel && (
          <Link
            href={ziel}
            onClick={beimTipp(ziel)}
            className={cn(
              'grid size-11 shrink-0 place-items-center text-foreground transition-colors duration-[250ms] hover:bg-muted md:hidden print:hidden',
              RUNDUNG.feld,
              FOKUS_RAHMEN
            )}
          >
            <ChevronLeft className="size-[22px]" strokeWidth={2} aria-hidden="true" />
            <span className="sr-only">{`${RUECKWEG_PRAEFIX} ${eltern.name}`}</span>
          </Link>
        )}
        <div className={cn(WERKZEUG_KOPF_SPALTE, !ziel && 'pl-3 md:pl-0')}>
          {eltern && ziel && (
            <Link
              href={ziel}
              onClick={beimTipp(ziel)}
              className={cn(
                'mb-1 hidden min-h-11 w-fit items-center gap-1 text-[15px] font-semibold text-status-fertig underline decoration-1 underline-offset-4 md:inline-flex print:hidden',
                FOKUS_RAHMEN
              )}
            >
              <span aria-hidden="true">‹</span>
              <span className="sr-only">{`${RUECKWEG_PRAEFIX} `}</span>
              {eltern.name}
            </Link>
          )}
          <h1 className={WERKZEUG_KOPF_TITEL}>{titel}</h1>
          {unterzeile && <div className="min-w-0 overflow-hidden whitespace-nowrap md:mt-1 md:whitespace-normal">{unterzeile}</div>}
        </div>
        {aktion && <div className="flex shrink-0 items-center pr-1 md:pr-0">{aktion}</div>}
      </div>
      {unterKopf && <div className="mb-4 print:hidden">{unterKopf}</div>}
    </>
  )
}

/** Ladeansicht des Werkzeug-Kopfs — dieselbe Leiste, Titel und Unterzeile als Flächen. Der Balken steht schon darunter. */
export function WerkzeugKopfLaden(): React.JSX.Element {
  const unterKopf = useContext(UnterKopfKontext)
  return (
    <>
      <div className={WERKZEUG_KOPF_LEISTE} data-werkzeug-kopf="">
        <div className={cn(WERKZEUG_KOPF_SPALTE, 'gap-1.5 pl-3 md:gap-2 md:pl-0')}>
          <div className="h-5 w-36 rounded bg-border md:h-8 md:w-48" />
          <div className="h-3 w-52 max-w-full rounded bg-muted md:h-4 md:w-32" />
        </div>
      </div>
      {unterKopf && <div className="mb-4 print:hidden">{unterKopf}</div>}
    </>
  )
}
