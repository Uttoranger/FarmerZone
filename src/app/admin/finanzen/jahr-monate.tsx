'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { Wallet } from 'lucide-react'
import { FINANZEN_JAHR_TEXT, ergebnisText, monatOhneJahr, type JahrMonatAnzeige } from '@/lib/finanzen'
import { centsAlsEuro, formatEuro } from '@/lib/format'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Switch } from '@/components/ui/switch'
import { KARTE, KICKER, LEISE } from '@/components/hof-bestellungen/stil'

/**
 * Die Jahresansicht der Finanzen: das Diagramm „<Jahr> nach Monaten" und die
 * Tabelle „Monat für Monat" (Register N15, Ergänzung Nr. 100; Mockup
 * admin-finanzen-jahr). Gerechnet wird hier nichts — die Zahlen kommen als ganze
 * Cent aus `rechneJahr`; die Höhe eines Balkens ist nur Darstellung.
 *
 * Eine Client-Komponente aus zwei Gründen: Der Schalter „mit <Vorjahr>
 * vergleichen" ändert Diagramm UND Tabelle (kein eigener Zustand in der
 * Adresse), und das Diagramm misst seine Breite, damit Schrift und Balken bei
 * jeder Breite ihre Größe behalten (ein skaliertes SVG schrumpfte die Beschriftung
 * am Handy auf drei Pixel).
 *
 * Das Diagramm ist ein Bild (`role="img"`); die Tabelle darunter ist seine
 * Textfassung (`aria-describedby`) — mit denselben Zahlen, auch für den
 * Screenreader. Ein Klick auf einen Monat im Diagramm öffnet die Monatsansicht;
 * für die Tastatur sind die Zeilen der Tabelle dieselben Ziele, darum sind die
 * Flächen über dem Diagramm keine eigenen Tabulator-Halte.
 */

const HOEHE = 250
/** Grundlinie der Balken; darunter stehen die Monatsnamen. */
const BASIS = 216
/** Oberkante der höchsten Achsenmarke; darüber ist Platz für die Beschriftung eines Ausreißers. */
const OBEN = 30
const LINKS = 56
const RECHTS = 8
/** Die Breite vor dem ersten Messen (Server und erster Aufbau im Browser). */
const START_BREITE = 960
const MAX_BALKEN = 22

/** Ein runder Schritt für die Achse (1, 2, 2,5 oder 5 mal Zehnerpotenz, in Euro), so dass etwa drei Linien entstehen. */
function achsenSchritt(hoechsterCents: number): number {
  const roh = Math.max(1, hoechsterCents / 100) / 3
  const zehner = 10 ** Math.floor(Math.log10(roh))
  const rest = roh / zehner
  const faktor = rest <= 1 ? 1 : rest <= 2 ? 2 : rest <= 2.5 ? 2.5 : rest <= 5 ? 5 : 10
  return Math.round(faktor * zehner * 100)
}

function kuerze(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

function useBreite(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null)
  const [breite, setBreite] = useState(START_BREITE)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    // Der Beobachter meldet die Größe gleich beim Anmelden — ein eigenes erstes Messen braucht es nicht.
    const beobachter = new ResizeObserver(() => setBreite(Math.max(300, Math.floor(element.clientWidth))))
    beobachter.observe(element)
    return () => beobachter.disconnect()
  }, [])
  return [ref, breite]
}

