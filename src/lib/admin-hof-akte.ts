/**
 * Die Akte eines Hofs im Admin (Register N32, N34; Nachtlauf Nr. 187; Mockup
 * admin-hof-akte): Wörter, Sätze und kleine Regeln — rein und ohne Datenbank
 * prüfbar (tests/hof-akte.test.ts). Die Abfrage steht in
 * src/server/queries/admin-hof.ts, die Wirkung der Sperre in
 * src/server/actions/admin-hof.ts.
 *
 * NIE Adresse der Kundschaft, Name oder Token: Die Akte zeigt Zahlen, Wörter
 * und Kennungen. Die Anmelde-E-Mail des Hofs steht nur gekürzt da
 * (maskiereAdresse); das Protokoll zeigt Art und Wer, nie einen Inhalt.
 */
import { DAY_NAMES } from '@/lib/pickup-slot-rules'
import { zuletztText } from '@/lib/betrieb'
import { mitAnzahl } from '@/lib/format'
import type { AdminAktionArt } from '@/schemas/admin-aktion'

export const ADMIN_HOEFE_HREF = '/admin/hoefe'

/** Die Akte eines Hofs — die Kennung ist nur die Adresse; die Seite prüft selbst (verlangeAdminSeite). */
export function adminHofHref(farmId: string): string {
  return `${ADMIN_HOEFE_HREF}/${encodeURIComponent(farmId)}`
}

// ─── Sperre durch das Team (N34) ────────────────────────────────────────────

/** Texte der Sperre (Wortlaut der Freigabe 187, Punkt 3; Mockup „Eingreifen“). */
export const SPERRE_TEXT = {
  knopf: 'Vorübergehend sperren …',
  titel: 'Hof vorübergehend sperren?',
  bestaetigen: 'Sperren',
  grundLabel: 'Grund (sieht der Hof im Postfach)',
  grundHilfe: 'Ohne E-Mail-Adresse und ohne Telefonnummer.',
  kundeLabel: 'Satz für die Kundschaft',
  erklaerung:
    'Sperren stoppt neue Bestellungen mit einem neutralen Satz für die Kundschaft und sagt es dem Hof im Postfach. Anders als die Pause kann der Hof sie nicht selbst aufheben.',
  laufende: 'Laufende Bestellungen, Abholung und Storno durch den Hof bleiben.',
  aufheben: 'Sperre aufheben',
  aufhebenTitel: 'Sperre aufheben?',
  aufhebenSatz: 'Danach kann die Kundschaft wieder bei diesem Hof bestellen. Der Hof bekommt eine Nachricht im Postfach.',
  gesperrt: 'Gesperrt',
  erledigt: 'Der Hof ist gesperrt.',
  aufgehoben: 'Die Sperre ist aufgehoben.',
  schonGesperrt: 'Der Hof ist schon gesperrt. Lade die Seite neu.',
  nichtGesperrt: 'Der Hof ist gerade nicht gesperrt. Lade die Seite neu.',
  nichtGefunden: 'Diesen Hof gibt es nicht mehr.',
  eingabe: 'Bitte schreib einen kurzen Grund.',
  eingriffSatz: 'fragt jeweils nach deinem Passkey',
} as const

/** Die Nachricht ins Postfach des Hofs (Art SYSTEM) — mit dem Grund des Teams, nie mit Daten der Kundschaft. */
export function sperreNachricht(grund: string): string {
  return `Dein Hof ist vom Team gesperrt: ${grund.trim()}. Neue Bestellungen sind gerade nicht möglich, laufende bleiben. Antworte hier im Postfach.`
}

export const SPERRE_AUFGEHOBEN_NACHRICHT = 'Die Sperre deines Hofs ist aufgehoben. Die Kundschaft kann wieder bei dir bestellen.'

/** Die Karte in Heute des Hofs (Wortlaut der Freigabe 187, Punkt 3). */
export function sperreKarteSatz(grund: string | null): string {
  const g = grund?.trim()
  return g ? `Dein Hof ist vom Team gesperrt: ${g}. Antworte im Postfach.` : 'Dein Hof ist vom Team gesperrt. Antworte im Postfach.'
}

export const SPERRE_KARTE_TITEL = 'Bestellungen gestoppt'

/** Der Leerzustand der Akte aus dem Protokoll (N33). */
export const AKTE_PROTOKOLL_LEER = {
  titel: 'Noch kein Eintrag',
  satz: 'Jede Aktion des Teams zu diesem Hof steht hier mit Zeitpunkt.',
} as const

