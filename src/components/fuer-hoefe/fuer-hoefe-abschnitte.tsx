import Link from 'next/link'
import { Check, ChevronDown } from 'lucide-react'
import {
  FUER_HOEFE_FRAGEN,
  FUER_HOEFE_FUTTER,
  FUER_HOEFE_SCHLUSS,
  FUER_HOEFE_SCHRITTE,
  FUER_HOEFE_VORTEILE,
} from '@/lib/fuer-hoefe'
import { KONDITIONEN_UEBERGANG, PRO_MONAT, SERVICEGEBUEHR_ZAHLT_KUNDE, TARIFE, type TarifText } from '@/lib/konditionen'
import { categoryImagePath } from '@/lib/product-image'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Kicker } from '@/components/startseite/kicker'
import { Illustration } from '@/components/startseite/startseite-abschnitte'
import { HeuteBild } from '@/components/fuer-hoefe/heute-bild'
import { StartSchritte } from '@/components/fuer-hoefe/start-schritte'

/*
 * Die Abschnitte von /fuer-hoefe in der Reihenfolge des Mockups
 * (web-h0-fuer-hoefe, mobil-h0-fuer-hoefe): Einstieg mit dem Bild der App,
 * Vorteile, So startest du, Preise, Futter, Fragen, Abschluss. Alles
 * Server-Komponenten ohne Skript; die Fragen klappt <details> selbst auf.
 * Hofwelt, also Orange für den Handlungsknopf (DESIGN_SYSTEM, „Farbrollen").
 * Texte aus src/lib/fuer-hoefe.ts, Preise nur aus src/lib/konditionen.ts.
 */

const CONTAINER = 'mx-auto max-w-[1200px] px-4 md:px-6'
const H2 = 'font-heading text-[22px] font-semibold text-balance md:text-[32px]'

/** Der orange Handlungsknopf der Hofwelt — als Link, er führt zur Registrierung. */
const KNOPF_ORANGE = cn(
  'inline-flex h-12 items-center justify-center rounded-full border border-primary-foreground/30 bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity duration-[250ms] hover:opacity-90',
  FOKUS_RAHMEN
)
const KNOPF_UMRISS = cn(
  'inline-flex h-12 items-center justify-center rounded-full border border-border px-5 text-sm font-medium text-foreground transition-colors duration-[250ms] hover:bg-muted',
  FOKUS_RAHMEN
)

export function FuerHoefeEinstieg(): React.JSX.Element {
  return (
    <section aria-labelledby="fuer-hoefe-titel" className="pt-8 pb-10 md:pt-14 md:pb-16">
      <div className={cn(CONTAINER, 'grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:gap-12')}>
        <div className="flex flex-col gap-4">
          <Kicker ton="orange">Für Höfe</Kicker>
          <h1 id="fuer-hoefe-titel" className="font-heading text-[34px] leading-[1.08] font-semibold text-balance md:text-[52px]">
            Dein Hofladen, online.
          </h1>
          <p className="text-[15px] leading-normal text-foreground md:hidden">
            Kunden bestellen vorab, du packst nach Liste und übergibst zur Abholzeit. Der volle Warenpreis bleibt bei dir.
          </p>
          <p className="hidden max-w-[34rem] text-[17px] leading-normal text-foreground md:block">
            Kunden bestellen vorab, du siehst alles auf einer Packliste und übergibst zur Abholzeit. Weniger Telefonieren,
            kein Kassenstress – und der volle Warenpreis bleibt bei dir.
          </p>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Link href="/register" className={KNOPF_ORANGE}>
              Kostenlos starten
            </Link>
            <Link href="/konditionen" className={KNOPF_UMRISS}>
              Konditionen ansehen
            </Link>
          </div>
          <p className="max-w-[34rem] text-[13px] leading-normal text-muted-foreground">{KONDITIONEN_UEBERGANG}</p>
        </div>
        <HeuteBild />
      </div>
    </section>
  )
}

