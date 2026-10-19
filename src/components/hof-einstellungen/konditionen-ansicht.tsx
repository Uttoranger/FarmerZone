import { Fragment } from 'react'
import Link from 'next/link'
import { Check, Info, Sprout } from 'lucide-react'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { StatusBadge } from '@/components/ui/status-badge'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { KARTE, KICKER } from '@/components/hof-bestellungen/stil'
import { UnterseitenKopf } from '@/components/hofbereich/unterseiten-kopf'
import {
  DEIN_STAND_TITEL,
  KONDITIONEN_STAND,
  KONDITIONEN_UEBERGANG,
  KOSTENLOS,
  MONATSABRECHNUNG_TEILE,
  TARIFE_TITEL,
  VERGLEICH_SATZ,
  VERGLEICH_TEXT,
  VOLLER_WARENPREIS,
  type DeinStand,
  type TextTeil,
} from '@/lib/konditionen'
import {
  baueKonditionenSeite,
  konditionenRechenbeispiel,
  type KonditionenHof,
  type RechenSeite,
  type TarifKarteAnzeige,
  type VergleichZeile,
} from '@/lib/hof-einstellungen'
import { cn } from '@/lib/utils'

/**
 * „Deine Konditionen" (/settings/konditionen), seit Nr. 61 nach den Mockups
 * web-/mobil-h1-einstellungen-konditionen-v2: oben „Dein Stand" mit dem
 * Übergang K1, dann die Tarife — Hoftor „kostenlos", der Preis von Hofladen
 * erst NACH den Leistungen und mit Bedingungen (E6-Ergänzung) —, der
 * Vergleich „Heute / Im Hoftor", das Rechenbeispiel, die Abrechnung.
 *
 * ALLE Preise, Daten und Zusagen kommen aus src/lib/konditionen.ts, Stand,
 * Karten und Vergleich aus baueKonditionenSeite (Tarif-Zustand wie die
 * Tarif-Zeile), das Rechenbeispiel aus den gespeicherten Sätzen dieses Hofs —
 * hier steht keine Zahl (tests/konditionen-seiten.test.ts). „Dein Stand" gibt
 * es vor dem Stichtag und für einen Gründungshof bis zu seinem Tag (K2); sonst
 * steht der Übergang wie in Fassung 1 als grüne Hinweiskarte (nach dem
 * Stichtag: Gate 8).
 */
export function KonditionenAnsicht({
  hof,
  jetzt,
  abzeichen = null,
}: {
  hof: KonditionenHof
  jetzt: Date
  /** Der Schalter „Abzeichen zeigen“ im Block „Dein Stand“ (Register K2, Nr. 116) — nur für Gründungshöfe, sonst null. */
  abzeichen?: React.ReactNode
}): React.JSX.Element {
  const beispiel = konditionenRechenbeispiel(hof, jetzt)
  const seite = baueKonditionenSeite(hof, jetzt)

  return (
    <div>
      <UnterseitenKopf titel="Deine Konditionen" satz={beispiel.mitProvision ? undefined : VOLLER_WARENPREIS} />

      <div className="flex flex-col gap-5 md:gap-6">
        {/* Vor den Preisen, damit keiner als heute fällig gelesen wird (Register K1). */}
        {seite.stand ? (
          <DeinStandKarte stand={seite.stand} zusatz={abzeichen} />
        ) : (
          <Hinweiskarte ton="gruen" symbol={Info}>
            <p className="font-medium">{KONDITIONEN_UEBERGANG}</p>
          </Hinweiskarte>
        )}

        <section aria-labelledby="tarife-titel">
          <h2 id="tarife-titel" className={KICKER}>
            {TARIFE_TITEL}
          </h2>
          {/* Luft oben für die Marken, die auf der Kante der Karten sitzen. */}
          <ul className="mt-5 grid gap-[22px] md:grid-cols-2 md:gap-3.5">
            {seite.karten.map((karte) => (
              <TarifKarte key={karte.id} karte={karte} />
            ))}
          </ul>
        </section>

        {seite.vergleich && <Vergleich zeilen={seite.vergleich} />}

        <section aria-labelledby="beispiel-titel" className={cn(KARTE, 'p-5 md:p-6')}>
          <h2 id="beispiel-titel" className="font-heading text-lg font-semibold text-foreground">
            {beispiel.titel}
          </h2>
          {beispiel.satz && <p className="mt-1 text-[13px] text-muted-foreground">{beispiel.satz}</p>}
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <RechenKarte seite={beispiel.online} />
            <RechenKarte seite={beispiel.bar} />
          </div>
        </section>

        <section aria-labelledby="abrechnung-titel">
          <h2 id="abrechnung-titel" className={cn(KICKER, 'mb-2.5')}>
            So rechnen wir ab
          </h2>
          <p className="text-[14px] leading-relaxed text-foreground md:text-[13.5px]">
            <Teile teile={MONATSABRECHNUNG_TEILE} />
          </p>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-[13px] text-muted-foreground">
          <p>Stand: {KONDITIONEN_STAND}</p>
          <Link
            href="/konditionen"
            className={cn('inline-flex min-h-11 items-center rounded-sm font-semibold text-brand-text underline-offset-2 hover:underline', FOKUS_RAHMEN)}
          >
            Konditionen für alle Höfe ansehen
          </Link>
        </div>
      </div>
    </div>
  )
}

