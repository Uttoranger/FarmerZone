/**
 * Was der Hof über die Sichtbarkeit eines eigenen Produkts liest — rein und
 * ohne Datenbank prüfbar (tests/produkt-sichtbarkeit.test.ts).
 *
 * WARUM DIESE DATEI ENTSTAND: Dieselbe Entscheidung lag zweimal im Code —
 * `getStripState` im Produktraster der Hofseite und `getStatus` in der
 * Produktliste. Beide leiteten aus `isAvailable` und `stock` denselben Zustand
 * ab, mit verschiedenen Wörtern dafür. Mit dem Sichtbarkeits-Schalter kommt
 * derselbe Zustand an einem dritten Ort dazu (Schalter und Toast), und drei
 * Stellen mit einer Fachregel driften. Jetzt entscheidet diese Funktion, und
 * die Oberflächen zeigen nur noch an (ARCHITECTURE.md, Abschnitt 1).
 *
 * EIN WORT JE ZUSTAND. „Nicht im Shop" heißt es überall gleich: auf dem
 * Streifen über dem Bild, als Marke in der Liste und im Toast nach dem
 * Umschalten. Das frühere „Ausgeblendet" und das frühere „Pausiert" sind
 * verschwunden — „Pausiert" heißt bei uns der ganze Hof (Hof-Pause), und ein
 * Wort für zwei Dinge lässt den Hof rätseln, was er gerade abgeschaltet hat.
 */
import { LOW_STOCK_THRESHOLD } from '@/lib/dashboard-hints'

/** Die eine Beschriftung des Aus-Zustands — nie eine zweite Fassung daneben. */
export const NICHT_IM_SHOP = 'Nicht im Shop'

/** Die Beschriftung des Schalters. Sie WECHSELT NICHT: Der Zustand steckt in
 *  der Schalterstellung, nicht im Text. Ein Text, der mitwandert, liest sich
 *  beim Umschalten wie eine Frage („Im Shop?") statt wie eine Aussage. */
export const IM_SHOP = 'Im Shop'

export type ProduktZustand =
  | { art: 'nicht-im-shop' }
  | { art: 'ausverkauft' }
  | { art: 'knapp'; bestand: number }
  | { art: 'im-shop'; bestand: number }

/**
 * Der Zustand eines Produkts in der Sicht des Hofes.
 *
 * DIE REIHENFOLGE IST DIE AUSSAGE: „Nicht im Shop" sticht „Ausverkauft". Ein
 * ausgeblendetes Produkt ohne Bestand ist für die Kundin gar nicht da — es
 * „Ausverkauft" zu nennen verspräche, dass es wiederkommt, sobald der Hof
 * nachlegt. Genau umgekehrt bleibt der Schalter bei Bestand 0 AN: Die Kundin
 * sieht dann „Ausverkauft", und das ist gewollt.
 */
export function produktZustand(
  produkt: { isAvailable: boolean; stock: number },
  knappAb: number = LOW_STOCK_THRESHOLD
): ProduktZustand {
  if (!produkt.isAvailable) return { art: 'nicht-im-shop' }
  if (produkt.stock <= 0) return { art: 'ausverkauft' }
  if (produkt.stock <= knappAb) return { art: 'knapp', bestand: produkt.stock }
  return { art: 'im-shop', bestand: produkt.stock }
}

/** Die Beschriftung des Streifens über dem Produktbild im Bearbeitungsmodus. */
export function streifenText(zustand: ProduktZustand): string {
  switch (zustand.art) {
    case 'nicht-im-shop':
      return NICHT_IM_SHOP
    case 'ausverkauft':
      return 'Ausverkauft'
    case 'knapp':
      return `Nur noch ${zustand.bestand} verfügbar`
    case 'im-shop':
      return `${zustand.bestand} verfügbar`
  }
}

/** Die Marke in der Produktliste — kürzer als der Streifen, gleiche Wörter. */
export function markeText(zustand: ProduktZustand): string {
  switch (zustand.art) {
    case 'nicht-im-shop':
      return NICHT_IM_SHOP
    case 'ausverkauft':
      return 'Ausverkauft'
    case 'knapp':
    case 'im-shop':
      return 'Aktiv'
  }
}

/**
 * Der Satz nach dem Umschalten. Er nennt das Produkt, weil der Toast auch dann
 * noch steht, wenn der Hof schon weitergescrollt hat.
 */
export function umschaltMeldung(name: string, imShop: boolean): string {
  return imShop ? `${name} ist wieder im Shop` : `${name} ist nicht mehr im Shop`
}

/**
 * Die Kopfzeile der Produktliste.
 *
 * Gezählt wird `isAvailable`, NICHT der Bestand: Ein ausverkauftes Produkt ist
 * im Shop und wird dort auch gezeigt („Ausverkauft"). Wer es aus der Zählung
 * nähme, ließe den Hof glauben, er habe weniger eingestellt, als die Kundin
 * sieht.
 */
export function zaehleImShop(produkte: readonly { isAvailable: boolean }[]): {
  imShop: number
  gesamt: number
} {
  return {
    imShop: produkte.filter((p) => p.isAvailable).length,
    gesamt: produkte.length,
  }
}

export function kopfzeileProdukte(produkte: readonly { isAvailable: boolean }[]): string {
  const { imShop, gesamt } = zaehleImShop(produkte)
  if (gesamt === 0) return 'Noch keine Produkte'
  return `${imShop} im Shop · ${gesamt} gesamt`
}
