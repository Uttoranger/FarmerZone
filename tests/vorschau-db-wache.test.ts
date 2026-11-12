/**
 * Vorschau-Build bricht ab, wenn er auf die Produktions-Datenbank zeigt (Nr. 294a, M7).
 *
 * `vercel-build` spielt zuerst die Migrationen ein – in die Datenbank aus `DIRECT_URL`,
 * sonst `DATABASE_URL`. Zeigt eine Vorschau durch einen Fehlgriff bei den Variablen auf
 * die Produktion, landet die Migration eines ungemergten Branches dort. Das Skript
 * `scripts/vorschau-db-wache.mjs` steht davor und bricht genau diesen Fall ab.
 *
 * Die Gegenprobe Produktion ist Pflicht: Ein Fehler in der Prüfung darf nie eine
 * Auslieferung der Produktion aufhalten. Alle Adressen sind erfunden (Benutzer und
 * Passwort Platzhalter); die Referenz der Produktion kommt aus dem Skript selbst.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { erkannteFernDatenbank } from '@/lib/umgebung'
import {
  PRODUKTION_DATENBANK_REFERENZ,
  enthaeltProduktionsReferenz,
  vorschauZeigtAufProduktion,
} from '../scripts/vorschau-db-wache.mjs'

const WURZEL = process.cwd()
const SKRIPT_RELATIV = 'scripts/vorschau-db-wache.mjs'

const REF = PRODUKTION_DATENBANK_REFERENZ
// Die Referenz der Entwicklungsdatenbank steht wie in tests/umgebung.test.ts offen da: kein Geheimnis, sie steht in jedem Hostnamen.
const DEV_REF = 'pmshaubwpxzdupwhyvjj'

const BENUTZER = 'platzhalterbenutzer'
const PASSWORT = 'platzhalterpasswort'

/** Direkte Verbindung: die Referenz steht im Host. */
const PROD_DIREKT = `postgresql://${BENUTZER}:${PASSWORT}@db.${REF}.supabase.co:5432/postgres`
/** Pooler: Der Host ist für alle Projekte gleich, die Referenz steht im Benutzer. */
const PROD_POOLER = `postgresql://postgres.${REF}:${PASSWORT}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`
const DEV_POOLER = `postgresql://postgres.${DEV_REF}:${PASSWORT}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`
const DEV_DIREKT = `postgresql://${BENUTZER}:${PASSWORT}@db.${DEV_REF}.supabase.co:5432/postgres`

describe('vorschauZeigtAufProduktion', () => {
  it('nennt DATABASE_URL, wenn sie in einer Vorschau auf die Produktion zeigt', () => {
    expect(vorschauZeigtAufProduktion({ VERCEL_ENV: 'preview', DATABASE_URL: PROD_POOLER })).toBe('DATABASE_URL')
    expect(vorschauZeigtAufProduktion({ VERCEL_ENV: 'preview', DATABASE_URL: PROD_DIREKT })).toBe('DATABASE_URL')
  })

  it('nennt DIRECT_URL, wenn nur sie in einer Vorschau auf die Produktion zeigt', () => {
    expect(
      vorschauZeigtAufProduktion({ VERCEL_ENV: 'preview', DATABASE_URL: DEV_POOLER, DIRECT_URL: PROD_DIREKT }),
    ).toBe('DIRECT_URL')
    expect(vorschauZeigtAufProduktion({ VERCEL_ENV: 'preview', DIRECT_URL: PROD_POOLER })).toBe('DIRECT_URL')
  })

  it('lässt eine Vorschau mit der Entwicklungsdatenbank durch', () => {
    expect(
      vorschauZeigtAufProduktion({ VERCEL_ENV: 'preview', DATABASE_URL: DEV_POOLER, DIRECT_URL: DEV_DIREKT }),
    ).toBeNull()
  })

  it('lässt eine Vorschau ohne Datenbank-Variablen durch', () => {
    expect(vorschauZeigtAufProduktion({ VERCEL_ENV: 'preview' })).toBeNull()
    expect(vorschauZeigtAufProduktion({ VERCEL_ENV: 'preview', DATABASE_URL: '', DIRECT_URL: '' })).toBeNull()
  })

  it('hält keine Umgebung außer genau „preview“ auf, auch mit der Produktions-Adresse', () => {
    const produktion = { DATABASE_URL: PROD_POOLER, DIRECT_URL: PROD_DIREKT }
    expect(vorschauZeigtAufProduktion({ VERCEL_ENV: 'production', ...produktion })).toBeNull()
    expect(vorschauZeigtAufProduktion({ VERCEL_ENV: '', ...produktion })).toBeNull()
    expect(vorschauZeigtAufProduktion({ ...produktion })).toBeNull()
    expect(vorschauZeigtAufProduktion({ VERCEL_ENV: 'development', ...produktion })).toBeNull()
    expect(vorschauZeigtAufProduktion({ VERCEL_ENV: 'Preview', ...produktion })).toBeNull()
  })
})

