import type { ReactNode } from 'react'
import Link from 'next/link'
import { CalendarPlus, Check, CheckCircle2, Clock, Info, MapPin, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { formatEuro } from '@/lib/format'
import { SERVICEGEBUEHR_BEZEICHNUNG, SERVICEGEBUEHR_HINWEIS, bestellSummen, centsAlsEuro, gebuehrEntfallen } from '@/lib/servicegebuehr'
import type { BestaetigungsKopf, BestellSchritt } from '@/lib/bestaetigung'

/*
 * Bausteine der Bestätigungsseite /{hof}/confirm/{id} (Nr. 13). Mockups:
 * web-k3-bestaetigung-online-mit-erzaehl-s-weiter, web-k3-bar-wartet-auf-
 * bestaetigung, mobil-k3-bestaetigung. Sie zeigen nur an — was in welchem
 * Zustand erscheint, entscheidet src/lib/bestaetigung.ts.
 */

export const KARTE = 'rounded-2xl border border-border bg-card px-4 py-4 md:px-[18px]'
const ETIKETT = 'text-[11px] font-semibold tracking-[1.1px] text-muted-foreground uppercase'

/** Volle Pille in Grün — die eine Hauptaktion der Seite. */
export const KNOPF_GRUEN = cn(
  'inline-flex h-11 items-center justify-center rounded-full bg-accent px-[18px] text-[14px] font-semibold text-accent-foreground transition-opacity duration-[250ms] hover:opacity-90',
  FOKUS_RAHMEN
)
/** Rahmen-Pille — alles neben der Hauptaktion. */
export const KNOPF_RAHMEN = cn(
  'inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border px-[18px] text-[14px] font-medium text-foreground transition-colors duration-[250ms] hover:bg-muted',
  FOKUS_RAHMEN
)

const KOPF_SYMBOL = { haken: CheckCircle2, uhr: Clock, kreuz: XCircle, info: Info } as const

/** Zeichen, Überschrift (das h1 der Seite) und der Satz darunter. */
export function BestaetigungKopf({ kopf }: { kopf: BestaetigungsKopf }): React.JSX.Element {
  const Symbol = KOPF_SYMBOL[kopf.symbol]
  return (
    <div className="flex flex-col items-center gap-2.5 text-center">
      <div
        className={cn(
          'flex size-16 items-center justify-center rounded-full',
          kopf.ton === 'gruen' && 'bg-accent/25',
          kopf.ton === 'orange' && 'bg-primary/18',
          kopf.ton === 'neutral' && 'bg-muted'
        )}
      >
        {kopf.ton === 'gruen' ? (
          <span className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Check className="size-5" strokeWidth={2.4} aria-hidden="true" />
          </span>
        ) : (
          <Symbol
            className={cn('size-8', kopf.ton === 'orange' ? 'text-status-offen' : 'text-muted-foreground')}
            strokeWidth={1.7}
            aria-hidden="true"
          />
        )}
      </div>
      <h1 className="font-heading text-[26px] leading-tight font-semibold text-balance break-words md:text-[28px]">{kopf.titel}</h1>
      {/* E-Mail-Adressen sind bis 254 Zeichen lang und haben keine Leerzeichen. */}
      <p className="max-w-[56ch] text-[13.5px] leading-normal [overflow-wrap:anywhere] text-muted-foreground">{kopf.satz}</p>
    </div>
  )
}

/** Bar offen: bis wann bestätigt sein muss — die Uhrzeit aus fristen.ts. */
export function FristHinweis({ bis }: { bis: string }): React.JSX.Element {
  return (
    <Hinweiskarte ton="orange" symbol={Clock} titel={`Bestätigen bis ${bis}`}>
      <p className="text-[12.5px] leading-normal text-muted-foreground">
        Danach geben wir die Ware wieder frei, und die Bestellung verfällt – ohne Kosten für dich.
      </p>
    </Hinweiskarte>
  )
}

/**
 * Bestellnummer und Abholung. Die Nummer ist NUR Anzeige: Sie steht in
 * keinem Link und öffnet nichts — der Zugang zur Bestellung ist allein der
 * signierte Link (S1). Es gibt keinen eigenen Abholcode (Bericht Nr. 07).
 */
export function AbholKarte({
  bestellnummer,
  abholZeit,
  hofName,
  adresse,
  routeHref,
  kalenderHref,
}: {
  bestellnummer: string
  abholZeit: string
  hofName: string
  adresse: string
  routeHref: string
  kalenderHref: string | null
}): React.JSX.Element {
  return (
    <section aria-label="Abholung" className={cn(KARTE, 'flex flex-col gap-4 md:flex-row md:items-stretch md:gap-5')}>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 md:order-2">
        <p className={ETIKETT}>Abholung</p>
        <p className="text-[17px] font-semibold">{abholZeit}</p>
        <p className="text-[13px] leading-normal break-words text-muted-foreground">
          {hofName} · {adresse}
        </p>
        <div className="mt-1 flex flex-wrap gap-2">
          <a href={routeHref} target="_blank" rel="noopener noreferrer" className={cn(KNOPF_RAHMEN, 'h-11 px-4 text-[13.5px]')}>
            <MapPin className="size-4" strokeWidth={1.7} aria-hidden="true" />
            Route planen
          </a>
          {kalenderHref && (
            <a href={kalenderHref} className={cn(KNOPF_RAHMEN, 'h-11 px-4 text-[13.5px]')}>
              <CalendarPlus className="size-4" strokeWidth={1.7} aria-hidden="true" />
              In den Kalender
            </a>
          )}
        </div>
      </div>
      <div className="hidden w-px self-stretch bg-border md:order-1 md:block" aria-hidden="true" />
      <div className="min-w-0 flex-1 rounded-xl border border-dashed border-accent/50 bg-accent/8 p-3 text-center md:order-0 md:border-0 md:bg-transparent md:p-0 md:text-left">
        <p className={ETIKETT}>Bestellnummer</p>
        <p className="mt-1 font-heading text-[30px] leading-tight font-semibold tracking-[2px] break-words md:text-[34px]">{bestellnummer}</p>
        <p className="mt-0.5 text-[12px] leading-normal text-muted-foreground">
          Nenn sie bei der Abholung – der Hof gleicht zusätzlich deinen Namen ab.
        </p>
      </div>
    </section>
  )
}

const SCHRITT_VORGELESEN: Record<BestellSchritt['stand'], string> = {
  erledigt: 'erledigt',
  naechster: 'als Nächstes',
  offen: 'noch offen',
}

/** Die Status-Schritte aus dem Bestellstatus (bestellSchritte). */
export function StatusSchritte({ schritte }: { schritte: readonly BestellSchritt[] }): React.JSX.Element {
  return (
    <section aria-labelledby="stand-ueberschrift" className={KARTE}>
      <h2 id="stand-ueberschrift" className="sr-only">
        Stand deiner Bestellung
      </h2>
      <ol className="grid grid-cols-4 gap-1">
        {schritte.map((s) => (
          <li
            key={s.id}
            data-schritt={s.id}
            data-stand={s.stand}
            aria-current={s.stand === 'naechster' ? 'step' : undefined}
            className="flex min-w-0 flex-col items-center gap-1.5 text-center"
          >
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full',
                s.stand === 'erledigt' && 'bg-accent text-accent-foreground',
                s.stand === 'naechster' && 'border-2 border-status-fertig',
                s.stand === 'offen' && 'border-2 border-border'
              )}
            >
              {s.stand === 'erledigt' && <Check className="size-3.5" strokeWidth={2.6} aria-hidden="true" />}
            </span>
            <span className={cn('text-[12.5px] font-semibold', s.stand === 'offen' ? 'text-muted-foreground' : 'text-foreground')}>
              {s.titel}
              <span className="sr-only">: {SCHRITT_VORGELESEN[s.stand]}</span>
            </span>
            {s.zusatz && <span className="text-[11.5px] leading-snug text-muted-foreground">{s.zusatz}</span>}
          </li>
        ))}
      </ol>
    </section>
  )
}

