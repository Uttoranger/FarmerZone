import Link from 'next/link'
import { ChevronDown, Globe, KeyRound, Star, type LucideIcon } from 'lucide-react'
import {
  EINSTELLUNGEN_GRUPPEN,
  EINSTELLUNGEN_TEXT,
  PLATTFORM_ANGABEN,
  einstellungenGruppeHref,
  type EinstellungenGruppe,
} from '@/lib/plattform-einstellung'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Chip } from '@/components/ui/chip'
import { EinstellungenGruendung, type GruendungFormularDaten } from '@/components/admin/einstellungen-gruendung'

const SYMBOL: Record<EinstellungenGruppe, LucideIcon> = { gruendung: Star, plattform: Globe, anmeldung: KeyRound }

const H2 = 'font-heading text-lg font-semibold text-foreground'

/** Was die Seite den Gruppen mitgibt — alles fertig vom Server. */
export type EinstellungenDaten = {
  gewaehlt: EinstellungenGruppe
  gruendung: GruendungFormularDaten
  /** „12 Plätze · 5 frei · bis 31.12.2027" — Zeile der zugeklappten Gruppe am Handy. */
  gruendungZeile: string
}

function Navigation({ gewaehlt }: { gewaehlt: EinstellungenGruppe }): React.JSX.Element {
  return (
    <nav aria-label={EINSTELLUNGEN_TEXT.navigation} className="hidden flex-col gap-0.5 self-start rounded-2xl border border-border bg-card p-2 lg:flex">
      {EINSTELLUNGEN_GRUPPEN.map((gruppe) => {
        const aktiv = gruppe === gewaehlt
        const Symbol = SYMBOL[gruppe]
        return (
          <Link
            key={gruppe}
            href={einstellungenGruppeHref(gruppe)}
            aria-current={aktiv ? 'page' : undefined}
            className={cn(
              'flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 transition-colors',
              aktiv ? 'bg-foreground text-background' : 'text-foreground hover:bg-muted',
              FOKUS_RAHMEN
            )}
          >
            <span aria-hidden="true" className={cn('flex size-8 shrink-0 items-center justify-center rounded-[10px]', aktiv ? 'bg-background/15' : 'bg-muted')}>
              <Symbol className="size-4" strokeWidth={1.8} />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-[14px] font-semibold">{EINSTELLUNGEN_TEXT.gruppe[gruppe].titel}</span>
              <span className={cn('truncate text-[12px]', aktiv ? 'text-background/80' : 'text-muted-foreground')}>
                {EINSTELLUNGEN_TEXT.gruppe[gruppe].zeile}
              </span>
            </span>
          </Link>
        )
      })}
    </nav>
  )
}

/** Eine Zeile „Bezeichnung · Wert" der nur lesenden Gruppen. */
function Angabe({ titel, children }: { titel: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border py-3 first:border-t-0 first:pt-0">
      <dt className="text-[13px] font-semibold text-muted-foreground">{titel}</dt>
      <dd className="min-w-0 text-[14px] break-words text-foreground">{children}</dd>
    </div>
  )
}

function Plattform(): React.JSX.Element {
  return (
    <>
      <p className="text-[13px] leading-snug text-muted-foreground">{EINSTELLUNGEN_TEXT.plattform.satz}</p>
      <dl>
        <Angabe titel={EINSTELLUNGEN_TEXT.plattform.name}>{PLATTFORM_ANGABEN.name}</Angabe>
        <Angabe titel={EINSTELLUNGEN_TEXT.plattform.adresse}>{PLATTFORM_ANGABEN.adresse}</Angabe>
      </dl>
    </>
  )
}

