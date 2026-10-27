/**
 * Admin › Bestellungen (Register N32, N34; Nachtlauf Nr. 186; Mockup
 * admin-bestellungen): rein — Fälle mit „Was tun“, wann der Notfall-Storno
 * geht, der Verlauf, die Adresse der Seite und alle Sätze. Gelesen wird in
 * src/server/queries/admin-bestellungen.ts, geschrieben in
 * src/server/actions/admin-bestellung.ts.
 *
 * Der Admin sieht jede Bestellung, ändert aber nur, was der Hof nicht selbst
 * kann: Erstattung abschließen, im Notfall stornieren (mit Grund, nur vor der
 * Abholung) und Mails nochmal schicken (über Admin › Betrieb › E-Mails).
 */
import type { MailZeitraum } from '@/schemas/betrieb-mails'
import type { BestellFilter, BestellStandFilter } from '@/schemas/admin-bestellung'
import type { AdminAktionArt } from '@/schemas/admin-aktion'
import { ABHOLUNG_ERLEDIGT } from '@/lib/heute'
import { OFFEN_STATUS } from '@/lib/hof-bestellungen'
import { formatTagKurz } from '@/lib/format'
import { kalendertagInWien } from '@/lib/wiener-tag'
import { uhrzeitInWien } from '@/lib/fristen'

// ─── Adressen ────────────────────────────────────────────────────────────────

export const ADMIN_BESTELLUNGEN_HREF = '/admin/bestellungen'

/** Die Akte eines Hofs (Nr. 187, `/admin/hoefe/[id]`). */
export function hofAkteHref(farmId: string): string {
  return `/admin/hoefe/${encodeURIComponent(farmId)}`
}

/** Die Adresse der Seite mit Suche, Filter und gewählter Bestellung — Standardwerte bleiben weg. */
export function bestellungenHref(f: Partial<BestellFilter>, extra: { suche?: string; bestellung?: string } = {}): string {
  const p = new URLSearchParams()
  if (extra.suche) p.set('suche', extra.suche)
  if (f.stand) p.set('stand', f.stand)
  if (f.hof) p.set('hof', f.hof)
  if (f.zeitraum && f.zeitraum !== '90t') p.set('zeitraum', f.zeitraum)
  if (f.erstattungOffen) p.set('offen', '1')
  if (extra.bestellung) p.set('bestellung', extra.bestellung)
  const q = p.toString()
  return q ? `${ADMIN_BESTELLUNGEN_HREF}?${q}` : ADMIN_BESTELLUNGEN_HREF
}

// ─── Filter ──────────────────────────────────────────────────────────────────

/** Welche Status ein Stand meint — „offen“ ist dieselbe Liste wie beim Hof (OFFEN_STATUS). */
export const STAND_STATUS: Record<BestellStandFilter, readonly string[]> = {
  offen: OFFEN_STATUS,
  abgeholt: ['PICKED_UP'],
  nicht_abgeholt: ['NOT_PICKED_UP'],
  storniert: ['CANCELLED'],
}

export const STAND_NAME: Record<BestellStandFilter, string> = {
  offen: 'Offen',
  abgeholt: 'Abgeholt',
  nicht_abgeholt: 'Nicht abgeholt',
  storniert: 'Storniert',
}

export const BESTELL_ZEITRAUM_NAME: Record<Extract<MailZeitraum, '7t' | '30t' | '90t'>, string> = { '7t': '7 Tage', '30t': '30 Tage', '90t': '90 Tage' }

// ─── Notfall-Storno (N34) ────────────────────────────────────────────────────

/**
 * Die Stände, in denen NICHT mehr storniert wird — dieselbe Liste wie die
 * Sperre im Storno des Hofs (`storniere`, src/server/stornieren.ts) und seine
 * Knöpfe (`bestellAktionen`): abgeholt, storniert, nicht abgeholt.
 */
