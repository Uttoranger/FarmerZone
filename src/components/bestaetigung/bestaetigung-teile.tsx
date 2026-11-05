import type { ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { formatEuro } from '@/lib/format'
import { bestellSummen, centsAlsEuro, gebuehrEntfallen } from '@/lib/servicegebuehr'
import { gebuehrBezeichnungFuer, gebuehrHinweisFuer } from '@/lib/plattformgebuehr'
import type { BestaetigungsKopf, BestellSchritt } from '@/lib/bestaetigung'
import { ETIKETT, KARTE, KNOPF_BREIT_GRUEN, KNOPF_BREIT_RAHMEN } from '@/components/bestaetigung/bestaetigung-stil'

export { ETIKETT, KARTE, KNOPF_BREIT_GRUEN, KNOPF_BREIT_RAHMEN }

/*
 * Bausteine der Bestätigungsseite /{hof}/confirm/{id} (Nr. 13). Mockups:
 * web-k3-bestaetigung-online-mit-erzaehl-s-weiter, web-k3-bar-wartet-auf-
 * bestaetigung, mobil-k3-bestaetigung. Sie zeigen nur an — was in welchem
 * Zustand erscheint, entscheidet src/lib/bestaetigung.ts. Seit Nr. 54 baut
 * auch die Bestellseite /{hof}/bestellung/{id} aus ihnen (Karte, Positionen,
 * Knöpfe): dieselbe Bestellung sieht an beiden Stellen gleich aus.
 */


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

/**
 * Der Kopf der Seite (Boards s1-/w1-bestaetigung, Nr. 227): links bündig, darüber leise „Bestellung bei <Hof>“
 * als Kicker, dann die Überschrift (das h1 der Seite) und der Satz — ohne Zeichen im Kreis. Je Zustand ein
 * klarer Kopf: Den Wortlaut entscheidet `bestaetigungsKopf` (src/lib/bestaetigung.ts). `ohneSatz`, wo der Satz
 * an anderer Stelle steht (bar offen: in der Karte mit der Frist).
 */
export function BestaetigungKopf({
  kopf,
  kicker,
  ohneSatz = false,
}: {
  kopf: BestaetigungsKopf
  kicker?: string
  ohneSatz?: boolean
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      {kicker && (
        <p className={cn(ETIKETT, 'break-words')} title={kicker}>
          {kicker}
        </p>
      )}
      <h1 className="font-heading text-[26px] leading-tight font-semibold text-balance break-words md:text-[28px]">{kopf.titel}</h1>
      {/* E-Mail-Adressen sind bis 254 Zeichen lang und haben keine Leerzeichen. */}
      {!ohneSatz && <p className="text-[15px] leading-normal [overflow-wrap:anywhere] text-foreground">{kopf.satz}</p>}
    </div>
  )
}

/**
 * Bar offen (Boards s1-/w1-bestaetigung Bild 3; V87): die orange Karte „Bitte bis … bestätigen“ mit der Frist aus
 * `fristVon` (fristen.ts), darunter der Satz an die Kundin und der Termin — und als Kinder der Knopf „Mail nicht
 * bekommen? Erneut senden“. Farben aus dem Paar „tun“ (≥ 4,5:1 in beiden Themes); kein `role="alert"`, denn es ist
 * kein Fehler, sondern der nächste Schritt.
 */
export function FristHinweis({ titel, satz, children }: { titel: string; satz: string; children?: ReactNode }): React.JSX.Element {
  return (
    <section
      aria-label={titel}
      data-frist-hinweis=""
      className="flex flex-col gap-2 rounded-[16px] border border-zustand-tun/30 bg-zustand-tun-grund px-3.5 py-3 text-zustand-tun"
    >
      <p className="text-[15px] font-bold">{titel}</p>
      {/* E-Mail-Adressen sind bis 254 Zeichen lang und haben keine Leerzeichen. */}
      <p className="text-[14px] leading-normal [overflow-wrap:anywhere]">{satz}</p>
      {children}
    </section>
  )
}

/**
 * Abholung und Bestellnummer (Boards s1-/w1-bestaetigung, s1-/w1-bestellung-link; Nr. 227): „ABHOLUNG“, der
 * Termin, Hof und Adresse, die Bestellnummer gestrichelt, darunter „In den Kalender“ und „Route planen“ zu
 * gleichen Teilen. Die Nummer ist NUR Anzeige: Sie steht in keinem Link und öffnet nichts — der Zugang zur
 * Bestellung ist allein der signierte Link (S1). Es gibt keinen eigenen Abholcode (Bericht Nr. 07).
 * `kalenderHaupt`: Auf der Bestellseite ist „In den Kalender“ die eine grüne Hauptaktion, auf der
 * Bestätigung ist es „Bestellung ansehen“ — dort hat der Kalender einen Rand.
 */
export function AbholKarte({
  bestellnummer,
  abholZeit,
  hofName,
  adresse,
  routeHref,
  kalenderHref,
  kalenderHaupt = false,
}: {
  bestellnummer: string
  abholZeit: string
  hofName: string
  adresse: string
  routeHref: string
  kalenderHref: string | null
  kalenderHaupt?: boolean
}): React.JSX.Element {
  return (
    <section aria-labelledby="abholung-titel" className={cn(KARTE, 'flex min-w-0 flex-col gap-1.5')}>
      <h2 id="abholung-titel" className={ETIKETT}>
        Abholung
      </h2>
      <p className="text-[17px] font-semibold break-words">{abholZeit}</p>
      <p className="text-[14px] leading-normal break-words text-muted-foreground">
        {hofName} · {adresse}
      </p>
      <p className="mt-1 self-start rounded-lg border border-dashed border-input px-2.5 py-1 text-[14px] break-words">
        Bestellnummer <b className="font-bold">{bestellnummer}</b>
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {kalenderHref && (
          <a href={kalenderHref} className={cn(kalenderHaupt ? KNOPF_BREIT_GRUEN : KNOPF_BREIT_RAHMEN, 'px-2 text-[15px]')}>
            In den Kalender
          </a>
        )}
        <a
          href={routeHref}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(KNOPF_BREIT_RAHMEN, 'px-2 text-[15px]', !kalenderHref && 'col-span-2')}
        >
          Route planen
        </a>
      </div>
    </section>
  )
}

