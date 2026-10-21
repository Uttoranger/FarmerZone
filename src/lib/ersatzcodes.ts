import { z } from 'zod'
import { EMAIL_MAX } from '@/lib/eingabegrenzen'
import { MARKE } from '@/lib/marke'
import { emailSchema } from '@/schemas/email'

/*
 * Ersatzcodes eines Admin-Kontos (Register N20; Nr. 115, Freigabe §21 Punkt 6):
 * 10 Codes `XXXX-XXXX` aus einem Alphabet ohne verwechselbare Zeichen, aus
 * dem Zufall der Plattform (Web Crypto, im Browser wie auf dem Server). In der
 * Datenbank steht nur ein HMAC-SHA256 mit dem Server-Geheimnis, gebunden an
 * das Konto (ersatzcodeHash) — gezeigt werden die Codes nur einmal nach dem
 * Erstellen. Ohne node:crypto, damit die Seite die Texte und die Form ohne
 * Server-Module lesen kann.
 */

export const ERSATZCODE_ANZAHL = 10
/** Ohne 0/O, 1/I/L, 2/Z, 5/S, 6 (neben G), 8/B — wie im Mockup („JME9-QUFD"). */
export const ERSATZCODE_ALPHABET = 'ACDEFGHJKMNPQRTUVWXY3479'
const HAELFTE = 4
const LAENGE = HAELFTE * 2

/** `zufall` liefert Zufallsbytes — Standard Web Crypto; Tests geben feste Bytes. */
export type Zufall = (anzahl: number) => Uint8Array

const webCryptoZufall: Zufall = (anzahl) => globalThis.crypto.getRandomValues(new Uint8Array(anzahl))

/**
 * Ein Zeichen ohne Verzerrung: Bytes ab dem größten Vielfachen der
 * Alphabetlänge werden verworfen (Ablehnung statt Modulo).
 */
function zeichen(zufall: Zufall): string {
  const grenze = 256 - (256 % ERSATZCODE_ALPHABET.length)
  for (;;) {
    const [b] = zufall(1)
    if (b < grenze) return ERSATZCODE_ALPHABET[b % ERSATZCODE_ALPHABET.length]
  }
}

/** Ein Code in der gezeigten Form `XXXX-XXXX`. */
export function erzeugeErsatzcode(zufall: Zufall = webCryptoZufall): string {
  let roh = ''
  while (roh.length < LAENGE) roh += zeichen(zufall)
  return `${roh.slice(0, HAELFTE)}-${roh.slice(HAELFTE)}`
}

/** Zehn verschiedene Codes. */
export function erzeugeErsatzcodes(zufall: Zufall = webCryptoZufall): string[] {
  const codes = new Set<string>()
  while (codes.size < ERSATZCODE_ANZAHL) codes.add(erzeugeErsatzcode(zufall))
  return [...codes]
}

/**
 * Die getippte Eingabe als 8 Zeichen ohne Strich — Groß-/Kleinschreibung,
 * Leerzeichen und Striche egal. null, wenn es kein Code sein kann (falsche
 * Länge oder ein Zeichen außerhalb des Alphabets).
 */
export function normalisiereErsatzcode(eingabe: string): string | null {
  const roh = eingabe.toUpperCase().replace(/[\s-]/g, '')
  if (roh.length !== LAENGE) return null
  for (const z of roh) if (!ERSATZCODE_ALPHABET.includes(z)) return null
  return roh
}

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Was in AdminErsatzcode.codeHash steht: HMAC-SHA256(Geheimnis,
 * „ersatzcode:<Konto>:<Code>"). Das Konto im Text bindet den Code an genau ein
 * Konto (gleiche Codes zweier Konten ergäben verschiedene Hashes); der Code
 * geht normalisiert hinein, so zählt „jme9 qufd" wie „JME9-QUFD".
 */
export async function ersatzcodeHash(geheimnis: string, userId: string, code: string): Promise<string> {
  const normal = normalisiereErsatzcode(code) ?? code
  const kodierer = new TextEncoder()
  const schluessel = await globalThis.crypto.subtle.importKey('raw', kodierer.encode(geheimnis), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return hex(await globalThis.crypto.subtle.sign('HMAC', schluessel, kodierer.encode(`ersatzcode:${userId}:${normal}`)))
}

/**
 * Was kein Adresse-Format hat, bleibt eine unbekannte Adresse: ohne Rand, klein
 * und höchstens so lang wie eine Adresse — der Endpunkt sucht damit ohne Treffer
 * und zählt sie auf der Bremse wie jede andere Eingabe.
 */
function alsUnbekannteAdresse(roh: unknown): string {
  return typeof roh === 'string' ? roh.trim().toLowerCase().slice(0, EMAIL_MAX) : ''
}

/**
 * Systemgrenze der Anmeldung mit Ersatzcode (POST /api/auth/admin-ersatzcode/anmelden).
 *
 * Die Adresse geht durch `emailSchema` (eine Regel für jede Adresse). Scheitert
 * sie dort — falsches Format, zu lang —, wird sie NICHT mit einem eigenen
 * Fehler abgewiesen: Das wäre eine zweite Antwort neben „Diese Kombination
 * passt nicht“, und aus Unterschieden zwischen den Antworten ließe sich etwas
 * ablesen. Sie bekommt dieselbe allgemeine Antwort wie eine unbekannte
 * Adresse (Nr. 126, Register N20).
 */
export const ersatzcodeAnmeldenSchema = z.object({
  email: emailSchema().catch((ctx) => alsUnbekannteAdresse(ctx.input)),
  code: z.string().max(40),
})

/** Inhalt der Datei „Als Datei speichern" — nur die Codes, keine Adresse. */
export function ersatzcodeDatei(codes: readonly string[], erstellt: string): string {
  return [`${MARKE} Admin – Ersatzcodes`, `Erstellt: ${erstellt}`, 'Jeder Code gilt einmal.', '', ...codes, ''].join('\n')
}

export const ERSATZCODE_DATEINAME = 'ersatzcodes.txt'

export const ERSATZCODES_TEXT = {
  titel: 'Deine Ersatzcodes',
  satzVor: 'Jeder Code gilt',
  einmal: 'einmal',
  satzNach: '. Bewahre sie getrennt vom Handy auf – ausgedruckt im Ordner oder im Passwortmanager.',
  ausdrucken: 'Ausdrucken',
  datei: 'Als Datei speichern',
  haken: 'Ich habe die Codes sicher aufbewahrt',
  fertig: 'Fertig',
  nurJetzt: 'Wir zeigen die Codes nur jetzt. Später kannst du neue erstellen – die alten gelten dann nicht mehr.',
  fehler: 'Die Ersatzcodes ließen sich nicht erstellen. Versuch es noch einmal.',
} as const
