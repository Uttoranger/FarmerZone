import type { ReactNode } from 'react'
import Link from 'next/link'
import { Check, ChevronRight, Inbox, MessageCircle, Printer, Sprout } from 'lucide-react'
import { Marke } from '@/components/ui/marke'
import { RUNDUNG } from '@/components/ui/rundung'
import { WerkzeugKopf } from '@/components/ui/werkzeug-kopf'
import { Zaehler } from '@/components/ui/zaehler'
import { PFLICHT_KNOPF, PFLICHT_KNOPF_RAHMEN, PflichtKarte } from '@/components/heute/pflicht-karte'
import { POSTFACH_HREF, POSTFACH_TEXT, weitereText, type HeuteNachricht } from '@/lib/postfach'
import { markiereGelesenFormular } from '@/server/actions/postfach'
import { FOKUS_RAHMEN, FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'
import { HofTeilenKnopf } from '@/components/farmer/hof-teilen-knopf'
import { TeilenFensterKnopf } from '@/components/teilen/teilen-fenster'
import type { TeilenFensterDaten } from '@/lib/teilen-fenster'
import {
  BRAUCHT_DICH_LEER,
  HEUTE_ABHOLZEITEN_SATZ,
  brauchtDichAnzeige,
  zuTunLinkText,
  HEUTE_KEINE_BESTELLUNGEN,
  HEUTE_NIEMAND,
  KENNZAHL_TEXT,
  TEILEN_KARTE_SATZ,
  kennzahlBreiteEm,
  mitTrennstellen,
  PACK_MARKE,
  type BrauchtDichEintrag,
  type NaechstesFenster,
  type PacklistenZeile,
  type WochenBalken,
} from '@/lib/heute'
import { onlinePausiertHinweis } from '@/lib/stripe-konto'
import { SPERRE_KARTE_TITEL, sperreKarteSatz } from '@/lib/admin-hof-akte'
import { ABHOLZEITEN_FEHLEN } from '@/lib/pickup-slot-rules'
import { ONLINE_ZAHLUNG_EINRICHTEN_SATZ, ONLINE_ZAHLUNG_EINRICHTEN_TITEL } from '@/lib/konditionen'
import { ZU_TUN_TEXT, type ZuTunAufgabe } from '@/lib/erste-schritte'
import { DIAGRAMM_BALKEN, DIAGRAMM_LEER } from '@/components/ui/diagramm-farbe'
import { centsAlsEuro } from '@/lib/servicegebuehr'
import { formatEuro } from '@/lib/format'
import { cn } from '@/lib/utils'

/*
 * Die Bausteine von „Heute" im neuen Design (Gate 5, Nachtlauf Nr. 17;
 * Mockups web-h3-heute-mit-teilen-karte, web-h3-heute-online-zahlung-pausiert,
 * mobil-h3-heute-*, hell: system-heute-hell). Nur Anzeige: Was erscheint und
 * in welcher Reihenfolge, entscheiden die reinen Regeln in src/lib/heute.ts;
 * Beträge kommen in Cent und gehen über formatEuro. Farben nur über Tokens
 * (shadcn-Namen im Geltungsbereich data-design="neu"), beide Themes.
 */

// Karten 12 px (G8, RUNDUNG.karte) statt rounded-2xl, das mit --radius auf 29 px wächst.
const KARTE = cn(RUNDUNG.karte, 'border border-border bg-card')
const LEISE = 'text-muted-foreground'
// Orange gefüllte Pille = Hof-Aktion (Farbrollen); 44 px Trefferfläche.
const KNOPF_ORANGE = cn(
  'inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-primary-foreground/25 bg-primary px-4 text-[13.5px] font-semibold text-primary-foreground transition-opacity duration-[250ms] hover:opacity-90',
  FOKUS_RAHMEN
)
const TEXTLINK = cn('inline-flex min-h-11 items-center rounded-md text-[13.5px] font-semibold text-status-fertig hover:underline underline-offset-2', FOKUS_RAHMEN)
// Umriss für die Einladung zum Teilen (Board s1-heute, Bild 2): 44 px, Feldrand, volle Textfarbe.
const KNOPF_UMRISS = cn(
  RUNDUNG.feld,
  'inline-flex h-11 items-center justify-center gap-2 border border-input px-4 text-[14.5px] font-semibold text-foreground transition-colors duration-[250ms] hover:bg-muted',
  FOKUS_RAHMEN
)
// Die Köpfe der Abschnitte (Board s1-heute): klein, fett, in Großbuchstaben, leise.
const KOPF = 'text-[13px] font-bold tracking-[0.04em] text-muted-foreground uppercase'

function mehrzahl(n: number, eins: string, viele: string): string {
  return `${n} ${n === 1 ? eins : viele}`
}

// ─── Postfach (Register N12, Nr. 87) ────────────────────────────────────────

/**
 * Eine ungelesene Nachricht vom Team, ganz oben in der Hauptspalte lesbar
 * (Mockup mobil-h3-heute-post-karte): Absender, Marke Wichtig, wann, Titel,
 * Text, der Link als Knopf, „Antworten" in den Faden und „Gelesen" — das
 * nimmt die Karte weg, die Nachricht bleibt im Postfach. Bei mehreren die
 * neueste, darunter „n weitere im Postfach" (heutePostfach in lib/postfach.ts).
 * „Gelesen" ist ein Formular mit Server Action, es geht auch ohne JavaScript.
 */
export function PostfachKarte({ nachricht, weitere }: { nachricht: HeuteNachricht; weitere: number }): React.JSX.Element {
  const knopf = cn(
    RUNDUNG.feld,
    'flex min-h-11 flex-1 items-center justify-center gap-2 border border-border px-3 text-sm font-semibold text-foreground transition-colors duration-[250ms] hover:bg-muted',
    FOKUS_RAHMEN
  )
  return (
    <div className="flex flex-col gap-1.5">
      <article aria-labelledby="postfach-karte-titel" className={cn(KARTE, 'flex flex-col gap-2.5 border-accent/60 p-3.5 md:p-4 dark:ring-0')}>
        <div className="flex min-w-0 items-center gap-2">
          <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent/12">
            <Sprout className="size-4 text-brand-text" strokeWidth={1.9} />
          </span>
          <span className="truncate text-[12.5px] font-semibold">{POSTFACH_TEXT.absender}</span>
          {nachricht.wichtig && <Marke art="tun" className="shrink-0">{POSTFACH_TEXT.wichtig}</Marke>}
          <span className={cn('ml-auto shrink-0 text-xs', LEISE)}>{nachricht.wann}</span>
        </div>
        <h2 id="postfach-karte-titel" className="text-base leading-snug font-semibold break-words">
          {nachricht.titel}
        </h2>
        <p className="text-sm leading-relaxed break-words whitespace-pre-line">{nachricht.text}</p>
        {nachricht.link && (
          <Link
            href={nachricht.link}
            className={cn(
              RUNDUNG.feld,
              'flex min-h-11 items-center justify-center bg-accent px-4 text-sm font-semibold text-accent-foreground transition-opacity duration-[250ms] hover:opacity-90',
              FOKUS_RAHMEN
            )}
          >
            {POSTFACH_TEXT.linkKnopf}
          </Link>
        )}
        <div className="flex gap-2">
          <Link href={nachricht.href} className={knopf}>
            <MessageCircle className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
            {POSTFACH_TEXT.antworten}
          </Link>
          <form action={markiereGelesenFormular} className="flex flex-1">
            <input type="hidden" name="unterhaltungId" value={nachricht.unterhaltungId} />
            <input type="hidden" name="nachrichtId" value={nachricht.nachrichtId} />
            <button type="submit" className={knopf}>
              <Check className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
              {POSTFACH_TEXT.gelesen}
            </button>
          </form>
        </div>
      </article>
      {weitere > 0 && (
        <Link href={POSTFACH_HREF} className={cn(TEXTLINK, 'self-center')}>
          {weitereText(weitere)}
        </Link>
      )}
    </div>
  )
}

// ─── Kopf ───────────────────────────────────────────────────────────────────

/**
 * Titel und Wiener Datum — ganz oben, vor jeder Pflicht- und Stripe-Karte
 * (Board s1-heute, Bild 3–5). Die Marke „Abholung heute" steht getrennt
 * darunter (AbholungHeuteMarke), nach den Karten und vor den Zahlen.
 *
 * Am Handy (Board s1-heute) eine feste Leiste oben: „Heute“, das Datum
 * darunter und rechts das Postfach mit dem Zähler der ungelesenen
 * Nachrichten — die Seitenleiste mit dem Postfach gibt es dort nicht. Ab
 * 768 px die freistehende Überschrift; das Postfach steht in der Seitenleiste.
 * Wartet der Hof auf die Freischaltung, steht sein Name vor dem Datum
 * (Board Bild 4: „Hof am Moos · Mittwoch, 3. März 2027“).
 */
export function HeuteKopf({ datum, hofName = null, postfach = 0 }: { datum: string; hofName?: string | null; postfach?: number }): React.JSX.Element {
  return (
    // Seit Nr. 249 der Werkzeug-Kopf (G1) ohne Rückweg — Heute ist eine Seite der Leiste. Damit steht der
    // Freischalt-Balken (G3) unter dem Kopf in der Inhaltsspalte statt über ihm (Liste Lauf 32, heute).
    <WerkzeugKopf
      titel="Heute"
      unterzeile={
        <p className={cn('truncate text-[13px] md:text-sm', LEISE)}>
          {hofName && <>{hofName} · </>}
          {datum}
        </p>
      }
      aktion={<PostfachKopfKnopf anzahl={postfach} />}
    />
  )
}

/**
 * Das Postfach rechts im Kopf, nur am Handy (im Web steht es in der Seitenleiste) — derselbe Zähler wie in der
 * Navigation. Mein-Hof-Kopf nach Board s1-heute bzw. s1-produkte (PL).
 */
export function PostfachKopfKnopf({ anzahl }: { anzahl: number }): React.JSX.Element {
  return (
    <Link
      href={POSTFACH_HREF}
      aria-label="Postfach"
      className={cn('relative inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted md:hidden', FOKUS_RAHMEN)}
    >
      <Inbox className="size-[22px]" strokeWidth={1.7} aria-hidden="true" />
      <Zaehler anzahl={anzahl} wofuer="ungelesene Nachrichten" klein className="absolute top-0.5 right-0" />
    </Link>
  )
}

/** „Abholung heute, Mi 3. März, 15–18 Uhr" — grün getönt wie die Marke „läuft", ohne Rand (Board s1-heute). */
export function AbholungHeuteMarke({ text }: { text: string }): React.JSX.Element {
  return (
    <p className="inline-flex min-h-8 items-center self-start rounded-full bg-zustand-laeuft-grund px-3 text-sm font-bold text-zustand-laeuft">{text}</p>
  )
}

// ─── Kennzahlen ─────────────────────────────────────────────────────────────

function Kennzahl({
  titel,
  wert,
  zusatz,
  offen = false,
  className,
}: {
  titel: string
  wert: string
  /** Leiser Satz unter dem Wert — was die Zahl mitzählt. */
  zusatz?: string
  offen?: boolean
  className?: string
}) {
  return (
    // Jede Karte ist ein Container: Die Zahl misst sich an ihrer Breite (cqw).
    <div className={cn(KARTE, '@container min-w-0 px-3 py-3 md:px-[18px] md:py-4', className)}>
      {/* Ein Betrag wird nie gekürzt: höchstens 22 bzw. 26 px, in einer schmalen Karte so groß, wie er hineinpasst
          (kennzahlBreiteEm), nie unter 12 px — passt er dann nicht, bricht er um, statt über den Rand zu laufen. */}
      <p
        style={{ '--kz-em': kennzahlBreiteEm(wert) } as React.CSSProperties}
        className={cn(
          'font-heading leading-7 font-semibold tabular-nums [overflow-wrap:anywhere] md:leading-8',
          'text-[length:max(12px,min(22px,calc(100cqw/var(--kz-em))))] md:text-[length:max(12px,min(26px,calc(100cqw/var(--kz-em))))]',
          offen && 'text-status-offen'
        )}
      >
        {wert}
      </p>
      {/* Die Bezeichnung unter der Zahl (Board s1-heute). In der halben Karte (2 + 1, Nr. 53) passt jede
          in eine Zeile; ein langes Wort trennt an seinen weichen Trennstellen — gekürzt wird sie nie. */}
      <p className={cn('mt-0.5 text-xs leading-snug break-words md:text-[13px]', LEISE)}>{mitTrennstellen(titel)}</p>
      {zusatz && <p className={cn('mt-0.5 text-xs leading-snug md:text-[13px]', LEISE)}>{zusatz}</p>}
    </div>
  )
}

/**
 * Die drei Kennzahlen (Register F4) mit Bezeichnungen, die sagen, was sie
 * zählen (KENNZAHL_TEXT, freigabe.md §12 Nr. 45). Unter 1024 px 2 + 1 (F4,
 * Vermerk 10.10.2026: „bis 1024 px"): die beiden Zahlen nebeneinander,
 * darunter der Betrag über die ganze Breite — so hat er am Handy Platz und
 * muss nicht schrumpfen; die Anpassung der Schrift bleibt als Netz. Ab 1024 px
 * (lg) drei nebeneinander.
 */
export function Kennzahlen({
  bestellungen,
  zuPacken,
  umsatzHeuteCent,
}: {
  bestellungen: number
  zuPacken: number
  umsatzHeuteCent: number
}): React.JSX.Element {
  return (
    <section aria-label="Heute in Zahlen" className="grid grid-cols-2 gap-2.5 md:gap-4 lg:grid-cols-3">
      <Kennzahl titel={KENNZAHL_TEXT.abholen} wert={String(bestellungen)} />
      <Kennzahl titel={KENNZAHL_TEXT.packen} wert={String(zuPacken)} offen={zuPacken > 0} />
      <Kennzahl
        titel={KENNZAHL_TEXT.eingenommen}
        wert={formatEuro(centsAlsEuro(umsatzHeuteCent))}
        className="col-span-2 lg:col-span-1"
      />
    </section>
  )
}

// ─── Stripe-Hinweis ─────────────────────────────────────────────────────────

/**
 * Online-Zahlung pausiert (onlineZahlungPausiert): Der Weg führt in die
 * bestehenden Zahlungs-Einstellungen — dort sitzt der Knopf zu Stripe. Die
 * Seite selbst ruft Stripe nicht auf.
 */
export function StripeHinweis({ barMoeglich }: { barMoeglich: boolean }): React.JSX.Element {
  const { titel, satz } = onlinePausiertHinweis(barMoeglich)
  return (
    <PflichtKarte
      titel={titel}
      knoepfe={
        <Link href="/settings/payments" className={PFLICHT_KNOPF}>
          Bei Stripe ergänzen
        </Link>
      }
    >
      <p>{satz}</p>
    </PflichtKarte>
  )
}

/**
 * Die Sperre durch das Team (Register N34, Nr. 187): ganz oben in Heute, mit
 * dem Grund des Teams und dem Weg ins Postfach. Der Hof kann sie nicht selbst
 * aufheben — anders als die Pause gibt es hier keinen Schalter.
 */
export function TeamSperreKarte({ grund }: { grund: string | null }): React.JSX.Element {
  return (
    <PflichtKarte
      titel={SPERRE_KARTE_TITEL}
      knoepfe={
        <Link href={POSTFACH_HREF} className={PFLICHT_KNOPF}>
          Zum Postfach
        </Link>
      }
    >
      <p>{sperreKarteSatz(grund)}</p>
    </PflichtKarte>
  )
}

/**
 * Online-Zahlung einrichten (Register Z1, stripeEinrichtenHinweis): für
 * freigeschaltete Höfe ohne Stripe. Nur ein Hinweis — der Hof bleibt online.
 * Derselbe Platz und dieselbe Form wie „pausiert", damit er nicht übersehen
 * wird; der Weg führt in die Zahlungs-Einstellungen, die Seite ruft Stripe
 * nicht selbst auf.
 */
export function StripeEinrichtenHinweis(): React.JSX.Element {
  return (
    <PflichtKarte
      titel={ONLINE_ZAHLUNG_EINRICHTEN_TITEL}
      knoepfe={
        // Board s1-heute Bild 4: ein Weg in die Einstellungen, kein Auftrag mit Frist — Umriss statt Orange.
        <Link href="/settings/payments" className={PFLICHT_KNOPF_RAHMEN}>
          Jetzt einrichten
        </Link>
      }
    >
      <p>{ONLINE_ZAHLUNG_EINRICHTEN_SATZ}</p>
    </PflichtKarte>
  )
}

// ─── Teilen-Karte ───────────────────────────────────────────────────────────

/**
 * Teilen zuletzt in der Hauptspalte, nach Packliste und „Braucht dich"
 * (freigabe.md §12 Nr. 45, Register N11) — an jedem Tag. Seit Lauf 30 nach
 * Board s1-heute, Bild 2: „Diese Woche bei dir: …" als Titel, darunter der
 * Satz und „Teilen" als Umriss über die volle Breite — eine Einladung, keine
 * Hauptaktion. Seit Nr. 21 (Gate 7) öffnet der Knopf das Teilen-Fenster mit
 * Bild und Kanälen, wenn die Seite dessen Daten mitgibt; sonst bleibt es beim
 * einfachen Teilen der Hofseite (teileHof).
 */
export function TeilenKarte({
  hofName,
  hofSlug,
  satz,
  fenster = null,
  wirkung = null,
}: {
  hofName: string
  hofSlug: string
  satz: string
  /** Daten des Teilen-Fensters (Nr. 21); ohne sie das einfache Teilen. */
  fenster?: TeilenFensterDaten | null
  /** „14 Besuche über deine Links" der letzten Woche (teilenWirkungSatz). */
  wirkung?: string | null
}): React.JSX.Element {
  const knopf = cn(KNOPF_UMRISS, 'w-full')
  return (
    <div className={cn(KARTE, 'flex flex-col gap-2 p-4 md:px-[18px]')}>
      <p className="text-[15px] leading-snug font-semibold break-words">Diese Woche bei dir: {satz}</p>
      <p className={cn('text-[13.5px] leading-snug', LEISE)}>
        {TEILEN_KARTE_SATZ}
        {wirkung && <> · letzte Woche {wirkung}</>}
      </p>
      <div className="mt-1">
        {fenster ? (
          <TeilenFensterKnopf daten={fenster} label="Teilen" className={knopf} />
        ) : (
          <HofTeilenKnopf name={hofName} slug={hofSlug} label="Teilen" className={knopf} />
        )}
      </div>
    </div>
  )
}

// ─── Packliste ──────────────────────────────────────────────────────────────

function PacklistenEintrag({ zeile }: { zeile: PacklistenZeile }) {
  const marke = PACK_MARKE[zeile.chip]
  return (
    <li className="border-t border-border first:border-t-0">
      <Link
        href={`/orders/${zeile.id}`}
        className={cn('flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted md:gap-3.5 md:px-[18px]', FOKUS_RAHMEN_INNEN)}
      >
        {/* Antwort 2 der Projektleitung (Lauf 32): Kurzname ohne Uhrzeit — die Zeit steht im Kopf des Fensters
            („Abholung heute, …, 15–18 Uhr“), abgeholt wird bei allen im selben Fenster (V60). Die Positionen
            dürfen zwei Zeilen nehmen statt abgeschnitten zu werden. */}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px] font-semibold" title={zeile.kunde}>
            {zeile.kunde}
          </span>
          <span className={cn('mt-0.5 line-clamp-2 text-[12.5px] leading-snug break-words md:text-[13px]', LEISE)} title={zeile.positionen}>
            {zeile.positionen} · {zeile.zahlart}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-[13.5px] font-semibold tabular-nums md:text-sm">{formatEuro(centsAlsEuro(zeile.gesamtCents))}</span>
          <Marke art={marke.art} form="schild">
            {marke.text}
          </Marke>
        </span>
      </Link>
    </li>
  )
}

