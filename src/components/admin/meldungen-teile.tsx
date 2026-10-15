import Link from 'next/link'
import { Check, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react'
import {
  BUENDEL_STAND_LABEL,
  MELDUNGEN_TEXT,
  MELDUNG_ARTEN,
  MELDUNG_ART_LABEL,
  MELDUNG_ART_MARKE,
  STAND_TEILE,
  STAND_TEIL_TEXT,
  WUENSCHE_LEER,
  WUENSCHE_LEER_FILTER,
  WUENSCHE_TEXT,
  kiBegruendung,
  meldungenAuf,
  oeffentlicherStatus,
  standBandBeschriftung,
  teileErledigt,
  type AblaufKarte,
  type AblaufStand,
  type BuendelStand,
  type MeldungTeil,
  type StandTeil,
  type SuchMeldung,
} from '@/lib/meldung'
import type { MarkeArt } from '@/lib/marke-art'
import { adminPostfachAdresse, eingangMeldungAdresse, wannText } from '@/lib/postfach'
import { wienKalendertag } from '@/lib/kalender'
import { datumKurz } from '@/lib/verkauf-eintragen'
import { cn } from '@/lib/utils'
import { WUENSCHE_FILTER, type MeldungenAnsicht, type ZugeklappterTeil } from '@/schemas/meldung'
import type { WunschCluster } from '@/server/queries/meldung'
import { Marke } from '@/components/ui/marke'
import { EmptyState } from '@/components/ui/empty-state'
import { FilterChip, FilterChipReihe } from '@/components/ui/chip'
import { FOKUS_RAHMEN, FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'
import { KARTE, KICKER, KNOPF_RAHMEN, LEISE } from '@/components/hof-bestellungen/stil'
import { KiKnoepfe } from './meldungen-ki-vorschlag'
import { KartenMenue, TrennenKnopf, WerkzeugKnopf } from './meldungen-werkzeug'
import { StandFormular } from './meldungen-stand-formular'

/*
 * Der Reiter „Meldungen" des Admin-Postfachs (Register N14, Ergänzung;
 * Nachtlauf Nr. 101; Mockups admin-postfach-meldungen-ablauf,
 * admin-postfach-wuensche, mobil-admin-postfach-meldungen): Stand-Band über
 * alle Meldungen, Umschalter Ablauf | Wünsche gebündelt, Filter Art und Von.
 * Alles steht in der Adresse (meldungenAnsichtAus, Zod mit Standard) — die
 * Teile hier sind Server-Komponenten, nur die Klicks (KI, Menü, Dialoge,
 * Stand für alle) sind Client-Inseln. Welche Meldung in welchem Teil steht,
 * entscheidet allein meldungTeil/ablaufStand (src/lib/meldung.ts). Kurztitel
 * und Wortlaut sind Fremdtext und stehen nur als Text da.
 */

/** Ein Link im Reiter: die aktuelle Wahl mit einer Änderung. */
export function meldungenAdresse(a: MeldungenAnsicht, aenderung: Partial<MeldungenAnsicht> = {}): string {
  const n = { ...a, ...aenderung }
  return adminPostfachAdresse('meldungen', {
    ansicht: n.ansicht === 'ablauf' ? undefined : n.ansicht,
    art: n.art ? n.art.toLowerCase() : undefined,
    von: n.von === 'alle' ? undefined : n.von,
    auf: n.auf.length > 0 ? n.auf.join(',') : undefined,
    teil: n.teil === 'brauchtDich' ? undefined : n.teil,
    aeltere: n.aeltere ? '1' : undefined,
    buendel: n.buendel ?? undefined,
    stand: n.stand === 'alle' ? undefined : n.stand,
  })
}

/** Die Farbe eines Teils im Balken — nur Tokens (Bedeutungsfarben G5), in beiden Themes. */
const BAND_FARBE: Record<StandTeil, string> = {
  brauchtDich: 'bg-zustand-tun',
  inArbeit: 'bg-zustand-laeuft',
  erledigt: 'bg-zustand-laeuft/45',
  gesammelt: 'bg-zustand-erledigt',
  abgelegt: 'bg-border',
}

const SPALTEN_PUNKT: Partial<Record<MeldungTeil, string>> = {
  neu: 'bg-zustand-tun',
  ki: 'bg-zustand-tun',
  geplant: 'bg-zustand-laeuft',
  erledigt: 'bg-zustand-laeuft/45',
}

const STAND_MARKE: Record<BuendelStand, MarkeArt> = {
  neu: 'tun',
  gesammelt: 'laeuft',
  geplant: 'laeuft',
  umgesetzt: 'erledigt',
  nichtGeplant: 'erledigt',
  gemischt: 'erledigt',
}

/** „15.10." — der Wiener Tag ohne Jahr, wie im Mockup („seit 15.10.", „live 7.10."). */
function tagPunkt(d: Date): string {
  const [, monat, tag] = wienKalendertag(d).split('-').map(Number)
  return `${tag}.${monat}.`
}

// ─── Stand-Band ─────────────────────────────────────────────────────────────

export function StandBand({ stand }: { stand: AblaufStand }): React.JSX.Element {
  const { band, gesamt } = stand
  return (
    <section aria-label={MELDUNGEN_TEXT.standBeschriftung} className={cn(KARTE, 'flex flex-col gap-3 px-4 py-3.5 md:px-[18px] md:py-4 dark:ring-1 dark:ring-border')}>
      <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
        <span className="text-sm font-semibold text-foreground">{MELDUNGEN_TEXT.summe(gesamt)}</span>
        <span className={cn('hidden text-[12.5px] md:inline', LEISE)}>{MELDUNGEN_TEXT.summeSatz}</span>
      </p>
      <div role="img" aria-label={standBandBeschriftung(band)} className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted">
        {STAND_TEILE.filter((t) => band[t] > 0).map((t) => (
          <span key={t} className={cn('h-full', BAND_FARBE[t])} style={{ flexGrow: band[t] }} />
        ))}
      </div>
      <dl className="grid grid-cols-5 gap-1.5 md:gap-3.5">
        {STAND_TEILE.map((t) => (
          <div key={t} className="flex min-w-0 flex-col">
            <dt className="order-2 flex items-center gap-2 text-[11.5px] leading-tight font-semibold text-foreground md:order-none md:text-[13.5px]">
              <span className={cn('hidden size-2.5 shrink-0 rounded-[3px] md:block', BAND_FARBE[t])} aria-hidden="true" />
              {STAND_TEIL_TEXT[t].titel}
            </dt>
            <dd
              className={cn(
                'order-1 font-heading text-[18px] leading-tight font-semibold md:order-none md:pl-[18px] md:text-[24px]',
                t === 'brauchtDich' && band[t] > 0 ? 'text-zustand-tun' : 'text-foreground'
              )}
            >
              {band[t]}
            </dd>
            <dd className={cn('order-3 hidden text-[12px] md:block md:pl-[18px]', LEISE)}>{STAND_TEIL_TEXT[t].satz}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

// ─── Kopf: Umschalter und Filter ────────────────────────────────────────────

export function MeldungenKopf({ ansicht, stand }: { ansicht: MeldungenAnsicht; stand: AblaufStand }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:gap-3">
      <FilterChipReihe beschriftung={MELDUNGEN_TEXT.ansichtBeschriftung}>
        <FilterChip href={meldungenAdresse(ansicht, { ansicht: 'ablauf' })} aktiv={ansicht.ansicht === 'ablauf'}>
          {MELDUNGEN_TEXT.ablauf}
        </FilterChip>
        <FilterChip href={meldungenAdresse(ansicht, { ansicht: 'wuensche' })} aktiv={ansicht.ansicht === 'wuensche'}>
          {MELDUNGEN_TEXT.wuensche}
        </FilterChip>
      </FilterChipReihe>
      {ansicht.ansicht === 'ablauf' && (
        <>
          <span className="hidden flex-1 lg:block" />
          <FilterChipReihe beschriftung={MELDUNGEN_TEXT.artBeschriftung}>
            <FilterChip href={meldungenAdresse(ansicht, { art: null })} aktiv={ansicht.art === null}>
              {MELDUNGEN_TEXT.alle} <span className="ml-1.5 text-xs font-semibold tabular-nums">{stand.jeArt.alle}</span>
            </FilterChip>
            {MELDUNG_ARTEN.map((a) => (
              <FilterChip key={a} href={meldungenAdresse(ansicht, { art: a })} aktiv={ansicht.art === a}>
                {MELDUNG_ART_LABEL[a]} <span className="ml-1.5 text-xs font-semibold tabular-nums">{stand.jeArt[a]}</span>
              </FilterChip>
            ))}
          </FilterChipReihe>
          <div className="flex items-center gap-2">
            <span className={cn('text-[12.5px]', LEISE)} aria-hidden="true">
              {MELDUNGEN_TEXT.von}
            </span>
            <FilterChipReihe beschriftung={MELDUNGEN_TEXT.vonBeschriftung}>
              {(['hoefe', 'kundschaft'] as const).map((v) => (
                <FilterChip
                  key={v}
                  href={meldungenAdresse(ansicht, {
                    von: ansicht.von === v ? 'alle' : v,
                  })}
                  aktiv={ansicht.von === v}
                >
                  {MELDUNGEN_TEXT.vonLabel[v]}
                </FilterChip>
              ))}
            </FilterChipReihe>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Karten ─────────────────────────────────────────────────────────────────

function Chip({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[11.5px] text-muted-foreground">{children}</span>
}

function karteZeit(karte: AblaufKarte, jetzt: Date): string {
  if (karte.teil === 'neu' || karte.teil === 'ki') return wannText(karte.zeit, jetzt)
  if (karte.teil === 'geplant') return MELDUNGEN_TEXT.seit(tagPunkt(karte.zeit))
  return tagPunkt(karte.zeit)
}

function titelVon(karte: AblaufKarte): string {
  return karte.buendel ?? (karte.haupt.ersteZeile || '—')
}

function werVon(karte: AblaufKarte): string {
  if (karte.buendel) return MELDUNGEN_TEXT.buendelWer(karte.hoefe)
  const teile = [karte.haupt.hofName ?? MELDUNGEN_TEXT.kundin, karte.haupt.diagKennung ? MELDUNGEN_TEXT.kennung(karte.haupt.diagKennung) : null]
  return teile.filter((t) => t !== null).join(' · ')
}

/** Wohin „Ansehen" führt: ein Wunsch-Bündel in „Wünsche gebündelt", sonst die Meldung im Eingang. */
function ansehenAdresse(karte: AblaufKarte, ansicht: MeldungenAnsicht): string {
  if (karte.buendel && karte.haupt.art === 'WUNSCH')
    return meldungenAdresse(ansicht, {
      ansicht: 'wuensche',
      buendel: karte.buendel,
    })
  return eingangMeldungAdresse(karte.haupt.id)
}

export function MeldungKarte({ karte, jetzt, ansicht, such }: { karte: AblaufKarte; jetzt: Date; ansicht: MeldungenAnsicht; such: SuchMeldung | undefined }): React.JSX.Element {
  const m = karte.haupt
  const titel = titelVon(karte)
  const grund = karte.teil === 'ki' ? kiBegruendung(m.triageNotiz) : null
  return (
    <article
      className={cn(
        'flex min-w-0 flex-col gap-2 rounded-xl border bg-card p-3 dark:ring-1 dark:ring-border',
        karte.teil === 'neu' || karte.teil === 'ki' ? 'border-zustand-tun/45' : 'border-border'
      )}
    >
      <div className="flex items-center gap-1.5">
        <Marke art={MELDUNG_ART_MARKE[m.art]}>{MELDUNG_ART_LABEL[m.art]}</Marke>
        <span className="flex-1" />
        <span className={cn('text-[11.5px] whitespace-nowrap', LEISE)}>{karteZeit(karte, jetzt)}</span>
      </div>
      <h3 className="text-[13.5px] leading-snug font-semibold break-words text-foreground" title={titel}>
        {titel}
      </h3>
      <p className={cn('truncate text-[12px]', LEISE)} title={werVon(karte)}>
        {werVon(karte)}
      </p>
      {karte.teil === 'ki' && <p className="text-[12.5px] leading-snug break-words text-foreground">{grund ? MELDUNGEN_TEXT.kiGrund(grund) : MELDUNGEN_TEXT.kiOhneGrund}</p>}
      {(m.screenshot || karte.meldungen > 1 || m.sprintName || karte.angesehen) && (
        <div className="flex flex-wrap gap-1.5">
          {m.screenshot && !karte.buendel && <Chip>{MELDUNGEN_TEXT.screenshot}</Chip>}
          {karte.meldungen > 1 && <Chip>{MELDUNGEN_TEXT.meldungenChip(karte.meldungen, karte.duplikate)}</Chip>}
          {m.sprintName && <Chip>{m.sprintName}</Chip>}
          {karte.angesehen && <Chip>{MELDUNGEN_TEXT.angesehen}</Chip>}
        </div>
      )}
      {karte.teil === 'ki' ? (
        <KiKnoepfe
          meldungId={m.id}
          stand={
            such?.stand ?? {
              status: m.status,
              art: m.art,
              clusterKey: m.clusterKey,
              triageNotiz: m.triageNotiz,
              duplikatVonId: m.duplikatVonId,
              sprintName: m.sprintName,
              antwortAnMelder: m.antwortAnMelder,
            }
          }
        />
      ) : (
        <div className="flex items-center gap-2">
          <Link href={ansehenAdresse(karte, ansicht)} className={cn(KNOPF_RAHMEN, 'px-4')}>
            {MELDUNGEN_TEXT.ansehen}
          </Link>
          <span className="flex-1" />
          {!karte.buendel && such && <KartenMenue meldung={such} titel={titel} />}
        </div>
      )}
    </article>
  )
}

/** Eine kompakte Zeile unter Erledigt: Haken, Kurztitel, Art · Nummer · live, was der Hof sieht. */
function ErledigtZeile({ karte }: { karte: AblaufKarte }): React.JSX.Element {
  const m = karte.haupt
  const titel = titelVon(karte)
  const zeile = [karte.buendel ? MELDUNGEN_TEXT.meldungenChip(karte.meldungen, karte.duplikate) : MELDUNG_ART_LABEL[m.art], m.sprintName, MELDUNGEN_TEXT.live(tagPunkt(karte.zeit))]
    .filter((t) => t)
    .join(' · ')
  return (
    <li className="flex min-w-0 gap-2.5 py-2">
      <Check className="mt-0.5 size-4 shrink-0 text-zustand-laeuft" strokeWidth={2} aria-hidden="true" />
      <Link href={eingangMeldungAdresse(m.id)} className={cn('flex min-w-0 flex-1 flex-col rounded hover:underline', FOKUS_RAHMEN_INNEN)}>
        <span className="truncate text-[13px] font-semibold text-foreground" title={titel}>
          {titel}
        </span>
        <span className={cn('truncate text-[12px]', LEISE)}>{zeile}</span>
        <span className={cn('truncate text-[12px]', LEISE)}>{MELDUNGEN_TEXT.hofSieht(oeffentlicherStatus(m.status, m.art), (m.antwortAnMelder ?? '').trim() !== '')}</span>
      </Link>
    </li>
  )
}

function ErledigtListe({ karten, jetzt, ansicht }: { karten: AblaufKarte[]; jetzt: Date; ansicht: MeldungenAnsicht }): React.JSX.Element {
  const { sichtbar, aeltere } = teileErledigt(karten, jetzt)
  const gezeigt = ansicht.aeltere ? [...sichtbar, ...aeltere] : sichtbar
  return (
    <div className="flex flex-col">
      {gezeigt.length > 0 && (
        <ul className="[&>li+li]:border-t [&>li+li]:border-border">
          {gezeigt.map((k) => (
            <ErledigtZeile key={k.schluessel} karte={k} />
          ))}
        </ul>
      )}
      {aeltere.length > 0 && (
        <Link
          href={meldungenAdresse(ansicht, { aeltere: !ansicht.aeltere })}
          className={cn('inline-flex min-h-11 items-center self-start rounded text-[12.5px] font-semibold text-brand-text hover:underline', FOKUS_RAHMEN)}
        >
          {ansicht.aeltere ? MELDUNGEN_TEXT.aeltereZu : MELDUNGEN_TEXT.aeltere(aeltere.length)}
        </Link>
      )}
      {gezeigt.length === 0 && aeltere.length === 0 && <p className={cn('py-2 text-[12.5px]', LEISE)}>{MELDUNGEN_TEXT.leer}</p>}
    </div>
  )
}

function KartenListe({ karten, jetzt, ansicht, such }: { karten: AblaufKarte[]; jetzt: Date; ansicht: MeldungenAnsicht; such: Map<string, SuchMeldung> }): React.JSX.Element {
  if (karten.length === 0) return <p className={cn('py-2 text-[12.5px]', LEISE)}>{MELDUNGEN_TEXT.leer}</p>
  return (
    <div className="flex flex-col gap-2.5">
      {karten.map((k) => (
        <MeldungKarte key={k.schluessel} karte={k} jetzt={jetzt} ansicht={ansicht} such={such.get(k.haupt.id)} />
      ))}
    </div>
  )
}

function Spalte({ teil, karten, kinder }: { teil: MeldungTeil; karten: AblaufKarte[]; kinder: React.ReactNode }): React.JSX.Element {
  const text = MELDUNGEN_TEXT.spalte[teil]
  return (
    <section aria-labelledby={`spalte-${teil}`} className="flex min-w-0 flex-col gap-2.5 rounded-2xl border border-border bg-muted/40 p-3">
      <div>
        <h2 id={`spalte-${teil}`} className="flex items-center gap-2 text-[14.5px] font-semibold text-foreground">
          <span className={cn('size-2 rounded-full', SPALTEN_PUNKT[teil])} aria-hidden="true" />
          {text.titel}
          <span className={cn('text-[13px] font-normal tabular-nums', LEISE)}>{MELDUNGEN_TEXT.spaltenZahl(karten.length, meldungenAuf(karten))}</span>
        </h2>
        <p className={cn('mt-0.5 text-[12px] leading-snug', LEISE)}>{text.satz}</p>
      </div>
      {kinder}
    </section>
  )
}

function Zugeklappt({
  teil,
  karten,
  ansicht,
  jetzt,
  such,
}: {
  teil: ZugeklappterTeil
  karten: AblaufKarte[]
  ansicht: MeldungenAnsicht
  jetzt: Date
  such: Map<string, SuchMeldung>
}): React.JSX.Element {
  const offen = ansicht.auf.includes(teil)
  const meldungen = meldungenAuf(karten)
  const satz = teil === 'gesammelt' ? MELDUNGEN_TEXT.gesammeltZu(karten.filter((k) => k.buendel).length) : MELDUNGEN_TEXT.spalte.abgelegt.satz
  const Pfeil = offen ? ChevronUp : ChevronDown
  return (
    <section aria-labelledby={`zu-${teil}`} className="flex min-w-0 flex-col gap-2.5">
      <h2>
        <Link
          id={`zu-${teil}`}
          href={meldungenAdresse(ansicht, {
            auf: offen ? ansicht.auf.filter((t) => t !== teil) : [...ansicht.auf, teil],
          })}
          aria-expanded={offen}
          scroll={false}
          className={cn('flex min-h-11 items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-2 hover:bg-muted', FOKUS_RAHMEN)}
        >
          <span className="font-heading text-[18px] font-semibold text-foreground tabular-nums">{meldungen}</span>
          <span className="text-[13.5px] font-semibold text-foreground">{MELDUNGEN_TEXT.spalte[teil].titel}</span>
          <span className={cn('min-w-0 flex-1 truncate text-[12.5px]', LEISE)}>{satz}</span>
          <Pfeil className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
        </Link>
      </h2>
      {offen && (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {karten.length === 0 ? (
            <p className={cn('text-[12.5px]', LEISE)}>{MELDUNGEN_TEXT.leer}</p>
          ) : (
            karten.map((k) => <MeldungKarte key={k.schluessel} karte={k} jetzt={jetzt} ansicht={ansicht} such={such.get(k.haupt.id)} />)
          )}
        </div>
      )}
    </section>
  )
}

/** Was die KI hier tut — nur, was es heute gibt und was es nie gibt (die „später"-Zeilen des Mockups baut Nr. 101 nicht). */
function KiKasten(): React.JSX.Element {
  return (
    <section aria-labelledby="ki-kasten" className="rounded-2xl border border-border p-4">
      <h2 id="ki-kasten" className="flex items-center gap-2 text-[13.5px] font-semibold text-foreground">
        <Lightbulb className="size-4 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
        {MELDUNGEN_TEXT.kiKopf}
      </h2>
      <p className={cn('mt-1 text-[12.5px]', LEISE)}>{MELDUNGEN_TEXT.kiSatz}</p>
      <dl className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-[12.5px] md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        {MELDUNGEN_TEXT.kiZeilen.map((z) => (
          <div key={z.was} className="contents">
            <dt className="text-foreground">{z.was}</dt>
            <dd className="font-semibold text-foreground">{z.wann}</dd>
            <dd className={cn('col-span-2 md:col-span-1', LEISE)}>{z.wie}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/** Am Handy: Chips je Teil (Zahl aus dem Stand-Band) und die Liste des gewählten — in „Braucht dich" zuerst die KI-Vorschläge. */
function HandyAblauf({ stand, ansicht, jetzt, such }: { stand: AblaufStand; ansicht: MeldungenAnsicht; jetzt: Date; such: Map<string, SuchMeldung> }): React.JSX.Element {
  const k = stand.karten
  return (
    <div className="flex flex-col gap-3 lg:hidden">
      <FilterChipReihe beschriftung={MELDUNGEN_TEXT.chipsBeschriftung}>
        {STAND_TEILE.map((t) => (
          <FilterChip key={t} href={meldungenAdresse(ansicht, { teil: t })} aktiv={ansicht.teil === t}>
            {STAND_TEIL_TEXT[t].titel} <span className="ml-1.5 text-xs font-semibold tabular-nums">{stand.band[t]}</span>
          </FilterChip>
        ))}
      </FilterChipReihe>
      {ansicht.teil === 'brauchtDich' ? (
        <>
          <h2 className={KICKER}>
            {MELDUNGEN_TEXT.handyKiKopf} {k.ki.length}
          </h2>
          <KartenListe karten={k.ki} jetzt={jetzt} ansicht={ansicht} such={such} />
          <h2 className={KICKER}>
            {MELDUNGEN_TEXT.handyNeuKopf} {k.neu.length}
          </h2>
          <KartenListe karten={k.neu} jetzt={jetzt} ansicht={ansicht} such={such} />
        </>
      ) : (
        <h2 className="sr-only">{STAND_TEIL_TEXT[ansicht.teil].titel}</h2>
      )}
      {ansicht.teil === 'inArbeit' && <KartenListe karten={k.geplant} jetzt={jetzt} ansicht={ansicht} such={such} />}
      {ansicht.teil === 'erledigt' && <ErledigtListe karten={k.erledigt} jetzt={jetzt} ansicht={ansicht} />}
      {ansicht.teil === 'gesammelt' && <KartenListe karten={k.gesammelt} jetzt={jetzt} ansicht={ansicht} such={such} />}
      {ansicht.teil === 'abgelegt' && <KartenListe karten={k.abgelegt} jetzt={jetzt} ansicht={ansicht} such={such} />}
    </div>
  )
}

export function AblaufAnsicht({ stand, ansicht, jetzt, kandidaten }: { stand: AblaufStand; ansicht: MeldungenAnsicht; jetzt: Date; kandidaten: SuchMeldung[] }): React.JSX.Element {
  const such = new Map(kandidaten.map((m) => [m.id, m]))
  const k = stand.karten
  const ohneKarte = stand.inBuendeln + stand.alsDuplikat
  return (
    <div className="flex flex-col gap-4">
      <HandyAblauf stand={stand} ansicht={ansicht} jetzt={jetzt} such={such} />
      <div className="hidden items-start gap-3 lg:grid lg:grid-cols-4">
        <Spalte teil="neu" karten={k.neu} kinder={<KartenListe karten={k.neu} jetzt={jetzt} ansicht={ansicht} such={such} />} />
        <Spalte teil="ki" karten={k.ki} kinder={<KartenListe karten={k.ki} jetzt={jetzt} ansicht={ansicht} such={such} />} />
        <Spalte teil="geplant" karten={k.geplant} kinder={<KartenListe karten={k.geplant} jetzt={jetzt} ansicht={ansicht} such={such} />} />
        <Spalte teil="erledigt" karten={k.erledigt} kinder={<ErledigtListe karten={k.erledigt} jetzt={jetzt} ansicht={ansicht} />} />
      </div>
      <div className="hidden flex-col gap-3 lg:flex">
        <Zugeklappt teil="gesammelt" karten={k.gesammelt} ansicht={ansicht} jetzt={jetzt} such={such} />
        <Zugeklappt teil="abgelegt" karten={k.abgelegt} ansicht={ansicht} jetzt={jetzt} such={such} />
      </div>
      {ohneKarte > 0 && (
        <p className={cn('text-[12.5px] leading-relaxed', LEISE)}>
          <span className="font-semibold text-foreground">{MELDUNGEN_TEXT.zusammengefasstKopf} </span>
          {MELDUNGEN_TEXT.zusammengefasst(ohneKarte, stand.inBuendeln, stand.alsDuplikat)}{' '}
          <Link href={meldungenAdresse(ansicht, { ansicht: 'wuensche' })} className={cn('rounded font-semibold text-brand-text hover:underline', FOKUS_RAHMEN)}>
            {MELDUNGEN_TEXT.buendelAnsehen}
          </Link>
        </p>
      )}
      <p className={cn('text-[12.5px] leading-relaxed', LEISE)}>{MELDUNGEN_TEXT.regel}</p>
      <KiKasten />
    </div>
  )
}

// ─── Wünsche gebündelt ──────────────────────────────────────────────────────

function standText(c: WunschCluster): string {
  if (c.stand === 'geplant' && c.sprintName) return `${BUENDEL_STAND_LABEL.geplant} · ${c.sprintName}`
  return BUENDEL_STAND_LABEL[c.stand]
}

export function WuenscheAnsicht({
  cluster,
  ansicht,
  jetzt,
  kandidaten,
}: {
  cluster: WunschCluster[]
  ansicht: MeldungenAnsicht
  jetzt: Date
  kandidaten: SuchMeldung[]
}): React.JSX.Element {
  const mitStichwort = cluster.filter((c): c is WunschCluster & { clusterKey: string } => c.clusterKey !== null)
  const ohne = cluster.find((c) => c.clusterKey === null)
  const zahl = (f: (typeof WUENSCHE_FILTER)[number]): number => (f === 'alle' ? mitStichwort.length : mitStichwort.filter((c) => c.stand === f).length)
  const liste = ansicht.stand === 'alle' ? mitStichwort : mitStichwort.filter((c) => c.stand === ansicht.stand)
  const gewaehlt = liste.find((c) => c.clusterKey === ansicht.buendel) ?? liste[0] ?? null
  const such = new Map(kandidaten.map((m) => [m.id, m]))
  const heute = wienKalendertag(jetzt)

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[400px_minmax(0,1fr)]">
      <section aria-label={WUENSCHE_TEXT.listeBeschriftung} className={cn(KARTE, 'flex min-w-0 flex-col gap-2 p-3.5 dark:ring-1 dark:ring-border')}>
        <FilterChipReihe beschriftung={WUENSCHE_TEXT.chipsBeschriftung}>
          {WUENSCHE_FILTER.map((f) => (
            <FilterChip key={f} href={meldungenAdresse(ansicht, { stand: f, buendel: null })} aktiv={ansicht.stand === f}>
              {WUENSCHE_TEXT.chip[f]} <span className="ml-1.5 text-xs font-semibold tabular-nums">{zahl(f)}</span>
            </FilterChip>
          ))}
        </FilterChipReihe>
        {mitStichwort.length === 0 ? (
          <EmptyState
            symbol={Lightbulb}
            titel={WUENSCHE_LEER.titel}
            satz={WUENSCHE_LEER.satz}
            className="rounded-xl border-0 py-6"
            ausweg={{
              ohne: 'Ein Bündel entsteht nur, wenn du einem Wunsch ein Stichwort gibst – das geht über „Ins Bündel …“ im Ablauf oder beim Entscheiden',
            }}
          />
        ) : liste.length === 0 ? (
          <EmptyState
            symbol={Lightbulb}
            titel={WUENSCHE_LEER_FILTER.titel}
            className="rounded-xl border-0 py-6"
            ausweg={
              <Link
                href={meldungenAdresse(ansicht, {
                  stand: 'alle',
                  buendel: null,
                })}
                className={KNOPF_RAHMEN}
              >
                {WUENSCHE_TEXT.chip.alle}
              </Link>
            }
          />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {liste.map((c) => (
              <li key={c.clusterKey}>
                <Link
                  href={meldungenAdresse(ansicht, { buendel: c.clusterKey })}
                  scroll={false}
                  aria-current={gewaehlt?.clusterKey === c.clusterKey ? 'true' : undefined}
                  className={cn(
                    'flex min-h-11 items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors duration-[250ms]',
                    gewaehlt?.clusterKey === c.clusterKey ? 'border-foreground bg-muted' : 'border-border hover:bg-muted',
                    FOKUS_RAHMEN
                  )}
                >
                  <span className="flex w-12 shrink-0 flex-col items-center">
                    <span className="font-heading text-[22px] leading-none font-semibold text-foreground tabular-nums">{c.stimmen}</span>
                    <span className={cn('text-[11px]', LEISE)}>{WUENSCHE_TEXT.stimmen}</span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[13.5px] font-semibold text-foreground" title={c.clusterKey}>
                      {c.clusterKey}
                    </span>
                    <span className={cn('truncate text-[12px]', LEISE)}>
                      {WUENSCHE_TEXT.wer(c.hoefe, c.kundinnen)} · {WUENSCHE_TEXT.zuletzt(datumKurz(wienKalendertag(c.letzte), heute))}
                    </span>
                  </span>
                  <Marke art={STAND_MARKE[c.stand]} className="shrink-0">
                    {standText(c)}
                  </Marke>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className={cn('pt-1 text-[12.5px] leading-relaxed', LEISE)}>{WUENSCHE_TEXT.erklaerung}</p>
        {ohne && <p className={cn('text-[12.5px] leading-relaxed', LEISE)}>{WUENSCHE_TEXT.ohneStichwort(ohne.anzahl)}</p>}
      </section>

      <section aria-label={gewaehlt ? gewaehlt.clusterKey : WUENSCHE_TEXT.waehlen} className={cn(KARTE, 'flex min-w-0 flex-col gap-4 p-4 md:p-5 dark:ring-1 dark:ring-border')}>
        {!gewaehlt ? (
          <p className={cn('py-6 text-center text-sm', LEISE)}>{WUENSCHE_TEXT.waehlen}</p>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="min-w-0 font-heading text-[20px] leading-snug font-semibold break-words text-foreground">{gewaehlt.clusterKey}</h2>
                <Marke art={STAND_MARKE[gewaehlt.stand]}>{standText(gewaehlt)}</Marke>
              </div>
              <p className={cn('text-[12.5px]', LEISE)}>
                {WUENSCHE_TEXT.kopf({
                  stimmen: gewaehlt.stimmen,
                  hoefe: gewaehlt.hoefe,
                  kundinnen: gewaehlt.kundinnen,
                  duplikate: gewaehlt.duplikate,
                  erste: tagPunkt(gewaehlt.erste),
                  letzte: tagPunkt(gewaehlt.letzte),
                })}
              </p>
            </div>

            <section aria-labelledby="woraus-buendel">
              <h3 id="woraus-buendel" className={KICKER}>
                {WUENSCHE_TEXT.woraus}
              </h3>
              <ul className="mt-1.5 [&>li+li]:border-t [&>li+li]:border-border">
                {gewaehlt.meldungen.map((w) => {
                  const s = such.get(w.id)
                  return (
                    <li key={w.id} className="flex items-center gap-3 py-2">
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className={cn('text-[12px]', LEISE)}>
                          {datumKurz(wienKalendertag(w.createdAt), heute)} · {w.hofName ?? MELDUNGEN_TEXT.kundin}
                        </span>
                        <span className="text-[13.5px] break-words text-foreground">„{w.ersteZeile || '—'}“</span>
                      </span>
                      {w.duplikat ? (
                        <>
                          <Marke art="erledigt" className="shrink-0">
                            {WUENSCHE_TEXT.duplikat}
                          </Marke>
                          <TrennenKnopf meldungId={w.id} titel={w.ersteZeile} />
                        </>
                      ) : (
                        s && <KartenMenue meldung={s} titel={w.ersteZeile || w.kurznummer} />
                      )}
                    </li>
                  )
                })}
              </ul>
              <WerkzeugKnopf aktion="dazunehmen" clusterKey={gewaehlt.clusterKey}>
                {WUENSCHE_TEXT.dazunehmen}
              </WerkzeugKnopf>
            </section>

            <StandFormular
              key={gewaehlt.clusterKey}
              clusterKey={gewaehlt.clusterKey}
              anzahl={gewaehlt.anzahl}
              stand={gewaehlt.stand}
              sprintName={gewaehlt.sprintName}
              hoefe={gewaehlt.hoefe}
              kundinnenMitAdresse={gewaehlt.kundinnenMitAdresse}
            />
          </>
        )}
      </section>
    </div>
  )
}