// ─── Kontakt ────────────────────────────────────────────────────────────────

/** „wie Anmeldung“, wenn die Hof-E-Mail leer ist oder der Anmeldung gleicht (hofKontaktEmail, Nr. 194); sonst „eigene Adresse“. */
export function hofEmailText(hofEmail: string, anmeldung: string): string {
  const h = hofEmail.trim().toLowerCase()
  return h === '' || h === anmeldung.trim().toLowerCase() ? 'wie Anmeldung' : 'eigene Adresse'
}

// ─── Aktivität ──────────────────────────────────────────────────────────────

/** „Handy“ oder „Computer“ aus der Kennung des Browsers — mehr verlässt die Akte nicht. */
export function geraetText(userAgent: string | null): string | null {
  if (!userAgent) return null
  return /Mobile|Android|iPhone|iPad/i.test(userAgent) ? 'Handy' : 'Computer'
}

const ANMELDEART_TEXT: Record<string, string> = {
  passwort: 'Passwort',
  passkey: 'Passkey',
  ersatzcode: 'Ersatzcode',
  'ersatzcode-eingeloest': 'Ersatzcode',
}

/** „Handy · Passwort“ — Gerät und Art der Anmeldung, soweit bekannt. */
export function anmeldungText(sitzung: { userAgent: string | null; anmeldeart: string | null }): string | null {
  const teile = [geraetText(sitzung.userAgent), sitzung.anmeldeart ? (ANMELDEART_TEXT[sitzung.anmeldeart] ?? null) : null].filter(
    (t): t is string => t !== null
  )
  return teile.length > 0 ? teile.join(' · ') : null
}

/** „vor 2 Tagen“, „heute 09:14“ … — dieselbe Schreibweise wie Admin › Betrieb (zuletztText); ohne Zeitpunkt „noch nie“. */
export function zuletztAngemeldetText(zeitpunkt: Date | null, jetzt: Date): string {
  return zeitpunkt ? zuletztText(zeitpunkt, jetzt) : 'noch nie'
}

type NachrichtFuerAntwort = { unterhaltungId: string; vonHof: boolean; system: boolean; am: Date }

/**
 * Die Antwortzeit im Postfach: Je Faden zählt die Zeit von der ersten
 * unbeantworteten Nachricht des Teams (nicht SYSTEM) bis zur nächsten Antwort
 * des Hofs; der Mittelwert in ganzen Stunden, gerundet. null ohne Paar.
 */
export function antwortzeitStunden(nachrichten: readonly NachrichtFuerAntwort[]): number | null {
  const jeFaden = new Map<string, NachrichtFuerAntwort[]>()
  for (const n of nachrichten) jeFaden.set(n.unterhaltungId, [...(jeFaden.get(n.unterhaltungId) ?? []), n])
  const dauern: number[] = []
  for (const liste of jeFaden.values()) {
    const sortiert = [...liste].sort((a, b) => a.am.getTime() - b.am.getTime())
    let offenSeit: Date | null = null
    for (const n of sortiert) {
      if (!n.vonHof && !n.system && offenSeit === null) offenSeit = n.am
      else if (n.vonHof && offenSeit !== null) {
        dauern.push(n.am.getTime() - offenSeit.getTime())
        offenSeit = null
      }
    }
  }
  if (dauern.length === 0) return null
  const mittel = dauern.reduce((s, d) => s + d, 0) / dauern.length
  return Math.max(0, Math.round(mittel / 3_600_000))
}

export function antwortzeitText(stunden: number | null): string {
  if (stunden === null) return 'bisher ohne Antwort'
  if (stunden < 1) return 'unter 1 h'
  if (stunden < 48) return `≈ ${stunden} h`
  return `≈ ${Math.round(stunden / 24)} Tage`
}

// ─── Zustand ────────────────────────────────────────────────────────────────

export type ZustandTon = 'ok' | 'achtung' | 'neutral'
export type ZustandZeile = { titel: string; text: string; ton: ZustandTon; wort: string }

/** „Di und Fr“ bzw. „Mo, Mi und Fr“ — die Wochentage der aktiven Abholzeiten, ohne Doppelte, Montag zuerst. */
export function abholTageText(tage: readonly number[]): string {
  const einmalig = [...new Set(tage)].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
  const kurz = einmalig.map((t) => (DAY_NAMES[t] ?? '').slice(0, 2))
  if (kurz.length <= 1) return kurz.join('')
  return `${kurz.slice(0, -1).join(', ')} und ${kurz[kurz.length - 1]}`
}

