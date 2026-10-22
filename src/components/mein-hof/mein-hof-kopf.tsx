import Image from 'next/image'
import Link from 'next/link'
import type { MeinHofReiterAlleId } from '@/lib/bauern-navigation'
import { PRODUKTE_HREF } from '@/lib/bauern-navigation'
import { titelbildVerlauf, zustandsZeile, type ZustandsKnopfArt, type ZustandsZeile } from '@/lib/mein-hof'
import { ABHOLZEITEN_FEHLEN } from '@/lib/pickup-slot-rules'
import type { MeinHofKopfDaten } from '@/server/queries/farm'
import type { MeinHofZustand } from '@/server/mein-hof-zustand'
import { HofTeilenKnopf } from '@/components/farmer/hof-teilen-knopf'
import { Hofbild } from '@/components/mein-hof/seitenkopf'
import { KundenansichtKnopf } from '@/components/mein-hof/kundenansicht-knopf'
import { MeinHofReiterLeiste } from '@/components/mein-hof/reiter-leiste'
import { PausierenBlatt } from '@/components/mein-hof/pausieren-blatt'
import { KNOPF_ORANGE } from '@/components/hof-bestellungen/stil'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'

/*
 * Der Kopf von Mein Hof am Handy — EIN Baustein für Produkte, Hofseite und
 * Beiträge (Nachtlauf Nr. 143, Register N3, Ergänzung 22.10.2026; Board
 * system-h1-mein-hof-v3): auf /farm-page unter lg (in seitenkopf.tsx), auf
 * /products unter md. Oben das Titelbild als 76 px hoher Streifen mit Logo,
 * Name, Teilen (nur öffentlich) und Kundenansicht, darunter die Zustandszeile
 * mit dem nächsten Schritt, darunter die Reiter. Beide Seiten stecken ihn in
 * dieselbe Hülle (MEIN_HOF_KOPF_HUELLE) — so stehen die Reiter auf allen drei
 * Reitern an derselben Stelle. Ab lg bleibt die kompakte Zeile in seitenkopf.tsx.
 *
 * Adresse und „Kopieren“ stehen hier nicht mehr: Den Link gibt „Teilen“ über das
 * Teilen-Menü des Geräts weiter, sonst wird er kopiert (teileHof).
 */

/** Die Hülle um den Kopf — dieselbe auf /farm-page und /products (tests/mein-hof-kopf.test.ts). */
export const MEIN_HOF_KOPF_HUELLE = 'mx-auto max-w-3xl px-4 pt-5 md:px-8 md:pt-7 lg:max-w-none'

/*
 * Der Schleier über dem Titelbild: das theme-feste Dunkel (`primary-foreground` ist im
 * neuen Design in beiden Themes dasselbe dunkle Braun) mit Deckkraft, nach links
 * dunkler. Schrift und Knöpfe darauf in `accent-foreground` (theme-festes Hell).
 * Gerechnet gegen ein weißes Foto (schlimmster Fall): Name bis 55 % der Breite
 * mindestens 7,3:1, Knöpfe auf ihrer eigenen Fläche (60 % über 40 %) mindestens
 * 7,6:1 (Bericht 143).
 */
const SCHLEIER = 'bg-linear-to-r from-primary-foreground/90 via-primary-foreground/75 via-55% to-primary-foreground/40'
const STREIFEN_KNOPF = cn(
  'inline-flex h-11 shrink-0 items-center justify-center rounded-full border border-accent-foreground/25 bg-primary-foreground/60 text-accent-foreground transition-colors duration-[250ms] hover:bg-primary-foreground/80',
  FOKUS_RAHMEN
)

const TON_RAHMEN: Record<ZustandsZeile['ton'], string> = {
  gruen: 'border-border',
  orange: 'border-primary/45',
  grau: 'border-border',
}
const TON_PUNKT: Record<ZustandsZeile['ton'], string> = {
  gruen: 'bg-status-fertig ring-status-fertig/15',
  orange: 'bg-status-offen ring-status-offen/15',
  grau: 'bg-muted-foreground ring-muted-foreground/15',
}

