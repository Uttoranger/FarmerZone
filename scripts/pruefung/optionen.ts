/**
 * Optionen des Prüf-Seeds — rein, damit die Tests sie ohne Datenbank prüfen.
 *
 * `--stichtag vergangenheit` (Vorgabe): Hofpreis-Modell ab 1. Oktober 2026 —
 * der Stand der Boards (März 2027, nach dem Stichtag).
 * `--stichtag zukunft`: heute + 30 Tage — für eine zweite Prüf-DB vor T.
 * Gründungsplätze stellt der Prüf-Seed in der Wegwerf-DB immer auf 100
 * (E-026, Nr. 262). `--gruendung-fest`: Zusagen zusätzlich festschreiben, mit
 * derselben Regel wie die Admin-Aktion — für die Aktion-Karte auf /konditionen.
 */

export type StichtagArt = 'vergangenheit' | 'zukunft'

export const STICHTAG_VERGANGENHEIT = new Date('2026-10-01T00:00:00.000Z')
export const STICHTAG_ZUKUNFT_TAGE = 30

export type SeedOptionen = {
  stichtag: StichtagArt
  /** Wohin die signierten Links gehen (unter .nachtlauf/). */
  links: string
  /** Wohin der private Schlüssel des Prüf-Passkeys geht (unter .nachtlauf/). */
  passkey: string
  /** Zusagen der Gründungshöfe festschreiben (`--gruendung-fest`, ohne Wert). */
  gruendungFest: boolean
}

export const SEED_VORGABEN: SeedOptionen = {
  stichtag: 'vergangenheit',
  links: '.nachtlauf/pruef-links.json',
  passkey: '.nachtlauf/admin-passkey.json',
  gruendungFest: false,
}

export function stichtagFuer(art: StichtagArt, jetzt: Date): Date {
  if (art === 'vergangenheit') return new Date(STICHTAG_VERGANGENHEIT)
  const tag = new Date(Date.UTC(jetzt.getUTCFullYear(), jetzt.getUTCMonth(), jetzt.getUTCDate()))
  tag.setUTCDate(tag.getUTCDate() + STICHTAG_ZUKUNFT_TAGE)
  return tag
}

/** Ausgaben nur unter .nachtlauf/ — der Ordner ist gitignored. */
export function liegtUnterNachtlauf(pfad: string): boolean {
  const normal = pfad.replace(/\\/g, '/')
  if (normal.split('/').includes('..')) return false
  return normal.startsWith('.nachtlauf/') || /\/\.nachtlauf\//.test(normal)
}

export function leseSeedOptionen(argv: readonly string[]): SeedOptionen | string {
  const optionen: SeedOptionen = { ...SEED_VORGABEN }
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i]
    const wert = argv[i + 1]
    if (name === '--gruendung-fest') {
      optionen.gruendungFest = true
      continue
    }
    if (name === '--stichtag') {
      if (wert !== 'vergangenheit' && wert !== 'zukunft') return '--stichtag braucht „vergangenheit“ oder „zukunft“.'
      optionen.stichtag = wert
    } else if (name === '--links' || name === '--passkey') {
      if (!wert || !liegtUnterNachtlauf(wert)) return `${name} muss unter .nachtlauf/ liegen.`
      optionen[name === '--links' ? 'links' : 'passkey'] = wert
    } else {
      return `Unbekannte Angabe: ${name ?? ''}`
    }
    i++
  }
  return optionen
}