const WORT: Record<ZustandTon, string> = { ok: 'ok', achtung: 'Achtung', neutral: '–' }

function zeile(titel: string, text: string, ton: ZustandTon): ZustandZeile {
  return { titel, text, ton, wort: WORT[ton] }
}

/** Was Kundinnen erleben (Mockup „Zustand“): je Zeile ein Satz und ein Zustandswort — nie nur Farbe. */
export function zustandZeilen(stand: {
  abholTage: readonly number[]
  produkteImShop: number
  ausverkauft: number
  isPaused: boolean
  gesperrt: boolean
  stripeBereit: boolean
  onlineAn: boolean
  erstattungenOffen: number
}): ZustandZeile[] {
  const abholung =
    stand.abholTage.length === 0 ? zeile('Abholzeiten', 'keine aktive Abholzeit', 'achtung') : zeile('Abholzeiten', abholTageText(stand.abholTage), 'ok')
  const produkte =
    stand.produkteImShop === 0
      ? zeile('Produkte', 'kein Produkt im Shop', 'achtung')
      : zeile('Produkte', `${stand.produkteImShop} im Shop${stand.ausverkauft > 0 ? ` · ${stand.ausverkauft} ausverkauft` : ''}`, 'ok')
  const pause = stand.gesperrt
    ? zeile('Pause', `${stand.isPaused ? 'ja' : 'nein'} · vom Team gesperrt`, 'achtung')
    : zeile('Pause', stand.isPaused ? 'ja' : 'nein', stand.isPaused ? 'neutral' : 'ok')
  const online = !stand.stripeBereit
    ? zeile('Online-Zahlung', 'Stripe fehlt', 'achtung')
    : stand.onlineAn
      ? zeile('Online-Zahlung', 'Stripe eingerichtet', 'ok')
      : zeile('Online-Zahlung', 'vom Hof ausgeschaltet', 'neutral')
  const fragen =
    stand.erstattungenOffen > 0
      ? zeile('Offene Fragen', `${mitAnzahl(stand.erstattungenOffen, 'Erstattung', 'Erstattungen')} offen`, 'achtung')
      : zeile('Offene Fragen', 'keine', 'ok')
  return [abholung, produkte, pause, online, fragen]
}

// ─── Akte aus dem Protokoll (N33) ───────────────────────────────────────────

/**
 * Wie ein Eintrag in der Akte heißt. Arten ohne eigenen Text (etwa neue aus
 * späteren Nummern) stehen mit ihrem Namen da — lesbar, nie leer.
 */
export const PROTOKOLL_ART_TEXT: Partial<Record<AdminAktionArt, string>> = {
  hof_freigeschaltet: 'Freigeschaltet',
  hof_freigabe_entzogen: 'Freigabe zurückgenommen',
  hof_abgelehnt: 'Abgelehnt',
  servicegebuehr_geaendert: 'Servicegebühr geändert',
  gruendung_bis_geaendert: 'Gründungs-Ende geändert',
  gruendung_ausgenommen: 'Nicht mehr als Gründungshof gezählt',
  gruendung_wieder_aufgenommen: 'Wieder als Gründungshof gezählt',
  gruendung_festgeschrieben: 'Gründungsplatz festgeschrieben',
  testhof_markiert: 'Als Testhof markiert',
  testhof_zurueckgenommen: 'Kein Testhof mehr',
  rundschreiben_gesendet: 'Rundschreiben geschickt',
  team_antwort: 'Antwort im Postfach',
  hof_gesperrt: 'Vorübergehend gesperrt',
  hof_sperre_aufgehoben: 'Sperre aufgehoben',
  plattformgebuehr_geaendert: 'Plattformgebühr geändert',
  plattformgebuehr_angekuendigt: 'Einzug angekündigt',
  monatsabrechnung_erstellt: 'Monatsabrechnung erstellt',
  lastschrift_mandat_gueltig: 'Lastschrift eingerichtet',
  lastschrift_mandat_beendet: 'Lastschrift beendet',
  lastschrift_bezahlt: 'Monatsabrechnung bezahlt',
  lastschrift_gescheitert: 'Lastschrift gescheitert',
  lastschrift_zurueckgebucht: 'Lastschrift zurückgebucht',
}

export function protokollArtText(art: string): string {
  return PROTOKOLL_ART_TEXT[art as AdminAktionArt] ?? art.replaceAll('_', ' ')
}

/** Wer: „System“ (Ablauf), „Du“ (die angemeldete Person) oder „Team“ — nie ein Name. */
export function protokollWer(wer: string | null, ich: string): string {
  if (wer === null) return 'System'
  return wer === ich ? 'Du' : 'Team'
}