describe('Gleichlauf mit erkannteFernDatenbank', () => {
  // Eine Wahrheit, zwei Leser: Das Skript darf nichts aus src/ einbinden (kein Lader im Build),
  // erkennt die Produktion aber genau dort, wo die Umgebungsprüfung der App sie erkennt.
  const ADRESSEN: readonly (string | undefined)[] = [
    PROD_DIREKT,
    PROD_POOLER,
    DEV_DIREKT,
    DEV_POOLER,
    `  ${PROD_POOLER}  `,
    PROD_DIREKT.replace(`db.${REF}`, `db.${REF.toUpperCase()}`),
    PROD_POOLER.replace(`postgres.${REF}`, `postgres.${REF.toUpperCase()}`),
    `postgresql://${BENUTZER}:${REF}@db.${DEV_REF}.supabase.co:5432/postgres`,
    `postgresql://${BENUTZER}:${PASSWORT}@localhost:5432/${REF}`,
    `postgresql://${BENUTZER}:${PASSWORT}@localhost:5432/postgres`,
    `db.${REF}.supabase.co`,
    `postgresql://%E0%A4%A:${PASSWORT}@db.${REF}.supabase.co:5432/postgres`,
    '',
    '   ',
    undefined,
  ]

  it('erkennt die Produktion an denselben Adressen wie src/lib/umgebung.ts', () => {
    // Gegenprobe: Die Liste enthält Treffer und Nicht-Treffer, sonst bewiese die Gleichheit nichts.
    const erwartet = ADRESSEN.map((adresse) => erkannteFernDatenbank(adresse) === 'produktion')
    expect(erwartet).toContain(true)
    expect(erwartet).toContain(false)

    expect(ADRESSEN.map((adresse) => enthaeltProduktionsReferenz(adresse))).toEqual(erwartet)
  })
})

type Umgebung = Partial<Record<'VERCEL_ENV' | 'DATABASE_URL' | 'DIRECT_URL', string>>

/** Das Skript echt, so wie vercel-build es aufruft: relativer Pfad, Arbeitsordner = Projekt, nur die Werte des Falls. */
function laufe(umgebung: Umgebung): { status: number | null; ausgabe: string } {
  const env: NodeJS.ProcessEnv = { NODE_ENV: 'test', ...umgebung }
  const ergebnis = spawnSync(process.execPath, [SKRIPT_RELATIV], { cwd: WURZEL, env, encoding: 'utf8' })
  return { status: ergebnis.status, ausgabe: `${ergebnis.stdout}${ergebnis.stderr}` }
}

describe('scripts/vorschau-db-wache.mjs als Prozess', () => {
  it('bricht eine Vorschau auf die Produktion mit Ausgang 1 ab, ohne Zugangsdaten zu zeigen', () => {
    const direkt = laufe({ VERCEL_ENV: 'preview', DATABASE_URL: DEV_POOLER, DIRECT_URL: PROD_DIREKT })
    expect(direkt.status).toBe(1)
    expect(direkt.ausgabe).toContain(
      'Abbruch: DIRECT_URL dieser Vorschau zeigt auf die Produktions-Datenbank. Variablen in Vercel prüfen.',
    )

    const pooler = laufe({ VERCEL_ENV: 'preview', DATABASE_URL: PROD_POOLER })
    expect(pooler.status).toBe(1)
    expect(pooler.ausgabe).toContain('Abbruch: DATABASE_URL dieser Vorschau')

    for (const { ausgabe } of [direkt, pooler]) {
      expect(ausgabe).not.toContain(PASSWORT)
      expect(ausgabe).not.toContain(BENUTZER)
      expect(ausgabe).not.toContain(`postgres.${REF}`)
      expect(ausgabe).not.toContain(REF)
    }
  })

  it('baut die Produktion mit derselben Adresse weiter (Ausgang 0)', () => {
    const ergebnis = laufe({ VERCEL_ENV: 'production', DATABASE_URL: PROD_POOLER, DIRECT_URL: PROD_DIREKT })
    expect(ergebnis.status).toBe(0)
    expect(ergebnis.ausgabe).not.toContain('Abbruch')
  })

  it('baut ganz ohne Umgebung weiter (Ausgang 0)', () => {
    // Wirklich leer: Der Typ von Next verlangt NODE_ENV, das Skript liest es nicht.
    const leer = {} as NodeJS.ProcessEnv
    const ergebnis = spawnSync(process.execPath, [SKRIPT_RELATIV], { cwd: WURZEL, env: leer, encoding: 'utf8' })
    expect(ergebnis.status).toBe(0)
  })

  it('lässt eine Vorschau mit der Entwicklungsdatenbank bauen (Ausgang 0)', () => {
    expect(laufe({ VERCEL_ENV: 'preview', DATABASE_URL: DEV_POOLER, DIRECT_URL: DEV_DIREKT }).status).toBe(0)
  })
})

/** Steht die Wache als erster Schritt von vercel-build, mit `&&` verbunden, vor der Migration? */
function wacheStehtVorMigration(skript: string): boolean {
  const schritte = skript.split('&&').map((schritt) => schritt.trim())
  return (
    schritte[0] === `node ${SKRIPT_RELATIV}` &&
    schritte.findIndex((schritt) => schritt.includes('prisma migrate deploy')) === 1
  )
}

describe('Verdrahtung in package.json', () => {
  it('ruft die Wache als ersten Schritt von vercel-build, vor der Migration', () => {
    const paket = JSON.parse(readFileSync(join(WURZEL, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }
    expect(wacheStehtVorMigration(paket.scripts['vercel-build'] ?? '')).toBe(true)
  })

  it('Gegenprobe: erkennt die Fassung ohne Wache und eine Verbindung, die den Ausgang übergeht', () => {
    expect(wacheStehtVorMigration('prisma migrate deploy && prisma generate && next build')).toBe(false)
    expect(
      wacheStehtVorMigration(`node ${SKRIPT_RELATIV}; prisma migrate deploy && prisma generate && next build`),
    ).toBe(false)
    expect(
      wacheStehtVorMigration(`prisma migrate deploy && node ${SKRIPT_RELATIV} && prisma generate && next build`),
    ).toBe(false)
    expect(
      wacheStehtVorMigration(`node ${SKRIPT_RELATIV} && prisma migrate deploy && prisma generate && next build`),
    ).toBe(true)
  })
})
