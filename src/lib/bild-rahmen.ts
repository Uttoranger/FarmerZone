import { AUSSCHNITT_STANDARD } from '@/lib/bild-ausschnitt'
import type { BildAusschnitt } from '@/schemas/bild-ausschnitt'

/*
 * Rahmen und Vorschau je Zweck des Bild-Bausteins (Register N17, Nachtlauf
 * Nr. 98; Mockups system-h1-bild-baustein, mobil-h2-produktfoto-ausschnitt):
 * derselbe Baustein (components/shared/bild-ausschnitt.tsx), nur andere Rahmen.
 * Das Titelbild hat seine Rahmen in lib/titelbild.ts (Nr. 97).
 *
 * Die Verhältnisse sind Breite ÷ Höhe der echten Stellen: Wer hier etwas
 * ändert, ändert, was die Vorschau verspricht — die Stelle selbst muss mit.
 */

/** Das Logo steht überall rund und quadratisch: Hofseite 96 px, Mein Hof 72 px, Karten und Seitenleiste 40 px. */
export const LOGO_RAHMEN = 1
export const LOGO_VORSCHAU_PX = { hofseite: 96, meinHof: 72, klein: 40 } as const

/** Produktkarte am Computer (Hofseite): 260 × 140 — der Hauptrahmen des Produktfotos. */
export const PRODUKT_RAHMEN_KARTE = 260 / 140
/** Produktkarte am Handy: 64 × 64, quadratisch. */
export const PRODUKT_VORSCHAU_LISTE_HANDY = 1
/** Produktseite am Handy: das Foto über die volle Breite, 390 × 200. */
export const PRODUKT_VORSCHAU_SEITE_HANDY = 390 / 200
/** Produktseite am Computer: 300 × 300. */
export const PRODUKT_VORSCHAU_SEITE_COMPUTER = 1

/** Galerie-Kachel am Computer 260 × 140 (Hauptrahmen), am Handy 160 × 120. */
export const GALERIE_RAHMEN_KACHEL = 260 / 140
export const GALERIE_VORSCHAU_HANDY = 160 / 120

/** Das Beitragsfoto auf der Hofseite: 3 : 2. */
export const BEITRAG_RAHMEN = 3 / 2

/** Die Texte rund um den Bild-Baustein bei Logo, Produktfoto, Galerie und Beitragsfoto — eine Quelle. */
export const BILD_RAHMEN_TEXT = {
  anpassen: 'Ausschnitt anpassen',
  /** Gleich nach dem Upload statt „Abbrechen“: speichert `null`, das Foto steht wie heute (Freigabe 98, Punkt 6). */
  passtSo: 'Passt so',
  /** „Speichern“ im Produktdialog: Der Baustein übernimmt nur, geschrieben wird mit dem Produkt. */
  uebernehmen: 'Übernehmen',
  gespeichert: 'Ausschnitt gespeichert',
  /** 0 Zeilen beim Speichern: Das Produkt, das Foto oder der Beitrag ist weg — oder gehört einem anderen Hof. */
  fotoFehlt: 'Dieses Foto gibt es nicht mehr. Lade die Seite neu.',
  logo: {
    rahmen: 'Logo',
    groessen: 'So sieht es aus',
    groessenSatz: 'Von links: Hofseite, Mein Hof, Karten und Seitenleiste.',
    satz: 'Ein Logo bekommt keinen Filter — es ist das Zeichen deines Hofs.',
  },
  produkt: {
    titel: 'Produktfoto',
    hilfe: 'Zieh das Foto in den Rahmen.',
    rahmen: 'Ausschnitt',
    liste: 'So sieht es in der Liste aus',
    listeSatz: 'Links am Handy (quadratisch), rechts am Computer (breit) – derselbe Fokus.',
    seite: 'Auf der Produktseite',
    satz: 'Ein Fokus für alle Größen: Karte am Handy und Computer, Produktseite. Das Foto selbst bleibt unverändert gespeichert.',
    nichtGespeichert:
      'Das Produkt ist gespeichert, nur den Ausschnitt des Fotos konnten wir nicht speichern. Öffne das Produkt und versuch es noch einmal.',
  },
  galerie: {
    rahmen: 'Kachel',
    vorschauHandy: 'So sieht es am Handy aus',
    satz: 'Groß angesehen zeigen wir das ganze Foto.',
  },
  beitrag: {
    rahmen: 'Beitrag',
    satz: 'Mit Ausschnitt füllt das Foto den Rahmen, sonst zeigen wir es ganz.',
    nichtGespeichert: 'Der Beitrag ist veröffentlicht, nur den Ausschnitt des Fotos konnten wir nicht speichern. Du kannst den Beitrag so lassen.',
  },
} as const

/** Was die Aktion bei Logo, Produktfoto, Galerie und Beitragsfoto nimmt: ohne die Wahl füllen/ganz, die gibt es nur beim Titelbild. */
export type FotoAusschnitt = Omit<BildAusschnitt, 'darstellung'>

/**
 * Mitte, 100 %, Natürlich ist kein Ausschnitt, sondern „wie heute“: `null`.
 * Die Aktion speichert es so — und wer vor dem Speichern anzeigt (Beitrag,
 * Produktdialog), zeigt es genauso: Beim Beitrag steht das Foto ohne
 * Ausschnitt ganz, mit Ausschnitt füllt es den Rahmen.
 */
export function ausschnittOderNull<T extends FotoAusschnitt>(wert: T): T | null {
  const standard =
    wert.fokusX === AUSSCHNITT_STANDARD.fokusX &&
    wert.fokusY === AUSSCHNITT_STANDARD.fokusY &&
    wert.zoom === AUSSCHNITT_STANDARD.zoom &&
    wert.filter === AUSSCHNITT_STANDARD.filter
  return standard ? null : wert
}

/** Der Wert aus dem Baustein ohne die Wahl füllen/ganz — das strenge Schema der Aktion wiese sie sonst ab. */
export function alsFotoAusschnitt(wert: BildAusschnitt): FotoAusschnitt {
  return { fokusX: wert.fokusX, fokusY: wert.fokusY, zoom: wert.zoom, filter: wert.filter }
}
