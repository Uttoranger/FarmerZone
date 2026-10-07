'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Check, ChevronRight, Ellipsis, Search, Store } from 'lucide-react'
import {
  HOF_FILTER_LABEL,
  HOF_FILTER_WERTE,
  NUMMER_HINWEIS,
  ONLINE_AUS_TEXT,
  SERVICEGEBUEHR_NUR_NEUE,
  filtereHoefe,
  hoefeAdresse,
  zaehleHofFilter,
  type AdminHofZeile,
} from '@/lib/admin-hoefe'
import { hoefeAnsichtAus } from '@/schemas/admin-hoefe'
import { aktivitaetsTeile, istOhneInhalt, AKTIVITAET_LEER, type FarmAktivitaet } from '@/lib/farm-aktivitaet'
import { DE_ADMIN_KLAERUNG, LAND_LABEL } from '@/lib/laender'
import { HOFNAME_MAX } from '@/lib/eingabegrenzen'
import { mitAnzahl } from '@/lib/format'
import type { MeldungTon } from '@/lib/meldung'
import { cn } from '@/lib/utils'
import { FilterChip, FilterChipReihe } from '@/components/ui/chip'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { FOKUS_RAHMEN, FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { KARTE, KICKER, KNOPF_GRUEN, KNOPF_RAHMEN, LEISE } from '@/components/hof-bestellungen/stil'
import { HofKachel, SEITEN_TITEL } from './admin-teile'
import { HofAktionDialog, type HofAktion } from './hof-aktion-dialog'
import { ServicegebuehrDialog } from './servicegebuehr-dialog'

export type AdminHof = AdminHofZeile & { aktivitaet: FarmAktivitaet }

export type NeueMeldung = { id: string; art: string; artTon: MeldungTon; titel: string }

/**
 * Höfe und Freischaltung (Nachtlauf Nr. 22f; Mockups
 * admin-hoefe-und-freischaltung, admin-mobil-unterwegs-freischalten): oben
 * die wartenden Höfe als Karten mit „Freischalten", darunter alle übrigen mit
 * Filter und Suche — ab 1024 px als Tabelle, darunter als Karten. Am Handy
 * steht zwischen beiden „Neu im Briefkasten".
 *
 * Filter und Suche stehen in der Adresse und werden im Browser angewandt
 * (replaceState, kein Server-Aufruf je Tipp). Was eine Zeile sagt, entscheidet
 * src/lib/admin-hoefe.ts; die Wirkung die bestehenden Actions.
 */
export function HoefeAnsicht({
  hoefe,
  vergebenePlaetze,
  maxPlaetze,
  neueMeldungen,
}: {
  hoefe: AdminHof[]
  vergebenePlaetze: number
  maxPlaetze: number
  neueMeldungen: NeueMeldung[]
}): React.JSX.Element {
  const ansicht = hoefeAnsichtAus(useSearchParams())
  // Die Suche tippt lokal; die Adresse bekommt sie bereinigt mit.
  const [suche, setSuche] = useState(ansicht.suche)
  const [aktion, setAktion] = useState<HofAktion | null>(null)
  const [gebuehrHof, setGebuehrHof] = useState<AdminHof | null>(null)

  const wartende = hoefe.filter((h) => h.status.id === 'wartet')
  const zahlen = zaehleHofFilter(hoefe)
  const liste = filtereHoefe(hoefe, { filter: ansicht.filter, suche })

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <h1 className={SEITEN_TITEL}>Höfe</h1>
        <p className={cn('text-[13px]', LEISE)}>
          {maxPlaetze} Gründungsplätze · {vergebenePlaetze} vergeben
        </p>
      </header>

      <section aria-labelledby="wartende-titel" className="flex flex-col gap-3">
        <h2 id="wartende-titel" className={KICKER}>
          Warten auf Freischaltung · {wartende.length}
        </h2>
        {wartende.length === 0 ? (
          <p className={cn('text-[14px]', LEISE)}>Kein Hof wartet auf Freischaltung.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {wartende.map((hof) => (
              <li key={hof.id}>
                <WartenderHof hof={hof} onAktion={setAktion} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {neueMeldungen.length > 0 && <NeuImBriefkasten meldungen={neueMeldungen} />}

      <section aria-labelledby="alle-titel" className="flex flex-col gap-3">
        <h2 id="alle-titel" className="sr-only">
          Alle Höfe
        </h2>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <FilterChipReihe beschriftung="Höfe filtern" className="min-w-0 lg:flex-1">
            {HOF_FILTER_WERTE.filter((f) => (f !== 'stillgelegt' && f !== 'online-aus') || zahlen[f] > 0).map((f) => {
              const adresse = hoefeAdresse({ filter: f, suche })
              return (
                <FilterChip
                  key={f}
                  href={adresse}
                  aktiv={ansicht.filter === f}
                  onNavigate={(e) => {
                    e.preventDefault()
                    schreibeAdresse(adresse)
                  }}
                >
                  {HOF_FILTER_LABEL[f]}
                  <span className="ml-1 tabular-nums">· {zahlen[f]}</span>
                </FilterChip>
              )
            })}
          </FilterChipReihe>
          <label className="relative block md:max-w-[340px] lg:w-[288px] lg:shrink-0">
            <span className="sr-only">Hof suchen</span>
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
              strokeWidth={1.7}
              aria-hidden="true"
            />
            <input
              type="search"
              value={suche}
              onChange={(e) => {
                const wert = e.target.value.slice(0, HOFNAME_MAX)
                setSuche(wert)
                schreibeAdresse(hoefeAdresse({ filter: ansicht.filter, suche: wert }))
              }}
              placeholder="Hof suchen …"
              className={cn(
                'h-11 w-full rounded-full border border-border bg-card pr-4 pl-10 text-base text-foreground placeholder:text-muted-foreground md:h-10 md:text-[13.5px]',
                FOKUS_RAHMEN
              )}
            />
          </label>
        </div>

        <p className={cn('text-[13px]', LEISE)} aria-live="polite">
          {mitAnzahl(liste.length, 'Hof', 'Höfe')}
        </p>

        {zahlen.alle === 0 ? (
          <EmptyState
            symbol={Store}
            titel="Noch kein Hof freigeschaltet"
            satz="Sobald du einen wartenden Hof freischaltest, steht er hier mit Servicegebühr und Bestellungen."
          />
        ) : liste.length === 0 ? (
          <EmptyState
            symbol={Search}
            titel="Kein Hof passt"
            satz="Mit diesem Filter oder dieser Suche gibt es keinen Hof."
            aktion={
              <Link
                href="/admin"
                className={KNOPF_RAHMEN}
                onNavigate={(e) => {
                  e.preventDefault()
                  setSuche('')
                  schreibeAdresse('/admin')
                }}
              >
                Alle Höfe zeigen
              </Link>
            }
          />
        ) : (
          <>
            <Tabelle hoefe={liste} onGebuehr={setGebuehrHof} onAktion={setAktion} />
            <Karten hoefe={liste} onGebuehr={setGebuehrHof} onAktion={setAktion} />
          </>
        )}

        <p className={cn('text-[12.5px] leading-relaxed', LEISE)}>
          {SERVICEGEBUEHR_NUR_NEUE} {NUMMER_HINWEIS}
        </p>
      </section>

      <HofAktionDialog aktion={aktion} vergebenePlaetze={vergebenePlaetze} onClose={() => setAktion(null)} />
      <ServicegebuehrDialog hof={gebuehrHof} onClose={() => setGebuehrHof(null)} />
    </div>
  )
}

function schreibeAdresse(adresse: string) {
  // null als Zustand: Next gleicht useSearchParams ab (ARCHITECTURE §4, State-Regeln).
  window.history.replaceState(null, '', adresse)
}

/** Ein wartender Hof (Mockup: Karte mit „Ablehnen" und „Freischalten"). */
function WartenderHof({ hof, onAktion }: { hof: AdminHof; onAktion: (a: HofAktion) => void }): React.JSX.Element {
  // Was der Hof schon angelegt hat, dann Stripe und SEPA (Mockup: „4 Produkte · Stripe eingerichtet · SEPA erteilt").
  const teile = istOhneInhalt(hof.aktivitaet) ? [AKTIVITAET_LEER] : aktivitaetsTeile(hof.aktivitaet)
  // Ohne Stripe steht der Grund darunter orange (hof.sperre, Register Z1).
  const zahlung = hof.stripeBereit ? ['Stripe eingerichtet', ...(hof.onlineAn ? [] : [ONLINE_AUS_TEXT])] : []
  const angaben = [...teile, ...zahlung, ...(hof.sepaErteilt ? ['SEPA erteilt'] : [])]
  return (
    <article
      aria-label={hof.name}
      className={cn(KARTE, 'flex flex-col gap-3 p-4 md:flex-row md:items-center md:gap-4 md:px-[18px]', !hof.sperre && 'border-primary/45')}
    >
      <div className="flex min-w-0 flex-1 gap-3.5">
        <HofKachel name={hof.name} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="line-clamp-2 min-w-0 text-[15.5px] font-semibold break-words text-foreground" title={hof.name}>
              {hof.name}
            </p>
            {hof.istDeutsch && <StatusBadge status="neutral">{LAND_LABEL.DE}</StatusBadge>}
          </div>
          <p className={cn('mt-0.5 truncate text-[13px]', LEISE)} title={hof.ownerEmail}>
            {hof.ownerEmail} · {hof.registriert}
          </p>
          <p className="mt-0.5 flex flex-wrap gap-x-1.5 text-[13px] text-foreground">
            {angaben.map((t, i) => (
              <span key={t} className="flex gap-1.5">
                {t}
                {i < angaben.length - 1 && (
                  <span aria-hidden="true" className="text-muted-foreground">
                    ·
                  </span>
                )}
              </span>
            ))}
          </p>
          {hof.sperre && <p className="mt-0.5 text-[13px] font-medium text-status-offen">{hof.sperre}</p>}
          <p className={cn('mt-0.5 flex flex-wrap gap-x-3 text-[12.5px]', LEISE)}>
            <span>E-Mail bestätigt: {hof.emailBestaetigtText}</span>
            {hof.nummer && <span>Betriebsnummer {hof.nummer}</span>}
            <span className="break-all">Hof-ID {hof.id}</span>
          </p>
          {hof.istDeutsch && (
            <p className={cn('mt-2 rounded-lg border border-dashed border-border px-3 py-2 text-[12.5px]', LEISE)}>
              {DE_ADMIN_KLAERUNG}
            </p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5 md:flex md:shrink-0">
        <button type="button" onClick={() => onAktion({ hof, art: 'reject' })} className={KNOPF_RAHMEN}>
          Ablehnen
        </button>
        <button
          type="button"
          onClick={() => onAktion({ hof, art: 'approve' })}
          disabled={hof.sperre !== null}
          title={hof.sperre ?? undefined}
          className={KNOPF_GRUEN}
        >
          Freischalten
        </button>
      </div>
    </article>
  )
}

/** Am Handy: was im Briefkasten auf eine Entscheidung wartet (Mockup admin-mobil-unterwegs-freischalten). */
function NeuImBriefkasten({ meldungen }: { meldungen: NeueMeldung[] }): React.JSX.Element {
  return (
    <section aria-labelledby="neu-briefkasten-titel" className="flex flex-col gap-3 md:hidden">
      <h2 id="neu-briefkasten-titel" className={KICKER}>
        Neu im Briefkasten
      </h2>
      <ul className={cn(KARTE, 'overflow-hidden [&>li+li]:border-t [&>li+li]:border-border')}>
        {meldungen.map((m) => (
          <li key={m.id}>
            <Link
              href={`/admin/meldungen/${m.id}`}
              className={cn('flex min-h-[52px] items-center gap-2.5 px-4 py-2.5 hover:bg-muted', FOKUS_RAHMEN_INNEN)}
            >
              <StatusBadge status={m.artTon}>{m.art}</StatusBadge>
              <span className="min-w-0 flex-1 truncate text-[14px] text-foreground" title={m.titel}>
                {m.titel}
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

type ZeilenProps = {
  hoefe: AdminHof[]
  onGebuehr: (hof: AdminHof) => void
  onAktion: (a: HofAktion) => void
}

/** Ab 1024 px: die Tabelle aus dem Mockup. */
function Tabelle({ hoefe, onGebuehr, onAktion }: ZeilenProps): React.JSX.Element {
  const kopf = 'px-3.5 py-2.5 text-left text-[11px] font-semibold tracking-[0.1em] whitespace-nowrap text-muted-foreground uppercase'
  return (
    <div className={cn(KARTE, 'hidden overflow-hidden lg:block')}>
      <table className="w-full text-[14px]">
        <thead className="border-b border-border">
          <tr>
            <th scope="col" className={cn(kopf, 'w-full max-w-0')}>
              Hof
            </th>
            <th scope="col" className={kopf}>
              Status
            </th>
            <th scope="col" className={kopf}>
              Platz
            </th>
            <th scope="col" className={kopf}>
              Servicegebühr
            </th>
            <th scope="col" className={kopf}>
              Best./Monat
            </th>
            <th scope="col" className={kopf}>
              Stripe
            </th>
            <th scope="col" className={kopf}>
              Betriebsnr.
            </th>
            <th scope="col" className={kopf}>
              <span className="sr-only">Weitere Aktionen</span>
            </th>
          </tr>
        </thead>
        <tbody className="[&>tr+tr]:border-t [&>tr+tr]:border-border">
          {hoefe.map((hof) => (
            <tr key={hof.id}>
              <td className="w-full max-w-0 px-3.5 py-2.5">
                <p className="truncate font-semibold text-foreground" title={hof.name}>
                  {hof.name}
                </p>
                <p className={cn('truncate text-[12.5px]', LEISE)} title={`/${hof.slug}`}>
                  /{hof.slug}
                </p>
              </td>
              <td className="px-3.5 py-2.5">
                <StatusBadge status={hof.status.ton}>{hof.status.text}</StatusBadge>
              </td>
              <td className="px-3.5 py-2.5 whitespace-nowrap tabular-nums">{hof.gruendungsplatz !== null ? `#${hof.gruendungsplatz}` : '–'}</td>
              <td className="px-3.5 py-2.5 whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5">
                  <span className="rounded-lg border border-border px-2 py-0.5 tabular-nums" title={hof.satzLang}>
                    {hof.satz}
                  </span>
                  <button
                    type="button"
                    onClick={() => onGebuehr(hof)}
                    className={cn('min-h-11 rounded-full px-2 text-[13px] font-medium text-status-fertig hover:bg-muted', FOKUS_RAHMEN)}
                  >
                    ändern<span className="sr-only"> (Servicegebühr {hof.name})</span>
                  </button>
                </span>
              </td>
              <td className="px-3.5 py-2.5 tabular-nums">{hof.monat.bestellungen}</td>
              <td className="px-3.5 py-2.5">
                <StripeZeichen bereit={hof.stripeBereit} />
              </td>
              <td className="px-3.5 py-2.5 whitespace-nowrap tabular-nums">{hof.nummer ?? (
                  <>
                    <span aria-hidden="true">–</span>
                    <span className="sr-only">keine Angabe</span>
                  </>
                )}</td>
              <td className="px-2 py-1.5 text-right">
                <MehrMenue hof={hof} onAktion={onAktion} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Unter 1024 px: je Hof eine Karte (nichts scrollt quer). */
function Karten({ hoefe, onGebuehr, onAktion }: ZeilenProps): React.JSX.Element {
  return (
    <ul className="flex flex-col gap-3 lg:hidden">
      {hoefe.map((hof) => (
        <li key={hof.id} className={cn(KARTE, 'flex flex-col gap-2.5 p-4')}>
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 font-semibold break-words text-foreground" title={hof.name}>
                {hof.name}
              </p>
              <p className={cn('truncate text-[12.5px]', LEISE)}>/{hof.slug}</p>
            </div>
            <StatusBadge status={hof.status.ton} className="shrink-0">
              {hof.status.text}
            </StatusBadge>
            <MehrMenue hof={hof} onAktion={onAktion} />
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] sm:grid-cols-4">
            <div>
              <dt className={LEISE}>Platz</dt>
              <dd className="text-foreground tabular-nums">{hof.gruendungsplatz !== null ? `#${hof.gruendungsplatz}` : '–'}</dd>
            </div>
            <div>
              <dt className={LEISE}>Bestellungen im Monat</dt>
              <dd className="text-foreground tabular-nums">{hof.monat.bestellungen}</dd>
            </div>
            <div>
              <dt className={LEISE}>Stripe</dt>
              <dd className={hof.stripeBereit ? 'text-foreground' : 'text-status-offen'}>{hof.stripeBereit ? 'eingerichtet' : 'fehlt'}</dd>
            </div>
            <div>
              <dt className={LEISE}>Betriebsnummer</dt>
              <dd className="break-all text-foreground">{hof.nummer ?? '–'}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5">
            <p className="min-w-0 text-[13px] text-foreground">
              <span className={LEISE}>Servicegebühr </span>
              {hof.satz}
            </p>
            <button type="button" onClick={() => onGebuehr(hof)} className={KNOPF_RAHMEN}>
              Gebühr ändern
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}

function StripeZeichen({ bereit }: { bereit: boolean }): React.JSX.Element {
  if (bereit) {
    return (
      <span className="inline-flex text-status-fertig">
        <Check className="size-4" strokeWidth={1.7} aria-hidden="true" />
        <span className="sr-only">eingerichtet</span>
      </span>
    )
  }
  // Jeder Hof braucht Stripe (Register Z1) — orange, nicht rot: Der Hof bleibt online.
  return (
    <span className="text-status-offen">
      <span aria-hidden="true">–</span>
      <span className="sr-only">fehlt</span>
    </span>
  )
}

/** „⋯": Hofseite ansehen und Freigabe zurücknehmen — selten, deshalb nicht als eigener Knopf. */
function MehrMenue({ hof, onAktion }: { hof: AdminHof; onAktion: (a: HofAktion) => void }): React.JSX.Element {
  const oeffentlich = hof.status.id !== 'stillgelegt'
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Weitere Aktionen für ${hof.name}`}
        className={cn('inline-flex size-11 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-muted', FOKUS_RAHMEN)}
      >
        <Ellipsis className="size-5" strokeWidth={1.7} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {oeffentlich && (
          <DropdownMenuLinkItem render={<a href={`/${hof.slug}`} target="_blank" rel="noopener noreferrer" />}>
            Hofseite ansehen
          </DropdownMenuLinkItem>
        )}
        <DropdownMenuItem onClick={() => onAktion({ hof, art: 'revoke' })}>Freigabe zurücknehmen</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
