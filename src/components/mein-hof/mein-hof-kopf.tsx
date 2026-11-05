import Link from 'next/link'
import type { MeinHofReiterAlleId } from '@/lib/bauern-navigation'
import { PRODUKTE_HREF } from '@/lib/bauern-navigation'
import { datumLang } from '@/lib/heute'
import { MEIN_HOF_KOPF_TEXT, kopfSchild, schildTon, zustandsZeile, type ZustandsKnopfArt, type ZustandsZeile } from '@/lib/mein-hof'
import { ABHOLZEITEN_FEHLEN } from '@/lib/pickup-slot-rules'
import type { MeinHofKopfDaten } from '@/server/queries/farm'
import type { MeinHofZustand } from '@/server/mein-hof-zustand'
import { HofTeilenKnopf } from '@/components/farmer/hof-teilen-knopf'
import { KundenansichtKnopf } from '@/components/mein-hof/kundenansicht-knopf'
import { MeinHofReiterLeiste } from '@/components/mein-hof/reiter-leiste'
import { PausierenBlatt } from '@/components/mein-hof/pausieren-blatt'
import { KNOPF_ORANGE } from '@/components/hof-bestellungen/stil'
import { StatusBadge } from '@/components/ui/status-badge'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'

/*
 * Der Kopf von Mein Hof am Handy — EIN Baustein für Produkte, Hofseite und
 * Beiträge (Nachtlauf Nr. 143, Register N3, Ergänzung 22.10.2026): auf
 * /farm-page unter lg (in seitenkopf.tsx), auf /products unter md. Oben die
 * Titelzeile nach Board s1-mein-hof (Register N3, Ergänzung 5.11.2026: „Mein
 * Hof“ mit Schild statt des Titelbild-Streifens), darunter Hofname und Stand,
 * rechts Teilen (nur öffentlich) und Kundenansicht als Symbole; darunter die
 * Zustandszeile mit dem nächsten Schritt, darunter die Reiter. Beide Seiten
 * stecken ihn in dieselbe Hülle (MEIN_HOF_KOPF_HUELLE) — so stehen die Reiter
 * auf allen drei Reitern an derselben Stelle. Ab lg bleibt die kompakte Zeile in
 * seitenkopf.tsx. Das Titelbild selbst bearbeitet der Hof weiter in der Liste
 * „Bearbeiten“ (Zeile „Titelbild“).
 *
 * Adresse und „Kopieren“ stehen hier nicht: Den Link gibt „Teilen“ über das
 * Teilen-Menü des Geräts weiter, sonst wird er kopiert (teileHof). Das Postfach
 * des Boards in dieser Zeile gehört der HofShell (eigene Nummer).
 */

/** Die Hülle um den Kopf — dieselbe auf /farm-page und /products (tests/mein-hof-kopf.test.ts). */
export const MEIN_HOF_KOPF_HUELLE = 'mx-auto max-w-3xl px-4 pt-5 md:px-8 md:pt-7 lg:max-w-none'

/** Teilen und Kundenansicht als Symbol, 44 px — wie im Board; das Wort trägt der Screenreader. */
const SYMBOL_KNOPF = cn(
  'inline-flex size-11 shrink-0 items-center justify-center rounded-full text-foreground transition-colors duration-[250ms] hover:bg-muted',
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
  jetzt,
}: {
  hof: MeinHofKopfDaten
  /** Aus ladeMeinHofZustand; null ohne Daten — dann steht keine Zustandszeile da. */
  zustand: MeinHofZustand | null
  aktiv: MeinHofReiterAlleId
  /** Der Zeitpunkt der Seite — für „Stand …“ (Wiener Datum, wie auf Heute). */
  jetzt: Date
}): React.JSX.Element {
  const zeile = zustand ? zustandsZeile(zustand) : null
  const schild = kopfSchild(hof.zustand)

  return (
    <div className="flex flex-col gap-2.5" data-mein-hof-kopf="">
      <div className="flex min-h-14 items-center gap-0.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {/* Kein h1: Die Überschrift der Seite (sr-only) steht darunter im Reiter. */}
            <p className="font-heading text-[22px] leading-tight font-semibold text-foreground">{MEIN_HOF_KOPF_TEXT.titel}</p>
            {schild && <StatusBadge status={schildTon(schild.farbe)}>{schild.text}</StatusBadge>}
          </div>
          {/* Nie gekürzt: Ein langer Hofname bricht um, das Datum bleibt lesbar. */}
          <p className="mt-0.5 text-[13px] leading-snug break-words text-muted-foreground">
            {MEIN_HOF_KOPF_TEXT.unterzeile(hof.name, datumLang(jetzt))}
          </p>
        </div>
        {hof.zustand.oeffentlich && <HofTeilenKnopf name={hof.name} slug={hof.slug} label="Teilen" nurSymbol className={SYMBOL_KNOPF} />}
        <KundenansichtKnopf slug={hof.slug} nurSymbol className={SYMBOL_KNOPF} />
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
