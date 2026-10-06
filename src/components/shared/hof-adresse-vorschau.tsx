'use client'

import { useEffect, useState } from 'react'
import { checkSlugAvailability } from '@/server/actions/onboarding'
import { generateSlug } from '@/lib/slug'
import { frageAdresseAb, type AdressStand } from '@/lib/hof-adresse'

/**
 * „Wird zu deiner Adresse: farmerzone.at/…" unter dem Hofnamen — auf
 * Registrieren und Einrichten (Nr. 15). Ob die Adresse frei ist, fragt
 * dieselbe Aktion wie bisher Einrichten, 400 ms nach dem letzten Tastendruck.
 * Nur ein Hinweis: createFarm hängt bei einem vergebenen Namen ohnehin eine
 * Zahl an.
 */
export function HofAdresseVorschau({ hofname, id }: { hofname: string; id: string }): React.JSX.Element {
  const [stand, setStand] = useState<AdressStand | null>(null)
  const slug = hofname.trim() ? generateSlug(hofname) : ''

  useEffect(() => {
    if (!hofname.trim()) return
    let aktuell = true
    const warte = setTimeout(async () => {
      // Ohne Antwort (Netzfehler) oder ohne Auskunft (Bremse erreicht, Name zu
      // lang — Nr. 17c) bleibt der alte Stand stehen; er passt nicht zum neuen
      // Slug und zählt daher nicht — die Vorschau ist neutral.
      const neu = await frageAdresseAb(hofname, checkSlugAvailability)
      if (aktuell && neu) setStand(neu)
    }, 400)
    return () => {
      aktuell = false
      clearTimeout(warte)
    }
  }, [hofname])

  const frei = stand?.slug === slug ? stand.frei : null
  return (
    <p id={id} className="mt-1.5 text-[12.5px] break-words text-muted-foreground">
      {!slug ? (
        'Wird zu deiner Adresse: farmerzone.at/dein-hof'
      ) : frei === false ? (
        <span className="text-status-offen">
          farmerzone.at/{slug} ist schon vergeben – du bekommst eine Adresse mit Zahl dahinter, oder du wählst einen
          anderen Namen.
        </span>
      ) : (
        <>Wird zu deiner Adresse: farmerzone.at/{slug}</>
      )}
    </p>
  )
}
