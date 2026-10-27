'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Search, Store } from 'lucide-react'
import {
  HOEFE_LISTE_FILTER,
  HOEFE_LISTE_FILTER_LABEL,
  HOEFE_LISTE_TEXT,
  filtereHoefeListe,
  hoefeListeAdresse,
  zaehleHoefeListe,
  type HoefeListenZeile,
} from '@/lib/admin-hoefe-liste'
import type { AdminHofZeile } from '@/lib/admin-hoefe'
import type { GruendungAenderung, TesthofAenderung } from '@/lib/admin-hoefe-seite'
import { adminHofHref } from '@/lib/admin-hof-akte'
import { hoefeListeAus } from '@/schemas/admin-hoefe'
import type { FarmAktivitaet } from '@/lib/farm-aktivitaet'
import type { GruendungAnzeige } from '@/lib/gruendungshof'
import { HOFNAME_MAX } from '@/lib/eingabegrenzen'
import { mitAnzahl } from '@/lib/format'
import { cn } from '@/lib/utils'
import { FilterChip, FilterChipReihe } from '@/components/ui/chip'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { KARTE, KNOPF_GRUEN, KNOPF_RAHMEN, LEISE } from '@/components/hof-bestellungen/stil'
import { Seitenkopf } from './seitenkopf'

/**
 * Ein Hof mit allem, was die Dialoge der Akte brauchen (Freischalten,
 * Servicegebühr, Gründung, Testhof) — gebaut in ladeAdminHoefe
 * (src/server/queries/admin-hof.ts).
 */
export type AdminHof = AdminHofZeile & {
  aktivitaet: FarmAktivitaet
  gruendung: GruendungAnzeige | null
  platzBeiFreischaltung: number | null
  gruendungAenderung: GruendungAenderung | null
  gruendungZuletzt: string | null
  testhofAenderung: TesthofAenderung | null
}

/**
 * Admin › Höfe im Regelbetrieb (Register N32; Nachtlauf Nr. 187; Mockup
 * admin-hoefe-neu): Seitenkopf mit Suche, Filter „Braucht Blick“ (Standard) ·
 * Wartet · Verkauft · Pausiert · Gesperrt · Geschlossen · Testhöfe · Alle,
 * darunter ab 1024 px eine echte Tabelle (Hof, Zustand, Signal, Bestellungen
 * 30 Tage, zuletzt aktiv), darunter Karten. Je Zeile „Prüfen“ (wartend) bzw.
 * „Akte“. Filter und Suche stehen in der Adresse und werden im Browser
 * angewandt (replaceState). Was eine Zeile sagt, entscheidet
 * src/lib/admin-hoefe-liste.ts; alles Eingreifen steht in der Akte.
 */
