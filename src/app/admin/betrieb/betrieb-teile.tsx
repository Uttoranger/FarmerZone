import type { ReactNode } from 'react'
import { ChevronRight, Database, Download, ExternalLink, Image as BildSymbol, ImageOff, LineChart, Mail, TriangleAlert, Upload, type LucideIcon } from 'lucide-react'
import {
  BETRIEB_TEXT,
  BILDER_EXPORT_HREF,
  NUR_IM_DASHBOARD,
  OHNE_VERWENDUNG_ANKER,
  STAND_MARKE,
  STAND_TEXT,
  STUFEN,
  TARIF_ZEILEN,
  VERCEL_USAGE_HREF,
  VERLAUF_TAGE,
  prozentText,
  verlaufAchse,
  verlaufIndex,
  warnungenText,
  type AblaufZeile,
  type Kachel,
  type KachelId,
  type OhneVerwendungKarte,
  type OhneVerwendungZeile,
  type VercelAusgabenKarte,
  type VerlaufLinie,
  type WarnEintrag,
} from '@/lib/betrieb'
import type { StripeMarke } from '@/lib/testumgebung'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Chip } from '@/components/ui/chip'
import { Marke } from '@/components/ui/marke'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { KARTE, KICKER, KNOPF_RAHMEN, LEISE } from '@/components/hof-bestellungen/stil'

/*
 * Die Teile von Admin › Betrieb (Register N18, Nr. 103; Mockups admin-betrieb
 * bei 1440 px und mobil-admin-betrieb bei 390 px). Nur Anzeige: Was ein Teil
 * zeigt, haben die reinen Funktionen in src/lib/betrieb.ts entschieden; hier
 * kommt kein BigInt und kein Date an, nur Text und Zahlen.
 *
 * Die Inhalte (Verlauf, Tarife, Tabellen, Dashboard) stehen ohne eigenen
 * Rahmen: ab 1024 px in einer Karte mit Überschrift, am Handy in einer
 * zugeklappten Karte (`Klappkarte`) — so wie es die beiden Mockups zeigen.
 */

const H2 = 'font-heading text-[17px] font-semibold text-foreground'

const KACHEL_SYMBOL: Record<KachelId, LucideIcon> = { bilder: BildSymbol, datenbank: Database, mailsHeute: Mail, bildVorgaenge: Upload }

/** Orange ab 80 %, sonst Grün — der Ton kommt aus der Fachregel (`warnt`), die Farbe aus den Status-Tokens. */
function tonText(warnt: boolean): string {
  return warnt ? 'text-status-offen' : 'text-status-fertig'
}

// ─── Kopf und Warnkarte ──────────────────────────────────────────────────────

/**
 * Die Warnkarte über den Kacheln, solange eine Stufe offen ist (Mockup: „1 Warnung: Bilder-Speicher bei 82 %“).
 * `ohneVerwendung`: der Knopf zur Karte „Bilder ohne Verwendung“ (Nr. 104) — je Breite ein Anker, weil die Karte
 * ab 1024 px rechts und am Handy unter den Abläufen steht.
 */
export function Warnkarte({ eintraege, gruen, ohneVerwendung = false }: { eintraege: readonly WarnEintrag[]; gruen: string; ohneVerwendung?: boolean }): React.JSX.Element {
  const einzeln = eintraege.length === 1
  return (
    <section aria-labelledby="betrieb-warnung" className="flex gap-3 rounded-2xl border border-primary/45 bg-primary/12 p-4 md:p-5">
      <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary/20 text-status-offen">
        <TriangleAlert className="size-[18px]" strokeWidth={1.8} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h2 id="betrieb-warnung" className="text-[16px] leading-snug font-semibold text-foreground md:text-[17px]">
          {einzeln ? `${warnungenText(1)}: ${eintraege[0].titel}` : warnungenText(eintraege.length)}
        </h2>
        {eintraege.map((e) => (
          <p key={e.art} className="text-[13.5px] leading-snug break-words text-foreground">
            {!einzeln && <strong className="font-semibold">{e.titel}. </strong>}
            {e.saetze.join(' ')}
          </p>
        ))}
        <p className={cn('text-[12.5px] leading-snug', LEISE)}>{gruen}</p>
        {ohneVerwendung && (
          <div className="mt-1.5 flex flex-wrap gap-2">
            <a href={`#${OHNE_VERWENDUNG_ANKER.breit}`} className={cn(KNOPF_RAHMEN, 'hidden font-semibold lg:inline-flex')}>
              {BETRIEB_TEXT.ohneVerwendungAnsehen}
            </a>
            <a href={`#${OHNE_VERWENDUNG_ANKER.handy}`} className={cn(KNOPF_RAHMEN, 'font-semibold lg:hidden')}>
              {BETRIEB_TEXT.ohneVerwendungAnsehen}
            </a>
          </div>
        )}
      </div>
    </section>
  )
}

