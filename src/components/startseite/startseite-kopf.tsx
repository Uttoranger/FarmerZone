import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Check, House, LocateFixed, Map as MapIcon, Search, Sprout } from 'lucide-react'
import { SUCHTEXT_MAX, SUCHTEXT_PARAMETER } from '@/schemas/hoefe-filter'
import {
  KARTE_ADRESSE,
  KARTE_KNOPF,
  KARTE_OEFFNEN,
  KARTE_UEBERSCHRIFT,
  hoefeAdresse,
  benenneKartenLink,
  formatiereRegionsZaehler,
  type StartseitenKarte,
} from '@/lib/startseite'
import {
  HOFKARTE_ANTEIL,
  REGIONSKARTE_MASSE,
  REGIONS_NAMEN,
  platziereHofkarte,
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
        <Image src="/landing/hero-poster.jpg" alt="" fill priority sizes="100vw" className="-z-10 object-cover" />

        {/* Das Video samt Pause-Knopf (Nr. 176): hero-video.tsx. */}
        <HeroVideo />

        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-tr from-black/65 via-black/30 via-45% to-black/5" />
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-12 bg-linear-to-b from-transparent to-background md:h-20" />

        <div className="mx-auto flex max-w-[1200px] items-center gap-[60px] px-4 pt-8 pb-14 md:px-6 md:pt-[84px] md:pb-24">
          <div className="flex min-w-0 flex-1 flex-col gap-[18px] md:gap-5">
            <p className="text-[12.5px] font-bold tracking-[1.6px] text-white/85 uppercase">Direkt vom Hof in deiner Nähe</p>
            <h1
              id="startseite-titel"
              className="font-heading text-[36px] leading-[1.06] font-semibold text-balance text-white md:text-[58px] md:leading-[1.04]"
            >
              Frisch vom Hof. <br className="hidden md:inline" />
              Online bestellen, <br className="hidden md:inline" />
              am Hof abholen.
            </h1>
            <p className="max-w-[600px] text-[15px] leading-normal text-white/85 md:text-[17px]">
              <span className="md:hidden">Eier, Gemüse, Brot – und Heu für die Hasen. Von Höfen aus deiner Gegend.</span>
              <span className="hidden md:inline">
                Eier, Gemüse, Fleisch, Brot – und sogar Heu für die Hasen. Von Bäuerinnen und Bauern aus deiner Gegend,
                ohne Umweg über den Supermarkt.
              </span>
            </p>

            {/* Die Suche schickt den Suchtext `q` — derselbe Weg wie die Suche der
                404 und der KundeShell. /hoefe löst ihn beim Ankommen auf (Nr. 84):
                Eine Postleitzahl, „Postleitzahl Ort" oder ein Ortsname sucht dort
                den Ort, sonst Höfe und Produkte. Das Absenden hier ist der
                Auslöser — die Ortssuche startet nie beim Tippen. Das Formular
                schickt nur `q`: Daran erkennt /hoefe, dass hier abgesendet wurde
                (abgesendeterSuchtext) — kein Feld `t` dazusetzen. Der Standort
                steht nie in der Adresse; der Link darunter führt zu „Standort
                nutzen" auf /hoefe. */}
            <form
              role="search"
              action="/hoefe"
              method="get"
              className="flex flex-col gap-3 md:w-full md:max-w-[560px] md:flex-row md:items-center md:gap-2.5 md:rounded-full md:border md:border-border md:bg-card md:py-2 md:pr-2 md:pl-[18px]"
            >
              <label className="flex h-[50px] min-w-0 items-center gap-2.5 rounded-full border border-border bg-card px-4 md:h-auto md:flex-1 md:border-0 md:bg-transparent md:px-0">
                <Search className="size-[18px] shrink-0 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
                <span className="sr-only">Hof oder Produkt suchen</span>
                <input
                  type="search"
                  name={SUCHTEXT_PARAMETER}
                  maxLength={SUCHTEXT_MAX}
                  placeholder="Hof oder Produkt, z. B. Eier oder Heu"
                  className={cn(
                    'h-11 min-w-0 flex-1 rounded-md bg-transparent text-base text-foreground placeholder:text-muted-foreground',
                    FOKUS_RAHMEN
                  )}
                />
              </label>
              <button
                type="submit"
                className={cn(
                  'h-[50px] shrink-0 rounded-[14px] bg-accent px-[18px] text-sm font-semibold text-accent-foreground transition-opacity duration-[250ms] hover:opacity-90 md:h-[46px] md:rounded-full',
                  FOKUS_AUF_FOTO
                )}
              >
                Höfe finden
              </button>
            </form>

            <Link
              href={hoefeAdresse()}
              className={cn(
                'inline-flex min-h-11 w-fit items-center gap-1.5 rounded-md text-[13.5px] font-semibold text-white underline-offset-4 hover:underline',
                FOKUS_AUF_FOTO
              )}
            >
              <LocateFixed className="size-4" strokeWidth={1.7} aria-hidden="true" />
              In deiner Nähe suchen – mit Postleitzahl oder Standort
            </Link>

            <ul className="flex flex-col gap-[7px] md:mt-1.5 md:flex-row md:flex-wrap md:gap-[22px]">
              {VERSPRECHEN.map((text) => (
                <li key={text} className="flex items-center gap-[7px] text-[13.5px] text-white/85">
                  <Check className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
                  {text}
                </li>
              ))}
            </ul>
          </div>

          {/* Die Karte rechts (ab 1024 px), so breit wie bisher. */}
          <div className="hidden w-[420px] shrink-0 lg:block xl:w-[520px]">{karte('web')}</div>
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
      <section aria-labelledby="region-titel" className="pt-[18px] pb-[52px] md:pb-[72px] lg:hidden">
        <div className="mx-auto max-w-[1200px] px-4 md:px-6">
          <div className="flex max-w-[440px] flex-col gap-2.5">
            <h2 id="region-titel" className="font-heading text-xl font-semibold text-foreground">
              {KARTE_UEBERSCHRIFT}
            </h2>
            {karte('handy')}
            <Link
              href={KARTE_ADRESSE}
              className={cn(
                'mt-[22px] flex h-12 items-center justify-center gap-2 rounded-[14px] bg-accent px-4 text-[15px] font-semibold text-accent-foreground transition-opacity duration-[250ms] hover:opacity-90',
                FOKUS_RAHMEN
              )}
            >
              <MapIcon className="size-[17px] shrink-0" strokeWidth={1.7} aria-hidden="true" />
              {KARTE_KNOPF}
            </Link>
          </div>
        </div>
      </section>
    </>
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
 * Die Karte folgt dem Modus bewusst NICHT: Sie ist Papier wie die Kacheln der
 * Hofübersicht (CODING_STANDARDS §7, „Was dem Modus NICHT folgt") und bleibt
 * hell wie im dunklen Mockup — im Browser auf dem Foto, am Handy auf dem
 * Seitengrund. Deshalb nur Tokens, die im neuen Design in beiden Themes gleich
 * sind: accent-foreground (Crème) für Papier und Flächen, primary-foreground
 * (fast schwarz) für Schrift und Linien, accent (Grün) für Höfe und Wasser —
 * ein Blau kennt das Design-System nicht. Auch der Hover der Pille geht über
 * die Deckkraft: accent-hover ist je Theme verschieden. Nur der Fokus folgt
 * dem Grund: weiß auf dem Foto, am Handy der Fokusring.
 */
export function RegionsKarte({ form, karte }: { form: KartenForm; karte: StartseitenKarte | null }): React.JSX.Element {
  const mass = REGIONSKARTE_MASSE[form]
  const anzahl = karte?.pins.length ?? 0
  const hof = karte?.hervorgehoben ?? null
  const marken = zeichneMarken(karte?.pins ?? [], mass, hof?.slug ?? null)
  const land = zeichneLand(mass, marken)
  const markeDesHofs = marken.find((m) => m.hervorgehoben)
  const lage = hof && markeDesHofs ? platziereHofkarte(markeDesHofs, mass, HOFKARTE_ANTEIL[form]) : null

  return (
    <Link
      href={KARTE_ADRESSE}
      aria-label={benenneKartenLink(anzahl)}
      className={cn(
        'group relative block overflow-hidden bg-accent-foreground shadow-2xl',
        form === 'web' ? 'rounded-[26px]' : 'rounded-[22px]',
        form === 'web' ? FOKUS_AUF_FOTO : FOKUS_RAHMEN
      )}
      style={{ aspectRatio: `${mass.breite} / ${mass.hoehe}` }}
    >
      <svg viewBox={`0 0 ${mass.breite} ${mass.hoehe}`} aria-hidden="true" className="absolute inset-0 block size-full">
        {/* Papier: Crème mit einem Hauch Dunkel, damit die Straßen heller sind als das Land. */}
        <rect width={mass.breite} height={mass.hoehe} className="fill-primary-foreground/6" />
        {land.fluesse.map((fluss) =>
          fluss.pfade.map((d, i) => (
            <path
              key={`${fluss.name}-${i}`}
              d={d}
              fill="none"
              strokeWidth={FLUSS_STRICH[fluss.name] ?? 4}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="stroke-accent/45"
            />
          ))
        )}
        {land.strassen.map((strasse, s) =>
          strasse.pfade.map((d, i) => (
            <g key={`${s}-${i}`} fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d={d} strokeWidth={STRASSEN_STRICH[strasse.art].rand} className="stroke-primary-foreground/20" />
              <path d={d} strokeWidth={STRASSEN_STRICH[strasse.art].flaeche} className="stroke-accent-foreground" />
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
                className="fill-accent stroke-accent-foreground font-heading italic [paint-order:stroke]"
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
                className="fill-accent-foreground stroke-primary-foreground/25"
              />
              <text x={rundeAufZehntel(schild.x)} y={rundeAufZehntel(schild.y + 3.5)} textAnchor="middle" fontSize={10} fontWeight={600} className="fill-primary-foreground/70 font-sans">
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
            className="fill-primary-foreground/65 font-sans"
          >
            {name.text}
          </text>
        ))}
        {lage && (
          <line
            x1={rundeAufZehntel(lage.linie.x1)}
            y1={rundeAufZehntel(lage.linie.y1)}
            x2={rundeAufZehntel(lage.linie.x2)}
            y2={rundeAufZehntel(lage.linie.y2)}
            strokeWidth={2.5}
            strokeLinecap="round"
            className="stroke-accent"
          />
        )}
        {/* Der hervorgehobene Hof zuletzt: Er liegt über seinen Nachbarn. */}
        {[...marken.filter((m) => !m.hervorgehoben), ...marken.filter((m) => m.hervorgehoben)].map((marke) => (
          <Marke key={marke.schluessel} marke={marke} />
        ))}
      </svg>

      {anzahl > 0 && (
        <span className="absolute top-3.5 left-3.5 flex h-[34px] items-center gap-[7px] rounded-full bg-accent-foreground px-[13px] text-[13px] font-semibold text-primary-foreground shadow-md">
          <House className="size-[15px] shrink-0 text-accent" strokeWidth={1.7} aria-hidden="true" />
          {formatiereRegionsZaehler(anzahl)}
        </span>
      )}

      {form === 'web' && (
        <span className="absolute right-3.5 bottom-3.5 flex h-[38px] items-center gap-1.5 rounded-full bg-accent px-[15px] text-[13.5px] font-semibold text-accent-foreground transition-opacity duration-[250ms] group-hover:opacity-90">
          <MapIcon className="size-[15px] shrink-0" strokeWidth={1.7} aria-hidden="true" />
          {KARTE_OEFFNEN}
        </span>
      )}

      {hof && lage && (
        <span
          className="absolute flex items-center gap-2.5 rounded-2xl bg-accent-foreground p-2.5 text-primary-foreground shadow-xl"
          style={{
            left: `${lage.links}%`,
            width: `${HOFKARTE_ANTEIL[form] * 100}%`,
            ...(lage.senkrecht.kante === 'oben' ? { top: `${lage.senkrecht.abstand}%` } : { bottom: `${lage.senkrecht.abstand}%` }),
          }}
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-accent/15 text-accent">
            <Sprout className="size-[22px]" strokeWidth={1.7} aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span title={hof.name} className="truncate font-heading text-[15px] font-semibold">
              {hof.name}
            </span>
            {hof.zeile && <span className="truncate text-[11.5px] text-primary-foreground/70">{hof.zeile}</span>}
            {hof.abholung && (
              // Die Abholzeit darf umbrechen statt abzubrechen — abgeschnitten fehlte genau die Uhrzeit.
              <span
                className={cn(
                  'line-clamp-2 text-[11.5px] break-words',
                  hof.abholungIstTermin ? 'font-semibold text-accent' : 'text-primary-foreground/70'
                )}
              >
                {hof.abholungIstTermin ? `Abholung: ${hof.abholung}` : hof.abholung}
              </span>
            )}
          </span>
        </span>
      )}
    </Link>
  )
}
