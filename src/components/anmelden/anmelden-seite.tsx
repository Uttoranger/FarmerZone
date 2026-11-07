import Link from 'next/link'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Kicker } from '@/components/startseite/kicker'
import { KundeCodeFormular } from '@/components/anmelden/kunde-code-formular'
import { HofAnmeldung } from '@/components/anmelden/hof-anmeldung'

export type Anmeldeart = 'kunde' | 'hof'

/** Die zwei Wege, je eine eigene Route — der Umschalter am Handy verlinkt sie. */
const WEGE: ReadonlyArray<{ art: Anmeldeart; label: string; href: string }> = [
  { art: 'kunde', label: 'Ich kaufe ein', href: '/account/login' },
  { art: 'hof', label: 'Ich habe einen Hof', href: '/login' },
]

/** Am Handy ohne Karte, im Browser zwei Karten nebeneinander (Boards s2-/w2-anmelden). */
const KARTE =
  'min-w-0 flex-1 flex-col gap-3 lg:rounded-2xl lg:border lg:border-border lg:bg-card lg:p-5 dark:lg:ring-0'

/**
 * Die Anmeldeseite für Kundinnen (/account/login) und Höfe (/login) — EINE
 * Seite mit zwei getrennten Karten, wie im Mockup
 * web-k0-anmelden-kunde-code-hof-passwort: links „Ich kaufe ein" (Code aus der
 * E-Mail, E7), rechts „Ich habe einen Hof" (E-Mail und Passwort). Im Browser
 * stehen beide nebeneinander; am Handy (mobil-k0-anmelden-mit-code) nur die
 * Karte der aufgerufenen Route, darüber ein Umschalter aus zwei echten Links
 * (DESIGN_SYSTEM: was navigiert, ist ein Link) — die beiden Routen verweisen
 * so gegenseitig aufeinander.
 *
 * Kein Konto-Angebot für Kundinnen (E8): kein „Konto anlegen", nur die
 * bestehende freiwillige Anmeldung. Registrieren gibt es nur für Höfe.
 */
export function AnmeldenSeite({ aktiv, ziel }: { aktiv: Anmeldeart; ziel: string }): React.JSX.Element {
  return (
    <div className="mx-auto w-full max-w-[944px] px-[18px] pt-[22px] pb-10 lg:px-6 lg:pt-8">
      {/* Kopf links bündig über den Karten, am Handy wie im Browser (Board s2-anmelden, Bild 1). */}
      <h1 className="font-heading text-[26px] leading-tight font-semibold lg:text-[28px]">Willkommen zurück</h1>
      <p className="mt-1.5 text-[15px] leading-normal text-muted-foreground">
        Kunden melden sich mit einem Code an, Höfe mit Passwort.
      </p>

      <nav aria-label="Wie meldest du dich an?" className="mt-[18px] lg:hidden">
        {/* Schiene getönt, die gewählte Seite hell mit Schatten (Board s2-anmelden). */}
        <ul className="flex gap-[3px] rounded-full bg-muted p-1">
          {WEGE.map((weg) => (
            <li key={weg.art} className="flex-1">
              <Link
                href={weg.href}
                aria-current={weg.art === aktiv ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center justify-center rounded-full px-2 text-center text-[14px] font-semibold text-foreground transition-colors duration-[250ms] aria-[current=page]:bg-card aria-[current=page]:shadow-sm dark:aria-[current=page]:ring-1 dark:aria-[current=page]:ring-border',
                  FOKUS_RAHMEN
                )}
              >
                {weg.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-[18px] flex flex-col gap-[22px] lg:mt-5 lg:flex-row lg:items-start lg:gap-4">
        <section aria-labelledby="anmelden-kunde" className={cn(KARTE, aktiv === 'kunde' ? 'flex' : 'hidden lg:flex')}>
          <div className="flex flex-col gap-1">
            <Kicker className="text-[12.5px] tracking-[0.6px]">Ich kaufe ein</Kicker>
            <h2 id="anmelden-kunde" className="font-heading text-[22px] leading-tight font-semibold">
              Mit E-Mail-Code anmelden
            </h2>
          </div>
          <KundeCodeFormular ziel={ziel} />
        </section>

        <section aria-labelledby="anmelden-hof" className={cn(KARTE, aktiv === 'hof' ? 'flex' : 'hidden lg:flex')}>
          <div className="flex flex-col gap-1">
            <Kicker ton="orange" className="text-[12.5px] tracking-[0.6px]">
              Ich habe einen Hof
            </Kicker>
            <h2 id="anmelden-hof" className="font-heading text-[22px] leading-tight font-semibold">
              Hof-Anmeldung
            </h2>
          </div>
          <HofAnmeldung nachBoard />
        </section>
      </div>
    </div>
  )
}
