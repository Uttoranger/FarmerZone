'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Check, ChevronRight, Ellipsis, Search, Star, Store } from 'lucide-react'
import {
  HOF_FILTER_LABEL,
  HOF_FILTER_WERTE,
  NUMMER_HINWEIS,
  ONLINE_AUS_TEXT,
  SERVICEGEBUEHR_NUR_NEUE,
  filtereHoefe,
  passtZurSuche,
  zaehleHofFilter,
  type AdminHofZeile,
} from '@/lib/admin-hoefe'
import {
  GRUENDUNGSHOF_SPALTE,
  HOEFE_SEITE,
  gruendungshofZelle,
  gruendungshoefeListe,
  hoefeKennzahlen,
  hoefeSeitenAdresse,
  hoefeUnterreiter,
  waehleHoefeReiter,
  wartelistePlatzZeile,
} from '@/lib/admin-hoefe-seite'
import { hoefeAnsichtAus } from '@/schemas/admin-hoefe'
import { hoefeReiterAus } from '@/schemas/admin-reiter'
import { aktivitaetsTeile, istOhneInhalt, AKTIVITAET_LEER, type FarmAktivitaet } from '@/lib/farm-aktivitaet'
import { DE_ADMIN_KLAERUNG, LAND_LABEL } from '@/lib/laender'
import { GRUENDUNG_BIS_MARKE, GRUENDUNG_BIS_TITEL, type GruendungAnzeige } from '@/lib/gruendungshof'
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
import { HofKachel } from './admin-teile'
import { Kennzahlen } from './kennzahlen'
import { Seitenkopf } from './seitenkopf'
import { Unterreiter } from './unterreiter'
import { HofAktionDialog, type HofAktion } from './hof-aktion-dialog'
import { ServicegebuehrDialog } from './servicegebuehr-dialog'
import { GruendungBisDialog, type GruendungsHof } from './gruendung-bis-dialog'

/**
 * `gruendung`: das wirksame Gründungs-Ende (Nr. 62), null ohne Gründungsplatz.
 * `platzBeiFreischaltung`: der Gründungsplatz, den ein wartender Hof bei
 * sofortiger Freischaltung bekäme (Nr. 94, Register N15) — null für alle
 * anderen und wenn alle Plätze vergeben sind.
 */
export type AdminHof = AdminHofZeile & { aktivitaet: FarmAktivitaet; gruendung: GruendungAnzeige | null; platzBeiFreischaltung: number | null }

export type NeueMeldung = { id: string; art: string; artTon: MeldungTon; titel: string }

