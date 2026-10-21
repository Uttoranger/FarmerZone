import * as Sentry from '@sentry/nextjs'
import { ladeEigenenListeneintrag } from '@/server/queries/region'
import { eigeneListenkarte } from '@/lib/region'
import { StandortFehlt, type EigeneKarte } from '@/components/region/region-zustaende'

/**
 * Der Zustand ohne eigenen Standort, für beide Reiter gleich (Register N23,
 * Board v2 §4): lädt die eigene Hofkarte, wie sie in der Liste auf /hoefe
 * steht — nur für den Hof aus der Sitzung (die farmId kommt von der Seite).
 * Scheitert das Laden, bleibt der Leerzustand mit seinem Ausweg stehen; nur
 * der Abschnitt mit der Karte fehlt (gemeldet an Sentry, nur Kennungen).
 */
export async function OhneStandort({ farmId }: { farmId: string }): Promise<React.JSX.Element> {
  const jetzt = new Date()
  let eigeneKarte: EigeneKarte | null | undefined
  try {
    const eintrag = await ladeEigenenListeneintrag(farmId)
    eigeneKarte = eintrag ? eigeneListenkarte(eintrag, jetzt) : null
  } catch (err) {
    Sentry.captureException(err, { tags: { bereich: 'region', seite: 'ohne-standort' }, extra: { farmId } })
  }
  return <StandortFehlt eigeneKarte={eigeneKarte} jetzt={jetzt.toISOString()} />
}