/**
 * Die Gruppen von Admin › Einstellungen (Register N15; Mockups
 * admin-einstellungen bei 1440 px und admin-mobil-einstellungen bei 390 px).
 * Ab 1024 px links die Navigation (Links mit `?gruppe=`, ohne Skript) und
 * rechts die gewählte Gruppe; darunter alle Gruppen als aufklappbare Liste
 * (<details>), die gewählte — ohne Wahl Gründungshöfe — offen. Jede Gruppe
 * steht EINMAL im HTML: Ab 1024 px ist nur die gewählte zu sehen, ihr Kopf
 * zum Aufklappen verschwindet, der Titel steht dann in der Karte.
 *
 * Plattform nur lesend (in diesem Lauf keine neuen Felder): Name und Adresse
 * aus MARKE und PRODUKTION_HOST. Die Gruppe „Benachrichtigungen" des Mockups
 * gibt es nicht — das ist Postfach › Zustellung (Nr. 95); die Gruppe „Betrieb"
 * entfiel mit Nr. 103 (Register N15 geändert) — der Stripe-Modus steht in
 * Admin › Betrieb.
 */
export function EinstellungenGruppen({ daten }: { daten: EinstellungenDaten }): React.JSX.Element {
  const zeileHandy: Record<EinstellungenGruppe, string> = {
    gruendung: daten.gruendungZeile,
    plattform: `${PLATTFORM_ANGABEN.name} · ${PLATTFORM_ANGABEN.adresse}`,
    anmeldung: EINSTELLUNGEN_TEXT.gruppe.anmeldung.zeile,
  }
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start lg:gap-[18px]">
      <Navigation gewaehlt={daten.gewaehlt} />
      <div className="flex min-w-0 flex-col gap-2.5">
        {EINSTELLUNGEN_GRUPPEN.map((gruppe) => {
          const Symbol = SYMBOL[gruppe]
          const titel = EINSTELLUNGEN_TEXT.gruppe[gruppe].titel
          return (
            <details
              key={gruppe}
              open={gruppe === daten.gewaehlt}
              className={cn('group overflow-hidden rounded-2xl border border-border bg-card', gruppe !== daten.gewaehlt && 'lg:hidden')}
            >
              <summary
                className={cn(
                  'flex min-h-14 cursor-pointer list-none items-center gap-3 px-3.5 py-3 lg:hidden [&::-webkit-details-marker]:hidden',
                  FOKUS_RAHMEN
                )}
              >
                <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-muted text-foreground">
                  <Symbol className="size-[18px]" strokeWidth={1.8} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[15px] font-semibold text-foreground">{titel}</span>
                  <span className="truncate text-[12.5px] text-muted-foreground">{zeileHandy[gruppe]}</span>
                </span>
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <section aria-label={titel} className="flex flex-col gap-3.5 border-t border-border p-3.5 lg:border-t-0 lg:p-5">
                <div className="hidden flex-wrap items-center gap-2.5 lg:flex">
                  <h2 className={H2}>{titel}</h2>
                  {gruppe === 'gruendung' && <Chip>{EINSTELLUNGEN_TEXT.gruendung.register}</Chip>}
                </div>
                {gruppe === 'gruendung' && (
                  <>
                    <p className="-mt-1.5 hidden text-[13px] leading-snug text-muted-foreground lg:block">{EINSTELLUNGEN_TEXT.gruendung.satz}</p>
                    <EinstellungenGruendung daten={daten.gruendung} />
                  </>
                )}
                {gruppe === 'plattform' && <Plattform />}
                {/* Anmeldung (Register N20) hat eine eigene Seite — hier nur der Weg dorthin. */}
                {gruppe === 'anmeldung' && (
                  <>
                    <p className="text-[13px] leading-snug text-muted-foreground">{EINSTELLUNGEN_TEXT.gruppe.anmeldung.satz}</p>
                    <Link
                      href={einstellungenGruppeHref('anmeldung')}
                      className={cn('inline-flex min-h-11 items-center self-start rounded-full text-[14px] font-semibold text-status-fertig underline underline-offset-2', FOKUS_RAHMEN)}
                    >
                      {EINSTELLUNGEN_TEXT.gruppe.anmeldung.link}
                    </Link>
                  </>
                )}
              </section>
            </details>
          )
        })}
      </div>
    </div>
  )
}
