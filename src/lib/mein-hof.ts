/**
 * Der Kopf von „Mein Hof" (components/mein-hof/seitenkopf.tsx, unter lg
 * mein-hof-kopf.tsx) — was er über den Hof sagt. Rein und ohne Datenbank
 * prüfbar (tests/mein-hof.test.ts, tests/mein-hof-zustand.test.ts).
 */
import { vorlaufInWochen, type KaufSperre } from '@/lib/bereiche-anzeige'
import { ABHOLZEILE_TEXT, formatiereAbholung, type NaechsteAbholung } from '@/lib/hofuebersicht'

/**
 * Die Adresse von Mein Hof, Reiter Hofseite — EINE Quelle. Hier statt in der
 * Navigation (bauern-navigation.ts gibt sie weiter): Die Liste der Abschnitte
 * (hofseite-fortschritt.ts) braucht sie für ihre Ziele und steht über die
 * Markierung auch im Bündel der Hofseite für Kundinnen — die Navigation des
 * Hofbereichs gehört dort nicht hinein.
 */
export const HOFSEITE_HREF = '/farm-page'

/**
 * Ersatz-Titelbild, wenn ein Hof noch kein Foto hochgeladen hat. Bildersatz,
 * kein Anstrich — die Verläufe folgen dem Modus bewusst nicht. Eine Quelle für
 * die Hofseite (farm-page-view.tsx) und den Streifen im Kopf.
 */
export const TITELBILD_VERLAEUFE: Record<string, string> = {
  tannengruen: 'linear-gradient(135deg, #1F4732 0%, #3D7B58 60%, #E8F0E8 100%)',
  wiese: 'linear-gradient(135deg, #2D6A4F 0%, #52B788 50%, #D8F3DC 100%)',
  erde: 'linear-gradient(135deg, #6B4226 0%, #A0663E 55%, #F5E6D8 100%)',
  herbst: 'linear-gradient(135deg, #7B4F00 0%, #D4900A 55%, #FFF3CC 100%)',
}

/** Der Verlauf zu einem gespeicherten Wert — Unbekanntes fällt auf Tannengrün. */
export function titelbildVerlauf(bannerValue: string | null | undefined): string {
  return TITELBILD_VERLAEUFE[bannerValue ?? 'tannengruen'] ?? TITELBILD_VERLAEUFE.tannengruen
}

/**
 * Das hochgeladene Titelbild, sonst null (dann gilt der Verlauf). Eine Stelle
 * für Hofseite und Streifen — `bannerValue` kann laut Schema auch eine
 * Foto-URL tragen, maßgeblich ist aber nur PHOTO mit `bannerUrl`.
 */
export function titelbildFoto(hof: { bannerType: string; bannerUrl: string | null }): string | null {
  return hof.bannerType === 'PHOTO' && hof.bannerUrl ? hof.bannerUrl : null
}

export type HofZustandArt = 'sichtbar' | 'pausiert' | 'wartet' | 'aus' | 'stillgelegt'

/**
 * Farbe eines Schilds — Bedeutungsfarben; die EINE Zuordnung zur Marke ist
 * `schildTon` (unten), gezeichnet von StatusBadge über den Baustein Marke
 * (Register G5). Rot setzt heute kein Zustand.
 */
export type SchildFarbe = 'gruen' | 'bernstein' | 'grau' | 'rot'

/**
 * Das Schild im neuen Design als StatusBadge-Ton (components/ui/status-badge.tsx):
 * Grün = fertig, Bernstein = offen (Orange), Grau = neutral. Rot gibt es dort
 * nicht — „Ausverkauft" und Ähnliches ist ein offener Zustand.
 */
export function schildTon(farbe: SchildFarbe): 'offen' | 'fertig' | 'neutral' {
  if (farbe === 'gruen') return 'fertig'
  if (farbe === 'grau') return 'neutral'
  return 'offen'
}

