'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { MeinHofReiterAlleId } from '@/lib/bauern-navigation'
import { UMSCHALTER_AB_PX, kundenAnsichtAdresse, umschalterBis } from '@/lib/mein-hof-ansicht'
import type { HofseiteZeileId } from '@/schemas/hofseite-vorschau'
import { useSchmalerAls } from '@/lib/use-mindestbreite'
import { meldeGespeichertAnsehen } from '@/components/mein-hof/gespeichert-ansehen'
import { KundenansichtVollbild, useKundenansicht } from '@/components/mein-hof/kundenansicht-vollbild'

/*
 * Die Kundenansicht von „Mein Hof" unter lg (Nachtlauf Nr. 49, Register N4;
 * seit Nr. 107 als Vollbild, N4 ergänzt). Ein Baustein für alle drei Reiter —
 * Produkte (nur unter md, N3), Hofseite und Beiträge; der Inhalt hängt als
 * Kind darunter und bleibt immer stehen. Den Umschalter „Bearbeiten · So
 * sieht’s die Kundin" gibt es seit Nr. 107 nicht mehr: „Kundenansicht" im
 * Kopf (kundenansicht-knopf.tsx), „Gespeichert · Ansehen" und die Adresse
 * `?ansicht=kundin` öffnen ein Vollbild-Blatt (kundenansicht-vollbild.tsx)
 * mit dem bestehenden Rahmen der echten Hofseite (kundenAnsichtAdresse →
 * vorschauLink, keine zweite Darstellung), auf dem passenden Reiter der
 * Hofseite.
 *
 * Ab der Grenze des Reiters (md bzw. lg) öffnet nichts: useSchmalerAls (live
 * über matchMedia, auf dem Server und beim Hydrieren „nein") — ein breiter
 * Bildschirm mit ?ansicht=kundin (Drehen, größeres Fenster, geteilter Link)
 * lädt die Hofseite nicht unsichtbar mit. Dort öffnet der Kopf einen neuen
 * Tab, und auf dem Reiter Hofseite steht die Vorschau neben der Liste.
 *
 * Kopf und Inhalt hängen im Kontext: Der Knopf „Kundenansicht" im Kopf und
 * „Gespeichert · Ansehen" nach dem Speichern öffnen über useMeinHofAnsicht.
 */

export type MeinHofAnsichtSteuerung = {
  /** Öffnet die Kundenansicht; mit Abschnitt umrandet die Hofseite ihn kurz. */
  zeigeKundin: (abschnitt?: HofseiteZeileId | null) => void
  /** „Gespeichert · Ansehen" nach einem Speichern; „Ansehen" öffnet die Kundenansicht beim Abschnitt. */
  gespeichert: (abschnitt?: HofseiteZeileId | null) => void
}

const Steuerung = createContext<MeinHofAnsichtSteuerung | null>(null)

/** Die Steuerung der Kundenansicht — null außerhalb von MeinHofAnsicht. */
export function useMeinHofAnsicht(): MeinHofAnsichtSteuerung | null {
  return useContext(Steuerung)
}

export function MeinHofAnsicht({
  reiter,
  slug,
  kopf,
  children,
}: {
  reiter: MeinHofReiterAlleId
  slug: string
  /** Was über dem Inhalt steht: der Kopf von Mein Hof mit den Reitern, auf /products nur die Reiter. */
  kopf: ReactNode
  /** Der Inhalt des Reiters. */
  children: ReactNode
}): React.JSX.Element {
  // Ob die Kundenansicht hier als Vollbild gilt — erst dann lädt der Rahmen die Hofseite.
  const schmal = useSchmalerAls(UMSCHALTER_AB_PX[umschalterBis(reiter)])
  const kundenansicht = useKundenansicht(schmal)
  const [markiert, setMarkiert] = useState<HofseiteZeileId | null>(null)
  const { oeffne } = kundenansicht

  const zeigeKundin = useCallback(
    (abschnitt: HofseiteZeileId | null = null) => {
      setMarkiert(abschnitt)
      oeffne()
    },
    [oeffne]
  )

  const steuerung = useMemo<MeinHofAnsichtSteuerung>(
    () => ({
      zeigeKundin,
      gespeichert: (abschnitt = null) => meldeGespeichertAnsehen({ abschnitt, onAnsehen: () => zeigeKundin(abschnitt) }),
    }),
    [zeigeKundin]
  )

  return (
    <Steuerung.Provider value={steuerung}>
      {kopf}
      {children}
      <KundenansichtVollbild
        offen={kundenansicht.offen}
        adresse={kundenAnsichtAdresse(slug, reiter)}
        markiert={markiert}
        onSchliessen={kundenansicht.schliesse}
      />
    </Steuerung.Provider>
  )
}