export const STORNO_GESPERRT: readonly string[] = ABHOLUNG_ERLEDIGT

/** Geht der Notfall-Storno? Sonst mit dem Satz, warum nicht (steht am gesperrten Knopf). */
export function notfallStornoStand(b: { status: string }): { moeglich: true } | { moeglich: false; grund: string } {
  if (!STORNO_GESPERRT.includes(b.status)) return { moeglich: true }
  if (b.status === 'CANCELLED') return { moeglich: false, grund: ADMIN_BESTELLUNG_TEXT.stornoSchonStorniert }
  return { moeglich: false, grund: ADMIN_BESTELLUNG_TEXT.stornoNachAbholung }
}

// ─── Fälle und „Was tun“ ─────────────────────────────────────────────────────

/** Was eine Bestellung für den Support ist — mit Titel und „Was tun“ (eine Liste, BESTELL_FAELLE). */
export type BestellFall =
  | 'erstattung_offen'
  | 'zahlung_offen'
  | 'wartet_auf_bestaetigung'
  | 'laeuft'
  | 'abgeholt'
  | 'nicht_abgeholt'
  | 'storniert_erstattet'
  | 'storniert_ausserhalb'
  | 'storniert'

export const BESTELL_FAELLE: Record<BestellFall, { titel: string; wasTun: string; ton: 'tun' | 'ruhig' }> = {
  erstattung_offen: {
    titel: 'Erstattung gescheitert',
    wasTun:
      'Stripe konnte nicht zurückbuchen. Sieh in Stripe nach, warum. Ist zum Beispiel die Karte abgelaufen, hilft nochmal anstoßen nicht: Bitte die Kundin um ihre Bankverbindung, überweise selbst und klick dann „Außerhalb erstattet“.',
    ton: 'tun',
  },
  zahlung_offen: {
    titel: 'Zahlung nicht abgeschlossen',
    wasTun: 'Die Kundin hat online noch nicht fertig bezahlt. Bleibt die Zahlung aus, fällt die Bestellung von selbst weg und die Ware wird wieder frei.',
    ton: 'ruhig',
  },
  wartet_auf_bestaetigung: {
    titel: 'Wartet auf die Kundin',
    wasTun: 'Die Kundin muss die Bestellung über den Link in der Mail bestätigen. Kam keine Mail an, schick die Bestätigung unten nochmal.',
    ton: 'ruhig',
  },
  laeuft: {
    titel: 'Läuft beim Hof',
    wasTun: 'Bei Fragen zu Ware oder Abholung zuerst den Hof schreiben. Stornieren kann der Hof selbst – den Notfall-Storno nur, wenn er nicht erreichbar ist.',
    ton: 'ruhig',
  },
  abgeholt: { titel: 'Abgeholt', wasTun: 'Nichts zu tun.', ton: 'ruhig' },
  nicht_abgeholt: { titel: 'Nicht abgeholt', wasTun: 'Der Hof hat die Bestellung als nicht abgeholt vermerkt. Nichts zu tun, außer die Kundin fragt nach.', ton: 'ruhig' },
  storniert_erstattet: { titel: 'Storniert und erstattet', wasTun: 'Die Kundin bekommt ihr Geld über Stripe zurück – das dauert bei der Bank einige Tage.', ton: 'ruhig' },
  storniert_ausserhalb: { titel: 'Storniert, außerhalb erstattet', wasTun: 'Die Erstattung ist außerhalb von Stripe abgeschlossen. Nichts zu tun.', ton: 'ruhig' },
  storniert: { titel: 'Storniert', wasTun: 'Es wurde nichts bezahlt, also gibt es nichts zu erstatten.', ton: 'ruhig' },
}

export type BestellungFuerFall = {
  status: string
  paymentMethod: string
  paymentStatus: string
  erstattungOffenSeit: Date | null
}

