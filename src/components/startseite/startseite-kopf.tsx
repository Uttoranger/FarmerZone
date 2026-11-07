import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Check, Search } from 'lucide-react'
import { SUCHTEXT_MAX, SUCHTEXT_PARAMETER } from '@/schemas/hoefe-filter'
import {
  KARTE_ADRESSE,
  KARTE_KNOPF,
  KARTE_UEBERSCHRIFT,
  hoefeAdresse,
  SUCHE_BESCHRIFTUNG,
  SUCHE_PLATZHALTER,
  benenneKartenLink,
  type StartseitenKarte,
} from '@/lib/startseite'
import {
  REGIONSKARTE_MASSE,
  REGIONS_NAMEN,
  rundeAufZehntel,
  zeichneLand,
  zeichneMarken,
  type GezeichneteMarke,
  type KartenForm,
} from '@/lib/regionskarte'
import type { StrassenArt } from '@/lib/regionskarte-daten'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { HeroVideo } from '@/components/startseite/hero-video'
import { FOTO_HUELLE } from '@/components/ui/bild-dunkel'

/*
 * Der Kopf der Startseite (Mockups web-k0-startseite, mobil-k0-startseite;
 * die Karte seit Nr. 59 nach web-/mobil-k0-startseite-karte-region):
 * Kornfeld-Video als Hintergrund (mit Pause-Knopf), links Satz und Suche, rechts die Karte der
 * Region. Am Handy endet der Kopf vor der Karte; sie folgt in einem eigenen
 * Abschnitt mit Überschrift auf dem Seitengrund, mit dem Knopf darunter.
 *
 * Alles über dem Foto bleibt in beiden Themes gleich (DESIGN_SYSTEM: „Bild-
 * Overlays bleiben immer dunkel hinterlegt und sind theme-unabhängig") —
 * deshalb weiße Schrift und ein schwarzer Schleier statt Tokens. Nur der
 * Auslauf ganz unten nimmt den Seitengrund, damit der Kopf ohne Kante in die
 * Seite übergeht; er liegt im unteren Innenabstand, nie unter Text.
 */

/** Der Fokus auf dem Foto: weiß, denn das Grün des Fokusrings trägt am Tag auf dem dunklen Bild nicht. */
const FOKUS_AUF_FOTO = cn(FOKUS_RAHMEN, 'focus-visible:outline-white')

/** Der Satz unter der h1, wörtlich nach der Liste Lauf 32 (startseite). */
export const STARTSEITE_UNTERTITEL = 'Eier, Gemüse, Fleisch, Brot – und sogar Heu für die Hasen.'

/** Der Link unter der Regionskarte (Board w1-/s1-startseite). */
export const KARTE_LINK = `${KARTE_KNOPF} →`

const VERSPRECHEN = ['Bar oder online bezahlen', 'Keine Lieferkosten – du holst ab', 'Der Hof bekommt den vollen Preis'] as const

/** Ohne Daten zeichnet die Karte nur das Land — so steht sie auch, solange die Höfe laden. */
const zeichneKarteOhneDaten = (form: KartenForm): ReactNode => <RegionsKarte form={form} karte={null} />

/**
 * `karte` liefert die Karte je Form: Die Seite reicht sie hinter einer
 * Suspense-Grenze herein, damit Kopf und Suche nicht auf die Datenbank warten.
 */
