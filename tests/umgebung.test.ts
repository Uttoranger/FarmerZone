import { describe, it, expect } from 'vitest'
import {
  bannerZeilen,
  bestimmeUmgebung,
  datenbankHost,
  erkannteFernDatenbank,
  istDevDatenbank,
  istTestDatenbank,
  zeigtAufGehostetesProjekt,
  type UmgebungsWerte,
} from '@/lib/umgebung'

// Frei erfundene Werte — das Repo ist öffentlich. Die Projektreferenz ist die
// echte Dev-Referenz, weil genau sie die Allowlist bildet; sie ist kein Geheimnis.
const DEV_REF = 'pmshaubwpxzdupwhyvjj'
const PROD_REF = 'zxwkhizjvpyporjteylr'
const PROD_DB_POOLER = `postgresql://postgres.${PROD_REF}:geheimes-passwort@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`
const LOKALE_DB = 'postgresql://postgres:postgres@localhost:5432/farmerzone_test'
const DEV_DB_DIREKT = `postgresql://postgres:geheimes-passwort@db.${DEV_REF}.supabase.co:5432/postgres`
const DEV_DB_POOLER = `postgresql://postgres.${DEV_REF}:geheimes-passwort@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true`
const FREMDE_DB = 'postgresql://postgres.zzzzfremdeprojektzzzz:anderes-passwort@aws-0-eu-central-1.pooler.supabase.com:6543/postgres'

const PREVIEW: UmgebungsWerte = {
  NODE_ENV: 'production',
  VERCEL_ENV: 'preview',
  VERCEL_URL: 'farmer-zone-abc123-team.vercel.app',
  VERCEL_BRANCH_URL: 'farmer-zone-git-fix-testumgebung-team.vercel.app',
  VERCEL_GIT_COMMIT_REF: 'fix/testumgebung',
  DATABASE_URL: DEV_DB_POOLER,
  STRIPE_SECRET_KEY: 'sk_test_abc',
}

const PRODUKTION: UmgebungsWerte = {
  NODE_ENV: 'production',
  VERCEL_ENV: 'production',
  VERCEL_URL: 'farmer-zone-xyz789-team.vercel.app',
  NEXT_PUBLIC_APP_URL: 'https://farmerzone.example',
  DATABASE_URL: FREMDE_DB,
  STRIPE_SECRET_KEY: 'sk_live_abc',
}

const LOKAL: UmgebungsWerte = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/farmerzone',
  STRIPE_SECRET_KEY: 'sk_test_abc',
}

describe('bestimmeUmgebung — Art', () => {
  it('erkennt eine Preview nur an VERCEL_ENV=preview', () => {
    expect(bestimmeUmgebung(PREVIEW).art).toBe('preview')
  })

  it('erkennt lokal nur an NODE_ENV=development', () => {
    expect(bestimmeUmgebung(LOKAL).art).toBe('lokal')
  })

  it('zählt Produktion als Produktion', () => {
    expect(bestimmeUmgebung(PRODUKTION).art).toBe('produktion')
  })

  it('zählt Unbekanntes als Produktion — fail-closed, das Banner darf nie vor Kundinnen stehen', () => {
    expect(bestimmeUmgebung({}).art).toBe('produktion')
    expect(bestimmeUmgebung({ VERCEL_ENV: 'irgendwas' }).art).toBe('produktion')
    expect(bestimmeUmgebung({ NODE_ENV: 'test' }).art).toBe('produktion')
    expect(bestimmeUmgebung({ VERCEL_ENV: 'development' }).art).toBe('produktion')
  })

  it('lässt VERCEL_ENV=preview vor NODE_ENV gewinnen', () => {
    expect(bestimmeUmgebung({ VERCEL_ENV: 'preview', NODE_ENV: 'development' }).art).toBe('preview')
  })

  it('macht aus einem lokalen Produktions-Build keine Testumgebung', () => {
    // pnpm build && pnpm start: NODE_ENV=production, kein VERCEL_ENV
    expect(bestimmeUmgebung({ NODE_ENV: 'production' }).art).toBe('produktion')
  })
})

