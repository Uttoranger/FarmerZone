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

const KARTE =
  'min-w-0 flex-1 flex-col gap-3 lg:rounded-2xl lg:border lg:border-border lg:bg-card lg:p-7 dark:lg:ring-0'

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
    <div className="mx-auto w-full max-w-[1000px] px-[18px] pt-[22px] pb-10 lg:px-6 lg:pt-[70px]">
      <div className="lg:text-center">
        <h1 className="font-heading text-[26px] leading-tight font-semibold lg:text-[34px]">
          <span className="lg:hidden">Anmelden</span>
          <span className="hidden lg:inline">Willkommen zurück</span>
        </h1>
        <p className="mt-1 hidden text-[15px] leading-normal text-muted-foreground lg:block">
          Kunden melden sich mit einem Code an, Höfe mit Passwort.
        </p>
      </div>

      <nav aria-label="Wie meldest du dich an?" className="mt-[22px] lg:hidden">
        <ul className="flex gap-[3px] rounded-full border border-border bg-background p-[3px]">
          {WEGE.map((weg) => (
            <li key={weg.art} className="flex-1">
              <Link
                href={weg.href}
                aria-current={weg.art === aktiv ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center justify-center rounded-full px-2 text-center text-[13.5px] text-muted-foreground transition-colors duration-[250ms] hover:text-foreground aria-[current=page]:bg-border aria-[current=page]:font-semibold aria-[current=page]:text-foreground',
                  FOKUS_RAHMEN
                )}
              >
                {weg.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-[22px] flex flex-col gap-[22px] lg:flex-row lg:items-start">
        <section aria-labelledby="anmelden-kunde" className={cn(KARTE, aktiv === 'kunde' ? 'flex' : 'hidden lg:flex')}>
          <Kicker className="hidden lg:block">Ich kaufe ein</Kicker>
          {/* Am Handy trägt der Umschalter die Überschrift sichtbar — für Screenreader bleibt sie stehen. */}
          <h2 id="anmelden-kunde" className="sr-only font-heading text-[22px] font-semibold lg:not-sr-only">
            Mit E-Mail-Code anmelden
          </h2>
          <KundeCodeFormular ziel={ziel} />
        </section>

        <section aria-labelledby="anmelden-hof" className={cn(KARTE, aktiv === 'hof' ? 'flex' : 'hidden lg:flex')}>
          <Kicker ton="orange" className="hidden lg:block">
            Ich habe einen Hof
          </Kicker>
          <h2 id="anmelden-hof" className="sr-only font-heading text-[22px] font-semibold lg:not-sr-only">
            Hof-Anmeldung
          </h2>
          <HofAnmeldung />
        </section>
      </div>
    </div>
  )
}