export function StartseiteKopf({ karte = zeichneKarteOhneDaten }: { karte?: (form: KartenForm) => ReactNode }): React.JSX.Element {
  return (
    <>
      {/* bg-black: der Grund unter Foto und Schleier, solange das Bild lädt (und
          für die Kontrastprüfung) — die weiße Schrift steht nie auf dem hellen Seitengrund. */}
      <section aria-labelledby="startseite-titel" className="relative isolate overflow-hidden bg-black">
        {/* Drei Schichten wie bisher: (1) das Standbild — immer da, es ist die
            Darstellung bei „Bewegung reduzieren" und der LCP-Kandidat (priority);
            (2) darüber das Video, rein per CSS eingeblendet; (3) der Schleier. */}
        <Image src="/landing/hero-poster.jpg" alt="" fill priority sizes="100vw" className={cn('-z-10 object-cover', FOTO_HUELLE)} />

        {/* Das Video samt Pause-Knopf (Nr. 176): hero-video.tsx. */}
        <HeroVideo />

        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-tr from-black/65 via-black/30 via-45% to-black/5" />
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-12 bg-linear-to-b from-transparent to-background md:h-20" />

        <div className="mx-auto flex max-w-[1146px] items-center gap-[60px] px-4 pt-8 pb-14 md:px-6 md:pt-[84px] md:pb-24">
          <div className="flex min-w-0 flex-1 flex-col gap-[18px] md:gap-5">
            <p className="text-[12.5px] font-bold tracking-[1.6px] text-white/85 uppercase">Direkt vom Hof in deiner Nähe</p>
            <h1
              id="startseite-titel"
              // Ab 1024 px höchstens zwei Zeilen wie im Board (A1): kleiner und ohne die festen Umbrüche.
              className="font-heading text-[36px] leading-[1.06] font-semibold text-balance text-white md:text-[58px] md:leading-[1.04] lg:text-[36px] lg:leading-[1.1] xl:text-[42px]"
            >
              Frisch vom Hof. <br className="hidden md:inline lg:hidden" />
              Online bestellen, <br className="hidden md:inline lg:hidden" />
              am Hof abholen.
            </h1>
            {/* Wörtlich nach dem Board (Liste Lauf 32, startseite), in jeder Breite derselbe Satz. */}
            <p className="max-w-[600px] text-[15px] leading-normal text-white/85 md:text-[17px]">{STARTSEITE_UNTERTITEL}</p>

            {/* Die Suche schickt den Suchtext `q` — derselbe Weg wie die Suche der
                404 und der KundeShell. /hoefe löst ihn beim Ankommen auf (Nr. 84):
                Eine Postleitzahl, „Postleitzahl Ort" oder ein Ortsname sucht dort
                den Ort, sonst Höfe und Produkte. Das Absenden hier ist der
                Auslöser — die Ortssuche startet nie beim Tippen. Das Formular
                schickt nur `q`: Daran erkennt /hoefe, dass hier abgesendet wurde
                (abgesendeterSuchtext) — kein Feld `t` dazusetzen. Der Standort
                steht nie in der Adresse; der Link darunter führt zu „Standort
                nutzen" auf /hoefe. */}
            <form role="search" action="/hoefe" method="get" className="flex flex-col gap-1.5 md:w-full md:max-w-[560px]">
              {/* Die sichtbare Beschriftung über dem Feld (A1, Board Bild 1) — weiß wie alles auf dem Foto. */}
              <label htmlFor="startseite-suche" className="w-fit text-[14px] font-semibold text-white">
                {SUCHE_BESCHRIFTUNG}
              </label>
              {/* Feld und „Höfe finden“ nebeneinander, auch am Handy (Liste Lauf 32, startseite 390 Bild 1). */}
              <div className="flex flex-row items-center gap-2 rounded-full border border-border bg-card py-1.5 pr-1.5 pl-4 md:gap-2.5 md:py-2 md:pr-2 md:pl-[18px]">
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <Search className="size-[18px] shrink-0 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
                <input
                  id="startseite-suche"
                  type="search"
                  name={SUCHTEXT_PARAMETER}
                  maxLength={SUCHTEXT_MAX}
                  placeholder={SUCHE_PLATZHALTER}
                  className={cn(
                    'h-11 min-w-0 flex-1 rounded-md bg-transparent text-base text-foreground placeholder:text-muted-foreground',
                    FOKUS_RAHMEN
                  )}
                />
              </div>
              <button
                type="submit"
                className={cn(
                  'h-11 shrink-0 rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground transition-opacity duration-[250ms] hover:opacity-90 md:h-[46px] md:px-[18px]',
                  FOKUS_AUF_FOTO
                )}
              >
                Höfe finden
              </button>
              </div>
            </form>

            {/* Unterstrichener Textlink ohne Symbol (Board). Auf dem Video bleibt er weiß: Das Grün der Boards trägt
                auf dem dunklen Bild nicht (A1, das Video bleibt; DESIGN_SYSTEM „Bild-Overlays“). Ohne Höfe entfallen
                Link und Häkchenliste (Board Bild 5) — die Höfe laden hinter Suspense, also entscheidet das CSS. */}
            <Link
              href={hoefeAdresse()}
              className={cn(
                'inline-flex min-h-11 w-fit items-center rounded-md text-[14px] font-medium text-white underline underline-offset-4 [:root:has([data-hoefe-leer])_&]:hidden',
                FOKUS_AUF_FOTO
              )}
            >
              In deiner Nähe suchen – mit Postleitzahl oder Standort
            </Link>

            {/* Einspaltig wie im Board (Liste Lauf 32, startseite 1440). */}
            <ul className="flex flex-col gap-[7px] md:mt-1.5 [:root:has([data-hoefe-leer])_&]:hidden">
              {VERSPRECHEN.map((text) => (
                <li key={text} className="flex items-center gap-[7px] text-[13.5px] text-white/85">
                  <Check className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
                  {text}
                </li>
              ))}
            </ul>
          </div>

          {/* Die Karte rechts (ab 1024 px), darunter „Alle Höfe auf der Karte →“ (Board w1-startseite Bild 1). */}
          <div className="hidden w-[420px] shrink-0 flex-col gap-2 lg:flex xl:w-[520px]">
            {karte('web')}
            <KartenLink aufFoto />
          </div>
        </div>
      </section>

      {/* Am Handy (unter 1024 px) endet der Kopf vor der Karte: Sie steht in
          einem eigenen Abschnitt auf dem Seitengrund, mit Überschrift und dem
          Knopf darunter (Mockup mobil-k0-startseite-karte-region, Abstände von
          dort). Hier gelten die Tokens des Seitengrunds und der normale
          Fokusring — Weiß wie auf dem Foto verschwände im hellen Modus. Breiter
          als 440 px wird die Karte nicht: Am Tablett füllte sie sonst den Schirm.
          Nach unten der Abstand der übrigen Abschnitte; das Mockup zeigt darunter
          nichts mehr. */}
      <section aria-label={KARTE_UEBERSCHRIFT} className="pt-[18px] pb-8 md:pb-12 lg:hidden">
        <div className="mx-auto max-w-[1146px] px-4 md:px-6">
          <div className="flex max-w-[440px] flex-col gap-2">
            {/* Die Karte direkt unter der Häkchenliste, ohne eigene Überschrift und Pille, der Link darunter (Board s1-startseite Bild 1). */}
            {karte('handy')}
            <KartenLink />
          </div>
        </div>
      </section>
    </>
  )
}