export type HofZustand = {
  art: HofZustandArt
  /**
   * Das Schild im Kopf. null bei einem stillgelegten Hof: Den Zustand sagt
   * der Balken über jeder Seite, ein zweites Schild darunter wäre Nachhall.
   */
  schild: { text: string; farbe: SchildFarbe } | null
  /** Die Hofseite ist öffentlich erreichbar — nur dann gibt es Link, Kopieren, Kundenansicht und Teilen. */
  oeffentlich: boolean
}

const NOCH_NICHT_FREIGEGEBEN = { text: 'Noch nicht freigegeben', farbe: 'grau' } as const

/**
 * Der Zustand des Hofs in einem Wort. Reihenfolge nach farm-approval.ts:
 * stillgelegt → nicht öffentlich → nicht freigeschaltet → pausiert.
 * Ein pausierter Hof bleibt öffentlich (mit Hinweis), die anderen nicht —
 * einen Link zu teilen, der ins Leere führt, wäre irreführend. Nicht
 * öffentlich (isActive false, wird heute nirgends gesetzt) und „wartet"
 * tragen dasselbe graue Schild: Für den Hof heißt beides, dass Kundinnen die
 * Seite noch nicht sehen.
 */
export function hofZustand(hof: {
  isActive: boolean
  isPaused: boolean
  approvedAt: Date | null
  archivedAt: Date | null
}): HofZustand {
  if (hof.archivedAt) return { art: 'stillgelegt', schild: null, oeffentlich: false }
  if (!hof.isActive) return { art: 'aus', schild: NOCH_NICHT_FREIGEGEBEN, oeffentlich: false }
  if (!hof.approvedAt) return { art: 'wartet', schild: NOCH_NICHT_FREIGEGEBEN, oeffentlich: false }
  if (hof.isPaused) return { art: 'pausiert', schild: { text: 'Pausiert', farbe: 'bernstein' }, oeffentlich: true }
  return { art: 'sichtbar', schild: { text: 'Öffentlich', farbe: 'gruen' }, oeffentlich: true }
}

/**
 * Die Adresse der Hofseite, wie der Kopf sie zeigt: Host und Slug, ohne
 * Protokoll (Domain/muellerhof). Ein Bauer liest eine Adresse, kein
 * „https://". Die vollständige Adresse (zum Öffnen und Kopieren) bleibt
 * daneben; ein ungültiger appUrl fällt auf den rohen Wert zurück.
 */
export function hofAdresse(appUrl: string, slug: string): { anzeige: string; url: string } {
  const url = `${appUrl.replace(/\/+$/, '')}/${slug}`
  let host = appUrl
  try {
    host = new URL(appUrl).host
  } catch {
    // Kein gültiger Ursprung (z. B. leer) — dann steht die Adresse eben roh da.
  }
  return { anzeige: `${host}/${slug}`, url }
}

// ─── Zustandszeile im Kopf am Handy (Register N3, Ergänzung 22.10.2026; Nr. 143) ──

/**
 * Die Wörter der Zustandszeile, an den Hof gerichtet — EINE Quelle. Die Karte der
 * Kundin (`kaufSperreHinweis`) spricht von „{Hof} hat …“ und steht hier nicht; der
 * Titel „Noch nicht bestellbar“ ist derselbe wie auf /hoefe (ABHOLZEILE_TEXT), der
 * Vorlauf derselbe wie in der Karte der Kundin (vorlaufInWochen).
 */
export const ZUSTANDSZEILE_TEXT = {
  aus: { titel: NOCH_NICHT_FREIGEGEBEN.text, satz: 'Kundinnen sehen deinen Hof nach der Freigabe.' },
  pausiert: { titel: 'Pausiert', satz: 'Bestellen kann gerade niemand.', knopf: 'Fortsetzen' },
  keineAbholzeit: { titel: ABHOLZEILE_TEXT.nichtBestellbar, satz: 'Es fehlen Abholzeiten.', knopf: 'Eintragen' },
  ausgebucht: { titel: 'Gerade ausgebucht', satz: `Alle Abholzeiten ${vorlaufInWochen()} sind voll.`, knopf: 'Abholzeiten' },
  keinProdukt: { titel: ABHOLZEILE_TEXT.nichtBestellbar, satz: 'Kein Produkt ist gerade zu kaufen.', knopf: 'Produkte' },
  nimmtAn: { titel: 'Nimmt Bestellungen an', satz: 'Nächste Abholung: ', knopf: 'Pausieren' },
  // N34: Die Sperre des Teams kann der Hof nicht selbst aufheben — darum ohne Knopf.
  gesperrt: { titel: 'Vom Team gesperrt', satz: 'Bestellen kann gerade niemand. Antworte im Postfach.' },
} as const