/** Welcher Fall vorliegt — die offene Erstattung zuerst, weil nur sie Geld schuldet. */
export function bestellFall(b: BestellungFuerFall): BestellFall {
  if (b.erstattungOffenSeit !== null) return 'erstattung_offen'
  if (b.status === 'CANCELLED') {
    if (b.paymentStatus === 'REFUNDED') return 'storniert_erstattet'
    if (b.paymentMethod === 'ONLINE' && b.paymentStatus === 'PAID') return 'storniert_ausserhalb'
    return 'storniert'
  }
  if (b.status === 'PICKED_UP') return 'abgeholt'
  if (b.status === 'NOT_PICKED_UP') return 'nicht_abgeholt'
  if (b.paymentMethod === 'ONLINE' && b.paymentStatus !== 'PAID') return 'zahlung_offen'
  if (b.status === 'PENDING_CONFIRMATION') return 'wartet_auf_bestaetigung'
  return 'laeuft'
}

/** Darf „Außerhalb erstattet“ hier stehen? Nur bei offener Erstattung — sonst gibt es nichts abzuschließen. */
export function ausserhalbErstattetMoeglich(b: Pick<BestellungFuerFall, 'erstattungOffenSeit'>): boolean {
  return b.erstattungOffenSeit !== null
}

// ─── Verlauf ─────────────────────────────────────────────────────────────────

/** Ein Protokoll-Eintrag zur Bestellung (N33) — ohne Person, nur ob mit Passkey. */
export type BestellProtokoll = { wann: Date; art: string; grund: string | null; mitPasskey: boolean }

export type BestellungFuerVerlauf = {
  createdAt: Date
  paidAt: Date | null
  confirmedAt: Date | null
  pickedUpAt: Date | null
  cancelledAt: Date | null
  cancelReason: string | null
  erstattungOffenSeit: Date | null
  status: string
  paymentMethod: string
}

export type VerlaufEintrag = { wann: Date; text: string; zusatz: string | null; ton: 'tun' | 'ruhig' }

/** Wie ein Protokoll-Eintrag im Verlauf heißt — unbekannte Arten mit ihrem Schlüssel. */
const PROTOKOLL_TEXT: Partial<Record<AdminAktionArt, string>> = {
  notfall_storno: 'Notfall-Storno durch das Team',
  erstattung_erledigt: 'Außerhalb erstattet',
  adresse_angezeigt: 'Volle Adresse angezeigt',
  mail_nochmal: 'Mail nochmal geschickt',
  mail_jetzt_geschickt: 'Mail jetzt geschickt',
  mail_verworfen: 'Mail verworfen',
}

/**
 * Der Verlauf aus Bestellung und Protokoll, ältestes zuerst. Ein Ereignis
 * von Stripe (WebhookEvent) trägt keinen Bezug zur Bestellung und steht darum
 * nicht hier; was es bewirkt hat, steht in der Bestellung (bezahlt,
 * erstattet, Erstattung offen).
 */
export function bestellVerlauf(b: BestellungFuerVerlauf, protokoll: readonly BestellProtokoll[]): VerlaufEintrag[] {
  const eintraege: VerlaufEintrag[] = [{ wann: b.createdAt, text: 'Bestellt', zusatz: null, ton: 'ruhig' }]
  if (b.paidAt) eintraege.push({ wann: b.paidAt, text: 'Online bezahlt', zusatz: null, ton: 'ruhig' })
  if (b.confirmedAt) eintraege.push({ wann: b.confirmedAt, text: 'Von der Kundin bestätigt', zusatz: null, ton: 'ruhig' })
  if (b.pickedUpAt) eintraege.push({ wann: b.pickedUpAt, text: 'Abgeholt', zusatz: null, ton: 'ruhig' })
  if (b.cancelledAt) {
    const vomTeam = protokoll.some((p) => p.art === 'notfall_storno')
    eintraege.push({ wann: b.cancelledAt, text: vomTeam ? 'Vom Team storniert' : 'Storniert', zusatz: b.cancelReason ? `„${b.cancelReason}“` : null, ton: 'ruhig' })
  }
  if (b.erstattungOffenSeit) eintraege.push({ wann: b.erstattungOffenSeit, text: 'Erstattung gescheitert – offen', zusatz: null, ton: 'tun' })
  for (const p of protokoll) {
    const teile = [p.grund ? `„${p.grund}“` : null, p.mitPasskey ? 'mit Passkey' : null].filter((t): t is string => t !== null)
    eintraege.push({ wann: p.wann, text: PROTOKOLL_TEXT[p.art as AdminAktionArt] ?? p.art, zusatz: teile.length > 0 ? teile.join(' · ') : null, ton: 'ruhig' })
  }
  return eintraege.sort((x, y) => x.wann.getTime() - y.wann.getTime())
}

