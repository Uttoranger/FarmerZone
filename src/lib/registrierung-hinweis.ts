import { kundinnenKonto } from '@/lib/anmeldecode'

/*
 * Registrierung mit einer vergebenen Adresse (Register F6 „19b", Nachtlauf
 * Nr. 27): Die Antwort ist dieselbe wie bei Erfolg, das bestehende Konto
 * bekommt einen Hinweis per Mail. Hier stehen die reinen Regeln dazu; das
 * Lesen, Bremsen und Senden macht src/server/registrierung-hinweis.ts.
 */

/**
 * Höchstens EIN Hinweis je Konto in diesem Fenster. Wer eine fremde Adresse
 * immer wieder eintippt, soll das Postfach nicht zuschütten; die echte
 * Person hat den ersten Hinweis ja schon.
 */
export const REGISTRIERUNG_HINWEIS_FENSTER_SEKUNDEN = 24 * 60 * 60

/**
 * Die Zeile der Bremse in der bestehenden Verification-Tabelle (keine
 * Schema-Änderung, gilt über alle Instanzen). Sie hängt an der Konto-ID —
 * die Adresse steht so nicht noch einmal in der Datenbank.
 */
export function registrierungsHinweisKennung(userId: string): string {
  return `registrierung-hinweis-${userId}`
}

/** Wie sich das Konto anmeldet: Kundinnen mit Code (E7), Höfe und Betreiber mit Passwort. */
export type HinweisWeg = 'passwort' | 'code'

export function registrierungsHinweisWeg(konto: { role?: string | null; isAdmin?: boolean | null }): HinweisWeg {
  return kundinnenKonto(konto) ? 'code' : 'passwort'
}

export type HinweisZiele = { anmelden: string; passwortZuruecksetzen: string | null }

/**
 * Die Links der Mail. Eine Kundin bekommt nie „Passwort zurücksetzen": Sie
 * meldet sich mit Code an, und ein Passwort am Kundinnen-Konto wäre ein Weg,
 * den die App nicht anbietet.
 */
export function registrierungsHinweisZiele(weg: HinweisWeg, basis: string): HinweisZiele {
  if (weg === 'code') return { anmelden: `${basis}/account/login`, passwortZuruecksetzen: null }
  return { anmelden: `${basis}/login`, passwortZuruecksetzen: `${basis}/forgot-password` }
}
