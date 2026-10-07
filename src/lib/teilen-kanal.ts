/**
 * Teilen-Zählung (Gate 7, Nr. 21; Sicherheitsregel S8) — die reinen Regeln:
 * welche Kanäle es gibt, wie ein geteilter Link aussieht und auf welchen Tag
 * ein Aufruf zählt.
 *
 * Ein geteilter Link trägt NUR `?k=<kanal>` und sonst nichts: keine Kennung
 * der Person, des Geräts oder des Beitrags. Gezählt wird ausschließlich als
 * Summe je Hof, Kanal und Wiener Kalendertag (`TeilenAufruf`). Was nicht in
 * der Liste steht, wird nicht gezählt — auch kein „unbekannt".
 */
import type { TeilenKanal } from '@prisma/client'
import { kalendertagInWien } from '@/lib/wiener-tag'

/** Die Kürzel in der Adresse, in der Reihenfolge des Teilen-Fensters. */
export const TEILEN_KANAL_CODES = ['wa', 'wa-status', 'fb', 'ig', 'mail', 'qr', 'link'] as const

export type TeilenKanalCode = (typeof TEILEN_KANAL_CODES)[number]

/** Der Name des Suchparameters — eine Quelle für Link, Hofseite und Test. */
export const TEILEN_PARAMETER = 'k'

const ZU_ENUM: Record<TeilenKanalCode, TeilenKanal> = {
  wa: 'WHATSAPP',
  'wa-status': 'WHATSAPP_STATUS',
  fb: 'FACEBOOK',
  ig: 'INSTAGRAM',
  mail: 'EMAIL',
  qr: 'QR',
  link: 'LINK',
}

/** Wie der Kanal in der Auswertung heißt (22c) — Deutsch, ohne Fachwort. */
export const TEILEN_KANAL_NAME: Record<TeilenKanal, string> = {
  WHATSAPP: 'WhatsApp',
  WHATSAPP_STATUS: 'WhatsApp-Status',
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  EMAIL: 'E-Mail',
  QR: 'Plakat (QR-Code)',
  LINK: 'Link kopiert',
}

function istKanalCode(wert: unknown): wert is TeilenKanalCode {
  return typeof wert === 'string' && (TEILEN_KANAL_CODES as readonly string[]).includes(wert)
}

/**
 * Das Kürzel aus der Adresse → der Kanal der Datenbank. Alles andere (fehlt,
 * leer, unbekannt, Groß geschrieben, mehrfach) ergibt null: Ein ungültiger
 * Wert lässt nie etwas scheitern, er zählt nur nicht.
 */
export function teilenKanalAus(wert: unknown): TeilenKanal | null {
  return istKanalCode(wert) ? ZU_ENUM[wert] : null
}

/**
 * Der geteilte Link: die öffentliche Hofseite mit genau einem Parameter.
 * `basis` ist die Adresse der App (APP_URL bzw. window.location.origin),
 * ohne Schrägstrich am Ende.
 */
export function teilenLink(basis: string, slug: string, kanal: TeilenKanalCode): string {
  return `${basis.replace(/\/+$/, '')}/${encodeURIComponent(slug)}?${TEILEN_PARAMETER}=${kanal}`
}

/**
 * Der Tag, auf den ein Aufruf oder eine Bestellung zählt: der Wiener
 * Kalendertag (CODING_STANDARDS „Tage und Wochen"), als Mitternacht UTC —
 * so speichert Prisma ihn in der Spalte `@db.Date` genau als diesen Tag.
 */
export function teilenTag(jetzt: Date): Date {
  return new Date(`${kalendertagInWien(jetzt)}T00:00:00.000Z`)
}

/**
 * Sieht die Anfrage nach einer Maschine aus statt nach einem Menschen? Dann
 * zählt sie nicht. Bewusst grob: Vorschau-Abrufer der Messenger (WhatsApp,
 * Facebook, Telegram …), Suchmaschinen und Skripte nennen sich selbst so.
 * Vorabrufe des Browsers erkennt `istVorabruf`. Der Text wird nur geprüft,
 * nie gespeichert.
 */
export function istMaschine(userAgent: string | null): boolean {
  if (!userAgent || userAgent.trim() === '') return true
  return /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|skype|curl|wget|python|node-fetch|axios|headless|lighthouse/i.test(
    userAgent
  )
}

/** Ein Vorabruf (Prefetch/Prerender) ist kein Besuch. */
export function istVorabruf(headers: Pick<Headers, 'get'>): boolean {
  const zweck = `${headers.get('sec-purpose') ?? ''} ${headers.get('purpose') ?? ''} ${headers.get('x-purpose') ?? ''}`
  return /prefetch|prerender|preview/i.test(zweck)
}