export function JahrMonate({
  jahr,
  monate,
  vorjahr,
  vergleichAb,
  hinweisImVergleich = null,
}: {
  jahr: number
  monate: JahrMonatAnzeige[]
  /** Das Vorjahr, wenn es Daten hat; sonst null (der Schalter ist dann aus, mit Hinweis). */
  vorjahr: number | null
  vergleichAb: number
  /** Der Testzahlungs-Satz, wenn nur das Vorjahr eine auslässt — er gilt erst, wenn dessen Zahlen dastehen (testzahlungenHinweisImJahr). */
  hinweisImVergleich?: string | null
}): React.JSX.Element {
  const [vergleich, setVergleich] = useState(false)
  const [messRahmen, breite] = useBreite()
  const titelId = useId()
  const tabelleTitelId = useId()
  const tabelleId = useId()
  const text = FINANZEN_JAHR_TEXT

  const mitVergleich = vergleich && vorjahr !== null
  const leer = monate.every((m) => m.zahlen === null || (m.zahlen.servicegebuehrCents === 0 && m.zahlen.kostenCents === 0))
  if (leer) {
    return <EmptyState symbol={Wallet} titel={text.leerTitel} satz={text.leer} ausweg={{ ohne: 'Die Monate füllen sich von selbst, sobald Bestellungen eingehen; es gibt nichts, wohin der Weg führen könnte' }} />
  }

  const gezaehlt = monate.filter((m) => m.zahlen !== null).reverse()

  return (
    <>
      <section aria-labelledby={titelId} className={cn(KARTE, 'flex flex-col gap-4 p-4 md:p-[18px]')}>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 id={titelId} className="font-heading text-[17px] font-semibold text-foreground">
            {text.diagrammTitel(jahr)}
          </h2>
          <VergleichSchalter jahr={jahr} vorjahr={vorjahr} vergleichAb={vergleichAb} an={mitVergleich} onChange={setVergleich} />
          <Legende vorjahr={mitVergleich ? vorjahr : null} />
        </div>
        {mitVergleich && hinweisImVergleich && <p className={cn('-mt-2 text-[12.5px] leading-snug', LEISE)}>{hinweisImVergleich}</p>}
        <div ref={messRahmen}>
          <Diagramm jahr={jahr} monate={monate} breite={breite} vergleich={mitVergleich} beschreibtId={tabelleId} />
        </div>
      </section>

      <section aria-labelledby={tabelleTitelId} className="flex flex-col gap-2">
        <h2 id={tabelleTitelId} className={KICKER}>
          {text.monatFuerMonat}
        </h2>
        <div className={cn(KARTE, 'overflow-x-auto')}>
          <table id={tabelleId} aria-labelledby={tabelleTitelId} className="w-full min-w-[640px] text-[14px]">
            <thead>
              <tr className="text-left text-[12px] font-semibold text-muted-foreground">
                <th scope="col" className="px-4 py-3 font-semibold">
                  {text.monat}
                </th>
                <th scope="col" className="px-3 py-3 text-right font-semibold">
                  {text.legendeServicegebuehren}
                </th>
                {mitVergleich && (
                  <th scope="col" className="px-3 py-3 text-right font-semibold">
                    {text.vergleichSpalte}
                  </th>
                )}
                <th scope="col" className="px-3 py-3 text-right font-semibold">
                  {text.legendeKosten}
                </th>
                <th scope="col" className="px-3 py-3 text-right font-semibold">
                  Ergebnis
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Bestellungen
                </th>
              </tr>
            </thead>
            <tbody>
              {gezaehlt.map((m) => (
                <MonatsZeile key={m.monat} monat={m} mitVergleich={mitVergleich} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

function MonatsZeile({ monat, mitVergleich }: { monat: JahrMonatAnzeige; mitVergleich: boolean }): React.JSX.Element | null {
  const zahlen = monat.zahlen
  if (!zahlen) return null
  const euro = (cents: number) => formatEuro(centsAlsEuro(cents))
  return (
    // Die ganze Zeile ist das Ziel: Der Link im Monatsnamen spannt sich über sie.
    <tr className="relative border-t border-border hover:bg-muted">
      <th scope="row" className="px-4 py-3 text-left font-semibold text-foreground">
        <Link href={monat.href} className={cn('rounded-sm after:absolute after:inset-0 after:content-[""]', FOKUS_RAHMEN)}>
          {monat.bezeichnung}
        </Link>
      </th>
      <td className="px-3 py-3 text-right text-foreground tabular-nums">{euro(zahlen.servicegebuehrCents)}</td>
      {mitVergleich && (
        <td className={cn('px-3 py-3 text-right tabular-nums', LEISE)}>{monat.vorjahrCents === null ? '–' : euro(monat.vorjahrCents)}</td>
      )}
      <td className="px-3 py-3 text-right text-foreground tabular-nums">{euro(zahlen.kostenCents)}</td>
      <td
        className={cn(
          'px-3 py-3 text-right font-semibold tabular-nums',
          zahlen.ergebnisCents > 0 ? 'text-status-fertig' : zahlen.ergebnisCents < 0 ? 'text-status-offen' : 'text-foreground'
        )}
      >
        {ergebnisText(zahlen.ergebnisCents)}
      </td>
      <td className="px-4 py-3 text-right text-foreground tabular-nums">{zahlen.bestellungen}</td>
    </tr>
  )
}

/** „mit 2025 vergleichen" — aus, mit dem Grund daneben, solange das Vorjahr keine Zahlen hat. */
function VergleichSchalter({
  jahr,
  vorjahr,
  vergleichAb,
  an,
  onChange,
}: {
  jahr: number
  vorjahr: number | null
  vergleichAb: number
  an: boolean
  onChange: (an: boolean) => void
}): React.JSX.Element {
  const text = FINANZEN_JAHR_TEXT
  const moeglich = vorjahr !== null
  const beschriftungId = useId()
  return (
    // Das ganze Etikett ist die Tippfläche (≥ 44 px), der Schalter selbst ist kleiner.
    <label className={cn('inline-flex min-h-11 items-center gap-2.5 text-[13px]', moeglich ? 'cursor-pointer text-foreground' : LEISE)}>
      <Switch
        checked={an}
        onCheckedChange={onChange}
        disabled={!moeglich}
        aria-labelledby={beschriftungId}
        className="data-disabled:cursor-not-allowed data-disabled:opacity-50"
      />
      <span id={beschriftungId}>
        {moeglich ? text.vergleichen(vorjahr) : `${text.vergleichen(jahr - 1)} · ${text.vergleichAb(vergleichAb)}`}
      </span>
    </label>
  )
}

/** Die Legende über dem Diagramm: Servicegebühren · Kosten · noch offen (und das Vorjahr, wenn es verglichen wird). */
function Legende({ vorjahr }: { vorjahr: number | null }): React.JSX.Element {
  const text = FINANZEN_JAHR_TEXT
  return (
    <p aria-hidden="true" className={cn('flex flex-wrap gap-x-3 gap-y-1 text-[12px]', LEISE)}>
      {vorjahr !== null && (
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px] bg-status-fertig/50" />
          {text.legendeVorjahr(vorjahr)}
        </span>
      )}
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-[2px] bg-status-fertig" />
        {text.legendeServicegebuehren}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-[2px] bg-status-offen" />
        {text.legendeKosten}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-[2px] border border-dashed border-muted-foreground/60" />
        {text.nochOffen}
      </span>
    </p>
  )
}

/**
 * Das Diagramm: je Monat zwei Balken (Servicegebühren, Kosten), auf Wunsch
 * davor ein blasser für das Vorjahr; die Achse in €; ein offener Monat als
 * gestrichelter Kasten; ein Ausreißer mit dem Namen des einmaligen Postens am
 * Balken. Farben nur aus Tokens (`status-fertig` grün, `status-offen` orange),
 * also in beiden Themes. Jeder Monat ist ein Link auf seine Monatsansicht —
 * für die Maus; die Tastatur nimmt die Tabelle darunter.
 */
function Diagramm({
  jahr,
  monate,
  breite,
  vergleich,
  beschreibtId,
}: {
  jahr: number
  monate: JahrMonatAnzeige[]
  breite: number
  vergleich: boolean
  beschreibtId: string
}): React.JSX.Element {
  const hoechster = Math.max(
    1,
    ...monate.map((m) => Math.max(m.zahlen?.servicegebuehrCents ?? 0, m.zahlen?.kostenCents ?? 0, vergleich ? (m.vorjahrCents ?? 0) : 0))
  )
  const schritt = achsenSchritt(hoechster)
  const marken: number[] = []
  for (let c = 0; c < hoechster + schritt; c += schritt) marken.push(c)
  const obergrenze = marken[marken.length - 1] ?? schritt
  const hoeheFuer = (cents: number) => (cents <= 0 ? 0 : Math.max(2, Math.round((cents / obergrenze) * (BASIS - OBEN))))

  const spalte = (breite - LINKS - RECHTS) / monate.length
  const schmal = spalte < 40
  const balken = vergleich ? 3 : 2
  const luecke = 3
  const balkenBreite = Math.max(4, Math.min(MAX_BALKEN, (spalte - 10 - (balken - 1) * luecke) / balken))
  const gruppe = balken * balkenBreite + (balken - 1) * luecke
  const schrift = schmal ? 10 : 12

  return (
    <div className="relative">
      <svg
        role="img"
        aria-label={FINANZEN_JAHR_TEXT.diagrammBeschriftung(jahr)}
        aria-describedby={beschreibtId}
        viewBox={`0 0 ${breite} ${HOEHE}`}
        width="100%"
        height={HOEHE}
        className="block"
      >
        {marken.map((c) => {
          const y = BASIS - hoeheFuer(c)
          return (
            <g key={c}>
              <line x1={LINKS} x2={breite - RECHTS} y1={y} y2={y} className="stroke-border" strokeWidth={1} />
              <text x={LINKS - 8} y={y + 4} textAnchor="end" fontSize={11} className="fill-muted-foreground">
                {formatEuro(centsAlsEuro(c), 0)}
              </text>
            </g>
          )
        })}
        {monate.map((m, i) => {
          const links = LINKS + i * spalte
          const mitte = links + spalte / 2
          const x0 = mitte - gruppe / 2
          const zahlen = m.zahlen
          const kostenX = x0 + (balken - 1) * (balkenBreite + luecke)
          const kostenHoehe = zahlen ? hoeheFuer(zahlen.kostenCents) : 0
          const rechts = mitte > breite / 2
          return (
            <g key={m.monat}>
              {zahlen === null ? (
                <>
                  <rect
                    x={links + 3}
                    y={BASIS - 60}
                    width={spalte - 6}
                    height={60}
                    rx={4}
                    fill="none"
                    strokeDasharray="4 4"
                    className="stroke-muted-foreground/60"
                  />
                  {!schmal && (
                    <text x={mitte} y={BASIS - 66} textAnchor="middle" fontSize={10.5} className="fill-muted-foreground">
                      offen
                    </text>
                  )}
                </>
              ) : (
                <>
                  {vergleich && m.vorjahrCents !== null && (
                    <rect
                      x={x0}
                      y={BASIS - hoeheFuer(m.vorjahrCents)}
                      width={balkenBreite}
                      height={hoeheFuer(m.vorjahrCents)}
                      rx={3}
                      className="fill-status-fertig/50"
                    />
                  )}
                  <rect
                    x={x0 + (vergleich ? balkenBreite + luecke : 0)}
                    y={BASIS - hoeheFuer(zahlen.servicegebuehrCents)}
                    width={balkenBreite}
                    height={hoeheFuer(zahlen.servicegebuehrCents)}
                    rx={3}
                    className="fill-status-fertig"
                  />
                  <rect
                    x={kostenX}
                    y={BASIS - kostenHoehe}
                    width={balkenBreite}
                    height={kostenHoehe}
                    rx={3}
                    className="fill-status-offen"
                  />
                  {m.ausreisser !== null && (
                    <text
                      x={rechts ? kostenX + balkenBreite : kostenX}
                      y={BASIS - kostenHoehe - 6}
                      textAnchor={rechts ? 'end' : 'start'}
                      fontSize={10.5}
                      className="fill-status-offen"
                    >
                      {`${kuerze(m.ausreisser, 24)} (${FINANZEN_JAHR_TEXT.einmaligZusatz})`}
                    </text>
                  )}
                </>
              )}
              <text x={mitte} y={238} textAnchor="middle" fontSize={schrift} className="fill-muted-foreground">
                {schmal ? monatOhneJahr(m.monat).slice(0, 3) : monatOhneJahr(m.monat)}
              </text>
            </g>
          )
        })}
      </svg>
      {/* Die Fläche eines Monats öffnet seine Ansicht — neben dem Bild, nicht darin: Ein Link in einem `role="img"` ist für
          Screenreader unsichtbar und für Axe ein Fehler (nested-interactive). Für die Tastatur sind die Zeilen der Tabelle
          dieselben Ziele, darum kein eigener Tabulator-Halt und kein Eintrag für Screenreader. Die Lage in Prozent der
          Breite folgt dem Bild auch vor dem ersten Messen. */}
      <div aria-hidden="true" className="absolute inset-0">
        {monate.map((m, i) => (
          <Link
            key={m.monat}
            href={m.href}
            tabIndex={-1}
            prefetch={false}
            title={
              m.zahlen
                ? `${m.bezeichnung}: ${FINANZEN_JAHR_TEXT.legendeServicegebuehren} ${formatEuro(centsAlsEuro(m.zahlen.servicegebuehrCents))}, ${FINANZEN_JAHR_TEXT.legendeKosten} ${formatEuro(centsAlsEuro(m.zahlen.kostenCents))}`
                : `${m.bezeichnung}: ${FINANZEN_JAHR_TEXT.nochOffen}`
            }
            className="absolute inset-y-0 rounded-md hover:bg-foreground/5"
            style={{ left: `${((LINKS + i * spalte) / breite) * 100}%`, width: `${(spalte / breite) * 100}%` }}
          />
        ))}
      </div>
    </div>
  )
}
