import Link from 'next/link'
import { Check, Info } from 'lucide-react'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { StatusBadge } from '@/components/ui/status-badge'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { KARTE, KICKER } from '@/components/hof-bestellungen/stil'
import { UnterseitenKopf } from '@/components/hofbereich/unterseiten-kopf'
import {
  KONDITIONEN_STAND,
  KONDITIONEN_UEBERGANG,
  MONATSABRECHNUNG_TEXT,
  PRO_MONAT,
  TARIFE,
  VOLLER_WARENPREIS,
} from '@/lib/konditionen'
import { konditionenRechenbeispiel, type KonditionenHof, type RechenSeite } from '@/lib/hof-einstellungen'
import { cn } from '@/lib/utils'

/**
 * „Deine Konditionen" (/settings/konditionen, Mockup web-h1-einstellungen-
 * konditionen, Nachtlauf Nr. 22d). ALLE Preise und Sätze kommen aus
 * src/lib/konditionen.ts (Übergang K1, Bar-Ausnahme B1) bzw. aus dem
 * Rechenbeispiel mit den gespeicherten Sätzen dieses Hofs
 * (konditionenRechenbeispiel) — hier steht keine Zahl
 * (tests/konditionen-seiten.test.ts). Die Seite verspricht nichts, was nicht
 * schon gilt: kein „Dein Tarif", solange keiner gewählt ist, keine Sätze aus
 * dem Mockup ohne Grundlage (Live gehen, Mail bei Satzänderung).
 */
export function KonditionenAnsicht({ hof, jetzt }: { hof: KonditionenHof; jetzt: Date }): React.JSX.Element {
  const beispiel = konditionenRechenbeispiel(hof, jetzt)

  return (
    <div>
      <UnterseitenKopf titel="Deine Konditionen" satz={beispiel.mitProvision ? undefined : VOLLER_WARENPREIS} />

      <div className="flex flex-col gap-5 md:gap-6">
        {/* Vor den Preisen, damit keiner als heute fällig gelesen wird (Register K1). */}
        <Hinweiskarte ton="gruen" symbol={Info}>
          <p className="font-medium">{KONDITIONEN_UEBERGANG}</p>
        </Hinweiskarte>

        <section aria-labelledby="tarife-titel">
          <h2 id="tarife-titel" className={cn(KICKER, 'mb-2.5')}>
            Tarife
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {TARIFE.map((tarif) => {
              const gewaehlt = hof.tarif === tarif.id
              return (
                <li key={tarif.id} className={cn(KARTE, 'flex flex-col gap-3 p-5', gewaehlt && 'border-accent/70')}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[15.5px] font-semibold text-foreground">{tarif.name}</p>
                      <p className="mt-1 text-[13px] text-muted-foreground">{tarif.zusatz}</p>
                    </div>
                    {gewaehlt && <StatusBadge status="fertig">Dein Tarif</StatusBadge>}
                  </div>
                  <p className="text-foreground">
                    <span className="font-heading text-[30px] leading-none font-semibold">{tarif.preis}</span>{' '}
                    <span className="text-[13px] text-muted-foreground">{PRO_MONAT}</span>
                  </p>
                  <ul className="flex flex-col gap-1.5 text-[13.5px] text-foreground">
                    {tarif.leistungen.map((leistung) => (
                      <li key={leistung} className="flex gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-status-fertig" strokeWidth={1.7} aria-hidden="true" />
                        <span className="min-w-0">{leistung}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              )
            })}
          </ul>
        </section>

        <section aria-labelledby="beispiel-titel" className={cn(KARTE, 'p-5 md:p-6')}>
          <h2 id="beispiel-titel" className="font-heading text-lg font-semibold text-foreground">
            {beispiel.titel}
          </h2>
          {beispiel.satz && <p className="mt-1 text-[13px] text-muted-foreground">{beispiel.satz}</p>}
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <RechenKarte seite={beispiel.online} />
            <RechenKarte seite={beispiel.bar} />
          </div>
        </section>

        <section aria-labelledby="abrechnung-titel">
          <h2 id="abrechnung-titel" className={cn(KICKER, 'mb-2.5')}>
            So rechnen wir ab
          </h2>
          <p className="text-[13.5px] leading-relaxed text-foreground">{MONATSABRECHNUNG_TEXT}</p>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-[13px] text-muted-foreground">
          <p>Stand: {KONDITIONEN_STAND}</p>
          <Link
            href="/konditionen"
            className={cn('inline-flex min-h-11 items-center rounded-sm font-semibold text-brand-text underline-offset-2 hover:underline', FOKUS_RAHMEN)}
          >
            Konditionen für alle Höfe ansehen
          </Link>
        </div>
      </div>
    </div>
  )
}

/** Eine Spalte des Rechenbeispiels: Zeilen als Beschreibungsliste, Summen hervorgehoben. */
function RechenKarte({ seite }: { seite: RechenSeite }): React.JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <h3 className="text-[14.5px] font-semibold text-foreground">{seite.titel}</h3>
      <dl className="mt-2.5 flex flex-col text-[13.5px]">
        {seite.zeilen.map((zeile) => (
          <div
            key={zeile.label}
            className={cn('flex items-baseline justify-between gap-3 py-1', zeile.summe && 'mt-1 border-t border-border pt-2 font-semibold')}
          >
            <dt className={cn('min-w-0', zeile.summe ? 'text-foreground' : 'text-muted-foreground')}>{zeile.label}</dt>
            <dd className="shrink-0 text-foreground tabular-nums">{zeile.betrag}</dd>
          </div>
        ))}
      </dl>
      {seite.satz && <p className="mt-2.5 text-[12.5px] leading-relaxed text-muted-foreground">{seite.satz}</p>}
    </div>
  )
}
