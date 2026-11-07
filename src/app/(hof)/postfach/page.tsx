import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { verlangeHofDerSitzung } from '@/server/hofbereich'
import { getFarmForUser } from '@/server/queries/dashboard'
import { ladeFaedenHof } from '@/server/queries/postfach'
import {
  POSTFACH_ALLES_GELESEN,
  POSTFACH_FEHLER,
  POSTFACH_LEER,
  POSTFACH_TEXT,
  neuText,
  postfachFilterAus,
  postfachFilterHref,
  postfachZeilen,
  zaehleUngelesen,
  type FadenRoh,
} from '@/lib/postfach'
import { EmptyState } from '@/components/ui/empty-state'
import { FilterChip, FilterChipReihe } from '@/components/ui/chip'
import { Textlink } from '@/components/ui/textlink'
import { WerkzeugKopf } from '@/components/ui/werkzeug-kopf'
import { RUNDUNG } from '@/components/ui/rundung'
import { LadeFehlerKasten } from '@/components/hof-hilfe/lade-fehler-kasten'
import { PROBLEM_MELDEN } from '@/lib/fehlerseite'
import { NEUE_MELDUNG_HREF } from '@/lib/hof-hilfe'
import { LadeInhalt, LadeRahmen } from '@/components/ui/lade-punkt'
import { Marke } from '@/components/ui/marke'
import { HofUnterzeile } from '@/components/mein-hof/hof-unterzeile'
import { KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'
import { cn } from '@/lib/utils'
import { MARKE } from '@/lib/marke'
import { POSTFACH_RAHMEN, PostfachZeile } from './teile'

export const metadata: Metadata = { title: `${POSTFACH_TEXT.titel} — ${MARKE}` }

export const dynamic = 'force-dynamic'

/*
 * Das Postfach des Hofs (Register N12, Nachtlauf Nr. 87; Mockup
 * mobil-h6-postfach): je Nachricht vom Team ein Faden, neueste zuerst, Filter
 * Alle/Ungelesen. Nur die Fäden dieses Hofs (farmId der Sitzung in der
 * Abfrage). Abweichend vom Mockup ohne Pfeil zurück: Postfach ist ein
 * Hauptpunkt, und Seiten der Leiste und des Mehr-Blatts haben keinen Rückweg
 * (Register N1, elternseite). Ein Ladefehler steht inline statt als 500.
 */
export default async function PostfachPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string | string[] }>
}): Promise<React.JSX.Element> {
  const { userId } = await verlangeHofDerSitzung()
  const farm = await getFarmForUser(userId)
  if (!farm) redirect('/onboarding')

  const filter = postfachFilterAus((await searchParams).filter)
  let faeden: FadenRoh[] | null = null
  try {
    faeden = await ladeFaedenHof(farm.id)
  } catch (err) {
    // Nur Bereich und Hof — nie ein Nachrichtentext.
    Sentry.captureException(err, { tags: { bereich: 'postfach', seite: 'liste' }, extra: { farmId: farm.id } })
  }

  const ungelesen = faeden ? zaehleUngelesen(faeden) : 0
  // Ein Zeitpunkt für die ganze Seite, auf dem Server („vor 3 Std.").
  const jetzt = new Date()
  const zeilen = faeden ? postfachZeilen(faeden, filter, jetzt) : []

  return (
    <div className={cn(POSTFACH_RAHMEN, 'flex flex-col gap-4')}>
      {/* Werkzeug-Kopf (G1) wie im Board s2-/w2-postfach: Titel und Hofzeile, „n neu“ rechts. */}
      <WerkzeugKopf
        titel={POSTFACH_TEXT.titel}
        unterzeile={<HofUnterzeile hofName={farm.name} jetzt={jetzt} />}
        aktion={ungelesen > 0 ? <Marke art="tun">{neuText(ungelesen)}</Marke> : undefined}
      />

      {faeden === null ? (
        // G6 mit Überschrift, Satz und „Neu laden“ (Board s2-/w2-postfach Bild 6) — der Link fragt dieselbe Seite neu.
        <LadeFehlerKasten
          titel={POSTFACH_FEHLER.laden.replace(/ Lade die Seite bitte neu\.$/, '')}
          satz="Lade die Seite bitte neu. Deine Nachrichten sind nicht verloren."
          knopf="Neu laden"
          nochmal={postfachFilterHref(filter)}
        />
      ) : faeden.length === 0 ? (
        <EmptyState
          titel={POSTFACH_LEER.titel}
          satz={POSTFACH_LEER.satz}
          ausweg={{ ohne: 'Höfe beginnen keine Unterhaltung (Register N12): Nachrichten schreibt nur das Team, Probleme und Wünsche gehen über die Meldungsseite' }}
        />
      ) : (
        <LadeRahmen>
          {/* Polster, damit der Fokusring um „Alle“ nicht abgeschnitten wird (Liste Lauf 32 postfach). */}
          <FilterChipReihe beschriftung={POSTFACH_TEXT.filterBeschriftung} className="md:-mx-1 md:px-1">
            <FilterChip href={postfachFilterHref('alle')} aktiv={filter === 'alle'} ladePunkt>
              {POSTFACH_TEXT.alle}
            </FilterChip>
            <FilterChip href={postfachFilterHref('ungelesen')} aktiv={filter === 'ungelesen'} ladePunkt>
              {/* Mit Zahl wie im Board s2-/w2-postfach („Ungelesen · 1“). */}
              {ungelesen > 0 ? `${POSTFACH_TEXT.ungelesen} · ${ungelesen}` : POSTFACH_TEXT.ungelesen}
            </FilterChip>
          </FilterChipReihe>
          <LadeInhalt className="flex flex-col gap-4">
            {zeilen.length === 0 ? (
              <EmptyState
                titel={POSTFACH_ALLES_GELESEN.titel}
                satz={POSTFACH_ALLES_GELESEN.satz}
                ausweg={
                  <Link
                    href={postfachFilterHref('alle')}
                    className={KNOPF_RAHMEN}
                  >
                    {POSTFACH_ALLES_GELESEN.ausweg}
                  </Link>
                }
              />
            ) : (
              <ul className={cn('overflow-hidden border border-border bg-card', RUNDUNG.karte)}>
                {zeilen.map((zeile) => (
                  <li key={zeile.id} className="border-b border-border last:border-0">
                    <PostfachZeile zeile={zeile} />
                  </li>
                ))}
              </ul>
            )}
            {/* Nur mit Fäden: Leer sagt der EmptyState dasselbe (DESIGN_SYSTEM „Leerzustände"). */}
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              <ErklaerungMitLink />
            </p>
          </LadeInhalt>
        </LadeRahmen>
      )}
    </div>
  )
}

/** Der Erklärsatz mit „Problem melden“ als grünem Textlink (Board s2-/w2-postfach); der Satz bleibt EINE Quelle. */
function ErklaerungMitLink(): React.JSX.Element {
  // Die Anführungszeichen bleiben außerhalb des Links stehen wie im Board.
  const wort = PROBLEM_MELDEN
  const stelle = POSTFACH_TEXT.erklaerung.lastIndexOf(wort)
  if (stelle < 0) return <>{POSTFACH_TEXT.erklaerung}</>
  return (
    <>
      {POSTFACH_TEXT.erklaerung.slice(0, stelle)}
      <Textlink href={NEUE_MELDUNG_HREF} form="im-satz">
        {PROBLEM_MELDEN}
      </Textlink>
      {POSTFACH_TEXT.erklaerung.slice(stelle + wort.length)}
    </>
  )
}
