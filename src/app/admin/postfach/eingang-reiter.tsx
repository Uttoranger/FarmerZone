import Link from 'next/link'
import { CheckCheck, Inbox } from 'lucide-react'
import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { getAdminFarms } from '@/server/queries/admin'
import { getDuplikateVon, getMeldungDetail, getWunschCluster, type AdminMeldungDetail } from '@/server/queries/meldung'
import { ladeEingang, ladeFadenAdmin, type AdminFaden } from '@/server/queries/postfach'
import {
  EINGANG_FILTER_IDS,
  EINGANG_FILTER_LABEL,
  EINGANG_LEER,
  EINGANG_TEXT,
  eingangAdresse,
  eingangEintraege,
  eingangKennung,
  wannText,
  type EingangAuswahl,
  type EingangEintrag,
  type EingangFilter,
} from '@/lib/postfach'
import { hofSignale } from '@/lib/admin-hoefe-liste'
import { adminHofHref } from '@/lib/admin-hof-akte'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'
import { FilterChip, FilterChipReihe } from '@/components/ui/chip'
import { Marke } from '@/components/ui/marke'
import { FOKUS_RAHMEN, FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'
import { KARTE, KICKER, LEISE } from '@/components/hof-bestellungen/stil'
import { MeldungEntscheidenSpalte, Wunschliste, type WunschBuendel } from '@/components/admin/briefkasten-teile'
import { FadenSpalte, type AkteHinweis } from './faden-spalte'

const SPALTE = cn(KARTE, 'flex min-w-0 flex-col overflow-hidden dark:ring-1 dark:ring-border')

type Detail =
  | { art: 'antwort'; faden: AdminFaden; akte: AkteHinweis | null }
  | { art: 'meldung'; meldung: AdminMeldungDetail; duplikate: Awaited<ReturnType<typeof getDuplikateVon>> }

export type EingangDaten = {
  filter: EingangFilter
  eintraege: EingangEintrag[]
  auswahl: EingangAuswahl | null
  detail: Detail | null
  /** Die Wunschliste gebündelt — nur beim Filter Meldung ohne Auswahl, als Inhalt der rechten Spalte. */
  wuensche: WunschBuendel[] | null
}

/**
 * Der Hinweis aus der Akte im Faden (N32, Nr. 193; Mockup
 * admin-postfach-gespraeche): Hat der Hof ein Signal, steht es über dem
 * Antwortfeld — dieselbe Regel wie Höfe-Liste und Heute (`hofSignale`), kein
 * zweites Urteil. Ohne Signal kein Hinweis. Die Liste der Höfe ist beim Pilot
 * klein; sie ist dieselbe Abfrage wie Admin › Höfe.
 */
async function ladeAkteHinweis(hofId: string, jetzt: Date): Promise<AkteHinweis | null> {
  // Der Hinweis ist Beiwerk: Scheitert das Laden, bleibt der Faden sichtbar, nur ohne Hinweis.
  try {
    const hof = (await getAdminFarms(jetzt)).find((f) => f.id === hofId)
    if (!hof) return null
    const signale = hofSignale(hof, jetzt)
    return signale.length === 0 ? null : { signale: signale.map((s) => s.text), href: adminHofHref(hof.id) }
  } catch (err) {
    const meldung = new Error('Postfach: Hinweis aus der Akte nicht geladen')
    meldung.name = err instanceof Error ? err.name : 'Unbekannt'
    Sentry.captureException(meldung, { level: 'warning', tags: { bereich: 'admin', seite: 'postfach-akte-hinweis' } })
    return null
  }
}

/**
 * Die Daten des Eingangs — wirft bei einem Datenbankfehler; die Seite zeigt
 * dann AdminFehler. Die Liste mischt rein (eingangEintraege); die gewählte
 * Zeile lädt ihr Detail nach Art. Eine Kennung, die zu nichts gehört, öffnet
 * nichts (auch keine fremde Art: Der Faden braucht eine cuid). Alte Links auf
 * eine Aufgabe leitet die Seite vorher um (page.tsx).
 */
export async function ladeEingangReiter(filter: EingangFilter, auswahl: EingangAuswahl | null, jetzt: Date): Promise<EingangDaten> {
  const roh = await ladeEingang(filter)
  const eintraege = eingangEintraege(roh, filter)

  let detail: Detail | null = null
  if (auswahl?.art === 'antwort') {
    const id = z.cuid().safeParse(auswahl.id)
    const faden = id.success ? await ladeFadenAdmin(id.data) : null
    detail = faden ? { art: 'antwort', faden, akte: await ladeAkteHinweis(faden.hof.id, jetzt) } : null
  } else if (auswahl?.art === 'meldung') {
    const meldung = await getMeldungDetail(auswahl.id)
    // „Woraus" (Nr. 101): die Duplikate dieser Meldung, mit „Trennen".
    detail = meldung ? { art: 'meldung', meldung, duplikate: await getDuplikateVon(meldung.id) } : null
  }

  let wuensche: WunschBuendel[] | null = null
  if (filter === 'meldung' && detail === null) {
    wuensche = (await getWunschCluster()).map((c) => ({
      schluessel: c.clusterKey ?? '__ohne',
      name: c.clusterKey ?? 'Ohne Bündel',
      anzahl: c.anzahl,
      beispiele: c.beispiele.map((b) => ({ id: b.id, text: `${b.kurznummer} · ${b.hofName ?? 'Kundin'} · ${b.ersteZeile || '—'}` })),
      weitere: Math.max(0, c.anzahl - c.beispiele.length),
    }))
  }
  return { filter, eintraege, auswahl, detail, wuensche }
}

function Zeile({ e, filter, aktiv, jetzt }: { e: EingangEintrag; filter: EingangFilter; aktiv: boolean; jetzt: Date }): React.JSX.Element {
  return (
    <Link
      href={eingangAdresse(filter, e.auswahl)}
      scroll={false}
      aria-current={aktiv ? 'true' : undefined}
      className={cn(
        'flex min-h-11 items-start gap-2.5 border-l-[3px] py-3 pr-3.5 pl-[11px] transition-colors duration-[250ms]',
        aktiv ? 'border-l-brand-text bg-muted' : 'border-l-transparent hover:bg-muted',
        FOKUS_RAHMEN_INNEN
      )}
    >
      <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', e.offen ? 'bg-zustand-tun' : 'bg-transparent')}>
        {e.offen && <span className="sr-only">{EINGANG_TEXT.offenSr}</span>}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-2">
          <Marke art={e.markeArt} className="shrink-0">
            {e.marke}
          </Marke>
          <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-foreground" title={e.wer}>
            {e.wer}
          </span>
          <span className={cn('shrink-0 text-xs', LEISE)}>{wannText(e.zeit, jetzt)}</span>
        </span>
        <span className="truncate text-[13.5px] font-semibold text-foreground" title={e.titel}>
          {e.titel}
        </span>
        <span className={cn('truncate text-[12.5px]', LEISE)} title={e.zeile}>
          {e.zeile}
        </span>
      </span>
    </Link>
  )
}

function DetailSpalte({ detail, wuensche, jetzt }: { detail: Detail | null; wuensche: WunschBuendel[] | null; jetzt: Date }): React.JSX.Element {
  if (detail?.art === 'antwort') return <FadenSpalte faden={detail.faden} akte={detail.akte} jetzt={jetzt} />
  if (detail?.art === 'meldung') return <MeldungEntscheidenSpalte m={detail.meldung} jetzt={jetzt} duplikate={detail.duplikate} />
  return (
    <div className="flex flex-col gap-4 p-4 md:p-5">
      <p className={cn('py-6 text-center text-sm', LEISE)}>{EINGANG_TEXT.waehlen}</p>
      {wuensche && <Wunschliste buendel={wuensche} />}
    </div>
  )
}

/*
 * Der Eingang des Admin-Postfachs (Register N12-Änderung, N14; Nr. 95;
 * Mockups admin-postfach, admin-postfach-unterhaltungen,
 * admin-postfach-meldungen; seit Nr. 193 admin-postfach-gespraeche): links
 * EINE Liste aus Antworten und Meldungen (480 px ab 1024 px, darunter
 * gestapelt) mit den Filterchips Offen · Antwort · Meldung · Alle (ohne Zahl —
 * die steht am Unterreiter „Eingang"), rechts die Arbeit am gewählten Eintrag
 * — Faden mit Antwortfeld (und dem Hinweis aus der Akte) oder Meldung
 * entscheiden. Aufgaben und Kennzahlen stehen seit Nr. 193 in Heute (N32).
 * Gewählt wird über ?id= (art-kennung); nichts öffnet von selbst, weil Öffnen
 * den Lesestand setzt. Regel-Zeile darunter (Seitenmuster N15). Filter und
 * Zeilen wechseln ohne Sprung nach oben, der gewählte Filter zeigt beim Laden
 * den kleinen Kreis.
 */
export function EingangReiter({ daten, jetzt }: { daten: EingangDaten; jetzt: Date }): React.JSX.Element {
  const { filter, eintraege, auswahl, detail } = daten
  const leer = EINGANG_LEER[filter]
  const gewaehlt = auswahl ? eingangKennung(auswahl) : null
  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[480px_minmax(0,1fr)]">
        <section aria-label={EINGANG_TEXT.listeBeschriftung} className={SPALTE}>
          <div className="px-3.5 pt-3 pb-2">
            <p className={cn(KICKER, 'mb-1.5')}>{EINGANG_TEXT.listeKopf(filter)}</p>
            <FilterChipReihe beschriftung={EINGANG_TEXT.filterBeschriftung}>
              {EINGANG_FILTER_IDS.map((f) => (
                <FilterChip key={f} href={eingangAdresse(f)} aktiv={f === filter} scroll={false} ladePunkt>
                  {EINGANG_FILTER_LABEL[f]}
                </FilterChip>
              ))}
            </FilterChipReihe>
          </div>
          {eintraege.length === 0 ? (
            <EmptyState
              symbol={filter === 'offen' ? CheckCheck : Inbox}
              titel={leer.titel}
              satz={leer.satz}
              className="rounded-none border-0 py-8"
              ausweg={
                <Link href={eingangAdresse(filter === 'alle' ? 'offen' : 'alle')} scroll={false} className={cn('inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-semibold hover:bg-muted', FOKUS_RAHMEN)}>
                  {filter === 'alle' ? EINGANG_TEXT.offenesZeigen : EINGANG_TEXT.alleZeigen}
                </Link>
              }
            />
          ) : (
            <ul>
              {eintraege.map((e) => {
                const kennung = eingangKennung(e.auswahl)
                return (
                  <li key={kennung} className="border-t border-border">
                    <Zeile e={e} filter={filter} aktiv={kennung === gewaehlt} jetzt={jetzt} />
                  </li>
                )
              })}
            </ul>
          )}
        </section>
        <section aria-label={EINGANG_TEXT.detailBeschriftung} className={SPALTE}>
          <DetailSpalte detail={detail} wuensche={daten.wuensche} jetzt={jetzt} />
        </section>
      </div>
      <p className={cn('text-[12.5px] leading-relaxed', LEISE)}>{EINGANG_TEXT.regel}</p>
    </div>
  )
}