/** Was der Knopf der Zeile tut — die Adresse bzw. die Handlung wählt der Kopf (mein-hof-kopf.tsx). */
export type ZustandsKnopfArt = 'fortsetzen' | 'pausieren' | 'eintragen' | 'abholzeiten' | 'produkte'

export type ZustandsZeile = {
  ton: 'gruen' | 'orange' | 'grau'
  titel: string
  satz: string
  knopf: null | { art: ZustandsKnopfArt; text: string }
}

/**
 * Die Zustandszeile im Kopf von Mein Hof am Handy, oder null. Reihenfolge:
 *  - stillgelegt und „wartet auf Freigabe“ → null: Das sagt schon der Balken über
 *    jeder Seite der HofShell (eine Fassung je Zustand, DESIGN_SYSTEM). `zustand`
 *    kommt dafür mit der Bedingung des Balkens (ladeMeinHofZustand), nicht aus
 *    hofZustand allein.
 *  - aus (freigeschaltet, aber nicht aktiv) → grau, ohne Knopf.
 *  - vom Team gesperrt (N34) → orange, ohne Knopf; sticht die Pause wie bei der Kundin.
 *  - pausiert → Fortsetzen; keine Abholzeit → Eintragen; ausgebucht → Abholzeiten;
 *    kein kaufbares Produkt → Produkte (dieselbe Regel wie `istBestellbar` auf /hoefe).
 *  - sonst → grün mit der nächsten Abholung im Hausformat und „Pausieren“.
 * `sperre` und `naechste` rechnet der Server aus denselben Fenstern (kaufSperre,
 * naechsteAbholung) — wie bei der Kundin.
 */
export function zustandsZeile({
  zustand,
  sperre,
  naechste,
  kaufbar,
}: {
  zustand: HofZustandArt
  sperre: KaufSperre
  naechste: NaechsteAbholung | null
  kaufbar: boolean
}): ZustandsZeile | null {
  const t = ZUSTANDSZEILE_TEXT
  if (zustand === 'stillgelegt' || zustand === 'wartet') return null
  if (zustand === 'aus') return { ton: 'grau', ...t.aus, knopf: null }
  if (sperre === 'gesperrt') return { ton: 'orange', ...t.gesperrt, knopf: null }
  if (zustand === 'pausiert') return { ton: 'orange', titel: t.pausiert.titel, satz: t.pausiert.satz, knopf: { art: 'fortsetzen', text: t.pausiert.knopf } }
  if (sperre === 'keine-abholzeit') {
    return { ton: 'orange', titel: t.keineAbholzeit.titel, satz: t.keineAbholzeit.satz, knopf: { art: 'eintragen', text: t.keineAbholzeit.knopf } }
  }
  // Ohne nächste Abholung ist alles im Vorlauf voll — dieselbe Rechnung wie kaufSperre.
  if (sperre === 'ausgebucht' || naechste === null) {
    return { ton: 'orange', titel: t.ausgebucht.titel, satz: t.ausgebucht.satz, knopf: { art: 'abholzeiten', text: t.ausgebucht.knopf } }
  }
  if (!kaufbar) {
    return { ton: 'orange', titel: t.keinProdukt.titel, satz: t.keinProdukt.satz, knopf: { art: 'produkte', text: t.keinProdukt.knopf } }
  }
  return {
    ton: 'gruen',
    titel: t.nimmtAn.titel,
    satz: `${t.nimmtAn.satz}${formatiereAbholung(naechste)}`,
    knopf: { art: 'pausieren', text: t.nimmtAn.knopf },
  }
}