// ─── Kacheln ─────────────────────────────────────────────────────────────────

/**
 * Der Balken einer Kachel: Anteil an der Grenze mit einem Strich bei 80 %, ab
 * dem die Warn-Mail kommt. `role="progressbar"` mit Beschriftung und Wert als
 * Text; über 100 % bleibt der Balken voll. Neu statt ProgressBar, weil der
 * Baustein keinen Warnstrich kennt und seine Beschriftung selbst zeichnet.
 */
export function GrenzBalken({ titel, anteil, warnt }: { titel: string; anteil: number | null; warnt: boolean }): React.JSX.Element {
  const breite = anteil === null ? 0 : Math.min(100, Math.max(0, anteil))
  return (
    <div
      role="progressbar"
      aria-label={BETRIEB_TEXT.balken(titel)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.floor(breite)}
      aria-valuetext={anteil === null ? BETRIEB_TEXT.nichtGemessen : prozentText(anteil)}
      className="relative h-2 rounded-full bg-muted"
    >
      <div className={cn('h-full rounded-full', warnt ? 'bg-primary' : 'bg-accent')} style={{ width: `${breite}%` }} />
      <span aria-hidden="true" className="absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded-full bg-foreground/60" style={{ left: `${STUFEN[0]}%` }} />
    </div>
  )
}

function KachelKarte({ kachel: k, ohneVerwendung }: { kachel: Kachel; ohneVerwendung: string | null }): React.JSX.Element {
  const Symbol = KACHEL_SYMBOL[k.id]
  return (
    <article className={cn(KARTE, 'flex min-w-0 flex-col gap-2.5 p-4', k.warnt && 'border-primary/60')}>
      <div className="flex min-w-0 items-center gap-2.5">
        <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
          <Symbol className="size-4" strokeWidth={1.8} />
        </span>
        <h3 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-foreground">{k.titel}</h3>
        <Chip className="hidden shrink-0 font-semibold lg:inline-flex">{k.tarif}</Chip>
        {k.prozent && <span className={cn('shrink-0 text-[14px] font-semibold tabular-nums lg:hidden', tonText(k.warnt))}>{k.prozent}</span>}
      </div>
      {k.untertitel && <p className={cn('-mt-1.5 text-[12px] leading-snug', LEISE)}>{k.untertitel}</p>}
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
        <span className="font-heading text-[26px] leading-tight font-semibold text-foreground tabular-nums">{k.wert ?? '–'}</span>
        <span className={cn('text-[13px]', LEISE)}>{k.von}</span>
        {k.prozent && <span className={cn('ml-auto hidden text-[15px] font-semibold tabular-nums lg:inline', tonText(k.warnt))}>{k.prozent}</span>}
      </div>
      {/* Ohne feste Grenze (Vercel Pro, Nr. 113): kein Balken, dafür der Satz. */}
      {k.ohneGrenze ? <p className={cn('text-[12.5px] leading-snug', LEISE)}>{k.ohneGrenze}</p> : <GrenzBalken titel={k.titel} anteil={k.anteil} warnt={k.warnt} />}
      {k.hinweis && <p className="text-[12.5px] leading-snug text-status-offen">{k.hinweis}</p>}
      <p className="hidden text-[12.5px] leading-snug break-words text-foreground lg:block">{k.zeile}</p>
      <p className={cn('hidden text-[12px] leading-snug lg:block', LEISE)}>{k.satz}</p>
      {/* Nur ab 1024 px, wie im Mockup: Am Handy nennt die Warnkarte die Bilder ohne Verwendung. */}
      {ohneVerwendung && (
        <a
          href={`#${OHNE_VERWENDUNG_ANKER.breit}`}
          className={cn('hidden min-h-11 items-center self-start rounded-md text-[12.5px] font-semibold text-status-fertig underline-offset-2 hover:underline lg:inline-flex', FOKUS_RAHMEN)}
        >
          {ohneVerwendung}
        </a>
      )}
      <p className={cn('text-[12.5px] leading-snug lg:hidden', LEISE)}>{k.kurz}</p>
    </article>
  )
}