export function HoefeAnsicht({ zeilen }: { zeilen: HoefeListenZeile[] }): React.JSX.Element {
  const parameter = useSearchParams()
  const start = hoefeListeAus(parameter)
  const [filter, setFilter] = useState(start.filter)
  const [suche, setSuche] = useState(start.suche)
  const zahlen = zaehleHoefeListe(zeilen)
  const liste = filtereHoefeListe(zeilen, { filter, suche })

  function waehle(neu: { filter?: typeof filter; suche?: string }) {
    const f = neu.filter ?? filter
    const s = neu.suche ?? suche
    setFilter(f)
    setSuche(s)
    // null als Zustand: Next gleicht useSearchParams ab (ARCHITECTURE §4, State-Regeln).
    window.history.replaceState(null, '', hoefeListeAdresse({ filter: f, suche: s }))
  }

  return (
    <div className="flex flex-col gap-5">
      <Seitenkopf
        titel={HOEFE_LISTE_TEXT.titel}
        satz={HOEFE_LISTE_TEXT.satz}
        rechts={
          <label className="relative block w-full md:w-[288px]">
            <span className="sr-only">Hof suchen</span>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
            <input
              type="search"
              value={suche}
              onChange={(e) => waehle({ suche: e.target.value.slice(0, HOFNAME_MAX) })}
              placeholder="Hof suchen …"
              className={cn(
                'h-11 w-full rounded-full border border-border bg-card pr-4 pl-10 text-base text-foreground placeholder:text-muted-foreground md:text-[13.5px]',
                FOKUS_RAHMEN
              )}
            />
          </label>
        }
      />

      <FilterChipReihe beschriftung="Höfe filtern">
        {HOEFE_LISTE_FILTER.map((f) => (
          <FilterChip
            key={f}
            href={hoefeListeAdresse({ filter: f, suche })}
            aktiv={filter === f}
            onNavigate={(e) => {
              e.preventDefault()
              waehle({ filter: f })
            }}
          >
            {HOEFE_LISTE_FILTER_LABEL[f]}
            <span className="ml-1 tabular-nums">· {zahlen[f]}</span>
          </FilterChip>
        ))}
      </FilterChipReihe>

      <p className={cn('text-[13px]', LEISE)} aria-live="polite">
        {filter === 'braucht-blick'
          ? `${liste.length} von ${mitAnzahl(zahlen.alle, 'Hof', 'Höfen')} brauchen Blick · Testhöfe nur unter „Testhöfe“`
          : mitAnzahl(liste.length, 'Hof', 'Höfe')}
      </p>

      {zahlen.alle === 0 ? (
        <EmptyState
          symbol={Store}
          titel={HOEFE_LISTE_TEXT.leerTitel}
          satz={HOEFE_LISTE_TEXT.leerSatz}
          ausweg={{ ohne: 'Höfe melden sich selbst an; vorher gibt es hier nichts zu tun' }}
        />
      ) : liste.length === 0 ? (
        <EmptyState
          symbol={filter === 'braucht-blick' && suche.trim() === '' ? Store : Search}
          titel={filter === 'braucht-blick' && suche.trim() === '' ? HOEFE_LISTE_TEXT.keinerBrauchtBlick : HOEFE_LISTE_TEXT.keinTreffer}
          satz={filter === 'braucht-blick' && suche.trim() === '' ? HOEFE_LISTE_TEXT.keinerBrauchtBlickSatz : HOEFE_LISTE_TEXT.keinTrefferSatz}
          ausweg={
            <Link
              href={hoefeListeAdresse({ filter: 'alle', suche: '' })}
              className={KNOPF_RAHMEN}
              onNavigate={(e) => {
                e.preventDefault()
                waehle({ filter: 'alle', suche: '' })
              }}
            >
              Alle Höfe zeigen
            </Link>
          }
        />
      ) : (
        <>
          <Tabelle zeilen={liste} />
          <Karten zeilen={liste} />
        </>
      )}

      <p className={cn('text-[12.5px] leading-relaxed', LEISE)}>{HOEFE_LISTE_TEXT.regel}</p>
    </div>
  )
}

/** „Prüfen“ bei wartenden Höfen, sonst „Akte“ — der Hofname steht für Screenreader mit im Link. */
function AkteLink({ zeile }: { zeile: HoefeListenZeile }): React.JSX.Element {
  const wartet = zeile.zustand.id === 'wartet'
  return (
    <Link href={adminHofHref(zeile.id)} className={wartet ? KNOPF_GRUEN : KNOPF_RAHMEN}>
      {wartet ? HOEFE_LISTE_TEXT.pruefen : HOEFE_LISTE_TEXT.akte}
      <span className="sr-only"> {zeile.name}</span>
    </Link>
  )
}

function Zustand({ zeile }: { zeile: HoefeListenZeile }): React.JSX.Element {
  return (
    <span className="flex flex-col items-start gap-0.5">
      <StatusBadge status={zeile.zustand.ton}>{zeile.zustand.text}</StatusBadge>
      {zeile.seit && <span className={cn('text-[12px]', LEISE)}>{zeile.seit}</span>}
    </span>
  )
}

