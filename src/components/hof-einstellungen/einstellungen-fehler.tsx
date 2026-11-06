import Link from 'next/link'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'

/**
 * Fehler beim Laden einer Einstellungsseite — inline als orange Hinweiskarte
 * statt der ganzseitigen 500 (DESIGN_SYSTEM „Zustände"). Der Weg zurück ist
 * ein Link auf dieselbe Seite: Sie ist dynamisch, Hinlaufen heißt neu fragen.
 */
export function EinstellungenFehler({ titel, href }: { titel: string; href: string }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-2xl font-semibold text-foreground md:text-[26px]">{titel}</h1>
      <Hinweiskarte
        
        ton="neutral"
        titel="Wir konnten deine Einstellungen gerade nicht laden."
        aktion={
          <Link href={href} className={KNOPF_RAHMEN}>
            Neu laden
          </Link>
        }
      >
        {/* Wörtlich nach Board s1-/w1-einstellungen Bild 2. */}
        Deine Angaben sind nicht verloren. Versuch es noch einmal.
      </Hinweiskarte>
    </div>
  )
}
