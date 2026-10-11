'use client'

import { FarmPageView } from '@/components/farm/farm-page-view'
import type { PublicFarm } from '@/server/queries/farm'
import type { ActiveStatusPost } from '@/server/queries/status-posts'
import { useMeinHofAnsicht } from '@/components/mein-hof/mein-hof-ansicht'

interface Props {
  farm: PublicFarm
  activeStatus: ActiveStatusPost | null
  pastStatusCount: number
}

/*
 * Mein Hof unter lg, Reiter Hofseite, „Bearbeiten": die Hofseite mit Stiften.
 * Seit Nachtlauf Nr. 16 in der HofShell. Der Umschalter „Bearbeiten · So
 * sieht’s die Kundin" und die Kundenansicht (das iframe der echten Hofseite)
 * stehen seit Nr. 49 (Register N4) ganz oben im Baustein MeinHofAnsicht
 * (components/mein-hof/mein-hof-ansicht.tsx) — hier bleibt nur „Bearbeiten".
 * „Ansehen →" über den Produkten schaltet dorthin, und wer hier Titelbild,
 * Ausschnitt oder Fotos speichert, bekommt „Gespeichert · Ansehen".
 * Adresse, Kopieren und Teilen sitzen im Kopf von Mein Hof
 * (components/mein-hof/seitenkopf.tsx), und dort nur, solange die Hofseite
 * öffentlich ist.
 */
export function FarmPageClient({ farm, activeStatus, pastStatusCount }: Props): React.JSX.Element {
  const ansicht = useMeinHofAnsicht()

  return (
    // Die Bestandsfarben der Hofseite (--app-*) nehmen hier die Werte des
    // Design-Systems an (data-app-palette, globals.css).
    <div data-app-palette="neu">
      <FarmPageView
        farm={farm}
        activeStatus={activeStatus}
        ownerMode={true}
        mode="edit"
        pastStatusCount={pastStatusCount}
        onVorschau={ansicht ? () => ansicht.zeigeKundin(null) : undefined}
        onGespeichert={ansicht ? (abschnitt) => ansicht.gespeichert(abschnitt) : undefined}
      />
    </div>
  )
}