// ─── Die Akte als Anzeige (kein Date an den Browser) ────────────────────────

export type HofAkteEingabe = {
  hof: {
    phone: string
    email: string
    postalCode: string
    city: string
    landText: string
    isPaused: boolean
    adminGesperrtAm: Date | null
    adminSperrGrund: string | null
    owner: { email: string; sessions: ReadonlyArray<{ createdAt: Date; userAgent: string | null; anmeldeart: string | null }> }
    pickupSlots: ReadonlyArray<{ dayOfWeek: number }>
    products: ReadonlyArray<{ stock: number }>
  }
  zahlen: { bestellungen: number; storniert: number; nichtAbgeholt: number; umsatzCents: number; servicegebuehrCents: number }
  erstattungenOffen: number
  nachrichten: readonly NachrichtFuerAntwort[]
  protokoll: ReadonlyArray<{ id: string; wann: Date; wer: string | null; art: string; grund: string | null; mitPasskey: boolean }>
}

export type HofAkteAnsicht = {
  kontakt: { telefon: string; anmeldung: string; emailBestaetigt: string; hofEmail: string; ort: string }
  aktivitaet: {
    bestellungen: number
    bestellungenZeile: string
    umsatzCents: number
    servicegebuehrCents: number
    zuletztAngemeldet: string
    anmeldung: string | null
    antwortzeit: string
  }
  zustand: ZustandZeile[]
  sperre: { gesperrt: boolean; grund: string | null; seit: string | null }
  protokoll: Array<{ id: string; wann: string; wer: string; text: string; grund: string | null; mitPasskey: boolean }>
}

/**
 * Was die Akte zeigt — aus den Rohdaten der Abfrage (ladeHofAkte) und der
 * Person, die gerade ansieht (`ich`, für „Du“ im Protokoll). Die Anmelde-E-Mail
 * kommt gekürzt herein (maskiereAdresse auf dem Server), `emailBestaetigt` als Text.
 */
export function hofAkteAnsicht(
  roh: HofAkteEingabe,
  zusatz: { anmeldungGekuerzt: string; emailBestaetigt: string; stripeBereit: boolean; onlineAn: boolean; ich: string },
  jetzt: Date
): HofAkteAnsicht {
  const sitzung = roh.hof.owner.sessions[0] ?? null
  const { zahlen } = roh
  return {
    kontakt: {
      telefon: roh.hof.phone.trim() || '–',
      anmeldung: zusatz.anmeldungGekuerzt,
      emailBestaetigt: zusatz.emailBestaetigt,
      hofEmail: hofEmailText(roh.hof.email, roh.hof.owner.email),
      ort: `${`${roh.hof.postalCode} ${roh.hof.city}`.trim()} · ${roh.hof.landText}`,
    },
    aktivitaet: {
      bestellungen: zahlen.bestellungen,
      bestellungenZeile: `${zahlen.storniert} storniert · ${zahlen.nichtAbgeholt} nicht abgeholt`,
      umsatzCents: zahlen.umsatzCents,
      servicegebuehrCents: zahlen.servicegebuehrCents,
      zuletztAngemeldet: zuletztAngemeldetText(sitzung?.createdAt ?? null, jetzt),
      anmeldung: sitzung ? anmeldungText(sitzung) : null,
      antwortzeit: antwortzeitText(antwortzeitStunden(roh.nachrichten)),
    },
    zustand: zustandZeilen({
      abholTage: roh.hof.pickupSlots.map((s) => s.dayOfWeek),
      produkteImShop: roh.hof.products.length,
      ausverkauft: roh.hof.products.filter((p) => p.stock <= 0).length,
      isPaused: roh.hof.isPaused,
      gesperrt: roh.hof.adminGesperrtAm !== null,
      stripeBereit: zusatz.stripeBereit,
      onlineAn: zusatz.onlineAn,
      erstattungenOffen: roh.erstattungenOffen,
    }),
    sperre: {
      gesperrt: roh.hof.adminGesperrtAm !== null,
      grund: roh.hof.adminSperrGrund,
      seit: roh.hof.adminGesperrtAm ? zuletztText(roh.hof.adminGesperrtAm, jetzt) : null,
    },
    protokoll: roh.protokoll.map((e) => ({
      id: e.id,
      wann: zuletztText(e.wann, jetzt),
      wer: protokollWer(e.wer, zusatz.ich),
      text: protokollArtText(e.art),
      grund: e.grund,
      mitPasskey: e.mitPasskey,
    })),
  }
}
