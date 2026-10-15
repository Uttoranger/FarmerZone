import type { StartseitenBlockDaten } from '@/lib/startseite-gestalten'
import type { StartseitenHof } from '@/lib/startseite'
import { Saisonkarte } from './saisonkarte'
import { Hinweisband } from './hinweisband'
import { HoefeAuswahl } from './hoefe-auswahl'
import { KategorieHinweis } from './kategorie-hinweis'

/**
 * Ein Block der Startseite (Register N16, Nr. 96) — je Vorlage die eine
 * Komponente. Ohne Datenbank und ohne Server-Import, damit Admin › Startseite
 * dieselben Komponenten in der Vorschau-Kachel zeigt wie die Seite.
 */
export function StartseitenBlock({
  block,
  hoefe = [],
  kategorieBild = null,
}: {
  block: StartseitenBlockDaten
  /** Nur Höfe-Auswahl: die gewählten Höfe, die noch öffentlich sichtbar sind. */
  hoefe?: readonly StartseitenHof[]
  /** Nur Kategorie-Hinweis: die Illustration der Kategorie. */
  kategorieBild?: string | null
}): React.JSX.Element | null {
  switch (block.vorlage) {
    case 'SAISONKARTE':
      return <Saisonkarte block={block} />
    case 'HINWEISBAND':
      return <Hinweisband block={block} />
    case 'HOEFE_AUSWAHL':
      return <HoefeAuswahl block={block} hoefe={hoefe} />
    case 'KATEGORIE_HINWEIS':
      return <KategorieHinweis block={block} bild={kategorieBild} />
  }
}
