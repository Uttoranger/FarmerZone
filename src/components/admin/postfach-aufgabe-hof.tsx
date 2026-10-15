'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AdminHofZeile } from '@/lib/admin-hoefe'
import { KNOPF_GRUEN, KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'
import { HofAktionDialog, type HofAktion } from './hof-aktion-dialog'

/**
 * Freischalten und Ablehnen in der Aufgabe „Hof wartet" des Eingangs
 * (Register N14, Nr. 95; Mockup admin-postfach) — dieselbe Rückfrage und
 * dieselben Actions wie Admin › Höfe (HofAktionDialog: approveFarmAction prüft
 * E-Mail und Stripe selbst, rejectFarmAction seine Guards). Ohne Stripe oder
 * bestätigte E-Mail bleibt „Freischalten" gesperrt, der Grund steht im
 * Titel des Knopfs und in der Prüfliste. Nach dem Dialog lädt die Seite neu:
 * Eine erledigte Aufgabe verschwindet aus dem Eingang.
 */
export function PostfachHofAktionen({ hof, vergebenePlaetze }: { hof: AdminHofZeile; vergebenePlaetze: number }): React.JSX.Element {
  const router = useRouter()
  const [aktion, setAktion] = useState<HofAktion | null>(null)
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 sm:flex sm:justify-end">
        <button type="button" onClick={() => setAktion({ hof, art: 'reject' })} className={KNOPF_RAHMEN}>
          Ablehnen
        </button>
        <button type="button" onClick={() => setAktion({ hof, art: 'approve' })} disabled={hof.sperre !== null} title={hof.sperre ?? undefined} className={KNOPF_GRUEN}>
          Freischalten
        </button>
      </div>
      <HofAktionDialog
        aktion={aktion}
        vergebenePlaetze={vergebenePlaetze}
        onClose={() => {
          setAktion(null)
          router.refresh()
        }}
      />
    </>
  )
}