const SCHRITT_VORGELESEN: Record<BestellSchritt['stand'], string> = {
  erledigt: 'erledigt',
  naechster: 'als Nächstes',
  offen: 'noch offen',
}

/**
 * Die Status-Schritte aus dem Bestellstatus (bestellSchritte), als vier Balken mit dem Wort darunter (Boards
 * s1-/w1-bestaetigung): erledigt grün und fett, offen leise. Was im nächsten Schritt bis wann geschehen muss,
 * steht für den Screenreader dabei — sichtbar sagt es die Karte mit der Frist bzw. die Abholkarte.
 */
export function StatusSchritte({ schritte }: { schritte: readonly BestellSchritt[] }): React.JSX.Element {
  return (
    <section aria-labelledby="stand-ueberschrift">
      <h2 id="stand-ueberschrift" className="sr-only">
        Stand deiner Bestellung
      </h2>
      <ol className="grid grid-cols-4 gap-1.5">
        {schritte.map((s) => (
          <li
            key={s.id}
            data-schritt={s.id}
            data-stand={s.stand}
            aria-current={s.stand === 'naechster' ? 'step' : undefined}
            className="flex min-w-0 flex-col gap-1.5"
          >
            {/* Erledigt in `status-fertig`: hell das Grün, dunkel das helle Mint der Boards (s1-/w1-bestaetigung-dunkel) —
                `accent` läge im Dunkeln kaum über dem Grund (Bewertung Lauf 31). */}
            <span aria-hidden="true" className={cn('h-1.5 rounded-full', s.stand === 'erledigt' ? 'bg-status-fertig' : 'bg-border')} />
            <span className={cn('truncate text-[13px]', s.stand === 'erledigt' ? 'font-bold text-status-fertig' : 'text-muted-foreground')}>
              {s.titel}
              <span className="sr-only">
                : {SCHRITT_VORGELESEN[s.stand]}
                {s.zusatz && `, ${s.zusatz}`}
              </span>
            </span>
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
  titel = 'Deine Bestellung',
}: {
  /** `fehlt`: Der Hof hat die Position als fehlend gemeldet (E14) — sie ist nicht mehr im Betrag. */
  positionen: ReadonlyArray<{ text: string; betragCents: number; fehlt?: boolean }>
  summen: {
    totalAmount: number | string | { toString(): string }
    serviceFeeCents: number
    serviceFeeRefundedAt: Date | string | null
    paymentMethod: string
    /** N38: 'hofpreis' — dann heißt die Zeile „Plattformgebühr“ mit dem Satz aus konditionen.ts. */
    gebuehrModell?: string | null
  }
  zahlung: string
  fuss?: ReactNode
  /** Die kleine Überschrift über der Karte: „Deine Bestellung“ (Bestätigung), „Positionen“ (Bestellseite). */
  titel?: string
}): React.JSX.Element {
  const s = bestellSummen(summen)
  const entfallen = gebuehrEntfallen(summen)
  return (
    // Board: die kleine Überschrift über der Karte, darin die Zeilen, „Gesamt“ und darunter Zahlart und Gebühr leise.
    <section aria-label={titel} className="flex flex-col gap-2">
      <h2 className={ETIKETT}>{titel}</h2>
      <div className={cn(KARTE, 'flex flex-col gap-2')}>
      {/* Boards s1-/w1-bestaetigung (Lauf 31): je Position eine Zeile mit dem Betrag dahinter („2 × Bergkäse, 250 g ·
          € 13,16“), „Gesamt € …“ fett in einer Zeile. Die Gebühr bleibt eine eigene Zeile (E4): Die Zeilen tragen den
          Warenpreis aus dem Snapshot — Endpreise je Zeile wären eine neue Rechnung. */}
      <ul className="flex flex-col gap-1">
        {positionen.map((p, i) => (
          <li key={i} className="text-[15px] break-words">
            {p.text}
            {p.fehlt ? (
              <>
                <span className="text-foreground"> · fehlt leider</span>
                <span className="text-[13px] text-muted-foreground"> · nicht berechnet</span>
              </>
            ) : (
              <>
                {' · '}
                <span className="whitespace-nowrap tabular-nums">{formatEuro(centsAlsEuro(p.betragCents))}</span>
              </>
            )}
          </li>
        ))}
        {s.gebuehrCents > 0 && (
          <li className="text-[15px]">
            {gebuehrBezeichnungFuer(summen)}
            {entfallen && <span className="text-[13px]"> ({summen.paymentMethod === 'ONLINE' ? 'erstattet' : 'entfällt'})</span>}
            {' · '}
            <span className={cn('whitespace-nowrap tabular-nums', entfallen && 'text-muted-foreground line-through')}>
              {formatEuro(centsAlsEuro(s.gebuehrCents))}
            </span>
          </li>
        )}
      </ul>
      <p className="text-[16px] font-bold">
        Gesamt <span className="whitespace-nowrap tabular-nums">{formatEuro(centsAlsEuro(s.gesamtCents))}</span>
      </p>
      <p className="text-[13px] leading-normal text-muted-foreground">{zahlung}</p>
      {s.gebuehrCents > 0 && <p className="text-[12px] leading-normal text-muted-foreground">{gebuehrHinweisFuer(summen)}</p>}
      {fuss}
      </div>
    </section>
  )
}

/**
 * Die eine Hauptaktion unten (Boards s1-/w1-bestaetigung): am Handy eine Leiste, die beim Scrollen unten klebt, mit
 * dem grünen Knopf über die volle Breite und dem leisen Nebenweg darunter; ab 768 px unter einer Linie rechts
 * bündig (Nebenweg, dann Knopf). Sie klebt nur innerhalb der Spalte (`sticky`, nicht `fixed`): Am Ende der Seite
 * gibt sie den Seitenfuß frei, statt ihn zu verdecken. `data-unten-fest`: Der Cookie-Hinweis steht darüber, nie
 * darauf (src/lib/cookie-hinweis.ts).
 */
export function Hauptaktion({ haupt, neben }: { haupt: { href: string; text: string }; neben?: { href: string; text: string } }): React.JSX.Element {
  return (
    <div
      data-unten-fest=""
      // Ab 768 px klebt sie wie im Board w1-bestaetigung ebenfalls unten (Lauf 31): über einer Linie, rechts bündig.
      className="sticky bottom-0 z-30 -mx-4 -mb-12 mt-2 flex flex-col gap-1 border-t border-border bg-card px-4 pt-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:mx-0 md:mb-0 md:flex-row-reverse md:items-center md:justify-start md:gap-4 md:bg-background md:px-0 md:pt-4 md:pb-5 print:hidden"
    >
      <Link href={haupt.href} className={cn(KNOPF_BREIT_GRUEN, 'md:w-auto md:px-5')}>
        {haupt.text}
      </Link>
      {neben && (
        <Link
          href={neben.href}
          className={cn('inline-flex min-h-11 items-center justify-center rounded-full px-3 text-[15px] font-semibold text-foreground hover:bg-muted', FOKUS_RAHMEN)}
        >
          {neben.text}
        </Link>
      )}
    </div>
  )
}