/** Die vier Kacheln: am Handy untereinander, ab 768 px zu zweit, ab 1024 px zu viert. `ohneVerwendung`: „davon … ohne Verwendung“ unter den Bildern (Nr. 104). */
export function Kacheln({ kacheln, ohneVerwendung = null }: { kacheln: readonly Kachel[]; ohneVerwendung?: string | null }): React.JSX.Element {
  return (
    <section aria-labelledby="betrieb-kacheln">
      <h2 id="betrieb-kacheln" className="sr-only">
        {BETRIEB_TEXT.kacheln}
      </h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4 lg:gap-3.5">
        {kacheln.map((k) => (
          <KachelKarte key={k.id} kachel={k} ohneVerwendung={k.id === 'bilder' ? ohneVerwendung : null} />
        ))}
      </div>
    </section>
  )
}

// ─── Rahmen: Karte ab 1024 px, Klappkarte am Handy ───────────────────────────

/** Eine Karte mit Überschrift (ab 1024 px). */
export function Karte({ titel, zusatz, rechts, children, className }: { titel: string; zusatz?: string; rechts?: ReactNode; children: ReactNode; className?: string }): React.JSX.Element {
  return (
    <section aria-label={titel} className={cn(KARTE, 'flex min-w-0 flex-col gap-3 p-4 md:p-5', className)}>
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <h2 className={H2}>{titel}</h2>
        {zusatz && <span className={cn('text-[12.5px]', LEISE)}>{zusatz}</span>}
        {rechts && <div className="ml-auto">{rechts}</div>}
      </div>
      {children}
    </section>
  )
}

/** Am Handy zugeklappt (Mockup mobil-admin-betrieb): Titel, eine Zeile, Pfeil. Ohne Skript (<details>). */
export function Klappkarte({ titel, zeile, children }: { titel: string; zeile: string; children: ReactNode }): React.JSX.Element {
  return (
    <details className={cn(KARTE, 'group overflow-hidden')}>
      <summary className={cn('flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden', FOKUS_RAHMEN)}>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[15px] font-semibold text-foreground">{titel}</span>
          <span className={cn('truncate text-[12.5px]', LEISE)}>{zeile}</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden="true" />
      </summary>
      <div className="flex flex-col gap-3 border-t border-border p-4">{children}</div>
    </details>
  )
}

// ─── Verlauf ─────────────────────────────────────────────────────────────────

/** Die Farbe je Linie — als Klassen (Tokens), nie als SVG-Attribut mit Farbwert. */
const LINIE_KLASSE: Record<VerlaufLinie['id'], { strich: string; fuellung: string; fleck: string }> = {
  bilder: { strich: 'stroke-primary', fuellung: 'fill-primary', fleck: 'bg-primary' },
  datenbank: { strich: 'stroke-accent', fuellung: 'fill-accent', fleck: 'bg-accent' },
  mailsMonat: { strich: 'stroke-muted-foreground', fuellung: 'fill-muted-foreground', fleck: 'bg-muted-foreground' },
}