/**
 * Die Packliste für heute — dieselben Bestellungen wie das Papier
 * (/orders/today/print, abholWhere). Nach Board s1-heute steht der Kopf über
 * der Karte („Packliste · 2 zu packen · 1 wartet", rechts Drucken), die
 * Zeilen in der Karte, „Alle Bestellungen ansehen →" darunter. Zeilen führen
 * in die Bestellung; dort wird gepackt und übergeben (keine Knöpfe hier). Die
 * nächste Abholung steht nur in der Seitenspalte („Nächste Abholung“), nicht
 * noch einmal als Zeile unter der Liste (Board s1-/w1-heute, Lauf 31).
 *
 * Leer: mit Abholzeit eine Karte mit HEUTE_NIEMAND und der nächsten Abholung
 * samt ihrer Zahl (V40) — es gibt nichts zu tun, also kein Knopf; ohne
 * Abholzeit dieselbe Karte mit ABHOLZEITEN_FEHLEN und dem Knopf (Board Bild 4).
 */
export function Packliste({
  zeilen,
  stand,
  leer,
}: {
  zeilen: PacklistenZeile[]
  /** „2 zu packen · 1 wartet" (packlistenStand). */
  stand: string
  /** Für den Leerzustand: der Satz zur nächsten Abholung (naechsteAbholungSatz), null = keine Abholzeit eingetragen. */
  leer: { naechsteAbholung: string | null }
}): React.JSX.Element {
  return (
    <section aria-labelledby="heute-packliste" className="flex flex-col gap-2">
      <div className="flex min-h-11 items-center gap-2">
        <h2 id="heute-packliste" className={cn(KOPF, 'min-w-0 flex-1')}>
          Packliste
          {zeilen.length > 0 && <> · {stand}</>}
        </h2>
        {zeilen.length > 0 && (
          <Link
            href="/orders/today/print"
            aria-label="Packliste drucken"
            className={cn(
              'inline-flex size-11 shrink-0 items-center justify-center gap-2 rounded-full transition-colors hover:bg-muted md:w-auto md:border md:border-border md:px-4 md:text-[13.5px] md:font-semibold print:hidden',
              FOKUS_RAHMEN
            )}
          >
            <Printer className="size-4" strokeWidth={1.7} aria-hidden="true" />
            <span className="hidden md:inline" aria-hidden="true">
              Drucken
            </span>
          </Link>
        )}
      </div>

      {zeilen.length === 0 ? (
        leer.naechsteAbholung ? (
          <div className={cn(KARTE, 'flex flex-col gap-1 px-4 py-3.5 md:px-[18px]')}>
            <p className="text-[15px] font-semibold">{HEUTE_NIEMAND}</p>
            <p className={cn('text-[13.5px]', LEISE)}>{leer.naechsteAbholung}</p>
          </div>
        ) : (
          // Board s1-heute Bild 4: eine Karte wie „Heute holt niemand etwas ab.“ — Titel, Satz, oranger Knopf
          // über die volle Breite, ohne Symbol und ohne gestrichelten Rand (das Board zeigt den Zustand, es geht
          // dem allgemeinen EmptyState vor).
          <div className={cn(KARTE, 'flex flex-col gap-2 px-3.5 py-3')}>
            <p className="text-base font-semibold">{ABHOLZEITEN_FEHLEN.titel}</p>
            <p className={cn('text-sm', LEISE)}>{HEUTE_ABHOLZEITEN_SATZ}</p>
            <Link href={ABHOLZEITEN_FEHLEN.aktion.href} className={cn(KNOPF_ORANGE, 'h-auto min-h-[52px] w-full rounded-[14px] text-base font-bold')}>
              {ABHOLZEITEN_FEHLEN.aktion.text}
            </Link>
          </div>
        )
      ) : (
        <div className={cn(KARTE, 'overflow-hidden')}>
          <ul>
            {zeilen.map((z) => (
              <PacklistenEintrag key={z.id} zeile={z} />
            ))}
          </ul>
          {!leer.naechsteAbholung && (
            // Bestellungen für heute, aber keine aktive Abholzeit: Satz und Knopf stehen trotzdem (sonst nur im ausblendbaren „Zu tun").
            <div className="flex flex-col gap-2.5 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-[18px]">
              <p className={cn('text-[13px]', LEISE)}>{HEUTE_ABHOLZEITEN_SATZ}</p>
              <Link href={ABHOLZEITEN_FEHLEN.aktion.href} className={cn(KNOPF_ORANGE, 'shrink-0 self-start sm:self-auto')}>
                {ABHOLZEITEN_FEHLEN.aktion.text}
              </Link>
            </div>
          )}
        </div>
      )}
      {zeilen.length > 0 && (
        <Link href="/orders" className={cn(TEXTLINK, 'self-start underline underline-offset-2')}>
          Alle Bestellungen ansehen →
        </Link>
      )}
    </section>
  )
}

