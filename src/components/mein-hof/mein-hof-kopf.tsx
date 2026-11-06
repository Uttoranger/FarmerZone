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
 * Reiter (gleich breit), darunter die Zustandskarte mit dem nächsten Schritt
 * (Lauf 31, Nr. 238: Reihenfolge wie im Board, die Karte getönt). Beide Seiten
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

/*
 * Die Karte ist getönt wie im Board (s1-/w1-mein-hof): grün, wenn der Hof Bestellungen annimmt,
 * orange, wenn etwas zu tun ist — Fläche 12 %, Rand 45 % wie die Hinweiskarte; grau bleibt
 * ruhig auf der Kartenfläche. Kein Punkt mehr davor: Die Bedeutung trägt der Titel.
 */
const TON_KARTE: Record<ZustandsZeile['ton'], string> = {
  gruen: 'border-accent/45 bg-accent/12',
  orange: 'border-primary/45 bg-primary/12',
  grau: 'border-border bg-card',
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

/**
 * Die Zustandskarte mit dem nächsten Schritt — EINE für den Kopf am Handy (hier) und den Kopf
 * ab lg (seitenkopf.tsx). Steht unter den Reitern (Boards s1-/w1-mein-hof), nie auf Beiträge.
 */
export function MeinHofZustandsKarte({
  hof,
  zustand,
  className,
}: {
  hof: MeinHofKopfDaten
  /** Aus ladeMeinHofZustand; null ohne Daten — dann steht keine Karte da. */
  zustand: MeinHofZustand | null
  className?: string
}): React.JSX.Element | null {
  const zeile = zustand ? zustandsZeile(zustand) : null
  if (!zeile || !zustand) return null
  return (
    <div className={cn('flex min-h-[70px] items-center gap-3 rounded-[14px] border py-2 pr-2 pl-3.5', TON_KARTE[zeile.ton], className)} data-zustands-karte="">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] leading-5 font-semibold text-foreground">{zeile.titel}</p>
        {/* Nie gekürzt: Der Satz bricht um, die Karte hat Platz für zwei Satzzeilen. */}
        {/* Auf der getönten Fläche in der Textfarbe (Kontrast wie die Hinweiskarte), auf Grau leise. */}
        <p className={cn('text-[13px] leading-[1.35]', zeile.ton === 'grau' ? 'text-muted-foreground' : 'text-foreground')}>{zeile.satz}</p>
      </div>
      {zeile.knopf && <ZustandsKnopf knopf={zeile.knopf} hof={hof} zustand={zustand} />}
    </div>
  )
}

export function MeinHofKopf({
  hof,
  zustand,
  aktiv,
  jetzt,
  titelAlsH1 = false,
}: {
  hof: MeinHofKopfDaten
  /** Aus ladeMeinHofZustand; null ohne Daten — dann steht keine Zustandskarte da. */
  zustand: MeinHofZustand | null
  aktiv: MeinHofReiterAlleId
  /** Der Zeitpunkt der Seite — für „Stand …“ (Wiener Datum, wie auf Heute). */
  jetzt: Date
  /**
   * Auf /farm-page ist „Mein Hof“ die sichtbare Überschrift der Seite (eine h1 je Seite, Lauf 31);
   * auf /products trägt die Seite ihre eigene h1, dort bleibt der Titel ein Absatz.
   */
  titelAlsH1?: boolean
}): React.JSX.Element {
  const schild = kopfSchild(hof.zustand)
  const Titel = titelAlsH1 ? 'h1' : 'p'

  return (
    <div className="flex flex-col gap-2.5" data-mein-hof-kopf="">
      <div className="flex min-h-14 items-center gap-0.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Titel className="font-heading text-[22px] leading-tight font-semibold text-foreground">{MEIN_HOF_KOPF_TEXT.titel}</Titel>
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

      {/* Auf /products gibt es die Reiter nur unter md (N3); ab md ist Produkte ein Punkt der Seitenleiste. */}
      <MeinHofReiterLeiste aktiv={aktiv} nurUnterMd={aktiv === 'produkte'} gleichBreit />

      {/* Unter den Reitern wie im Board; auf Beiträge zeigt das Board keine Karte. */}
      {aktiv !== 'beitraege' && <MeinHofZustandsKarte hof={hof} zustand={zustand} className="mt-1.5" />}
    </div>
  )
}
