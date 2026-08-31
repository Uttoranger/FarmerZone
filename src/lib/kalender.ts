// Kalendereintrag (ICS) für den Abholtermin — reine Funktionen, KEINE
// Abhängigkeit: RFC 5545 verlangt für ein einzelnes VEVENT nur wenige
// Zeilen, ein Paket dafür wäre Ballast.
//
// Die Zeiten stehen als Wiener ORTSZEIT im Ereignis (TZID=Europe/Vienna,
// samt eingebetteter VTIMEZONE-Definition): So zeigt jeder Kalender 14:00
// als 14:00 — ohne dass dieser Code je einen Sommerzeit-Versatz rechnen
// muss, das übernimmt der Kalender des Telefons.

/** RFC-5545-TEXT: Rückstrich, Strichpunkt, Beistrich und Zeilenumbruch
 *  werden maskiert — sonst zerfiele z. B. „Ried, Hauptplatz 1" in Felder.
 *  Auch ein NACKTES \r (per API-Import denkbar) wird zu \n: roh wäre es in
 *  der Datei ein verbotenes Steuerzeichen. */
export function icsText(wert: string): string {
  return wert
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/**
 * Zeilen über 75 Oktetten werden gefaltet (CRLF + Leerzeichen), gemessen in
 * UTF-8-BYTES und nie mitten in einem Mehrbyte-Zeichen — ein zerteiltes „ä"
 * macht die Datei für strenge Parser unlesbar.
 */
export function icsFalte(zeile: string): string {
  const teile: string[] = []
  let aktuell = ''
  let oktette = 0
  // Erste Zeile darf 75 Oktette tragen, Folgezeilen 74 + führendes Leerzeichen.
  let grenze = 75
  for (const zeichen of zeile) {
    const breite = Buffer.byteLength(zeichen, 'utf8')
    if (oktette + breite > grenze) {
      teile.push(aktuell)
      aktuell = ''
      oktette = 0
      grenze = 74
    }
    aktuell += zeichen
    oktette += breite
  }
  teile.push(aktuell)
  return teile.join('\r\n ')
}

/**
 * Der Kalendertag eines Zeitpunkts in Wien, als YYYY-MM-DD.
 *
 * ANNAHME, dokumentiert: pickupDate wird beim Checkout als 12:00
 * SERVER-Lokalzeit gespeichert (api/checkout/route.ts). Der Wiener
 * Kalendertag stimmt damit, solange sich Server- und Wiener Offset um
 * weniger als 12 Stunden unterscheiden — für die realen Umgebungen
 * (Vercel = UTC, Entwicklung = Wien) immer wahr. Ein Deployment auf
 * Pazifik-Zeitzonen bräuchte zuerst eine Checkout-Änderung (Kasse ist in
 * diesem Sprint bewusst unberührt).
 */
export function wienKalendertag(moment: Date): string {
  // en-CA formatiert von Haus aus als YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Vienna',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(moment)
}

// Die übliche statische Definition für Europe/Vienna (CET/CEST, letzter
// Sonntag im März/Oktober) — gültig seit 1996 und von allen Kalendern
// verstanden. Eingebettet, weil TZID laut RFC auf eine VTIMEZONE im selben
// Objekt zeigen muss.
const VTIMEZONE_WIEN = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Vienna',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
]

export type KalenderEintrag = {
  /** z. B. „Abholung Hof Müller" */
  titel: string
  /** Die Hofadresse als eine Zeile. */
  ort: string
  /** Bestellnummer und Link zur Bestellseite. */
  beschreibung: string
  /** Wiener Kalendertag der Abholung, YYYY-MM-DD (wienKalendertag). */
  datum: string
  /** Beginn/Ende in Wiener Ortszeit, HH:MM (pickupTimeStart/End). */
  beginn: string
  ende: string
  /** Stabile Kennung des Ereignisses (Bestell-ID): Wer die Datei zweimal
   *  öffnet, bekommt EINEN Kalendereintrag, keinen Zwilling. */
  kennung: string
  /** Erstellungszeitpunkt für den Pflicht-Stempel DTSTAMP. */
  erstellt: Date
}

function wienerZeit(datum: string, uhrzeit: string): string {
  // Defensiv auf zwei Stellen aufgefüllt: „9:00" muss T090000 werden —
  // T90000 wäre für jeden Kalender-Parser ungültig.
  const [stunde = '00', minute = '00'] = uhrzeit.split(':')
  return `${datum.replace(/-/g, '')}T${stunde.padStart(2, '0')}${minute.padStart(2, '0')}00`
}

export function erzeugeIcs(eintrag: KalenderEintrag): string {
  const stempel = eintrag.erstellt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const zeilen = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FarmerZone//Bestellverfolgung//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...VTIMEZONE_WIEN,
    'BEGIN:VEVENT',
    `UID:abholung-${eintrag.kennung}@farmerzone`,
    `DTSTAMP:${stempel}`,
    `DTSTART;TZID=Europe/Vienna:${wienerZeit(eintrag.datum, eintrag.beginn)}`,
    `DTEND;TZID=Europe/Vienna:${wienerZeit(eintrag.datum, eintrag.ende)}`,
    `SUMMARY:${icsText(eintrag.titel)}`,
    `LOCATION:${icsText(eintrag.ort)}`,
    `DESCRIPTION:${icsText(eintrag.beschreibung)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return zeilen.map(icsFalte).join('\r\n') + '\r\n'
}