/** „Mi, 22. Okt, 19:04“ — Wiener Tag und Uhrzeit. */
export function zeitpunktText(zeitpunkt: Date): string {
  return `${formatTagKurz(kalendertagInWien(zeitpunkt))}, ${uhrzeitInWien(zeitpunkt)}`
}

// ─── Sätze ───────────────────────────────────────────────────────────────────

export type HofNachrichtGeld = 'erstattet' | 'offen' | 'vor_ort'

const HOF_NACHRICHT_GELD: Record<HofNachrichtGeld, string> = {
  erstattet: 'Die Kundin bekommt ihr Geld zurück.',
  offen: 'Die Erstattung hat noch nicht geklappt – das Team kümmert sich darum.',
  vor_ort: 'Bezahlt wird vor Ort, es gibt nichts zu erstatten.',
}

/** Welcher Geld-Satz in die Nachricht an den Hof gehört. */
export function hofNachrichtGeld(onlineBezahlt: boolean, erstattungOffen: boolean): HofNachrichtGeld {
  if (!onlineBezahlt) return 'vor_ort'
  return erstattungOffen ? 'offen' : 'erstattet'
}

export const ADMIN_BESTELLUNG_TEXT = {
  titel: 'Bestellungen',
  satz: 'Für Fragen von Kundinnen und Höfen: finden, verstehen, abschließen.',
  listeBeschriftung: 'Bestellungen',
  detailBeschriftung: 'Bestellung',
  filter: 'Filter',
  filterStand: 'Stand',
  filterHof: 'Hof',
  filterZeitraum: 'Zeitraum',
  filterOffen: 'nur mit offener Erstattung',
  alle: 'alle',
  filterAnwenden: 'Anzeigen',
  filterZuruecksetzen: 'Zurücksetzen',
  anzahl: (n: number): string => (n === 1 ? '1 Bestellung' : `${n} Bestellungen`),
  trefferZu: (an: string): string => `Treffer zu ${an}`,
  neuesteZuerst: 'neueste zuerst',
  leerTitel: 'Keine Bestellung gefunden',
  leerSatz: 'Mit diesem Filter gibt es keine Bestellung. Probier einen längeren Zeitraum oder setz den Filter zurück.',
  waehlen: 'Wähl links eine Bestellung, dann steht hier alles dazu.',
  nichtGefunden: 'Diese Bestellung gibt es nicht (mehr). Wähl links eine andere.',
  ladeFehler: 'Die Bestellungen lassen sich gerade nicht laden. Lade die Seite gleich noch einmal.',
  zurListe: 'Zur Liste',
  inStripe: 'In Stripe ansehen',
  hof: 'Hof',
  akte: 'Akte',
  kundin: 'Kundin',
  kundinBestellungen: (n: number): string => (n === 1 ? '1 Bestellung in 90 Tagen' : `${n} Bestellungen in 90 Tagen`),
  abholung: 'Abholung',
  zahlung: 'Zahlung',
  inklGebuehr: (gebuehr: string): string => `inkl. ${gebuehr} Servicegebühr`,
  servicegebuehr: 'Servicegebühr',
  positionen: 'Positionen',
  verlauf: 'Verlauf',
  wasTun: 'Was tun',
  mails: 'E-Mails zu dieser Bestellung',
  mailsLeer: 'Zu dieser Bestellung gibt es im Protokoll (90 Tage) keine Mail.',
  mailAnsehen: 'Ansehen und nochmal schicken',
  regel:
    'Der Admin sieht jede Bestellung, ändert aber nur, was der Hof nicht selbst kann: Erstattung abschließen, im Notfall stornieren (mit Grund, nur vor der Abholung) und Mails nochmal schicken. Die Adresse der Kundin steht gekürzt; voll erscheint sie nur nach „Kundin schreiben …“ mit Passkey.',
  passkeyHinweis: 'Fragt nach deinem Passkey · steht im Protokoll der Bestellung und des Hofs',
  // Aktionen
  ausserhalbErstattet: 'Außerhalb erstattet …',
  ausserhalbTitel: 'Erstattung außerhalb abgeschlossen?',
  ausserhalbSatz: 'Das schließt nur die Aufgabe „Erstattung offen“. Es bewegt kein Geld und schreibt Stripe nichts – überweise vorher selbst.',
  ausserhalbKnopf: 'Als erstattet abschließen',
  ausserhalbFertig: 'Erstattung abgeschlossen.',
  ausserhalbNichtOffen: 'Hier ist keine Erstattung offen.',
  kundinSchreiben: 'Kundin schreiben …',
  kundinTitel: 'Volle Adresse der Kundin anzeigen?',
  kundinSatz: 'Die Adresse erscheint erst nach dem Grund und steht danach im Protokoll.',
  kundinKnopf: 'Adresse anzeigen',
  kundinAdresse: 'Adresse der Kundin',
  kundinMail: 'Mail schreiben',
  hofSchreiben: 'Hof schreiben',
  hofOhneFaden: 'Im Postfach steht für diesen Hof bisher kein Faden.',
  notfallStorno: 'Notfall-Storno …',
  notfallTitel: (nummer: string): string => `Bestellung ${nummer} im Notfall stornieren?`,
  notfallSatz:
    'Wie beim Storno durch den Hof: Die Kundin bekommt ihr Geld zurück (online) und die normale Storno-Mail, die Ware geht zurück in den Vorrat. Der Hof bekommt eine Nachricht im Postfach mit deinem Grund.',
  notfallKnopf: 'Stornieren',
  notfallFertig: 'Storniert. Der Hof hat eine Nachricht im Postfach.',
  notfallErstattungOffen: 'Storniert, aber die Erstattung hat nicht geklappt. Sie steht jetzt als offen in der Bestellung.',
  stornoNachAbholung: 'Notfall-Storno geht nur vor der Abholung – diese Bestellung ist schon abgeholt oder als nicht abgeholt vermerkt.',
  stornoSchonStorniert: 'Notfall-Storno geht nur vor der Abholung und nur, wenn die Bestellung nicht schon storniert ist – hier schon geschehen.',
  grund: 'Grund (Pflicht, steht im Protokoll)',
  grundHilfe: 'Ohne E-Mail-Adresse und ohne Telefonnummer.',
  abbrechen: 'Abbrechen',
  // Die Nachricht an den Hof (Postfach, Faden ohne Rundschreiben)
  // Der Geld-Satz folgt dem echten Ausgang: online erstattet, Erstattung offen
  // oder vor Ort bezahlt — nie ein Versprechen, das nicht stimmt.
  hofNachricht: (nummer: string, grund: string, geld: HofNachrichtGeld): string =>
    `Bestellung ${nummer} vom Team storniert. Grund: „${grund}“. ${HOF_NACHRICHT_GELD[geld]} Die Kundin bekommt eine Mail, die Ware ist wieder in deinem Vorrat. Fragen? Antworte hier.`,
} as const
