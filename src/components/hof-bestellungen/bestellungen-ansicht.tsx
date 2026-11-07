import Link from 'next/link'
import { Printer } from 'lucide-react'
import type { BestellungenSeite, HofBestellDetail, HofListenEintrag } from '@/server/queries/orders'
import type { HofWiderruf } from '@/server/widerruf'
import type { HofBestellFilter } from '@/schemas/hof-bestellungen'
import { EmptyState } from '@/components/ui/empty-state'
import { FilterChip, FilterChipReihe } from '@/components/ui/chip'
import { LadeInhalt, LadePunkt, LadeRahmen } from '@/components/ui/lade-punkt'
import { Marke } from '@/components/ui/marke'
import { FOKUS_RAHMEN, FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'
import { RUNDUNG } from '@/components/ui/rundung'
import { WerkzeugKopf } from '@/components/ui/werkzeug-kopf'
import { centsAlsEuro } from '@/lib/servicegebuehr'
import { formatEuro } from '@/lib/format'
import { bestellListeHref } from '@/lib/hof-bestellungen'
import { HEUTE_NIEMAND } from '@/lib/heute'
import { cn } from '@/lib/utils'
import { BestellDetail } from './bestell-detail'
import { KARTE, KICKER, KNOPF_RAHMEN, LEISE } from './stil'

/** `?filter=` nur, wenn es nicht der Standard ist — die Adresse bleibt kurz (bestellListeHref). */
export function filterSuche(filter: HofBestellFilter): string {
  return bestellListeHref(filter).slice('/orders'.length)
}

/**
 * Der Leerzustand „noch nie eine Bestellung“ je Stand (Board s1-bestellungen Bild 3, Liste Lauf 32): Vor der
 * Freischaltung kann der Hof noch nichts teilen — der Weg führt als Textlink zu dem, was noch fehlt (/onboarding);
 * freigeschaltet bleibt der Weg zu Mein Hof, wo geteilt wird.
 */
export const BESTELLUNGEN_LEER = {
  titel: 'Noch keine Bestellungen',
  wartet: {
    satz: 'Sobald dein Hof freigeschaltet ist, kommen hier die Bestellungen an. Dann kannst du deine Hofseite teilen.',
    link: { text: 'Was bis zur Freischaltung noch fehlt →', href: '/onboarding' },
  },
  frei: {
    satz: 'Teile deine Hofseite, damit Kundinnen bei dir bestellen können.',
    link: { text: 'Zu Mein Hof', href: '/farm-page' },
  },
} as const

/** Textlink im Leerzustand: grün, unterstrichen, 44 px (wie „Alle Bestellungen ansehen →“ auf Heute). */
const TEXTLINK = cn('inline-flex min-h-11 items-center text-[15px] font-semibold text-status-fertig underline underline-offset-2', FOKUS_RAHMEN)

/** Die Vorschau einer Bestellung neben der Liste (ab 1024 px): dieselbe Liste mit `?bestellung=<id>`. */
function vorschauHref(filter: HofBestellFilter, bestellungId: string): string {
  const basis = bestellListeHref(filter)
  return `${basis}${basis.includes('?') ? '&' : '?'}bestellung=${encodeURIComponent(bestellungId)}`
}

/**
 * Bestellungen im neuen Design (Gate 5, Nachtlauf Nr. 19; Boards s1-/w1-
 * bestellungen und -bestellung, Lauf 31):
 *
 * - `liste` (/orders): Kopf, Filter und die Liste je Abholfenster (eine Karte
 *   je Fenster, Zeilen durch Linien getrennt). Ab 1024 px steht rechts die
 *   gewählte Bestellung als kompakte Vorschau mit „Ganze Bestellung öffnen →“
 *   (gewählt über `?bestellung=`, sonst die erste); eine Zeile wählt dort die
 *   Vorschau, am Handy öffnet sie die Bestellung.
 * - `detail` (/orders/[orderId]): nur die Bestellung, in jeder Breite als
 *   eigene Seite mit Rückweg (Board w1-bestellung: keine Liste daneben).
 *
 * Zeilen und Filter sind echte Links (DESIGN_SYSTEM „Links und Filter"); was
 * sie zeigen, entscheidet src/lib/hof-bestellungen.ts.
 */
export function BestellungenAnsicht({
  seite,
  filter,
  detail,
  modus,
  widerrufe,
  hofName,
  barFrist = null,
  naechsteAbholung = null,
  wartetAufFreigabe = false,
  geldsatz = null,
}: {
  /** Der Geldsatz nach V1 der gewählten Bestellung (ladeBestellGeldsatz). */
  geldsatz?: string | null
  /** Wartet der Hof auf die Freischaltung? Wählt den Leerzustand ohne Bestellung (BESTELLUNGEN_LEER). */
  wartetAufFreigabe?: boolean
  /** Die Liste — nur `liste` zeigt sie; `detail` braucht sie nicht. */
  seite: BestellungenSeite | null
  /** Ohne Bestellungen steht der Hofname unter der Überschrift (Board s1-bestellungen, Bild 3). */
  hofName: string
  /** „Lukas hat noch nicht bestätigt …“ (bestaetigungOffenSatz, V87) für die gewählte Bestellung. */
  barFrist?: string | null
  /** „Heute abholen" leer: „Nächste Abholung: … · 2 Bestellungen" (naechsteAbholungSatz). */
  naechsteAbholung?: string | null
  filter: HofBestellFilter
  detail: HofBestellDetail | null
  /** Offene Widerrufe der gewählten Bestellung (Nr. 200) — nur die Detailseite lädt sie. */
  widerrufe?: readonly HofWiderruf[]
  /** liste = /orders (Handy: Liste, ab 1024 px mit Vorschau), detail = /orders/[orderId] (die Bestellung allein). */
  modus: 'liste' | 'detail'
}): React.JSX.Element {
  const suche = filterSuche(filter)
  if (modus === 'detail') {
    return (
      <LadeRahmen>
        {/* Inhalt höchstens 896 px plus Rand, linksbündig neben der Seitenleiste — endet bei 1440 px wie im Board w1-bestellung
            bei x ≈ 1200 (Liste Lauf 32, bestellung „max-w 1200“; Nr. 249b). pt-5 trägt die feste Kopfleiste am Handy (G1). */}
        <div className="w-full max-w-[976px] px-4 pt-5 pb-12 md:px-8 md:pt-8 xl:px-10">
          <LadeInhalt>
            {detail && <BestellDetail key={detail.id} bestellung={detail} zurueckSuche={suche} widerrufe={widerrufe} barFrist={barFrist} geldsatz={geldsatz} />}
          </LadeInhalt>
        </div>
      </LadeRahmen>
    )
  }
  const liste: BestellungenSeite = seite ?? { kopfzeile: '', chips: [], gruppen: [], hatBestellungen: false }
  return (
    <LadeRahmen>
      <div className="mx-auto w-full max-w-7xl px-4 pt-5 pb-12 md:px-8 md:pt-8 xl:px-10">
        <div className="flex flex-col gap-4 md:gap-[18px]">
          {/* Seit Nr. 249 der Werkzeug-Kopf (G1) ohne Rückweg — Bestellungen ist eine Seite der Leiste; der
              Freischalt-Balken (G3) steht damit unter dem Kopf statt über der h1 (Liste Lauf 32, bestellungen). */}
          <WerkzeugKopf
            titel="Bestellungen"
            unterzeile={<p className={cn('truncate text-[13.5px] leading-normal md:text-[14.5px]', LEISE)}>{liste.hatBestellungen ? liste.kopfzeile : hofName}</p>}
            aktion={
              liste.hatBestellungen ? (
                <Link
                  href="/orders/today/print"
                  target="_blank"
                  aria-label="Packliste für heute drucken"
                  // Am Handy das freistehende Symbol (Board s1-bestellungen), ab 768 px der Umriss mit Wort.
                  className={cn(KNOPF_RAHMEN, 'size-11 border-transparent px-0 md:w-auto md:border-input md:px-[18px]')}
                >
                  <Printer className="size-5 md:size-4" strokeWidth={1.7} aria-hidden="true" />
                  <span className="hidden md:inline" aria-hidden="true">
                    Packliste drucken
                  </span>
                </Link>
              ) : undefined
            }
          />
          {/* Ohne jede Bestellung keine Filter (Board s1-bestellungen, Bild 3): Es gäbe nichts zu filtern. */}
          {liste.hatBestellungen && (
            <FilterChipReihe beschriftung="Bestellungen filtern">
              {liste.chips.map((chip) => (
                // Sichtbar 44 px hoch, 14 px Schrift und Rand wie in den Boards s1-/w1-bestellungen (Nr. 249b) — nur hier,
                // ui/chip.tsx bleibt bei 36 px.
                <FilterChip key={chip.filter} href={bestellListeHref(chip.filter)} aktiv={chip.filter === filter} ladePunkt className="h-11 px-3.5 text-[14px]">
                  {chip.text}
                </FilterChip>
              ))}
            </FilterChipReihe>
          )}
        </div>

        <LadeInhalt className="mt-4 lg:mt-5 lg:flex lg:items-start lg:gap-5 xl:gap-6">
          <div className="lg:w-[360px] lg:shrink-0 xl:w-[440px] 2xl:w-[520px]">
            <BestellListe seite={liste} filter={filter} gewaehlt={detail?.id ?? null} suche={suche} naechsteAbholung={naechsteAbholung} wartetAufFreigabe={wartetAufFreigabe} />
          </div>
          {detail && (
            <div className="hidden min-w-0 flex-1 lg:block">
              <BestellDetail key={detail.id} ansicht="kompakt" bestellung={detail} zurueckSuche={suche} barFrist={barFrist} geldsatz={geldsatz} />
            </div>
          )}
        </LadeInhalt>
      </div>
    </LadeRahmen>
  )
}

function BestellListe({
  seite,
  filter,
  gewaehlt,
  suche,
  naechsteAbholung,
  wartetAufFreigabe,
}: {
  seite: BestellungenSeite
  filter: HofBestellFilter
  naechsteAbholung: string | null
  wartetAufFreigabe: boolean
  /** Die Bestellung in der Vorschau (nur ab 1024 px sichtbar) — am Handy ist nichts gewählt. */
  gewaehlt: string | null
  suche: string
}): React.JSX.Element {
  if (seite.gruppen.length === 0) return <LeereListe seite={seite} filter={filter} naechsteAbholung={naechsteAbholung} wartetAufFreigabe={wartetAufFreigabe} />
  return (
    <div className="flex flex-col gap-5">
      {seite.gruppen.map((gruppe) => (
        <section key={gruppe.schluessel} aria-label={gruppe.titel}>
          <h2 className={cn(KICKER, 'mb-2')}>{gruppe.titel}</h2>
          {/* Eine Karte je Abholfenster, die Zeilen durch Linien getrennt (Boards s1-/w1-bestellungen). */}
          <ul className={cn(KARTE, 'overflow-hidden', RUNDUNG.karte)}>
            {gruppe.bestellungen.map((b) => (
              <li key={b.id} className="border-t border-border first:border-t-0">
                <ListenZeile eintrag={b} href={`/orders/${b.id}${suche}`} auswahlHref={vorschauHref(filter, b.id)} gewaehlt={b.id === gewaehlt} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/**
 * Eine Zeile der Liste (Board s1-bestellungen): links Kundin, Positionen und Zahlart
 * untereinander, rechts Betrag (was die Kundin zahlt) und die Marke als Schild.
 * Die Bestellnummer steht in der Bestellung selbst. Zwei Ziele aus derselben Zeile:
 * am Handy die Bestellung, ab 1024 px die Vorschau daneben (gewählt grün getönt).
 */
function ListenZeile({
  eintrag,
  href,
  auswahlHref,
  gewaehlt,
}: {
  eintrag: HofListenEintrag
  href: string
  auswahlHref: string
  gewaehlt: boolean
}): React.JSX.Element {
  const inhalt = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{eintrag.kunde}</span>
        <span className={cn('mt-0.5 block truncate text-[13px]', LEISE)}>{eintrag.positionen || 'Alle Artikel fehlen'}</span>
        <span className={cn('block truncate text-[13px]', LEISE)}>{eintrag.zahlart}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="text-[15px] font-semibold tabular-nums">{formatEuro(centsAlsEuro(eintrag.gesamtCents))}</span>
        <Marke art={eintrag.marke.art} form="schild">
          {eintrag.marke.text}
        </Marke>
      </span>
    </>
  )
  const zeile = 'relative min-h-[72px] items-center gap-3 px-3.5 py-3 transition-colors duration-[250ms] hover:bg-muted md:px-4'
  return (
    <>
      <Link href={href} title={eintrag.kunde} className={cn('flex lg:hidden', zeile, FOKUS_RAHMEN_INNEN)}>
        {inhalt}
        {/* Ohne Skelett auf /orders/[orderId] ist dieser Punkt die Rückmeldung, bis die Bestellung da ist (Nr. 127). */}
        <LadePunkt />
      </Link>
      <Link
        href={auswahlHref}
        title={eintrag.kunde}
        aria-current={gewaehlt ? 'true' : undefined}
        scroll={false}
        // Gewählt grün getönt (Paar „läuft“: der leise Text hält darauf 4,5:1 in beiden Themes).
        className={cn('hidden lg:flex', zeile, gewaehlt && 'bg-zustand-laeuft-grund hover:bg-zustand-laeuft-grund', FOKUS_RAHMEN_INNEN)}
      >
        {inhalt}
        <LadePunkt />
      </Link>
    </>
  )
}

function LeereListe({
  seite,
  filter,
  naechsteAbholung,
  wartetAufFreigabe,
}: {
  seite: BestellungenSeite
  filter: HofBestellFilter
  naechsteAbholung: string | null
  wartetAufFreigabe: boolean
}): React.JSX.Element {
  if (!seite.hatBestellungen) {
    const stand = wartetAufFreigabe ? BESTELLUNGEN_LEER.wartet : BESTELLUNGEN_LEER.frei
    return (
      <EmptyState
        titel={BESTELLUNGEN_LEER.titel}
        satz={stand.satz}
        ausweg={
          <Link href={stand.link.href} className={wartetAufFreigabe ? TEXTLINK : KNOPF_RAHMEN}>
            {stand.link.text}
          </Link>
        }
      />
    )
  }
  if (filter === 'offen') {
    return (
      <EmptyState
        titel="Alles erledigt"
        satz="Gerade wartet keine Bestellung auf dich."
        ausweg={
          <Link href={bestellListeHref('erledigt')} className={KNOPF_RAHMEN}>
            Erledigte ansehen
          </Link>
        }
      />
    )
  }
  // „Heute abholen" oder „Erledigt" leer: Der Ausweg führt zu allem, was noch offen ist.
  const ausweg = (
    <Link href={bestellListeHref('offen')} className={KNOPF_RAHMEN}>
      Noch offene ansehen
    </Link>
  )
  if (filter === 'heute' && naechsteAbholung) {
    // Board s1-bestellungen, Bild 2: dieselbe Karte wie die leere Packliste auf Heute — nichts zu tun, kein Knopf.
    return (
      <div className={cn(KARTE, 'flex flex-col gap-1 px-4 py-3.5 md:px-[18px]')}>
        <p className="text-[15px] font-semibold">{HEUTE_NIEMAND}</p>
        <p className={cn('text-[13.5px]', LEISE)}>{naechsteAbholung}</p>
      </div>
    )
  }
  if (filter === 'heute') {
    return <EmptyState titel={HEUTE_NIEMAND} satz="Alles, was noch abgeholt wird, steht unter „Noch offen“." ausweg={ausweg} />
  }
  return <EmptyState titel="Noch nichts erledigt" satz="Abgeholte, stornierte und nicht abgeholte Bestellungen stehen dann hier." ausweg={ausweg} />
}
