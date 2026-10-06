import Link from 'next/link'
import {
  ChevronRight,
  Clock,
  CreditCard,
  Megaphone,
  PackageOpen,
  PackageX,
  Printer,
  Share2,
  Tags,
  type LucideIcon,
} from 'lucide-react'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ProgressBar } from '@/components/ui/progress-bar'
import { FOKUS_RAHMEN, FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'
import { HofTeilenKnopf } from '@/components/farmer/hof-teilen-knopf'
import {
  PACK_MARKE,
  naechsteAbholungText,
  type BrauchtDichEintrag,
  type NaechsteAbholung,
  type NaechstesFenster,
  type PacklistenZeile,
  type TeilenForm,
  type WochenBalken,
} from '@/lib/heute'
import { onlinePausiertHinweis } from '@/lib/stripe-konto'
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

const KARTE = 'rounded-2xl border border-border bg-card'
const LEISE = 'text-muted-foreground'
// Orange gefüllte Pille = Hof-Aktion (Farbrollen); 44 px Trefferfläche.
const KNOPF_ORANGE = cn(
  'inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-primary-foreground/25 bg-primary px-4 text-[13.5px] font-semibold text-primary-foreground transition-opacity duration-[250ms] hover:opacity-90',
  FOKUS_RAHMEN
)
const TEXTLINK = cn('inline-flex min-h-11 items-center rounded-md text-[13.5px] font-semibold text-status-fertig hover:underline underline-offset-2', FOKUS_RAHMEN)

function mehrzahl(n: number, eins: string, viele: string): string {
  return `${n} ${n === 1 ? eins : viele}`
}

// ─── Kopf ───────────────────────────────────────────────────────────────────

export function HeuteKopf({ datum, abholungHeute }: { datum: string; abholungHeute: string | null }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-4">
      <div className="min-w-0">
        <h1 className="font-heading text-[27px] font-semibold md:text-[30px]">Heute</h1>
        <p className={cn('mt-0.5 text-sm', LEISE)}>{datum}</p>
      </div>
      {abholungHeute && (
        <p className="inline-flex min-h-10 items-center gap-2 self-start rounded-full border border-accent/50 bg-accent/12 px-4 text-[13.5px] font-semibold text-status-fertig md:self-auto">
          <Clock className="size-[15px] shrink-0" strokeWidth={1.7} aria-hidden="true" />
          Abholung heute, {abholungHeute}
        </p>
      )}
    </div>
  )
}

// ─── Kennzahlen ─────────────────────────────────────────────────────────────

function Kennzahl({ titel, wert, offen = false }: { titel: string; wert: string; offen?: boolean }) {
  return (
    <div className={cn(KARTE, 'min-w-0 px-3 py-3 md:px-[18px] md:py-4')}>
      {/* Am Handy dürfen die Bezeichnungen zweizeilig werden („Bestellungen heute" bei 110 px). */}
      <p className={cn('line-clamp-2 min-h-[2lh] text-xs leading-snug break-words md:min-h-0 md:text-[13px]', LEISE)}>{titel}</p>
      <p className={cn('mt-1 truncate font-heading text-[22px] font-semibold tabular-nums md:mt-1.5 md:text-[26px]', offen && 'text-status-offen')}>
        {wert}
      </p>
    </div>
  )
}

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
    <section aria-label="Heute in Zahlen" className="grid grid-cols-3 gap-2.5 md:gap-4">
      <Kennzahl titel="Bestellungen heute" wert={String(bestellungen)} />
      <Kennzahl titel="Noch zu packen" wert={String(zuPacken)} offen={zuPacken > 0} />
      <Kennzahl titel="Umsatz heute" wert={formatEuro(centsAlsEuro(umsatzHeuteCent))} />
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
    <Hinweiskarte
      ton="orange"
      symbol={CreditCard}
      titel={titel}
      aktion={
        <Link href="/settings/payments" className={KNOPF_ORANGE}>
          Bei Stripe ergänzen
        </Link>
      }
    >
      <p className="text-[12.5px]">{satz}</p>
    </Hinweiskarte>
  )
}

// ─── Teilen-Karte ───────────────────────────────────────────────────────────

