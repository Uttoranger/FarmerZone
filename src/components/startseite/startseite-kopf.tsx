import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Check, LocateFixed, Search } from 'lucide-react'
import { SUCHTEXT_MAX, SUCHTEXT_PARAMETER } from '@/schemas/hoefe-filter'
import { KARTE_ADRESSE, hoefeAdresse } from '@/lib/startseite'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'

/*
 * Der Kopf der Startseite (Mockups web-k0-startseite, mobil-k0-startseite):
 * Kornfeld-Video als Hintergrund, links Satz und Suche, rechts die Karte.
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

/** Die Stecknadeln der Karte — Schmuck; wo die Höfe wirklich liegen, zeigt /hoefe. */
const NADELN = ['left-[30%] top-[30%]', 'left-[66%] top-[40%]', 'left-[44%] top-[66%]', 'left-[74%] top-[74%]'] as const

export function StartseiteKopf({ kartenHof }: { kartenHof?: ReactNode }): React.JSX.Element {
  return (
    // bg-black: der Grund unter Foto und Schleier, solange das Bild lädt (und
    // für die Kontrastprüfung) — die weiße Schrift steht nie auf dem hellen Seitengrund.
    <section aria-labelledby="startseite-titel" className="relative isolate overflow-hidden bg-black">
      {/* Drei Schichten wie bisher: (1) das Standbild — immer da, es ist die
          Darstellung bei „Bewegung reduzieren" und der LCP-Kandidat (priority);
          (2) darüber das Video, rein per CSS eingeblendet; (3) der Schleier. */}
      <Image src="/landing/hero-poster.jpg" alt="" fill priority sizes="100vw" className="-z-10 object-cover" />

      {/* Stumm, in Schleife, ohne Bedienelemente — reiner Hintergrund
          (aria-hidden). Zweimal dieselbe Bedingung: Die Klasse blendet das
          Element nur bei erlaubter Bewegung ein, die media-Bedingung an der
          Quelle entscheidet, ob das Video überhaupt geladen wird.
          preload="none" hält das Laden NICHT auf: autoPlay geht vor, das
          Video lädt sofort an. Es bleibt nur für Browser stehen, die die
          automatische Wiedergabe sperren (etwa im Datensparmodus) — dort lädt
          dann gar nichts. Kein poster: Das Standbild darunter (next/image,
          verkleinert) zeigt sich durch, solange das Video noch kein Bild hat;
          ein poster lud dasselbe Foto ein zweites Mal im Original. */}
      <video
        className="absolute inset-0 -z-10 hidden h-full w-full object-cover motion-safe:block"
        autoPlay
        muted
        loop
        playsInline
        preload="none"
        aria-hidden="true"
      >
        <source media="(prefers-reduced-motion: no-preference)" src="/landing/hero-loop.mp4" type="video/mp4" />
      </video>

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

          {/* Die Suche schickt, was /hoefe heute versteht: den Suchtext `q`
              (Hof oder Produkt) — derselbe Weg wie die Suche der 404 und der
              KundeShell. Einen Ort nimmt /hoefe bewusst nicht aus der Adresse
              (ARCHITECTURE §4, „Nie Standort in die URL"); die Umkreissuche
              mit Postleitzahl oder Standort liegt dort, der Link darunter
              führt hin. */}
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
                  'h-11 min-w-0 flex-1 rounded-md bg-transparent text-[15.5px] text-foreground placeholder:text-muted-foreground',
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

        {/* Die Karte rechts (ab 1024 px): ein Bild der Gegend, kein
            Kartendienst — Leaflet und Kacheln blieben der Hofübersicht
            vorbehalten, die Startseite lädt dafür kein Skript. Die Fläche
            führt zur Kartenansicht von /hoefe; davor der erste Hof als Karte. */}
        <div className="relative hidden h-[440px] w-[420px] shrink-0 lg:block xl:w-[520px]">
          <Link
            href={KARTE_ADRESSE}
            aria-label="Alle Höfe auf der Karte ansehen"
            className={cn('absolute inset-0 overflow-hidden rounded-[26px] bg-accent', FOKUS_AUF_FOTO)}
          >
            <span aria-hidden="true" className="absolute inset-0 bg-linear-150 from-black/30 via-transparent via-55% to-primary/30" />
            <span aria-hidden="true" className="absolute top-[120px] -left-10 h-0.5 w-[640px] rotate-[14deg] bg-accent-foreground/12" />
            <span aria-hidden="true" className="absolute -top-[60px] left-[160px] h-[560px] w-0.5 rotate-[24deg] bg-accent-foreground/10" />
            {NADELN.map((lage) => (
              <span
                key={lage}
                aria-hidden="true"
                className={cn('absolute size-3.5 rounded-full border-[2.5px] border-primary-foreground bg-primary', lage)}
              />
            ))}
          </Link>
          {kartenHof}
        </div>
      </div>
    </section>
  )
}
