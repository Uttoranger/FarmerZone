import Link from 'next/link'
import { Check, CheckCheck, Inbox, Star, X } from 'lucide-react'
import { z } from 'zod'
import { getAdminFarms } from '@/server/queries/admin'
import { getDuplikateVon, getMeldungDetail, getWunschCluster, type AdminMeldungDetail } from '@/server/queries/meldung'
import {
  ladeEingang,
  ladeErstattungAufgaben,
  ladeFadenAdmin,
  ladeHofAufgaben,
  type AdminFaden,
} from '@/server/queries/postfach'
import {
  EINGANG_FILTER_IDS,
  EINGANG_FILTER_LABEL,
  EINGANG_LEER,
  EINGANG_TEXT,
  eingangAdresse,
  eingangEintraege,
  eingangKennung,
  hofPruefliste,
  stripeZahlungAdresse,
  wannText,
  type EingangAuswahl,
  type EingangEintrag,
  type EingangFilter,
  type ErstattungAufgabeRoh,
  type HofAufgabeRoh,
} from '@/lib/postfach'
import type { KennzahlDaten } from '@/lib/admin-seiten'
import { adminHofZeile, type AdminHofZeile } from '@/lib/admin-hoefe'
import { wartelistePlatzZeile } from '@/lib/admin-hoefe-seite'
import { gruendungsplaetze, MAX_GRUENDUNGSHOEFE } from '@/lib/gruendungshof'
import { wienKalendertag } from '@/lib/kalender'
import { datumKurz } from '@/lib/verkauf-eintragen'
import { UMGEBUNG } from '@/lib/umgebung-server'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'
import { FilterChip, FilterChipReihe } from '@/components/ui/chip'
import { Marke } from '@/components/ui/marke'
import { FOKUS_RAHMEN, FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'
import { KARTE, KICKER, LEISE } from '@/components/hof-bestellungen/stil'
import { MeldungEntscheidenSpalte, Wunschliste, type WunschBuendel } from '@/components/admin/briefkasten-teile'
import { PostfachHofAktionen } from '@/components/admin/postfach-aufgabe-hof'
import { PostfachErstattungSpalte } from '@/components/admin/postfach-aufgabe-erstattung'
import { Kennzahlen } from '@/components/admin/kennzahlen'
import { ErstattungErledigt } from './erstattung-erledigt'
import { FadenSpalte } from './faden-spalte'

const SPALTE = cn(KARTE, 'flex min-w-0 flex-col overflow-hidden dark:ring-1 dark:ring-border')

type Detail =
  | { art: 'antwort'; faden: AdminFaden }
  | { art: 'meldung'; meldung: AdminMeldungDetail; duplikate: Awaited<ReturnType<typeof getDuplikateVon>> }
  | { art: 'hof'; hof: HofAufgabeRoh; zeile: AdminHofZeile | null; vergeben: number }
  | { art: 'erstattung'; erstattung: ErstattungAufgabeRoh; zahlungAdresse: string | null }

export type EingangDaten = {
  filter: EingangFilter
  eintraege: EingangEintrag[]
  auswahl: EingangAuswahl | null
  detail: Detail | null
  /** Die Wunschliste gebündelt — nur beim Filter Meldung ohne Auswahl, als Inhalt der rechten Spalte. */
  wuensche: WunschBuendel[] | null
}

/**
 * Der Hof einer Aufgabe für Freischalten/Ablehnen: dieselbe Zeile und dieselbe
 * Platzzahl wie Admin › Höfe (src/app/admin/page.tsx — getAdminFarms,
 * adminHofZeile, MAX_GRUENDUNGSHOEFE), damit Rückfrage und Sperre dasselbe
 * sagen. Nur wenn eine Hof-Aufgabe gewählt ist.
 */
async function ladeHofZeile(hofId: string, jetzt: Date): Promise<{ zeile: AdminHofZeile | null; vergeben: number }> {
  const farms = await getAdminFarms(jetzt)
  const hof = farms.find((f) => f.id === hofId)
  return {
    zeile: hof ? adminHofZeile(hof, { gruendungsplatz: null, maxPlaetze: MAX_GRUENDUNGSHOEFE }, jetzt) : null,
    vergeben: Math.min(gruendungsplaetze(farms).size, MAX_GRUENDUNGSHOEFE),
  }
}

/**
 * Die Daten des Eingangs — wirft bei einem Datenbankfehler; die Seite zeigt
 * dann AdminFehler. Die Liste mischt rein (eingangEintraege); die gewählte
 * Zeile lädt ihr Detail nach Art. Eine Kennung, die zu nichts gehört, öffnet
 * nichts (auch keine fremde Art: Der Faden braucht eine cuid).
 */
export async function ladeEingangReiter(filter: EingangFilter, auswahl: EingangAuswahl | null, jetzt: Date): Promise<EingangDaten> {
  const roh = await ladeEingang(filter, jetzt)
  const eintraege = eingangEintraege(roh, filter)

  let detail: Detail | null = null
  if (auswahl?.art === 'antwort') {
    const id = z.cuid().safeParse(auswahl.id)
    const faden = id.success ? await ladeFadenAdmin(id.data) : null
    detail = faden ? { art: 'antwort', faden } : null
  } else if (auswahl?.art === 'meldung') {
    const meldung = await getMeldungDetail(auswahl.id)
    // „Woraus" (Nr. 101): die Duplikate dieser Meldung, mit „Trennen".
    detail = meldung ? { art: 'meldung', meldung, duplikate: await getDuplikateVon(meldung.id) } : null
  } else if (auswahl?.art === 'hof') {
    const hoefe = roh.hoefe.length > 0 ? roh.hoefe : await ladeHofAufgaben(jetzt)
    const hof = hoefe.find((h) => h.id === auswahl.id)
    detail = hof ? { art: 'hof', hof, ...(await ladeHofZeile(hof.id, jetzt)) } : null
  } else if (auswahl?.art === 'erstattung') {
    const erstattungen = roh.erstattungen.length > 0 ? roh.erstattungen : await ladeErstattungAufgaben()
    const erstattung = erstattungen.find((e) => e.id === auswahl.id)
    detail = erstattung ? { art: 'erstattung', erstattung, zahlungAdresse: stripeZahlungAdresse(erstattung.zahlungKennung, UMGEBUNG.stripe) } : null
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

/** Die Aufgabe „Hof wartet" (Mockup admin-postfach): Kopf, Platz, Prüfliste, Regel, Freischalten/Ablehnen. */
function HofSpalte({ hof, zeile, vergeben, jetzt }: { hof: HofAufgabeRoh; zeile: AdminHofZeile | null; vergeben: number; jetzt: Date }): React.JSX.Element {
  const platz = wartelistePlatzZeile(hof, hof.platz)
  return (
    <div className="flex flex-col gap-4 p-4 md:p-5">
      <div className="min-w-0">
        <p className={KICKER}>{EINGANG_TEXT.aufgabe}</p>
        <h2 className="mt-1 font-heading text-[19px] leading-snug font-semibold break-words text-foreground">
          {EINGANG_TEXT.hofKopf(hof.name)}
        </h2>
        <p className={cn('mt-0.5 text-[13px]', LEISE)}>{EINGANG_TEXT.registriert(datumKurz(wienKalendertag(hof.createdAt), wienKalendertag(jetzt)))}</p>
      </div>
      {platz && (
        <p className={cn('flex items-center gap-1.5 text-[13px]', platz.art === 'bekaeme' ? 'font-semibold text-zustand-tun' : 'font-medium text-muted-foreground')}>
          {platz.art === 'bekaeme' && <Star className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />}
          {platz.text}
        </p>
      )}
      <ul aria-label={EINGANG_TEXT.prueflisteBeschriftung} className="flex flex-col gap-1.5">
        {hofPruefliste(hof).map((p) => (
          <li key={p.schluessel} className="flex items-start gap-2 text-[14px] text-foreground">
            {p.erledigt ? (
              <Check className="mt-0.5 size-4 shrink-0 text-zustand-erledigt" strokeWidth={2} aria-hidden="true" />
            ) : (
              <X className="mt-0.5 size-4 shrink-0 text-zustand-tun" strokeWidth={2} aria-hidden="true" />
            )}
            <span className="min-w-0 break-words">
              {p.text}
              <span className="sr-only">{p.erledigt ? EINGANG_TEXT.erledigtSr : EINGANG_TEXT.fehltSr}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className={cn('text-[12.5px] leading-relaxed', LEISE)}>{EINGANG_TEXT.hofRegel}</p>
      {zeile && <PostfachHofAktionen hof={zeile} vergebenePlaetze={vergeben} />}
    </div>
  )
}

function DetailSpalte({ detail, wuensche, jetzt }: { detail: Detail | null; wuensche: WunschBuendel[] | null; jetzt: Date }): React.JSX.Element {
  if (detail?.art === 'antwort') return <FadenSpalte faden={detail.faden} jetzt={jetzt} />
  if (detail?.art === 'meldung') return <MeldungEntscheidenSpalte m={detail.meldung} jetzt={jetzt} duplikate={detail.duplikate} />
  if (detail?.art === 'hof') return <HofSpalte hof={detail.hof} zeile={detail.zeile} vergeben={detail.vergeben} jetzt={jetzt} />
  if (detail?.art === 'erstattung') {
    // „Erstattung erledigt" (Nr. 105) unter der Spalte aus Nr. 95 — in deren Polster, damit es wie ein Teil davon steht.
    return (
      <>
        <PostfachErstattungSpalte e={detail.erstattung} zahlungAdresse={detail.zahlungAdresse} jetzt={jetzt} />
        <div className="flex flex-col px-4 pb-4 md:px-5 md:pb-5">
          <ErstattungErledigt key={detail.erstattung.id} orderId={detail.erstattung.id} />
        </div>
      </>
    )
  }
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
 * admin-postfach-meldungen): links EINE Liste aller drei Arten (480 px ab
 * 1024 px, darunter gestapelt) mit den Filterchips Offen · Antwort · Meldung ·
 * Aufgabe · Alle (ohne Zahl — die steht am Unterreiter „Eingang", wie im
 * Mockup), rechts die Arbeit am gewählten Eintrag — Faden mit
 * Antwortfeld, Meldung entscheiden, Hof freischalten/ablehnen, Erstattung
 * ansehen. Gewählt wird über ?id= (art-kennung); nichts öffnet von selbst,
 * weil Öffnen den Lesestand setzt. Regel-Zeile darunter (Seitenmuster N15).
 * Seit Nr. 105 (Mockup admin-postfach-ruhig) stehen die Kennzahlen hier oben,
 * unter den Unterreitern — sie gehören zum Eingang; ohne Zahlen (Ladefehler)
 * fehlen sie. Filter und Zeilen wechseln ohne Sprung nach oben, der gewählte
 * Filter zeigt beim Laden den kleinen Kreis.
 */
export function EingangReiter({ daten, kennzahlen, jetzt }: { daten: EingangDaten; kennzahlen: KennzahlDaten[] | null; jetzt: Date }): React.JSX.Element {
  const { filter, eintraege, auswahl, detail } = daten
  const leer = EINGANG_LEER[filter]
  const gewaehlt = auswahl ? eingangKennung(auswahl) : null
  return (
    <div className="flex flex-col gap-3.5">
      {kennzahlen && <Kennzahlen beschriftung={EINGANG_TEXT.kennzahlenBeschriftung} eintraege={kennzahlen} />}
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