describe('bestimmeUmgebung — Adresse und vertraute Herkünfte', () => {
  it('vertraut in Produktion ausschließlich NEXT_PUBLIC_APP_URL', () => {
    const u = bestimmeUmgebung(PRODUKTION)
    expect(u.appUrl).toBe('https://farmerzone.example')
    expect(u.trustedOrigins).toEqual(['https://farmerzone.example'])
  })

  it('ersetzt in Produktion eine fehlende NEXT_PUBLIC_APP_URL durch NICHTS — auch nicht durch VERCEL_URL', () => {
    const u = bestimmeUmgebung({ ...PRODUKTION, NEXT_PUBLIC_APP_URL: undefined })
    expect(u.appUrl).toBeNull()
    expect(u.trustedOrigins).toEqual([])
  })

  it('nimmt in der Preview die Branch-Adresse als appUrl und vertraut beiden Vercel-Adressen', () => {
    const u = bestimmeUmgebung(PREVIEW)
    expect(u.appUrl).toBe('https://farmer-zone-git-fix-testumgebung-team.vercel.app')
    expect(u.trustedOrigins).toEqual([
      'https://farmer-zone-git-fix-testumgebung-team.vercel.app',
      'https://farmer-zone-abc123-team.vercel.app',
    ])
  })

  it('kommt in der Preview auch ohne Branch-Adresse aus', () => {
    const u = bestimmeUmgebung({ ...PREVIEW, VERCEL_BRANCH_URL: undefined })
    expect(u.appUrl).toBe('https://farmer-zone-abc123-team.vercel.app')
    expect(u.trustedOrigins).toEqual(['https://farmer-zone-abc123-team.vercel.app'])
  })

  it('ignoriert in der Preview eine gesetzte NEXT_PUBLIC_APP_URL — die gehört der Produktion', () => {
    const u = bestimmeUmgebung({ ...PREVIEW, NEXT_PUBLIC_APP_URL: 'https://farmerzone.example' })
    expect(u.trustedOrigins).not.toContain('https://farmerzone.example')
  })

  it('nimmt lokal localhost:3000', () => {
    const u = bestimmeUmgebung(LOKAL)
    expect(u.appUrl).toBe('http://localhost:3000')
    expect(u.trustedOrigins).toEqual(['http://localhost:3000'])
  })

  it('erzeugt niemals einen Platzhalter wie *.vercel.app', () => {
    for (const werte of [PREVIEW, PRODUKTION, LOKAL, {}, { VERCEL_ENV: 'preview' }]) {
      for (const origin of bestimmeUmgebung(werte).trustedOrigins) {
        expect(origin).not.toContain('*')
        expect(origin).toMatch(/^https?:\/\/[a-z0-9.-]+(:\d+)?$/)
      }
    }
  })

  it('behandelt leere und weiße Werte wie fehlende', () => {
    const u = bestimmeUmgebung({ ...PRODUKTION, NEXT_PUBLIC_APP_URL: '   ' })
    expect(u.appUrl).toBeNull()
  })
})

describe('istDevDatenbank', () => {
  it('erkennt die Dev-Datenbank über die Direktverbindung (Referenz im Host)', () => {
    expect(istDevDatenbank(DEV_DB_DIREKT)).toBe(true)
  })

  it('erkennt die Dev-Datenbank über den Pooler (Referenz nur im Benutzernamen)', () => {
    expect(istDevDatenbank(DEV_DB_POOLER)).toBe(true)
  })

  it('erkennt localhost', () => {
    expect(istDevDatenbank('postgresql://postgres:postgres@localhost:5432/db')).toBe(true)
    expect(istDevDatenbank('postgresql://postgres:postgres@127.0.0.1:5432/db')).toBe(true)
  })

  it('kennt den Docker-Dienstnamen postgres NICHT — deshalb prüft der Seed beide Allowlists', () => {
    // Festgehalten, weil die Asymmetrie der Grund ist, warum prisma/seed.ts
    // `istDevDatenbank || istTestDatenbank` prüft: Nur die erste Prüfung ließe
    // einen docker-compose-Lauf mitten im globalSetup sterben.
    expect(istDevDatenbank('postgresql://postgres:postgres@postgres:5432/db')).toBe(false)
    expect(istTestDatenbank('postgresql://postgres:postgres@postgres:5432/db')).toBe(true)
  })

  it('stuft jede andere Datenbank als fremd ein — Allowlist, keine Blocklist', () => {
    expect(istDevDatenbank(FREMDE_DB)).toBe(false)
    expect(istDevDatenbank('postgresql://u:p@db.anderesprojekt.supabase.co:5432/postgres')).toBe(false)
  })

  it('stuft Fehlendes und Unlesbares als fremd ein', () => {
    expect(istDevDatenbank(undefined)).toBe(false)
    expect(istDevDatenbank('')).toBe(false)
    expect(istDevDatenbank('das ist keine adresse')).toBe(false)
  })

  it('lässt sich nicht durch die Referenz im Passwort oder Pfad täuschen', () => {
    expect(istDevDatenbank(`postgresql://u:${DEV_REF}@db.fremd.supabase.co:5432/postgres`)).toBe(false)
    expect(istDevDatenbank(`postgresql://u:p@db.fremd.supabase.co:5432/${DEV_REF}`)).toBe(false)
  })
})