export function FuerHoefeVorteile(): React.JSX.Element {
  return (
    <section aria-label="Was du davon hast" className="pb-12 md:pb-20">
      <ul className={cn(CONTAINER, 'grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4')}>
        {FUER_HOEFE_VORTEILE.map((v) => (
          <li key={v.titel} className="rounded-2xl border border-border bg-card p-4 md:p-5">
            <h2 className="text-[15px] font-semibold md:text-[17px]">{v.titel}</h2>
            <p className="mt-1 text-[13.5px] leading-normal text-muted-foreground md:hidden">{v.kurz}</p>
            <p className="mt-1.5 hidden text-[14px] leading-normal text-muted-foreground md:block">{v.text}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function FuerHoefeSchritte(): React.JSX.Element {
  return (
    <section aria-labelledby="schritte-titel" className="border-y border-border bg-card/40 py-12 md:py-16">
      <div className={cn(CONTAINER, 'flex flex-col gap-6')}>
        <div className="flex flex-col gap-2">
          <Kicker ton="orange">So startest du</Kicker>
          <h2 id="schritte-titel" className={H2}>
            In vier Schritten zum ersten Verkauf
          </h2>
        </div>
        <StartSchritte schritte={FUER_HOEFE_SCHRITTE} spalten />
      </div>
    </section>
  )
}

function TarifKarte({ tarif, hervorgehoben }: { tarif: TarifText; hervorgehoben: boolean }) {
  return (
    <div className={cn('flex flex-col gap-3 rounded-2xl border bg-card p-5', hervorgehoben ? 'border-accent' : 'border-border')}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-heading text-xl font-semibold">{tarif.name}</h3>
        <p className="shrink-0">
          <span className="font-heading text-2xl font-semibold">{tarif.preis}</span>{' '}
          <span className="text-[13px] text-muted-foreground">{PRO_MONAT}</span>
        </p>
      </div>
      <p className="text-[13.5px] text-muted-foreground">{tarif.zusatz}</p>
      <ul className="flex flex-col gap-1.5">
        {tarif.leistungen.map((l) => (
          <li key={l} className="flex items-center gap-2 text-[14px]">
            <Check className="size-4 shrink-0 text-status-fertig" strokeWidth={1.7} aria-hidden="true" />
            {l}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function FuerHoefePreise(): React.JSX.Element {
  return (
    <section aria-labelledby="preise-titel" className="py-12 md:py-16">
      <div className={cn(CONTAINER, 'grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-10')}>
        <div className="flex flex-col gap-3">
          <Kicker ton="orange">Preise</Kicker>
          <h2 id="preise-titel" className={H2}>
            Einfach und fair
          </h2>
          {/* Die Karten zeigen die Tarife ab dem Stichtag — der Satz davor sagt
              das, damit kein Preis als heute fällig gelesen wird (K1). */}
          <p className="text-[14.5px] leading-normal font-semibold text-foreground">{KONDITIONEN_UEBERGANG}</p>
          <p className="text-[14.5px] leading-normal text-foreground">{SERVICEGEBUEHR_ZAHLT_KUNDE}</p>
          <Link
            href="/konditionen"
            className={cn(
              'inline-flex min-h-11 items-center self-start rounded-full px-1 text-[14px] font-semibold text-status-fertig underline-offset-2 hover:underline',
              FOKUS_RAHMEN
            )}
          >
            Alle Konditionen
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2 md:gap-4">
          {TARIFE.map((t, i) => (
            <TarifKarte key={t.id} tarif={t} hervorgehoben={i === TARIFE.length - 1} />
          ))}
        </div>
      </div>
    </section>
  )
}

export function FuerHoefeFutter(): React.JSX.Element {
  return (
    <section aria-labelledby="futter-titel" className="pb-12 md:pb-16">
      <div className={CONTAINER}>
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 md:gap-6 md:p-6">
          <Illustration src={categoryImagePath('HEU_STROH')} sizes="96px" className="size-16 shrink-0 rounded-xl md:size-24" />
          <div className="min-w-0">
            <h2 id="futter-titel" className="font-heading text-lg font-semibold md:text-xl">
              {FUER_HOEFE_FUTTER.titel}
            </h2>
            <p className="mt-1 text-[13.5px] leading-normal text-muted-foreground md:text-[14.5px]">{FUER_HOEFE_FUTTER.text}</p>
          </div>
        </div>
      </div>
    </section>
  )
}

export function FuerHoefeFragen(): React.JSX.Element {
  return (
    <section aria-labelledby="fragen-titel" className="pb-12 md:pb-16">
      <div className={cn(CONTAINER, 'flex flex-col gap-4 md:flex-row md:gap-[60px]')}>
        <div className="md:w-[340px] md:shrink-0">
          <Kicker ton="orange">Fragen von Höfen</Kicker>
          <h2 id="fragen-titel" className={H2}>
            Gut zu wissen
          </h2>
        </div>
        <div className="flex flex-1 flex-col border-t border-border">
          {FUER_HOEFE_FRAGEN.map((eintrag, i) => (
            <details key={eintrag.frage} name="fragen-hoefe" open={i === 0} className="group border-b border-border last:border-b-0">
              <summary
                className={cn(
                  'flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-md py-4 text-left text-[15px] font-semibold text-foreground transition-colors hover:text-brand-text [&::-webkit-details-marker]:hidden',
                  FOKUS_RAHMEN
                )}
              >
                {eintrag.frage}
                <ChevronDown
                  className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="pb-4 text-[13.5px] leading-normal text-muted-foreground">{eintrag.antwort}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

export function FuerHoefeSchluss(): React.JSX.Element {
  return (
    <section aria-labelledby="schluss-titel" className="pb-14 md:pb-20">
      <div className={CONTAINER}>
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-primary/45 bg-linear-120 from-primary/16 to-card to-70% px-5 py-10 text-center md:py-12">
          <h2 id="schluss-titel" className={H2}>
            {FUER_HOEFE_SCHLUSS.titel}
          </h2>
          <p className="text-[14.5px] text-foreground">{FUER_HOEFE_SCHLUSS.text}</p>
          <Link href="/register" className={cn(KNOPF_ORANGE, 'mt-2')}>
            Kostenlos starten
          </Link>
        </div>
      </div>
    </section>
  )
}