/**
 * Höfe und Freischaltung (Nachtlauf Nr. 22f; seit Nr. 94 im Admin-Seitenmuster,
 * Register N15; Mockups admin-hoefe-und-freischaltung,
 * admin-mobil-unterwegs-freischalten): Seitenkopf mit Suche, Kennzahlen,
 * Unterreiter „Warten auf Freischaltung · Alle Höfe · Gründungshöfe“, darunter
 * der Inhalt des gewählten Reiters und die Regel-Zeile. Warten zeigt die
 * wartenden Höfe als Karten mit „Freischalten“, Alle Höfe die Liste mit
 * Filtern — ab 1024 px als Tabelle, darunter als Karten —, Gründungshöfe die
 * Höfe mit Platz. Am Handy steht unter der Warteliste „Neu im Postfach“.
 *
 * Reiter, Filter und Suche stehen in der Adresse und werden im Browser
 * angewandt (replaceState, kein Server-Aufruf je Tipp). Was eine Zeile sagt,
 * entscheidet src/lib/admin-hoefe.ts, was die Kennzahlen und die Warteliste
 * sagen src/lib/admin-hoefe-seite.ts; die Wirkung die bestehenden Actions.
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
  const parameter = useSearchParams()
  const ansicht = hoefeAnsichtAus(parameter)
  // Die Suche tippt lokal; die Adresse bekommt sie bereinigt mit.
  const [suche, setSuche] = useState(ansicht.suche)
  const [aktion, setAktion] = useState<HofAktion | null>(null)
  const [gebuehrHof, setGebuehrHof] = useState<AdminHof | null>(null)
  const [gruendungHof, setGruendungHof] = useState<GruendungsHof | null>(null)

  const wartende = hoefe.filter((h) => h.status.id === 'wartet')
  const zahlen = zaehleHofFilter(hoefe)
  const reiter = waehleHoefeReiter(hoefeReiterAus(parameter), wartende.length)
  const gruendungshoefe = gruendungshoefeListe(hoefe)
  const liste = reiter === 'gruendung' ? filtereHoefe(gruendungshoefe, { filter: 'alle', suche }) : filtereHoefe(hoefe, { filter: ansicht.filter, suche })
  const wartendeGefunden = wartende.filter((h) => passtZurSuche(h, suche))
  const adresse = (neu: { reiter?: typeof reiter; filter?: typeof ansicht.filter; suche?: string }): string =>
    hoefeSeitenAdresse({ reiter: neu.reiter ?? reiter, filter: neu.filter ?? ansicht.filter, suche: neu.suche ?? suche })
  // Alle Hofzeilen derselben Art zeigen dieselbe Lage: ohne Treffer ein Satz mit Ausweg.
  const keinTreffer = (
    <EmptyState
      symbol={Search}
      titel="Kein Hof passt"
      satz="Mit diesem Filter oder dieser Suche gibt es keinen Hof."
      ausweg={
        <Link
          href={hoefeSeitenAdresse({ reiter, filter: 'alle', suche: '' })}
          className={KNOPF_RAHMEN}
          onNavigate={(e) => {
            e.preventDefault()
            setSuche('')
            schreibeAdresse(hoefeSeitenAdresse({ reiter, filter: 'alle', suche: '' }))
          }}
        >
          Alle Höfe zeigen
        </Link>
      }
    />
  )

  return (
    <div className="flex flex-col gap-5">
      <Seitenkopf
        titel={HOEFE_SEITE.titel}
        satz={HOEFE_SEITE.satz}
        rechts={
          <label className="relative block w-full md:w-[288px]">
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
                schreibeAdresse(adresse({ suche: wert }))
              }}
              placeholder="Hof suchen …"
              className={cn(
                'h-11 w-full rounded-full border border-border bg-card pr-4 pl-10 text-base text-foreground placeholder:text-muted-foreground md:text-[13.5px]',
                FOKUS_RAHMEN
              )}
            />
          </label>
        }
      />

      <Kennzahlen beschriftung={HOEFE_SEITE.kennzahlen} eintraege={hoefeKennzahlen(hoefe, { vergeben: vergebenePlaetze, max: maxPlaetze })} />

      <Unterreiter
        beschriftung={HOEFE_SEITE.reiter}
        eintraege={hoefeUnterreiter({ wartende: wartende.length, alle: zahlen.alle, gruendungshoefe: gruendungshoefe.length, maxPlaetze, suche })}
        aktiv={reiter}
        onNavigate={(e, eintrag) => {
          e.preventDefault()
          schreibeAdresse(eintrag.href)
        }}
      />

      {reiter === 'warten' && (
        <section aria-labelledby="warten-titel" className="flex flex-col gap-3">
          <h2 id="warten-titel" className="sr-only">
            Warten auf Freischaltung
          </h2>
          {wartende.length === 0 ? (
            <p className={cn('text-[14px]', LEISE)}>{HOEFE_SEITE.keineWartenden}</p>
          ) : wartendeGefunden.length === 0 ? (
            keinTreffer
          ) : (
            <ul className="flex flex-col gap-3">
              {wartendeGefunden.map((hof) => (
                <li key={hof.id}>
                  <WartenderHof hof={hof} onAktion={setAktion} />
                </li>
              ))}
            </ul>
          )}
          {neueMeldungen.length > 0 && <NeuImBriefkasten meldungen={neueMeldungen} />}
        </section>
      )}

      {reiter !== 'warten' && (
        <section aria-labelledby="liste-titel" className="flex flex-col gap-3">
          <h2 id="liste-titel" className="sr-only">
            {reiter === 'alle' ? 'Alle Höfe' : 'Gründungshöfe'}
          </h2>
          {reiter === 'alle' && (
            <FilterChipReihe beschriftung="Höfe filtern">
              {HOF_FILTER_WERTE.filter((f) => (f !== 'stillgelegt' && f !== 'online-aus') || zahlen[f] > 0).map((f) => {
                const ziel = adresse({ filter: f })
                return (
                  <FilterChip
                    key={f}
                    href={ziel}
                    aktiv={ansicht.filter === f}
                    onNavigate={(e) => {
                      e.preventDefault()
                      schreibeAdresse(ziel)
                    }}
                  >
                    {HOF_FILTER_LABEL[f]}
                    <span className="ml-1 tabular-nums">· {zahlen[f]}</span>
                  </FilterChip>
                )
              })}
            </FilterChipReihe>
          )}

          <p className={cn('text-[13px]', LEISE)} aria-live="polite">
            {mitAnzahl(liste.length, 'Hof', 'Höfe')}
          </p>

          {zahlen.alle === 0 ? (
            <EmptyState
              symbol={Store}
              titel="Noch kein Hof freigeschaltet"
              satz="Sobald du einen wartenden Hof freischaltest, steht er hier mit Servicegebühr und Bestellungen."
              ausweg={{ ohne: 'Freischalten steht im Reiter „Warten auf Freischaltung“ (der Satz sagt es); die Liste hier ist leer, weil noch kein Hof freigeschaltet ist' }}
            />
          ) : liste.length === 0 ? (
            keinTreffer
          ) : (
            <>
              <Tabelle hoefe={liste} onGebuehr={setGebuehrHof} onGruendung={setGruendungHof} onAktion={setAktion} />
              <Karten hoefe={liste} onGebuehr={setGebuehrHof} onGruendung={setGruendungHof} onAktion={setAktion} />
            </>
          )}
        </section>
      )}

      <p className={cn('text-[12.5px] leading-relaxed', LEISE)}>
        {HOEFE_SEITE.regel} {SERVICEGEBUEHR_NUR_NEUE} {NUMMER_HINWEIS}
      </p>

      <HofAktionDialog aktion={aktion} vergebenePlaetze={vergebenePlaetze} onClose={() => setAktion(null)} />
      <ServicegebuehrDialog hof={gebuehrHof} onClose={() => setGebuehrHof(null)} />
      <GruendungBisDialog hof={gruendungHof} onClose={() => setGruendungHof(null)} />
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
  // Der Gründungsplatz bei Freischaltung (Register N15): mit Stripe der Platz, sonst der Hinweis; keine Zeile, wenn alle Plätze vergeben sind.
  const platzZeile = wartelistePlatzZeile(hof, hof.platzBeiFreischaltung)
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
          {platzZeile && (
            <p className={cn('mt-1 flex items-center gap-1.5 text-[12.5px]', platzZeile.art === 'bekaeme' ? 'font-semibold text-status-offen' : 'font-medium text-muted-foreground')}>
              {platzZeile.art === 'bekaeme' && <Star className="size-3.5 shrink-0" strokeWidth={1.7} aria-hidden="true" />}
              {platzZeile.text}
            </p>
          )}
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

/** Am Handy: was im Postfach auf eine Entscheidung wartet (Mockup admin-mobil-unterwegs-freischalten). */
function NeuImBriefkasten({ meldungen }: { meldungen: NeueMeldung[] }): React.JSX.Element {
  return (
    <section aria-labelledby="neu-briefkasten-titel" className="flex flex-col gap-3 md:hidden">
      <h2 id="neu-briefkasten-titel" className={KICKER}>
        Neu im Postfach
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
  onGruendung: (hof: GruendungsHof) => void
  onAktion: (a: HofAktion) => void
}

/** „Standard" oder „abweichend" neben dem wirksamen Ende. */
function gruendungMarke(gruendung: GruendungAnzeige): string {
  return gruendung.abweichend ? GRUENDUNG_BIS_MARKE.abweichend : GRUENDUNG_BIS_MARKE.standard
}

/**
 * Die Zelle „Gründungshof“ (Register N15, Mockup): „Nr. 3 · bis 30.06.2027“,
 * darunter leise die Marke „Standard“ bzw. „abweichend“, daneben „ändern“ —
 * ohne Platz „kein Gründungshof“.
 */
function GruendungZelle({ hof, onGruendung }: { hof: AdminHof; onGruendung: (hof: GruendungsHof) => void }): React.JSX.Element {
  const zelle = gruendungshofZelle(hof)
  const gruendung = hof.gruendung
  if (!zelle) return <span className={LEISE}>{GRUENDUNGSHOF_SPALTE.kein}</span>
  return (
    <span className="inline-flex items-center gap-1.5">
      {/* Mindestbreite des längsten Textes („Nr. 12 · bis 31.12.2027“), damit „ändern“ in jeder Zeile gleich steht. */}
      <span className="flex min-w-40 flex-col leading-tight">
        <span className="text-foreground">{zelle.text}</span>
        {zelle.marke && <span className={cn('text-[12px]', LEISE)}>{zelle.marke}</span>}
      </span>
      {gruendung && (
        <button
          type="button"
          onClick={() => onGruendung({ id: hof.id, name: hof.name, gruendung })}
          className={cn('min-h-11 rounded-full px-2 text-[13px] font-medium text-status-fertig hover:bg-muted', FOKUS_RAHMEN)}
        >
          ändern<span className="sr-only"> ({GRUENDUNG_BIS_TITEL} {hof.name})</span>
        </button>
      )}
    </span>
  )
}

/** Ab 1024 px: die Tabelle aus dem Mockup. */
function Tabelle({ hoefe, onGebuehr, onGruendung, onAktion }: ZeilenProps): React.JSX.Element {
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
              {GRUENDUNGSHOF_SPALTE.titel}
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
              <td className="px-3.5 py-1.5 whitespace-nowrap">
                <GruendungZelle hof={hof} onGruendung={onGruendung} />
              </td>
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
function Karten({ hoefe, onGebuehr, onGruendung, onAktion }: ZeilenProps): React.JSX.Element {
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
              <dt className={LEISE}>{GRUENDUNGSHOF_SPALTE.titel}</dt>
              <dd className="text-foreground">{hof.gruendungsplatz !== null ? `Nr. ${hof.gruendungsplatz}` : GRUENDUNGSHOF_SPALTE.kein}</dd>
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
          {hof.gruendung && <GruendungKartenZeile hof={hof} gruendung={hof.gruendung} onGruendung={onGruendung} />}
        </li>
      ))}
    </ul>
  )
}

/** Karte am Handy: die Zeile „Gründungshof bis" mit Datum, Marke und „Ende ändern" (nur mit Platz). */
function GruendungKartenZeile({
  hof,
  gruendung,
  onGruendung,
}: {
  hof: AdminHof
  gruendung: GruendungAnzeige
  onGruendung: (hof: GruendungsHof) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5">
      {/* Beschriftung über dem Datum: In einer Zeile bräche „Ende ändern" bei 390 px unter den Text. */}
      <p className="min-w-0 text-[13px] text-foreground">
        <span className={cn('block', LEISE)}>{GRUENDUNG_BIS_TITEL}</span>
        {gruendung.bisText} <span className={LEISE}>{`· ${gruendungMarke(gruendung)}`}</span>
      </p>
      <button type="button" onClick={() => onGruendung({ id: hof.id, name: hof.name, gruendung })} className={KNOPF_RAHMEN}>
        Ende ändern<span className="sr-only"> ({GRUENDUNG_BIS_TITEL} {hof.name})</span>
      </button>
    </div>
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