// Die zweite Allowlist. Sie entscheidet, wohin die Integrationstests schreiben
// DÜRFEN — dort wird angelegt, geändert und gelöscht. Sie ist deshalb strenger
// als istDevDatenbank und lehnt die Dev-Datenbank mit ab.
describe('istTestDatenbank', () => {
  it('erlaubt die lokalen Hosts', () => {
    expect(istTestDatenbank(LOKALE_DB)).toBe(true)
    expect(istTestDatenbank('postgresql://postgres:postgres@127.0.0.1:5432/fz_test')).toBe(true)
    expect(istTestDatenbank('postgresql://postgres:postgres@postgres:5432/fz_test')).toBe(true)
  })

  it('lehnt die Produktions-Datenbank ab', () => {
    expect(istTestDatenbank(PROD_DB_POOLER)).toBe(false)
    expect(
      istTestDatenbank(`postgresql://postgres:p@db.${PROD_REF}.supabase.co:5432/postgres`)
    ).toBe(false)
  })

  it('lehnt auch die Dev-Datenbank ab — Tests löschen, das darf nur die Testdatenbank treffen', () => {
    expect(istTestDatenbank(DEV_DB_DIREKT)).toBe(false)
    expect(istTestDatenbank(DEV_DB_POOLER)).toBe(false)
  })

  it('lehnt einen Tunnel auf localhost ab, dessen Benutzername auf ein echtes Projekt zeigt', () => {
    expect(istTestDatenbank(`postgresql://postgres.${PROD_REF}:p@localhost:5432/postgres`)).toBe(false)
    expect(istTestDatenbank(`postgresql://postgres.${DEV_REF}:p@127.0.0.1:6543/postgres`)).toBe(false)
  })

  it('lehnt einen Tunnel auch bei einem unbekannten Projekt ab — die Pooler-Regel ist generisch', () => {
    // Genau der Fall, für den die namentliche Prüfung nicht reicht: eine
    // Projektreferenz, die in umgebung.ts nirgends steht.
    expect(istTestDatenbank('postgresql://postgres.nieheirgendwonotiert:p@localhost:5432/postgres')).toBe(
      false
    )
  })

  it('erlaubt die gewöhnliche lokale Rolle ohne Punkt im Namen', () => {
    expect(istTestDatenbank('postgresql://postgres:postgres@localhost:5432/fz_test')).toBe(true)
    expect(istTestDatenbank('postgresql://franz:geheim@127.0.0.1:5432/fz_test')).toBe(true)
  })

  it('vergleicht den Host exakt — ein fremder Rechner mit localhost im Namen zählt nicht', () => {
    expect(istTestDatenbank('postgresql://u:p@db.localhost.example.com:5432/postgres')).toBe(false)
    expect(istTestDatenbank('postgresql://u:p@localhost.fremd.at:5432/postgres')).toBe(false)
  })

  it('lehnt Fehlendes und Unlesbares ab, statt es durchzuwinken', () => {
    expect(istTestDatenbank(undefined)).toBe(false)
    expect(istTestDatenbank('')).toBe(false)
    expect(istTestDatenbank('   ')).toBe(false)
    expect(istTestDatenbank('das ist keine adresse')).toBe(false)
  })
})