export function VerlaufLegende({ linien }: { linien: readonly VerlaufLinie[] }): React.JSX.Element {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {linien.map((l) => (
        <li key={l.id} className={cn('flex items-center gap-1.5 text-[12.5px]', LEISE)}>
          <span aria-hidden="true" className={cn('h-0.5 w-3.5 rounded-full', LINIE_KLASSE[l.id].fleck)} />
          {l.name}
        </li>
      ))}
    </ul>
  )
}

const BREITE = 840
const HOEHE = 270
const LINKS = 40
const RECHTS = 14
const OBEN = 12
const UNTEN = 30

/**
 * Der Verlauf von 90 Tagen als SVG (`role="img"`, das aria-label nennt die
 * Werte von heute). y in % der Grenze (über 100 % am oberen Rand), x je Tag;
 * gestrichelt die Warnschwelle 80 %. Ohne Messung ein Leerzustand.
 */
export function VerlaufDiagramm({ von, bis, linien, beschreibung }: { von: string; bis: string; linien: readonly VerlaufLinie[]; beschreibung: string }): React.JSX.Element {
  if (linien.every((l) => l.punkte.length === 0)) {
    return (
      <EmptyState
        symbol={LineChart}
        titel={BETRIEB_TEXT.verlaufLeer}
        ausweg={{ ohne: 'Die erste Messung macht der Ablauf jeden Morgen von selbst oder der Knopf „Jetzt messen“ oben auf der Seite.' }}
        className="rounded-xl py-8"
      />
    )
  }
  const breite = BREITE - LINKS - RECHTS
  const hoehe = HOEHE - OBEN - UNTEN
  const x = (index: number): number => LINKS + (breite * index) / (VERLAUF_TAGE - 1)
  const y = (prozent: number): number => OBEN + hoehe * (1 - Math.min(100, Math.max(0, prozent)) / 100)
  return (
    <svg viewBox={`0 0 ${BREITE} ${HOEHE}`} role="img" aria-label={beschreibung} className="h-auto w-full">
      {[0, 25, 50, 75, 100].map((p) => (
        <g key={p}>
          <line x1={LINKS} x2={BREITE - RECHTS} y1={y(p)} y2={y(p)} className="stroke-border" strokeWidth={1} />
          <text x={LINKS - 6} y={y(p) + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">
            {`${p} %`}
          </text>
        </g>
      ))}
      <line x1={LINKS} x2={BREITE - RECHTS} y1={y(STUFEN[0])} y2={y(STUFEN[0])} className="stroke-primary" strokeWidth={1.25} strokeDasharray="5 4" />
      <text x={LINKS + 8} y={y(STUFEN[0]) - 6} className="fill-status-offen text-[11px]">
        {BETRIEB_TEXT.verlaufWarnung}
      </text>
      {verlaufAchse(von, bis).map((a) => (
        <text key={a.index} x={x(a.index)} y={HOEHE - 8} textAnchor={a.index === 0 ? 'start' : a.text === 'heute' ? 'end' : 'middle'} className="fill-muted-foreground text-[11px]">
          {a.text}
        </text>
      ))}
      {linien.map((l) => {
        if (l.punkte.length === 0) return null
        const punkte = l.punkte.map((p) => `${x(verlaufIndex(von, p.tag)).toFixed(1)},${y(p.prozent).toFixed(1)}`)
        const letzter = l.punkte[l.punkte.length - 1]
        return (
          <g key={l.id}>
            <polyline points={punkte.join(' ')} className={cn('fill-none', LINIE_KLASSE[l.id].strich)} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={x(verlaufIndex(von, letzter.tag))} cy={y(letzter.prozent)} r={3.5} className={LINIE_KLASSE[l.id].fuellung} />
          </g>
        )
      })}
    </svg>
  )
}

// ─── Abläufe ─────────────────────────────────────────────────────────────────

function StandMarke({ stand }: { stand: AblaufZeile['stand'] }): React.JSX.Element {
  return <Marke art={STAND_MARKE[stand]}>{STAND_TEXT[stand]}</Marke>
}

/** Die Abläufe als Tabelle (ab 1024 px). */
export function AblaeufeTabelle({ zeilen }: { zeilen: readonly AblaufZeile[] }): React.JSX.Element {
  const s = BETRIEB_TEXT.ablaeufeSpalten
  return (
    <div className={cn(KARTE, 'overflow-x-auto')}>
      <table className="w-full min-w-[640px] text-left text-[14px]">
        <thead>
          <tr className={KICKER}>
            {[s.ablauf, s.wann, s.zuletzt, s.dauer, s.stand].map((t) => (
              <th key={t} scope="col" className="px-4 py-3 font-semibold">
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {zeilen.map((z) => (
            <tr key={z.name} className="border-t border-border">
              <th scope="row" className="px-4 py-3 font-semibold text-foreground">
                {z.text}
              </th>
              <td className={cn('px-4 py-3', LEISE)}>{z.wann}</td>
              <td className="px-4 py-3 text-foreground tabular-nums">{z.zuletzt}</td>
              <td className="px-4 py-3 text-foreground tabular-nums">{z.dauer}</td>
              <td className="px-4 py-3">
                <StandMarke stand={z.stand} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Die Regel unter der Tabelle: was überfällig und was Fehler heißt. */
export function AblaeufeRegel(): React.JSX.Element {
  return (
    <div className={cn('flex flex-col gap-0.5 text-[12.5px] leading-snug', LEISE)}>
      <p>
        <strong className="font-semibold text-foreground">{STAND_TEXT.ueberfaellig}</strong> {BETRIEB_TEXT.ablaeufeRegel}
      </p>
      <p>
        <strong className="font-semibold text-foreground">{STAND_TEXT.fehler}</strong> {BETRIEB_TEXT.ablaeufeRegelFehler} {BETRIEB_TEXT.ablaeufeAufraeumen}
      </p>
    </div>
  )
}

/** Die Abläufe am Handy als Liste: Name, „heute 05:02 · täglich ab 05:00“, Marke. */
export function AblaeufeListe({ zeilen, puenktlich }: { zeilen: readonly AblaufZeile[]; puenktlich: string }): React.JSX.Element {
  return (
    <section aria-label={BETRIEB_TEXT.ablaeufeTitel} className={cn(KARTE, 'flex flex-col p-4')}>
      <div className="flex flex-wrap items-baseline gap-x-2 pb-1">
        <h2 className={H2}>{BETRIEB_TEXT.ablaeufeTitel}</h2>
        <span className={cn('text-[12.5px]', LEISE)}>{puenktlich}</span>
      </div>
      <ul>
        {zeilen.map((z) => (
          <li key={z.name} className="flex items-center gap-3 border-t border-border py-2.5 first:border-t-0">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[14px] font-semibold text-foreground">{z.text}</span>
              <span className={cn('text-[12.5px]', LEISE)}>{`${z.zuletzt} · ${z.wann}`}</span>
            </span>
            <StandMarke stand={z.stand} />
          </li>
        ))}
      </ul>
    </section>
  )
}

// ─── Tarife, Dashboard, Tabellen ─────────────────────────────────────────────

/** Tarife und Grenzen (aus TARIFE und GRENZE), dazu der Stripe-Modus wie in der Betriebsleiste (Register Z3). */
export function TarifeInhalt({ stripeMarke }: { stripeMarke: StripeMarke | null }): React.JSX.Element {
  return (
    <>
      <dl className="flex flex-col">
        {TARIF_ZEILEN.map((t) => (
          <div key={t.dienst} className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 border-t border-border py-3 first:border-t-0 first:pt-0">
            <dt className="text-[14px] font-semibold text-foreground">{t.dienst}</dt>
            <dd className="flex min-w-0 flex-col items-start gap-1">
              <Marke art={t.ton}>{t.marke}</Marke>
              <span className={cn('text-[13px] leading-snug', LEISE)}>{t.satz}</span>
            </dd>
          </div>
        ))}
        <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 border-t border-border py-3">
          <dt className="text-[14px] font-semibold text-foreground">{BETRIEB_TEXT.stripeDienst}</dt>
          <dd className="flex min-w-0 flex-col items-start gap-1">
            {stripeMarke ? <StatusBadge status={stripeMarke.ton}>{stripeMarke.text}</StatusBadge> : <span className="text-[13px] text-foreground">{BETRIEB_TEXT.ohneStripe}</span>}
            <span className={cn('text-[13px] leading-snug', LEISE)}>{BETRIEB_TEXT.stripeSatz}</span>
          </dd>
        </div>
      </dl>
      <p className={cn('border-t border-border pt-3 text-[12.5px] leading-snug', LEISE)}>{BETRIEB_TEXT.tarifeFuss}</p>
    </>
  )
}

/**
 * Die Karte „Vercel-Ausgaben“ (Nr. 113; nach dem Muster „Tarife und
 * Grenzen“): die letzte Meldung von Spend Management, „Unter 50 % (letzte
 * Meldung …)“ oder „Noch keine Meldung …“ (Nr. 162),
 * dazu der Link nach Vercel › Usage. Ab 1024 px in einer Karte, am Handy in
 * einer Klappkarte.
 */
export function VercelAusgabenInhalt({ karte }: { karte: VercelAusgabenKarte }): React.JSX.Element {
  return (
    <>
      <p className="text-[13.5px] leading-snug break-words text-foreground">{karte.satz}</p>
      <a
        href={VERCEL_USAGE_HREF}
        target="_blank"
        rel="noopener noreferrer"
        className={cn('inline-flex min-h-11 items-center gap-1.5 self-start rounded-md text-[13px] font-semibold text-status-fertig underline-offset-2 hover:underline', FOKUS_RAHMEN)}
      >
        {BETRIEB_TEXT.vercelLink}
        <ExternalLink className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
        <span className="sr-only">{BETRIEB_TEXT.neuerTab}</span>
      </a>
    </>
  )
}

/** Was nur die Dashboards der Dienste wissen — Links nach außen, ohne Kennung in der Adresse. */
export function DashboardInhalt(): React.JSX.Element {
  return (
    <ul className="flex flex-col">
      {NUR_IM_DASHBOARD.map((d) => (
        <li key={d.href} className="border-t border-border first:border-t-0">
          <a
            href={d.href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn('flex min-h-11 items-start gap-3 rounded-lg py-2.5 hover:bg-muted/60', FOKUS_RAHMEN)}
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[14px] font-semibold text-foreground">{d.titel}</span>
              <span className={cn('text-[13px] leading-snug', LEISE)}>{d.satz}</span>
            </span>
            <ExternalLink className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
            <span className="sr-only">{BETRIEB_TEXT.neuerTab}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

export type TabellenAnzeige = Array<{ name: string; modell: string; zeilen: string; groesse: string; bleibt: string }>

/** Die fünf größten Tabellen (Name, Modell, geschätzte Zeilen, Größe, wie lange die Zeilen bleiben). */
export function TabellenInhalt({ tabellen }: { tabellen: TabellenAnzeige | null }): React.JSX.Element {
  if (tabellen === null) return <p className={cn('text-[13px]', LEISE)}>{BETRIEB_TEXT.tabellenLeer}</p>
  const s = BETRIEB_TEXT.tabellenSpalten
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[14px]">
        <thead>
          <tr className={KICKER}>
            <th scope="col" className="py-2 pr-4 font-semibold">
              {s.tabelle}
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-semibold">
              {s.zeilen}
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-semibold">
              {s.groesse}
            </th>
            <th scope="col" className="py-2 font-semibold">
              {s.bleibt}
            </th>
          </tr>
        </thead>
        <tbody>
          {tabellen.map((t) => (
            <tr key={t.modell} className="border-t border-border">
              <th scope="row" className="py-2.5 pr-4 font-semibold text-foreground">
                <span className="block">{t.name}</span>
                {t.name !== t.modell && <span className={cn('block text-[12px] font-normal', LEISE)}>{t.modell}</span>}
              </th>
              <td className="py-2.5 pr-4 text-right text-foreground tabular-nums">{t.zeilen}</td>
              <td className="py-2.5 pr-4 text-right text-foreground tabular-nums">{t.groesse}</td>
              <td className={cn('py-2.5 text-[13px] leading-snug', LEISE)}>{t.bleibt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Bilder ohne Verwendung (Nr. 104) ────────────────────────────────────────

function OhneVerwendungListe({ zeilen, leise = false }: { zeilen: readonly OhneVerwendungZeile[]; leise?: boolean }): React.JSX.Element {
  return (
    <ul>
      {zeilen.map((z) => (
        <li key={z.gruppe} className={cn('flex items-baseline gap-2.5 border-t border-border py-2 text-[13px]', leise ? LEISE : 'text-foreground')}>
          <span className="min-w-0 flex-1 break-words">{z.text}</span>
          <span className={cn('w-11 shrink-0 text-right tabular-nums', LEISE)}>
            {z.dateien}
            <span className="sr-only"> {BETRIEB_TEXT.ohneVerwendungDateien}</span>
          </span>
          <span className="w-16 shrink-0 text-right font-semibold tabular-nums">{z.groesse}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Die Karte „Bilder ohne Verwendung“ (Mockup admin-betrieb, Karte #ohne-verwendung):
 * Summe, älteste Datei, Aufstellung je Art, „Liste als CSV“ und der Satz, dass
 * nichts gelöscht wird. Getrennt darunter, nicht mitgezählt: unbekannter Hof
 * und Startseite. Außerhalb der Produktion nur der Satz, warum es sie dort
 * nicht gibt; ohne Messung ein Leerzustand.
 */
export function BilderOhneVerwendung({ karte, produktion, anker }: { karte: OhneVerwendungKarte | null; produktion: boolean; anker: string }): React.JSX.Element {
  return (
    <section id={anker} aria-labelledby={`${anker}-titel`} className={cn(KARTE, 'flex min-w-0 scroll-mt-24 flex-col gap-2 p-4 md:px-[18px]')}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 id={`${anker}-titel`} className="text-[15px] font-semibold text-foreground">
          {BETRIEB_TEXT.ohneVerwendungTitel}
        </h2>
        {produktion && <Chip className="font-semibold">{BETRIEB_TEXT.ohneVerwendungMarke}</Chip>}
      </div>
      {!produktion ? (
        <p className={cn('text-[13px] leading-snug', LEISE)}>{BETRIEB_TEXT.ohneVerwendungVorschau}</p>
      ) : karte === null ? (
        <EmptyState
          symbol={ImageOff}
          titel={BETRIEB_TEXT.ohneVerwendungLeer}
          ausweg={{ ohne: 'Die Messung zählt die Bilder ohne Verwendung jeden Morgen von selbst; der Knopf „Jetzt messen“ oben auf der Seite zählt sofort.' }}
          className="rounded-xl py-6"
        />
      ) : (
        <>
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
            <span className="font-heading text-[26px] leading-tight font-semibold text-foreground tabular-nums">{karte.summe}</span>
            <span className={cn('text-[13px]', LEISE)}>{karte.zeile}</span>
          </div>
          {karte.hinweis && <p className="text-[12.5px] leading-snug text-status-offen">{karte.hinweis}</p>}
          {karte.arten.length > 0 && <p className="text-[12.5px] leading-normal text-foreground">{BETRIEB_TEXT.ohneVerwendungSatz}</p>}
          {karte.arten.length > 0 && <OhneVerwendungListe zeilen={karte.arten} />}
          {karte.getrennt.length > 0 && (
            <div className="flex flex-col">
              <p className={cn('pt-1 pb-1 text-[12px] leading-snug', LEISE)}>{BETRIEB_TEXT.ohneVerwendungGetrennt}</p>
              <OhneVerwendungListe zeilen={karte.getrennt} leise />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <a href={BILDER_EXPORT_HREF} download className={cn(KNOPF_RAHMEN, 'gap-2 font-semibold')}>
              <Download className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
              {BETRIEB_TEXT.ohneVerwendungCsv}
            </a>
          </div>
        </>
      )}
      {produktion && <p className={cn('text-[12px] leading-normal', LEISE)}>{BETRIEB_TEXT.ohneVerwendungFuss}</p>}
    </section>
  )
}