/** Wohin „Eintragen“, „Abholzeiten“ und „Produkte“ führen — die Adressen aus ihren Quellen, keine zweite. */
const KNOPF_ZIEL: Record<Exclude<ZustandsKnopfArt, 'pausieren' | 'fortsetzen'>, string> = {
  eintragen: ABHOLZEITEN_FEHLEN.aktion.href,
  abholzeiten: ABHOLZEITEN_FEHLEN.aktion.href,
  produkte: PRODUKTE_HREF,
}

function ZustandsKnopf({ knopf, hof, zustand }: { knopf: NonNullable<ZustandsZeile['knopf']>; hof: MeinHofKopfDaten; zustand: MeinHofZustand }) {
  if (knopf.art === 'pausieren' || knopf.art === 'fortsetzen') {
    return <PausierenBlatt pausiert={knopf.art === 'fortsetzen'} text={knopf.text} hofName={hof.name} gespeicherteNachricht={zustand.pauseMessage} />
  }
  return (
    <Link href={KNOPF_ZIEL[knopf.art]} className={KNOPF_ORANGE}>
      {knopf.text}
    </Link>
  )
}

export function MeinHofKopf({
  hof,
  zustand,
  aktiv,
}: {
  hof: MeinHofKopfDaten
  /** Aus ladeMeinHofZustand; null ohne Daten — dann steht keine Zustandszeile da. */
  zustand: MeinHofZustand | null
  aktiv: MeinHofReiterAlleId
}): React.JSX.Element {
  const zeile = zustand ? zustandsZeile(zustand) : null

  return (
    <div className="flex flex-col gap-2.5" data-mein-hof-kopf="">
      <div className="relative h-[76px] shrink-0 overflow-hidden rounded-2xl">
        {/* Bildersatz, folgt dem Modus bewusst nicht; mittig ausgeschnitten. */}
        {hof.titelbildUrl ? (
          <Image src={hof.titelbildUrl} alt="" fill sizes="(min-width: 768px) 720px, 100vw" className="object-cover object-center" />
        ) : (
          <div className="absolute inset-0" style={{ background: titelbildVerlauf(hof.bannerValue) }} />
        )}
        <div aria-hidden="true" className={cn('absolute inset-0', SCHLEIER)} />
        <div className="absolute inset-0 flex items-center gap-2.5 pr-2.5 pl-3">
          <Hofbild hof={hof} klasse="size-11 text-sm ring-2 ring-primary-foreground/55" />
          {/* Kein h1: Die Überschrift gehört der Seite darunter. */}
          <p className="line-clamp-2 min-w-0 flex-1 font-heading text-lg leading-tight font-semibold break-words text-accent-foreground" title={hof.name}>
            {hof.name}
          </p>
          {hof.zustand.oeffentlich && <HofTeilenKnopf name={hof.name} slug={hof.slug} label="Teilen" nurSymbol className={cn(STREIFEN_KNOPF, 'w-11')} />}
          <KundenansichtKnopf slug={hof.slug} className={cn(STREIFEN_KNOPF, 'gap-1.5 px-3 text-[13px] font-semibold whitespace-nowrap')} />
        </div>
      </div>

      {zeile && (
        <div className={cn('flex min-h-[70px] items-center gap-3 rounded-[14px] border bg-card py-2 pr-2 pl-3.5', TON_RAHMEN[zeile.ton])}>
          {/* Der Punkt ist Schmuck — die Bedeutung sagt der Titel. */}
          <span aria-hidden="true" className={cn('size-[9px] shrink-0 rounded-full ring-4', TON_PUNKT[zeile.ton])} />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] leading-5 font-semibold text-foreground">{zeile.titel}</p>
            {/* Nie gekürzt: Der Satz bricht um, die Zeile hat Platz für zwei Satzzeilen. */}
            <p className="text-[12.5px] leading-[1.35] text-muted-foreground">{zeile.satz}</p>
          </div>
          {zeile.knopf && zustand && <ZustandsKnopf knopf={zeile.knopf} hof={hof} zustand={zustand} />}
        </div>
      )}

      {/* Auf /products gibt es die Reiter nur unter md (N3); ab md ist Produkte ein Punkt der Seitenleiste. */}
      <MeinHofReiterLeiste aktiv={aktiv} nurUnterMd={aktiv === 'produkte'} className="mt-1" />
    </div>
  )
}