/**
 * Schmal an Abholtagen (eine orange Zeile, die Packliste hat Vorrang), groß an
 * Tagen ohne Abholung. Geteilt wird nur die öffentliche Hofseite über
 * teileHof (HofTeilenKnopf) — ohne Zählung, ohne eigene Kanäle (Gate 7).
 */
export function TeilenKarte({
  form,
  hofName,
  hofSlug,
  satz,
  adresse,
}: {
  form: Exclude<TeilenForm, null>
  hofName: string
  hofSlug: string
  satz: string
  /** „farmerzone.at/hof" (hofAdresse) — als Link auf die Hofseite. */
  adresse: string
}): React.JSX.Element {
  if (form === 'schmal') {
    // Eine Zeile auch am Handy (Mockup mobil-h3-heute-mit-teilen-karte): Knopf
    // rechts statt darunter, damit die Packliste nicht nach unten rutscht.
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-primary/45 bg-primary/12 py-2.5 pr-2.5 pl-3.5 text-[13px] md:gap-3.5 md:px-4 md:py-3 md:text-[13.5px]">
        <Share2 className="hidden size-5 shrink-0 text-status-offen sm:block" strokeWidth={1.7} aria-hidden="true" />
        <p className="min-w-0 flex-1 line-clamp-2 break-words">
          <strong className="font-semibold">Diese Woche bei dir:</strong> {satz}
        </p>
        <HofTeilenKnopf name={hofName} slug={hofSlug} label="Teilen" className={KNOPF_ORANGE} />
      </div>
    )
  }
  return (
    <section aria-labelledby="heute-teilen" className="flex flex-col gap-3 rounded-2xl border border-primary/45 bg-primary/12 p-[18px]">
      <span className="flex size-10 items-center justify-center rounded-full bg-primary/20">
        <Share2 className="size-5 text-status-offen" strokeWidth={1.7} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <h2 id="heute-teilen" className="font-heading text-lg font-semibold">
          Erzähl, was es diese Woche gibt
        </h2>
        <p className="mt-1 line-clamp-3 text-[13.5px] break-words">{satz}</p>
        <a
          href={`/${hofSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          className={cn('mt-1 block max-w-full truncate rounded-md text-[13px] font-medium text-status-fertig underline-offset-2 hover:underline', FOKUS_RAHMEN)}
          title={adresse}
        >
          {adresse}
        </a>
      </div>
      <HofTeilenKnopf name={hofName} slug={hofSlug} label="Hof teilen" className={cn(KNOPF_ORANGE, 'w-full rounded-[14px]')} />
    </section>
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
        <span className={cn('hidden w-[92px] shrink-0 text-[13px] font-semibold tabular-nums md:block', LEISE)}>{zeile.uhrzeit}</span>
        <span className="min-w-0 flex-1">
          {/* Eine Zeile — ein Name bis 80 Zeichen bräche sonst über mehrere; voll im title. */}
          <span className="block truncate text-[14.5px] font-semibold" title={zeile.kunde}>
            {zeile.kunde}
          </span>
          <span className={cn('mt-0.5 block truncate text-[12.5px] md:text-[13px]', LEISE)} title={zeile.positionen}>
            <span className="md:hidden">{zeile.uhrzeit} · </span>
            {zeile.positionen} · {zeile.zahlart}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1 md:flex-row md:items-center md:gap-3.5">
          <span className="text-[13.5px] font-semibold tabular-nums md:text-sm">{formatEuro(centsAlsEuro(zeile.gesamtCents))}</span>
          <StatusBadge status={marke.ton} className="md:w-[124px] md:justify-center">
            {marke.text}
          </StatusBadge>
        </span>
      </Link>
    </li>
  )
}

/**
 * Die Packliste für heute — dieselben Bestellungen wie das Papier
 * (/orders/today/print, abholWhere). Zeilen führen in die Bestellung; dort
 * wird gepackt und übergeben (bestehende Aktionen, keine neuen hier).
 */
export function Packliste({
  zeilen,
  zuPacken,
  naechsteAbholung,
  leer,
}: {
  zeilen: PacklistenZeile[]
  zuPacken: number
  /** Der nächste Abholtag mit offenen Bestellungen — ohne ihn entfällt die Zeile. */
  naechsteAbholung: NaechsteAbholung | null
  /** Für den Leerzustand: das nächste Abholfenster laut Abholzeiten (null = keine eingetragen). */
  leer: { abholfenster: NaechstesFenster | null }
}): React.JSX.Element {
  return (
    <section aria-labelledby="heute-packliste" className={cn(KARTE, 'overflow-hidden')}>
      <div className="flex min-h-[60px] items-center gap-2.5 border-b border-border px-4 py-2 md:px-[18px]">
        <h2 id="heute-packliste" className="text-[15px] font-semibold md:text-[15.5px]">
          <span className="md:hidden">Packliste</span>
          <span className="hidden md:inline">Packliste für heute</span>
        </h2>
        {zeilen.length > 0 && <span className={cn('text-[12.5px] md:text-[13px]', LEISE)}>{zuPacken} offen</span>}
        {zeilen.length > 0 && (
          <Link
            href="/orders/today/print"
            aria-label="Packliste drucken"
            className={cn(
              'ml-auto inline-flex size-11 shrink-0 items-center justify-center gap-2 rounded-full border border-border text-[12.5px] font-semibold transition-colors hover:bg-muted md:w-auto md:px-4 print:hidden',
              FOKUS_RAHMEN
            )}
          >
            <Printer className="size-4" strokeWidth={1.7} aria-hidden="true" />
            <span className="hidden md:inline" aria-hidden="true">
              Packliste drucken
            </span>
          </Link>
        )}
      </div>

      {zeilen.length === 0 ? (
        <EmptyState
          symbol={PackageOpen}
          titel="Heute holt niemand etwas ab."
          satz={
            leer.abholfenster
              ? `Nächste Abholung: ${leer.abholfenster.name}, ${leer.abholfenster.zeit}.`
              : 'Trag deine Abholzeiten ein, damit Kunden bei dir bestellen können.'
          }
          aktion={
            leer.abholfenster ? undefined : (
              <Link href="/settings/pickup-slots" className={KNOPF_ORANGE}>
                Abholzeiten eintragen
              </Link>
            )
          }
          className="rounded-none border-0 py-8"
        />
      ) : (
        <ul>
          {zeilen.map((z) => (
            <PacklistenEintrag key={z.id} zeile={z} />
          ))}
        </ul>
      )}

      {naechsteAbholung && (
        <Link
          href="/orders"
          className={cn('flex min-h-11 items-center gap-2 border-t border-border bg-muted/40 px-4 py-2.5 text-[13px] transition-colors hover:bg-muted md:px-[18px]', LEISE, FOKUS_RAHMEN_INNEN)}
        >
          <span className="flex-1">{naechsteAbholungText(naechsteAbholung)}</span>
          <ChevronRight className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
        </Link>
      )}
      <div className="border-t border-border px-4 py-1 md:px-[18px]">
        <Link href="/orders" className={TEXTLINK}>
          Alle Bestellungen ansehen →
        </Link>
      </div>
    </section>
  )
}

// ─── Braucht dich ───────────────────────────────────────────────────────────

const BRAUCHT_DICH_SYMBOL: Record<BrauchtDichEintrag['art'], LucideIcon> = {
  ueberfaellig: Clock,
  ausverkauft: PackageX,
  'ohne-kategorie': Tags,
  status: Megaphone,
}

/** „Braucht dich" — nur, was eine Handlung verlangt (brauchtDich in src/lib/heute.ts). */
export function BrauchtDichKarte({ eintraege }: { eintraege: BrauchtDichEintrag[] }): React.JSX.Element {
  return (
    <section aria-labelledby="heute-braucht-dich" className={cn(KARTE, 'overflow-hidden')}>
      <h2 id="heute-braucht-dich" className="border-b border-border px-4 py-3.5 text-[15px] font-semibold md:px-[18px]">
        Braucht dich
      </h2>
      {eintraege.length === 0 ? (
        <p className={cn('px-4 py-4 text-sm md:px-[18px]', LEISE)}>Alles erledigt.</p>
      ) : (
        <ul>
          {eintraege.map((eintrag) => {
            const Symbol = BRAUCHT_DICH_SYMBOL[eintrag.art]
            return (
              <li key={`${eintrag.art}-${eintrag.href}-${eintrag.text}`} className="border-t border-border first:border-t-0">
                <Link
                  href={eintrag.href}
                  className={cn('flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted md:px-[18px]', FOKUS_RAHMEN_INNEN)}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary/12 text-status-offen">
                    <Symbol className="size-4" strokeWidth={1.7} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 text-sm break-words">{eintrag.text}</span>
                  <ChevronRight className={cn('size-4 shrink-0', LEISE)} strokeWidth={1.7} aria-hidden="true" />
                </Link>
                {eintrag.unterpunkte && eintrag.unterpunkte.length > 0 && (
                  <ul className="pr-4 pb-2 pl-16">
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

export function NaechsteAbholungKarte({ fenster, anzahl }: { fenster: NaechstesFenster | null; anzahl: number }): React.JSX.Element {
  return (
    <section aria-labelledby="heute-naechste-abholung" className={cn(KARTE, 'flex flex-col gap-1.5 p-[18px]')}>
      <h2 id="heute-naechste-abholung" className={cn('text-[13px] font-normal', LEISE)}>
        Nächste Abholung
      </h2>
      {fenster ? (
        <>
          {/* Umbruch nur nach dem Komma — „15–18 Uhr" bleibt zusammen. */}
          <p className="font-heading text-[22px] leading-tight font-semibold break-words">
            {fenster.name}, <span className="whitespace-nowrap">{fenster.zeit}</span>
          </p>
          <p className={cn('text-[13px]', LEISE)}>{anzahl > 0 ? mehrzahl(anzahl, 'Bestellung', 'Bestellungen') : 'Noch keine Bestellungen'}</p>
        </>
      ) : (
        <>
          <p className="text-sm">Du hast noch keine Abholzeiten eingetragen.</p>
          <Link href="/settings/pickup-slots" className={TEXTLINK}>
            Abholzeiten eintragen →
          </Link>
        </>
      )}
    </section>
  )
}

/**
 * Umsatz diese Woche (Mo–So, gemeinsame Umsatzregel): Summe, Tagesbalken mit
 * dem heutigen Tag in Orange, Vergleich mit der Vorwoche bis jetzt. Die
 * Balken sind Anschauung (aria-hidden); die Werte stehen als Liste für den
 * Screenreader daneben.
 */
export function WocheKarte({
  summeCent,
  vergleich,
  balken,
}: {
  summeCent: number
  vergleich: string
  balken: WochenBalken[]
}): React.JSX.Element {
  return (
    <section aria-labelledby="heute-woche" className={cn(KARTE, 'flex flex-col gap-3 p-[18px]')}>
      <div className="flex items-baseline gap-2.5">
        <h2 id="heute-woche" className={cn('text-[13px] font-normal', LEISE)}>
          Umsatz diese Woche
        </h2>
        <p className="ml-auto text-[17px] font-semibold tabular-nums">{formatEuro(centsAlsEuro(summeCent))}</p>
      </div>
      <div aria-hidden="true">
        <div className="flex h-[78px] items-end gap-2">
          {balken.map((b) => (
            <div
              key={b.label}
              className={cn('flex-1 rounded-t-md rounded-b-sm', b.heute ? 'bg-primary' : b.cent > 0 ? 'bg-accent/45' : 'bg-border')}
              // Höhe ist Messwert, keine Farbe: mindestens ein Strich, damit leere Tage sichtbar bleiben.
              style={{ height: b.hoeheProzent > 0 ? `${b.hoeheProzent}%` : '3px' }}
            />
          ))}
        </div>
        <div className="mt-1.5 flex gap-2 text-center text-[11px]">
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
      <p className={cn('text-[12.5px]', LEISE)}>{vergleich}</p>
      <Link href="/analytics" className={cn(TEXTLINK, 'self-start')}>
        Auswertung →
      </Link>
    </section>
  )
}

/** „Deine Hofseite" — dieselbe Rechnung wie die Checkliste in Mein Hof (hofseiteFortschritt). */
export function HofseiteKarte({ prozent, satz, fertig }: { prozent: number; satz: string; fertig: boolean }): React.JSX.Element {
  return (
    <section aria-label="Deine Hofseite" className={cn(KARTE, 'flex flex-col gap-2.5 p-[18px]')}>
      <ProgressBar beschriftung="Deine Hofseite" wert={prozent} />
      <p className={cn('text-[12.5px]', LEISE)}>{satz}</p>
      <Link href="/farm-page" className={cn(TEXTLINK, 'self-start')}>
        {fertig ? 'Zu Mein Hof →' : 'Jetzt vervollständigen →'}
      </Link>
    </section>
  )
}