// ─── Braucht dich ───────────────────────────────────────────────────────────

/**
 * „Braucht dich" — nur, was eine Handlung verlangt (brauchtDich in src/lib/heute.ts),
 * nach Board s1-heute mit dem Kopf über der Karte („Braucht dich · 1"). Ohne
 * Eintrag steht nur bei leerer Packliste die eine Zeile BRAUCHT_DICH_LEER in
 * einer Karte (Register N11, Board Bild 3: kleine Zeile in einer Karte, ohne
 * Aktion); unter einer vollen Packliste steht nichts (brauchtDichAnzeige).
 */
export function BrauchtDichKarte({ eintraege, packlisteLeer }: { eintraege: BrauchtDichEintrag[]; packlisteLeer: boolean }): React.JSX.Element | null {
  const anzeige = brauchtDichAnzeige(eintraege.length, packlisteLeer)
  if (anzeige === null) return null
  return (
    <section aria-labelledby="heute-braucht-dich" className="flex flex-col gap-2">
      <h2 id="heute-braucht-dich" className={cn(KOPF, 'flex min-h-8 items-center')}>
        Braucht dich{anzeige === 'karte' && <> · {eintraege.length}</>}
      </h2>
      {anzeige === 'zeile' ? (
        <p className={cn(KARTE, 'px-4 py-3.5 text-[14.5px] md:px-[18px]')}>{BRAUCHT_DICH_LEER}</p>
      ) : (
        <ul className={cn(KARTE, 'overflow-hidden')}>
          {eintraege.map((eintrag) => {
            return (
              <li key={`${eintrag.art}-${eintrag.href}-${eintrag.text}`} className="border-t border-border first:border-t-0">
                <Link
                  href={eintrag.href}
                  className={cn('flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted md:px-[18px]', FOKUS_RAHMEN_INNEN)}
                >
                  {/* Board s1-heute Bild 2: Titel fett, ohne Symbol im Kästchen davor, darunter leise die Erklärzeile. */}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-semibold break-words">{eintrag.text}</span>
                    <span className={cn('mt-0.5 block text-[13px] leading-snug break-words', LEISE)}>{eintrag.erklaerung}</span>
                  </span>
                  <ChevronRight className={cn('size-4 shrink-0', LEISE)} strokeWidth={1.7} aria-hidden="true" />
                </Link>
                {eintrag.unterpunkte && eintrag.unterpunkte.length > 0 && (
                  <ul className="pr-4 pb-2 pl-4 md:pl-[18px]">
                    {eintrag.unterpunkte.map((u) => (
                      <li key={`${u.href}-${u.text}`}>
                        <Link
                          href={u.href}
                          className={cn('flex min-h-11 items-center gap-2 rounded-lg px-2 text-[13px] transition-colors hover:bg-muted', LEISE, FOKUS_RAHMEN_INNEN)}
                        >
                          <span className="min-w-0 flex-1 truncate" title={u.text}>
                            {u.text}
                          </span>
                          <ChevronRight className="size-3.5 shrink-0" strokeWidth={1.7} aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

// ─── Seitenspalte ───────────────────────────────────────────────────────────

/**
 * „Nächste Abholung" mit Wochentag und Datum (V9, Board s1-heute): „Sa, 6. März,
 * 9–12 Uhr", darunter die Zahl. `tag` kommt fertig von der Seite (abholTagMitDatum).
 */
export function NaechsteAbholungKarte({ fenster, tag, anzahl }: { fenster: NaechstesFenster | null; tag: string | null; anzahl: number }): React.JSX.Element | null {
  // Ohne Abholzeit entfällt die Karte (Liste Lauf 32, heute Bild 4): Satz und Knopf stehen schon in der Packliste.
  if (!fenster) return null
  return (
    <section aria-labelledby="heute-naechste-abholung" className={cn(KARTE, 'flex flex-col gap-1.5 p-[18px]')}>
      <h2 id="heute-naechste-abholung" className={KOPF}>
        Nächste Abholung
      </h2>
      {/* Umbruch nur nach dem Komma — „15–18 Uhr" bleibt zusammen. */}
      <p className="text-[17px] leading-tight font-semibold break-words">
        {tag ?? fenster.name}, <span className="whitespace-nowrap">{fenster.zeit}</span>
      </p>
      <p className={cn('text-[13px]', LEISE)}>{anzahl > 0 ? mehrzahl(anzahl, 'Bestellung', 'Bestellungen') : HEUTE_KEINE_BESTELLUNGEN}</p>
    </section>
  )
}

/**
 * Umsatz diese Woche (Mo–So, gemeinsame Umsatzregel): Summe, Tagesbalken in
 * Grün (heute fett beschriftet), Vergleich mit der Vorwoche bis jetzt. Die
 * Balken sind Anschauung (aria-hidden); die Werte stehen als Liste für den
 * Screenreader daneben. Nach Board s1-heute der Betrag groß unter dem Kopf.
 */
export function WocheKarte({
  summeCent,
  vergleich,
  balken,
  selbstEingetragen = null,
}: {
  summeCent: number
  vergleich: string
  balken: WochenBalken[]
  /** „Mo und Di: Verkäufe, die du selbst eingetragen hast.“ (selbstEingetragenSatz) — null, wenn es keine gibt. */
  selbstEingetragen?: string | null
}): React.JSX.Element {
  return (
    <section aria-labelledby="heute-woche" className={cn(KARTE, 'flex flex-col gap-3 p-[18px]')}>
      <div className="flex flex-col gap-1">
        <h2 id="heute-woche" className={KOPF}>
          Umsatz diese Woche
        </h2>
        <p className="font-heading text-[26px] leading-tight font-semibold tabular-nums">{formatEuro(centsAlsEuro(summeCent))}</p>
      </div>
      <div aria-hidden="true">
        <div className="flex h-[78px] items-end gap-2">
          {balken.map((b) => (
            <div
              key={b.label}
              // Board s1-heute: alle Tage mit Umsatz grün (heute ohne eigene Farbe, der Tag steht fett darunter);
              // im Dunkeln helles Mint statt Dunkelgrün (G13, DIAGRAMM_BALKEN), leere Tage als Strich (DIAGRAMM_LEER).
              className={cn('flex-1 rounded-t-md rounded-b-sm', b.cent > 0 ? DIAGRAMM_BALKEN : DIAGRAMM_LEER)}
              // Höhe ist Messwert, keine Farbe: mindestens ein Strich, damit leere Tage sichtbar bleiben.
              style={{ height: b.hoeheProzent > 0 ? `${b.hoeheProzent}%` : '3px' }}
            />
          ))}
        </div>
        <div className="mt-1.5 flex gap-2 text-center text-xs">
          {balken.map((b) => (
            <span key={b.label} className={cn('flex-1', b.heute ? 'font-semibold text-foreground' : LEISE)}>
              {b.label}
            </span>
          ))}
        </div>
      </div>
      <ul className="sr-only">
        {balken.map((b) => (
          <li key={b.label}>
            {b.label}
            {b.heute ? ' (heute)' : ''}: {formatEuro(centsAlsEuro(b.cent))}
          </li>
        ))}
      </ul>
      {selbstEingetragen && <p className={cn('text-[13px]', LEISE)}>{selbstEingetragen}</p>}
      <p className={cn('text-[13px]', LEISE)}>{vergleich}</p>
      <Link href="/analytics" className={cn(TEXTLINK, 'self-start underline underline-offset-2')}>
        Auswertung →
      </Link>
    </section>
  )
}

// ─── Zu tun ─────────────────────────────────────────────────────────────────

/**
 * „Zu tun" (freigabe.md §13 Nr. 53): EINE Liste statt „Erste Schritte" und
 * „Deine Hofseite". Was darin steht und in welcher Reihenfolge, entscheidet
 * zuTun (src/lib/erste-schritte.ts) — nur Offenes, jede Aufgabe einmal, ohne
 * das, was der Stripe-Kasten oben schon sagt. Nach Board s1-heute schlank:
 * Kopf „Zu tun · n" und je Aufgabe ein grüner Textlink mit ihrem Titel
 * (44 px). Seit Nr. 249 (Liste Lauf 32, heute Bild 4) ohne Einleitungssatz
 * und ohne Beschreibung unter den Links — nur Überschrift und Links.
 * „Ausblenden" bleibt im Kopf — sonst ließe sich die Karte nicht mehr
 * wegnehmen (Nr. 53, C-Zeile der Liste).
 */
export function ZuTunKarte({
  aufgaben,
  ausblenden,
}: {
  aufgaben: readonly ZuTunAufgabe[]
  /** Der Knopf „Ausblenden" (ErsteSchritteSchalter) — von der Seite gereicht, damit die Karte ohne Server-Aktion rendert. */
  ausblenden: ReactNode
}): React.JSX.Element {
  return (
    <section aria-labelledby="heute-zu-tun" className={cn(KARTE, 'flex flex-col gap-1 py-2 pr-2 pl-4 md:pl-[18px]')}>
      <div className="flex min-h-11 items-center gap-2.5">
        <h2 id="heute-zu-tun" className={KOPF}>
          {ZU_TUN_TEXT.titel} · {aufgaben.length}
        </h2>
        <span className="ml-auto shrink-0">{ausblenden}</span>
      </div>
      <ul className="flex flex-col">
        {aufgaben.map((aufgabe) => (
          <li key={aufgabe.id}>
            {/* Über die volle Breite: Ein kurzer Titel („Logo“) wäre sonst schmaler als 44 px (Messung Gate A, Lauf 31). */}
            <Link href={aufgabe.href} className={cn(TEXTLINK, 'flex w-full underline underline-offset-2 break-words')}>
              {zuTunLinkText(aufgabe)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