/** „Alle Höfe auf der Karte →“ unter der Regionskarte (Board w1-/s1-startseite) — der Weg in die Kartenansicht von /hoefe. */
function KartenLink({ aufFoto = false }: { aufFoto?: boolean }) {
  return (
    <Link
      href={KARTE_ADRESSE}
      className={cn(
        'inline-flex min-h-11 w-fit items-center rounded-md text-[15px] font-semibold underline underline-offset-4',
        aufFoto ? cn('text-white', FOKUS_AUF_FOTO) : cn('text-brand-text', FOKUS_RAHMEN)
      )}
    >
      {KARTE_LINK}
    </Link>
  )
}

/** Strichbreiten wie im Mockup (Einheiten = Pixel bei Entwurfsgröße): Rand und Fläche je Straßenart, Flüsse nach Name. */
const STRASSEN_STRICH: Record<StrassenArt, { rand: number; flaeche: number }> = {
  fernstrasse: { rand: 7, flaeche: 5 },
  hauptstrasse: { rand: 6, flaeche: 4 },
  strasse: { rand: 5, flaeche: 3 },
}
const FLUSS_STRICH: Record<string, number> = { Inn: 7, Salzach: 5 }

/** Ein Hof als kleines Haus (Mockup: 18 × 19 px), hervorgehoben größer; um seinen Punkt zentriert. */
function HausPin({ x, y, gross }: { x: number; y: number; gross: boolean }) {
  const s = gross ? 1.45 : 1
  return (
    <g className="fill-accent stroke-accent-foreground" strokeWidth={1.6} strokeLinejoin="round">
      <path d={`M${rundeAufZehntel(x - 9 * s)} ${rundeAufZehntel(y - 1.9 * s)} L${rundeAufZehntel(x)} ${rundeAufZehntel(y - 9.4 * s)} L${rundeAufZehntel(x + 9 * s)} ${rundeAufZehntel(y - 1.9 * s)} Z`} />
      <rect x={rundeAufZehntel(x - 6.85 * s)} y={rundeAufZehntel(y - 1.9 * s)} width={rundeAufZehntel(13.7 * s)} height={rundeAufZehntel(11.2 * s)} rx={1.5} />
      <rect x={rundeAufZehntel(x - 2 * s)} y={rundeAufZehntel(y + 3.2 * s)} width={rundeAufZehntel(4 * s)} height={rundeAufZehntel(6.1 * s)} className="fill-accent-foreground stroke-none" />
    </g>
  )
}