/** Ein Satz in Teilen — hervorgehobene Teile fett, wie im Mockup. */
function Teile({ teile }: { teile: readonly TextTeil[] }): React.JSX.Element {
  return (
    <>
      {teile.map((teil, i) =>
        teil.betont ? (
          <strong key={i} className="font-semibold text-foreground">
            {teil.text}
          </strong>
        ) : (
          <Fragment key={i}>{teil.text}</Fragment>
        )
      )}
    </>
  )
}

/** Ein Punkt mit grünem Haken — Sätze von „Dein Stand" und Leistungen der Tarife. */
function HakenZeile({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <li className="flex items-start gap-2">
      <Check className="mt-0.5 size-4 shrink-0 text-status-fertig" strokeWidth={1.8} aria-hidden="true" />
      <span className="min-w-0">{children}</span>
    </li>
  )
}

/** „Dein Stand": wo der Hof steht, seine Sätze (beim Gründungshof die Zusage), darunter der Übergang K1 wörtlich. */
function DeinStandKarte({ stand, zusatz = null }: { stand: DeinStand; zusatz?: React.ReactNode }): React.JSX.Element {
  return (
    <Hinweiskarte ton="gruen" className="rounded-[18px] p-4 md:px-[22px] md:py-[18px]">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-status-fertig/16 text-status-fertig">
            <Sprout className="size-5" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[1.2px] text-status-fertig uppercase">{DEIN_STAND_TITEL}</p>
            <h2 className="font-heading text-[19px] leading-tight font-semibold text-foreground md:text-xl">{stand.titel}</h2>
          </div>
        </div>
        <ul className="flex flex-col gap-[7px] text-[14px] leading-[1.45] md:text-[13.5px]">
          {stand.saetze.map((satz, i) => (
            <HakenZeile key={i}>
              <Teile teile={satz} />
            </HakenZeile>
          ))}
        </ul>
        {zusatz}
        {/* Normale Textfarbe wie in jeder Hinweiskarte: Leise Schrift hielte auf der Tönung im hellen Thema keine 4,5:1. */}
        <p className="border-t border-status-fertig/20 pt-2.5 text-[12px] leading-normal text-foreground">{KONDITIONEN_UEBERGANG}</p>
      </div>
    </Hinweiskarte>
  )
}