describe('zeigtAufGehostetesProjekt', () => {
  it('erkennt den Pooler-Benutzernamen am Punkt, unabhängig vom Projekt', () => {
    expect(zeigtAufGehostetesProjekt(DEV_DB_POOLER)).toBe(true)
    expect(zeigtAufGehostetesProjekt(PROD_DB_POOLER)).toBe(true)
    expect(zeigtAufGehostetesProjekt('postgresql://postgres.irgendwas:p@localhost:5432/db')).toBe(true)
  })

  it('lässt lokale Rollen und die Direktverbindung in Ruhe', () => {
    expect(zeigtAufGehostetesProjekt(LOKALE_DB)).toBe(false)
    // Direktverbindung: Referenz im Host, Benutzername schlicht „postgres".
    expect(zeigtAufGehostetesProjekt(DEV_DB_DIREKT)).toBe(false)
    expect(zeigtAufGehostetesProjekt(undefined)).toBe(false)
  })
})

describe('erkannteFernDatenbank', () => {
  it('benennt Produktion und Dev, damit eine Abbruchmeldung sie nennen kann', () => {
    expect(erkannteFernDatenbank(PROD_DB_POOLER)).toBe('produktion')
    expect(erkannteFernDatenbank(DEV_DB_POOLER)).toBe('dev')
  })

  it('meldet null für lokale und unbekannte Adressen', () => {
    expect(erkannteFernDatenbank(LOKALE_DB)).toBeNull()
    expect(erkannteFernDatenbank(FREMDE_DB)).toBeNull()
    expect(erkannteFernDatenbank(undefined)).toBeNull()
  })
})

describe('datenbankHost', () => {
  it('gibt den Host heraus — und sonst nichts aus der Adresse', () => {
    const host = datenbankHost(DEV_DB_POOLER)
    expect(host).toBe('aws-0-eu-central-1.pooler.supabase.com')
    expect(host).not.toContain('geheimes-passwort')
    expect(host).not.toContain(DEV_REF)
    expect(datenbankHost(LOKALE_DB)).toBe('localhost')
  })

  it('nennt unlesbare Adressen beim Namen, statt zu werfen', () => {
    expect(datenbankHost(undefined)).toBe('(keine lesbare Adresse)')
    expect(datenbankHost('das ist keine adresse')).toBe('(keine lesbare Adresse)')
  })
})

describe('bestimmeUmgebung — Stripe', () => {
  it('liest die Art nur aus dem Präfix', () => {
    expect(bestimmeUmgebung({ STRIPE_SECRET_KEY: 'sk_test_x' }).stripe).toBe('test')
    expect(bestimmeUmgebung({ STRIPE_SECRET_KEY: 'sk_live_x' }).stripe).toBe('live')
  })

  it('meldet fehlt bei fehlendem, leerem oder unbekanntem Schlüssel', () => {
    expect(bestimmeUmgebung({}).stripe).toBe('fehlt')
    expect(bestimmeUmgebung({ STRIPE_SECRET_KEY: '  ' }).stripe).toBe('fehlt')
    expect(bestimmeUmgebung({ STRIPE_SECRET_KEY: 'rk_live_x' }).stripe).toBe('fehlt')
  })
})

describe('bestimmeUmgebung — Branch', () => {
  it('reicht den Branch durch und meldet null, wenn keiner bekannt ist', () => {
    expect(bestimmeUmgebung(PREVIEW).branch).toBe('fix/testumgebung')
    expect(bestimmeUmgebung(LOKAL).branch).toBeNull()
    expect(bestimmeUmgebung({ VERCEL_GIT_COMMIT_REF: '  ' }).branch).toBeNull()
  })
})