function Marke({ marke }: { marke: GezeichneteMarke }) {
  return (
    <g>
      {marke.hervorgehoben && <circle cx={rundeAufZehntel(marke.x)} cy={rundeAufZehntel(marke.y)} r={21} className="fill-accent/20" />}
      {marke.art === 'pin' ? (
        <HausPin x={marke.x} y={marke.y} gross={marke.hervorgehoben} />
      ) : (
        <>
          <circle cx={rundeAufZehntel(marke.x)} cy={rundeAufZehntel(marke.y)} r={15} className="fill-accent stroke-accent-foreground" strokeWidth={2.5} />
          <text x={rundeAufZehntel(marke.x)} y={rundeAufZehntel(marke.y + 4.5)} textAnchor="middle" fontSize={13} fontWeight={700} className="fill-accent-foreground font-sans">
            {marke.anzahl}
          </text>
        </>
      )}
    </g>
  )
}

/**
 * Die Karte der Region (Nr. 59, Mockups web-k0-startseite-karte-region und
 * mobil-k0-startseite-karte-region): ein SVG aus Natural-Earth-Daten, auf
 * dem Server gezeichnet — kein Kartendienst, keine Kacheln, kein Skript, kein
 * Bild. Die ganze Fläche ist EIN Link auf die Kartenansicht von /hoefe; das
 * SVG ist für Screenreader verborgen, Zähler und Hofkarte stehen als Text im
 * Link, sein Name nennt die Zahl. Ohne Daten (laden, Fehler) steht nur das
 * Land da, ohne Zähler und Hofkarte; den Fehler zeigen die Hofkarten darunter.
 *
 * Am Tag ist die Karte Papier: Tokens, die im neuen Design in beiden Themes
 * gleich sind — accent-foreground (Crème) für Papier und Flächen,
 * primary-foreground (fast schwarz) für Schrift und Linien, accent (Grün) für
 * Höfe und Wasser; ein Blau kennt das Design-System nicht. Im Dunkeln ist sie
 * gedämpft wie im Board (A1, Lauf 31): Papier und Schilder auf `card`, Straßen
 * leise in `foreground`, Schrift in den Text-Tokens, grüne Schrift in
 * `status-fertig` (das Knopf-Grün trägt auf dunklem Grund nur 3:1) — die Pins
 * bleiben grün. Der Hover der Pille geht über die Deckkraft: accent-hover ist
 * je Theme verschieden. Nur der Fokus folgt dem Grund: weiß auf dem Foto, am
 * Handy der Fokusring.
 */