/**
 * Positionen, Servicegebühr als eigene Zeile und Gesamt — alles aus dem
 * Snapshot der Bestellung (bestellSummen), angezeigt über formatEuro.
 * `zahlung` ist die Zeile aus zahlungsAnzeige („Online · Bezahlt",
 * „Bar bei Abholung · Noch offen") — nie pauschal „bezahlt".
 */
export function BestellPositionen({
  positionen,
  summen,
  zahlung,
  fuss,
}: {
  /** `fehlt`: Der Hof hat die Position als fehlend gemeldet (E14) — sie ist nicht mehr im Betrag. */
  positionen: ReadonlyArray<{ text: string; betragCents: number; fehlt?: boolean }>
  summen: {
    totalAmount: number | string | { toString(): string }
    serviceFeeCents: number
    serviceFeeRefundedAt: Date | string | null
    paymentMethod: string
  }
  zahlung: string
  fuss?: ReactNode
}): React.JSX.Element {
  const s = bestellSummen(summen)
  const entfallen = gebuehrEntfallen(summen)
  return (
    <section aria-label="Deine Bestellung" className={cn(KARTE, 'flex flex-col gap-3')}>
      <ul className="flex flex-col gap-3">
        {positionen.map((p, i) => (
          <li key={i} className="flex items-baseline gap-2 text-[13.5px]">
            <span className="min-w-0 flex-1 break-words text-muted-foreground">
              {p.text}
              {p.fehlt && <span className="text-foreground"> · fehlt leider</span>}
            </span>
            {p.fehlt ? (
              <span className="shrink-0 text-[12.5px] text-muted-foreground">nicht berechnet</span>
            ) : (
              <span className="shrink-0 tabular-nums">{formatEuro(centsAlsEuro(p.betragCents))}</span>
            )}
          </li>
        ))}
        {s.gebuehrCents > 0 && (
          <li className="flex items-baseline gap-2 text-[13.5px]">
            <span className="min-w-0 flex-1 text-muted-foreground">
              {SERVICEGEBUEHR_BEZEICHNUNG}
              {entfallen && <span className="text-[12px]"> ({summen.paymentMethod === 'ONLINE' ? 'erstattet' : 'entfällt'})</span>}
            </span>
            <span className={cn('shrink-0 tabular-nums', entfallen && 'text-muted-foreground line-through')}>
              {formatEuro(centsAlsEuro(s.gebuehrCents))}
            </span>
          </li>
        )}
      </ul>
      <div className="h-px bg-border" aria-hidden="true" />
      <p className="flex items-baseline gap-2 text-[15px] font-semibold">
        <span className="min-w-0 flex-1">{zahlung}</span>
        <span className="shrink-0 tabular-nums">{formatEuro(centsAlsEuro(s.gesamtCents))}</span>
      </p>
      {s.gebuehrCents > 0 && <p className="text-[12px] leading-normal text-muted-foreground">{SERVICEGEBUEHR_HINWEIS}</p>}
      {fuss}
    </section>
  )
}

/** Eine Zeile Aktionen unter den Karten, mittig. */
export function Aktionen({ children }: { children: ReactNode }): React.JSX.Element {
  return <div className="flex flex-wrap justify-center gap-2.5">{children}</div>
}

/** Link im Design der Aktionen. */
export function AktionsLink({ href, haupt, children }: { href: string; haupt?: boolean; children: ReactNode }): React.JSX.Element {
  return (
    <Link href={href} className={haupt ? KNOPF_GRUEN : KNOPF_RAHMEN}>
      {children}
    </Link>
  )
}