/** Eine Tarif-Karte: Name (bei Hoftor „kostenlos"), für wen, Leistungen — der Preis erst darunter. */
function TarifKarte({ karte }: { karte: TarifKarteAnzeige }): React.JSX.Element {
  return (
    <li className={cn(KARTE, 'relative flex flex-col gap-3 px-5 py-[18px]', karte.marke?.ton === 'fertig' && 'border-accent')}>
      {karte.marke && (
        // Die Marke sitzt auf der Kante: Die Unterlage in Kartenfarbe deckt die Linie darunter.
        <span className="absolute -top-[11px] right-[18px] left-[18px] flex">
          <span className="flex max-w-full rounded-full bg-card">
            <StatusBadge status={karte.marke.ton}>{karte.marke.text}</StatusBadge>
          </span>
        </span>
      )}
      <div className="flex items-baseline justify-between gap-2.5">
        <h3 className="font-heading text-[19px] font-semibold text-foreground">{karte.name}</h3>
        {karte.kostenlos && <span className="font-heading text-[21px] font-semibold text-status-fertig">{KOSTENLOS}</span>}
      </div>
      <p className="-mt-1.5 text-[12.5px] text-muted-foreground">{karte.fuerWen}</p>
      <ul className="flex flex-col gap-[7px] text-[14px] leading-[1.45] text-foreground md:text-[13.5px]">
        {karte.leistungen.map((leistung) => (
          <HakenZeile key={leistung}>{leistung}</HakenZeile>
        ))}
      </ul>
      {karte.satz && <p className="mt-auto border-t border-border pt-2.5 text-[12.5px] text-muted-foreground">{karte.satz}</p>}
      {karte.preis && (
        <div className="mt-auto flex flex-col gap-[3px] border-t border-border pt-2.5">
          <p className="text-[15px] font-semibold text-foreground">{karte.preis.betrag}</p>
          <p className="text-[12.5px] leading-[1.45] text-muted-foreground">{karte.preis.bedingungen}</p>
        </div>
      )}
      {karte.preis?.wahl && <p className="text-[12.5px] text-foreground">{karte.preis.wahl}</p>}
    </li>
  )
}

/** Was sich ab dem Stichtag für diesen Hof ändert: seine Zahlen neben den Grenzen von Hoftor. */
function Vergleich({ zeilen }: { zeilen: readonly VergleichZeile[] }): React.JSX.Element {
  return (
    <section aria-labelledby="vergleich-titel" className={cn(KARTE, 'flex flex-col gap-2.5 p-4 md:px-[22px] md:py-[18px]')}>
      <h2 id="vergleich-titel" className="text-[15px] font-semibold text-foreground">
        {VERGLEICH_TEXT.titel}
      </h2>
      <table className="w-full table-fixed text-left text-[14px] md:text-[13.5px]">
        <thead>
          <tr className="text-[11.5px] tracking-[0.6px] text-muted-foreground uppercase">
            <td className="w-2/5 pb-1.5" />
            <th scope="col" className="pb-1.5 font-semibold">
              {VERGLEICH_TEXT.heute}
            </th>
            <th scope="col" className="pb-1.5 font-semibold">
              {VERGLEICH_TEXT.hoftor}
            </th>
          </tr>
        </thead>
        <tbody>
          {zeilen.map((zeile) => (
            <tr key={zeile.label} className="border-t border-border">
              <th scope="row" className="py-[9px] pr-2.5 font-normal text-muted-foreground">
                {zeile.label}
              </th>
              <td className="py-[9px] pr-2.5 font-semibold text-foreground tabular-nums">{zeile.heute}</td>
              <td className="py-[9px] text-foreground tabular-nums">{zeile.hoftor}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[14px] leading-[1.55] text-foreground md:text-[13.5px]">
        <Teile teile={VERGLEICH_SATZ} />
      </p>
    </section>
  )
}

/** Eine Spalte des Rechenbeispiels: Zeilen als Beschreibungsliste, Summen hervorgehoben. */
function RechenKarte({ seite }: { seite: RechenSeite }): React.JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <h3 className="text-[14.5px] font-semibold text-foreground">{seite.titel}</h3>
      <dl className="mt-2.5 flex flex-col text-[13.5px]">
        {seite.zeilen.map((zeile) => (
          <div
            key={zeile.label}
            className={cn('flex items-baseline justify-between gap-3 py-1', zeile.summe && 'mt-1 border-t border-border pt-2 font-semibold')}
          >
            <dt className={cn('min-w-0', zeile.summe ? 'text-foreground' : 'text-muted-foreground')}>{zeile.label}</dt>
            <dd className="shrink-0 text-foreground tabular-nums">{zeile.betrag}</dd>
          </div>
        ))}
      </dl>
      {seite.satz && <p className="mt-2.5 text-[12.5px] leading-relaxed text-muted-foreground">{seite.satz}</p>}
    </div>
  )
}
