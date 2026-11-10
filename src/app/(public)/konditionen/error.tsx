'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import { FehlerAnsicht } from '@/components/shared/fehler-ansicht'

/**
 * Fehlerseite von /konditionen (N45, A005 4e): Lässt sich der Stichtag
 * „Hofpreis-Modell ab“ nicht laden, steht die Fehlerseite da — nie die
 * Konditionen nach der stillen Vorgabe, die vielleicht nicht gilt. Dieselbe
 * 500 wie src/app/error.tsx (FehlerAnsicht in der KundeShell), gemeldet von
 * hier, mit festem Bereich.
 */
export default function KonditionenFehler({ error, reset }: { error: Error & { digest?: string }; reset: () => void }): React.JSX.Element {
  useEffect(() => {
    Sentry.captureException(error, { tags: { bereich: 'konditionen-seite' } })
  }, [error])

  return (
    <KundeShellMitSitzung>
      <FehlerAnsicht fehlernummer={error.digest} nochmal={reset} imLayout />
    </KundeShellMitSitzung>
  )
}