export function RegionsKarte({ form, karte }: { form: KartenForm; karte: StartseitenKarte | null }): React.JSX.Element {
  const mass = REGIONSKARTE_MASSE[form]
  const anzahl = karte?.pins.length ?? 0
  const hof = karte?.hervorgehoben ?? null
  const marken = zeichneMarken(karte?.pins ?? [], mass, hof?.slug ?? null)
  const land = zeichneLand(mass, marken)

  return (
    <Link
      href={KARTE_ADRESSE}
      aria-label={benenneKartenLink(anzahl)}
      className={cn(
        'group relative block overflow-hidden bg-accent-foreground shadow-2xl dark:bg-card dark:ring-1 dark:ring-border',
        form === 'web' ? 'rounded-[26px]' : 'rounded-[22px]',
        form === 'web' ? FOKUS_AUF_FOTO : FOKUS_RAHMEN
      )}
      style={{ aspectRatio: `${mass.breite} / ${mass.hoehe}` }}
    >
      <svg viewBox={`0 0 ${mass.breite} ${mass.hoehe}`} aria-hidden="true" className="absolute inset-0 block size-full">
        {/* Papier: Crème mit einem Hauch Dunkel, damit die Straßen heller sind als das Land. */}
        <rect width={mass.breite} height={mass.hoehe} className="fill-primary-foreground/6 dark:fill-foreground/4" />
        {land.fluesse.map((fluss) =>
          fluss.pfade.map((d, i) => (
            <path
              key={`${fluss.name}-${i}`}
              d={d}
              fill="none"
              strokeWidth={FLUSS_STRICH[fluss.name] ?? 4}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="stroke-accent/45 dark:stroke-accent/70"
            />
          ))
        )}
        {land.strassen.map((strasse, s) =>
          strasse.pfade.map((d, i) => (
            <g key={`${s}-${i}`} fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d={d} strokeWidth={STRASSEN_STRICH[strasse.art].rand} className="stroke-primary-foreground/20 dark:stroke-background" />
              <path d={d} strokeWidth={STRASSEN_STRICH[strasse.art].flaeche} className="stroke-accent-foreground dark:stroke-foreground/14" />
            </g>
          ))
        )}
        {land.fluesse.map(
          ({ beschriftung: b }) =>
            b && (
              <text
                key={b.text}
                x={rundeAufZehntel(b.x)}
                y={rundeAufZehntel(b.y)}
                transform={`rotate(${rundeAufZehntel(b.winkel)} ${rundeAufZehntel(b.x)} ${rundeAufZehntel(b.y)})`}
                textAnchor="middle"
                fontSize={12}
                strokeWidth={3}
                className="fill-accent stroke-accent-foreground font-heading italic [paint-order:stroke] dark:fill-status-fertig dark:stroke-card"
              >
                {b.text}
              </text>
            )
        )}
        {land.schilder.map((schild) => {
          const breite = 8 + 5.5 * schild.text.length
          return (
            <g key={schild.text}>
              <rect
                x={rundeAufZehntel(schild.x - breite / 2)}
                y={rundeAufZehntel(schild.y - 8)}
                width={rundeAufZehntel(breite)}
                height={16}
                rx={4}
                className="fill-accent-foreground stroke-primary-foreground/25 dark:fill-card dark:stroke-foreground/25"
              />
              <text x={rundeAufZehntel(schild.x)} y={rundeAufZehntel(schild.y + 3.5)} textAnchor="middle" fontSize={10} fontWeight={600} className="fill-primary-foreground/70 font-sans dark:fill-foreground/70">
                {schild.text}
              </text>
            </g>
          )
        })}
        {REGIONS_NAMEN.map((name) => (
          <text
            key={name.text}
            x={rundeAufZehntel(name.x * mass.breite)}
            y={rundeAufZehntel(name.y * mass.hoehe)}
            textAnchor={name.anker}
            fontSize={10}
            fontWeight={600}
            letterSpacing={2}
            className="fill-primary-foreground/65 font-sans dark:fill-foreground/65"
          >
            {name.text}
          </text>
        ))}
        {/* Der hervorgehobene Hof zuletzt: Er liegt über seinen Nachbarn. */}
        {[...marken.filter((m) => !m.hervorgehoben), ...marken.filter((m) => m.hervorgehoben)].map((marke) => (
          <Marke key={marke.schluessel} marke={marke} />
        ))}
      </svg>

      {/* Keine Pille „n Höfe“ und kein „Karte öffnen“ mehr (Liste Lauf 32, startseite): Der Link darunter führt zur Karte. */}
    </Link>
  )
}