describe('bestimmeUmgebung — Warnungen', () => {
  it('bleibt still, wenn alles zusammenpasst', () => {
    expect(bestimmeUmgebung(PREVIEW).warnungen).toEqual([])
    expect(bestimmeUmgebung(PRODUKTION).warnungen).toEqual([])
    expect(bestimmeUmgebung(LOKAL).warnungen).toEqual([])
  })

  it('warnt in der Preview vor einer fremden Datenbank', () => {
    const u = bestimmeUmgebung({ ...PREVIEW, DATABASE_URL: FREMDE_DB })
    expect(u.warnungen).toEqual(['Fremde Datenbank — das ist nicht die Dev-Datenbank.'])
  })

  it('warnt in der Preview vor Stripe live', () => {
    const u = bestimmeUmgebung({ ...PREVIEW, STRIPE_SECRET_KEY: 'sk_live_x' })
    expect(u.warnungen).toEqual(['Stripe LIVE — echte Zahlungen möglich.'])
  })

  it('warnt in der Preview, wenn Vercel keine Adresse liefert — dann fehlen die Systemvariablen', () => {
    const u = bestimmeUmgebung({ VERCEL_ENV: 'preview', DATABASE_URL: DEV_DB_POOLER, STRIPE_SECRET_KEY: 'sk_test_x' })
    expect(u.warnungen).toEqual(['Keine Vercel-Adresse bekannt — der Login kann so nicht funktionieren.'])
  })

  it('warnt in Produktion vor der Dev-Datenbank und vor Stripe test', () => {
    const u = bestimmeUmgebung({ ...PRODUKTION, DATABASE_URL: DEV_DB_POOLER, STRIPE_SECRET_KEY: 'sk_test_x' })
    expect(u.warnungen).toEqual([
      'Produktion läuft gegen die Dev-Datenbank.',
      'Stripe TEST in Produktion — keine echten Zahlungen möglich.',
    ])
  })

  it('kann mehrere Warnungen gleichzeitig tragen', () => {
    const u = bestimmeUmgebung({ ...PREVIEW, DATABASE_URL: FREMDE_DB, STRIPE_SECRET_KEY: 'sk_live_x' })
    expect(u.warnungen).toHaveLength(2)
  })
})

describe('bannerZeilen', () => {
  it('nennt in der Preview Datenbank, Stripe und Branch — lang und kurz', () => {
    const zeilen = bannerZeilen(bestimmeUmgebung(PREVIEW))
    expect(zeilen.lang).toBe('TESTUMGEBUNG · Dev-Datenbank · Stripe Test · fix/testumgebung')
    expect(zeilen.kurz).toBe('TEST · Dev-DB · Stripe Test')
  })

  it('schreibt lokal „lokal" statt eines Branches', () => {
    expect(bannerZeilen(bestimmeUmgebung(LOKAL)).lang).toBe('TESTUMGEBUNG · Dev-Datenbank · Stripe Test · lokal')
  })

  it('benennt fremde Datenbank und Stripe live beim Namen', () => {
    const zeilen = bannerZeilen(bestimmeUmgebung({ ...PREVIEW, DATABASE_URL: FREMDE_DB, STRIPE_SECRET_KEY: 'sk_live_x' }))
    expect(zeilen.lang).toContain('Fremde Datenbank')
    expect(zeilen.lang).toContain('Stripe LIVE')
    expect(zeilen.kurz).toBe('TEST · fremde DB · Stripe LIVE')
  })

  it('verrät auch im Bannertext keinen Host und keinen Schlüssel', () => {
    const zeilen = bannerZeilen(bestimmeUmgebung({ ...PREVIEW, STRIPE_SECRET_KEY: 'sk_live_sehr-geheim' }))
    const text = zeilen.lang + zeilen.kurz
    expect(text).not.toContain('supabase')
    expect(text).not.toContain('sk_')
    expect(text).not.toContain('geheim')
  })
})

describe('bestimmeUmgebung — keine Geheimnisse im Ergebnis', () => {
  it('trägt weder Datenbank-Adresse, Host, Benutzer, Passwort noch Stripe-Schlüssel', () => {
    for (const werte of [PREVIEW, PRODUKTION, LOKAL, { ...PREVIEW, DATABASE_URL: FREMDE_DB, STRIPE_SECRET_KEY: 'sk_live_sehr-geheim' }]) {
      const text = JSON.stringify(bestimmeUmgebung(werte))
      expect(text).not.toContain('postgres')
      expect(text).not.toContain('supabase')
      expect(text).not.toContain('pooler')
      expect(text).not.toContain('passwort')
      expect(text).not.toContain(DEV_REF)
      expect(text).not.toContain('sk_')
      expect(text).not.toContain('geheim')
      expect(text).not.toContain('5432')
      expect(text).not.toContain('6543')
    }
  })
})
