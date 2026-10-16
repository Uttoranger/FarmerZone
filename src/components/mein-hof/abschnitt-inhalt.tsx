'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { HofseiteZeileId } from '@/schemas/hofseite-vorschau'
import type { FarmSettings } from '@/server/queries/farm'
import type { AppearanceData } from '@/server/queries/appearance'
import {
  AbschnittDarstellungKontext,
  AbschnitteForm,
  AdresseForm,
  KontaktForm,
  LeitspruchForm,
  NameForm,
  UeberUnsForm,
  WerteForm,
  type AbschnittDarstellung,
} from '@/components/mein-hof/abschnitt-formulare'
import { GallerySection, LogoUpload, TitelbildBaustein } from '@/components/mein-hof/bild-bausteine'
import { PickupSlotsClient } from '@/components/settings/pickup-slots-client'
import { PauseClient } from '@/components/settings/pause-client'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'
import type { BildAusschnitt } from '@/schemas/bild-ausschnitt'

/*
 * Was eine Zeile von Mein Hof zum Bearbeiten öffnet (Nachtlauf Nr. 50,
 * Register N4) — EIN Baustein je Abschnitt, ab lg in der Zeile des Editors
 * (components/farmer/hofseite-editor.tsx), unter lg im Blatt von unten
 * (components/mein-hof/abschnitte-liste.tsx). Komplexe Teile kommen als die
 * vorhandenen Bausteine: Titelbild, Logo und Fotos (bild-bausteine.tsx),
 * Abholzeiten und Pause aus den Einstellungen. Standort (Karte) und Zahlungen
 * (Stripe) bleiben Links in ihre Einstellungsseite.
 */

/** Was die Bausteine über den Hof brauchen — ohne Date, ohne Decimal (CODING_STANDARDS §2). */
export type AbschnittHof = {
  slug: string
  /** Für Overlay und Browser-Rähmchen der Vorschau: Name und die Adresse, wie sie Kundinnen sehen. */
  name: string
  adresse: string
  logoUrl: string | null
  bannerType: 'GRADIENT' | 'PHOTO'
  bannerUrl: string | null
  bannerValue: string | null
  bannerFocusY: number
  /** Ausschnitt des Titelbilds, schon geprüft (Register N13, Nr. 97); null = wie vorher. */
  bannerAusschnitt: BildAusschnitt | null
  isPaused: boolean
  pauseMessage: string | null
}

/**
 * Zeilen, deren Baustein sofort speichert (Bilder, Abholzeiten, Pause) oder
 * nur verlinkt (Zahlung): Sie bleiben nach dem Speichern offen — man ändert
 * dort oft mehreres hintereinander. Alle anderen sind Formulare mit
 * „Speichern" und schließen danach.
 */
export const SOFORT_GESPEICHERT: ReadonlySet<HofseiteZeileId> = new Set<HofseiteZeileId>([
  'titelbild',
  'logo',
  'fotos',
  'abholzeiten',
  'zahlung',
  'bestellungen',
])

export function AbschnittInhalt({
  id,
  hof,
  einstellungen,
  auftritt,
  darstellung,
  onGespeichert,
  onAbbrechen,
  meldeErfolg,
  onHochladen,
}: {
  id: HofseiteZeileId
  hof: AbschnittHof
  einstellungen: FarmSettings
  auftritt: AppearanceData
  darstellung: AbschnittDarstellung
  /** Nach jedem erfolgreichen Speichern — Formulare schließen danach (SOFORT_GESPEICHERT nicht). */
  onGespeichert: () => void
  onAbbrechen: () => void
  /** Ersetzt den eigenen Erfolgs-Toast (unter lg: „Gespeichert · Ansehen"). */
  meldeErfolg?: () => void
  /** Meldet, solange ein Foto hochlädt — Zeile und Blatt bleiben dann offen. */
  onHochladen?: (laeuft: boolean) => void
}): React.JSX.Element {
  const formular = { onGespeichert, onAbbrechen, meldeErfolg }

  function inhalt(): React.ReactNode {
    switch (id) {
      case 'titelbild':
        return (
          <TitelbildBaustein
            hof={hof}
            anschrift={einstellungen}
            logoAusschnitt={auftritt.logoAusschnitt}
            onGespeichert={onGespeichert}
            meldeErfolg={meldeErfolg}
            onHochladen={onHochladen}
          />
        )
      case 'logo':
        // Der Schlüssel wechselt mit dem Logo: Nach dem Neuladen zeigt der Baustein den neuen Stand.
        return (
          <LogoUpload
            key={hof.logoUrl ?? 'kein-logo'}
            logoUrl={hof.logoUrl}
            logoAusschnitt={auftritt.logoAusschnitt}
            onUploaded={onGespeichert}
            meldeErfolg={meldeErfolg}
            onHochladen={onHochladen}
          />
        )
      case 'name':
        return <NameForm einstellungen={einstellungen} {...formular} />
      case 'tagline':
        return <LeitspruchForm auftritt={auftritt} {...formular} />
      case 'ueber-uns':
        return <UeberUnsForm auftritt={auftritt} {...formular} />
      case 'werte':
        return <WerteForm auftritt={auftritt} {...formular} />
      case 'fotos':
        return <GallerySection initialPhotos={auftritt.farmPhotos} onGespeichert={onGespeichert} meldeErfolg={meldeErfolg} onHochladen={onHochladen} />
      case 'adresse':
        return <AdresseForm einstellungen={einstellungen} {...formular} />
      case 'abholzeiten':
        return <PickupSlotsClient initialSlots={einstellungen.pickupSlots} onGespeichert={onGespeichert} meldeErfolg={meldeErfolg} />
      case 'zahlung':
        return (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Bar bei Abholung geht immer. Online-Zahlung läuft über ein Stripe-Konto — das richtest du in den Einstellungen ein.
            </p>
            <Link
              href="/settings/payments"
              className={cn(
                'inline-flex min-h-11 items-center gap-1 rounded-sm text-sm font-semibold text-brand-text underline-offset-2 hover:underline',
                FOKUS_RAHMEN
              )}
            >
              Zahlungen einrichten
              <ArrowRight className="size-4" strokeWidth={1.7} aria-hidden="true" />
            </Link>
          </div>
        )
      case 'kontakt':
        return <KontaktForm einstellungen={einstellungen} {...formular} />
      case 'bestellungen':
        return <PauseClient initialPaused={hof.isPaused} initialMessage={hof.pauseMessage} onGespeichert={onGespeichert} meldeErfolg={meldeErfolg} />
      case 'abschnitte':
        return <AbschnitteForm auftritt={auftritt} {...formular} />
    }
  }

  return (
    <AbschnittDarstellungKontext wert={darstellung}>
      {/* data-app-palette: Abholzeiten und Pause zeichnen noch mit --app-*; hier
          nehmen sie die Werte des Design-Systems an (globals.css) — auch im
          Blatt, das außerhalb der Seite in <body> hängt. */}
      <div data-app-palette="neu">{inhalt()}</div>
    </AbschnittDarstellungKontext>
  )
}