function Signale({ zeile }: { zeile: HoefeListenZeile }): React.JSX.Element {
  if (zeile.signale.length === 0) {
    return (
      <>
        <span aria-hidden="true" className={LEISE}>
          –
        </span>
        <span className="sr-only">kein Signal</span>
      </>
    )
  }
  return <span className={zeile.zustand.id === 'wartet' ? 'text-foreground' : 'font-medium text-status-offen'}>{zeile.signale.join(' · ')}</span>
}

/** Ab 1024 px: die Tabelle aus dem Mockup. */
function Tabelle({ zeilen }: { zeilen: HoefeListenZeile[] }): React.JSX.Element {
  const kopf = 'px-3.5 py-2.5 text-left text-[11px] font-semibold tracking-[0.1em] whitespace-nowrap text-muted-foreground uppercase'
  return (
    <div className={cn(KARTE, 'hidden overflow-hidden lg:block')}>
      <table className="w-full text-[14px]">
        <caption className="sr-only">{HOEFE_LISTE_TEXT.tabelle}</caption>
        <thead className="border-b border-border">
          <tr>
            <th scope="col" className={cn(kopf, 'w-full max-w-0')}>
              Hof
            </th>
            <th scope="col" className={kopf}>
              Zustand
            </th>
            <th scope="col" className={kopf}>
              Signal
            </th>
            <th scope="col" className={kopf}>
              Best. 30 T
            </th>
            <th scope="col" className={kopf}>
              Zuletzt aktiv
            </th>
            <th scope="col" className={kopf}>
              <span className="sr-only">Akte öffnen</span>
            </th>
          </tr>
        </thead>
        <tbody className="[&>tr+tr]:border-t [&>tr+tr]:border-border">
          {zeilen.map((z) => (
            <tr key={z.id}>
              <th scope="row" className="w-full max-w-0 px-3.5 py-2.5 text-left font-normal">
                <p className="truncate font-semibold text-foreground" title={z.name}>
                  {z.name}
                </p>
                <p className={cn('truncate text-[12.5px]', LEISE)}>{z.ort}</p>
              </th>
              <td className="px-3.5 py-2.5 whitespace-nowrap">
                <Zustand zeile={z} />
              </td>
              <td className="px-3.5 py-2.5 text-[13.5px] whitespace-nowrap">
                <Signale zeile={z} />
              </td>
              <td className="px-3.5 py-2.5 tabular-nums">{z.bestellungen30}</td>
              <td className="px-3.5 py-2.5 whitespace-nowrap">{z.zuletztAktiv ?? <span className={LEISE}>–</span>}</td>
              <td className="px-2 py-1.5 text-right whitespace-nowrap">
                <AkteLink zeile={z} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Unter 1024 px: je Hof eine Karte (nichts scrollt quer). */
function Karten({ zeilen }: { zeilen: HoefeListenZeile[] }): React.JSX.Element {
  return (
    <ul className="flex flex-col gap-3 lg:hidden">
      {zeilen.map((z) => (
        <li key={z.id} className={cn(KARTE, 'flex flex-col gap-2.5 p-4')}>
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 font-semibold break-words text-foreground" title={z.name}>
                {z.name}
              </p>
              <p className={cn('truncate text-[12.5px]', LEISE)}>{z.ort}</p>
            </div>
            <Zustand zeile={z} />
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
            <div className="col-span-2">
              <dt className={LEISE}>Signal</dt>
              <dd>
                <Signale zeile={z} />
              </dd>
            </div>
            <div>
              <dt className={LEISE}>Bestellungen 30 Tage</dt>
              <dd className="text-foreground tabular-nums">{z.bestellungen30}</dd>
            </div>
            <div>
              <dt className={LEISE}>Zuletzt aktiv</dt>
              <dd className="text-foreground">{z.zuletztAktiv ?? '–'}</dd>
            </div>
          </dl>
          <div className="flex justify-end border-t border-border pt-2.5">
            <AkteLink zeile={z} />
          </div>
        </li>
      ))}
    </ul>
  )
}
