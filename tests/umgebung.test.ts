import { describe, it, expect, vi } from 'vitest'
import { stripeStartGesperrt } from '@/lib/stripe-modus'
import {
  PRODUKTION_ADRESSE,
  WARNUNG_APP_URL_FEHLT,
  WARNUNG_APP_URL_FREMDER_HOST,
  WARNUNG_APP_URL_MUSTER,
  WARNUNG_APP_URL_UNGUELTIG,
  WARNUNG_LIVE_IN_VORSCHAU,
  bannerZeilen,
  bestimmeUmgebung,
  datenbankHost,
  erkannteFernDatenbank,
  httpsHerkunft,
  istDevDatenbank,
  istTestDatenbank,
  leseStripeLiveAb,
  produktionsAdresse,
  STICHTAG_ZUKUNFT_GRENZE_MS,
  stichtagWeitInDerZukunft,
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

// Seit Register S16 (Nr. 64) meldet die Produktion jeden anderen Host als die
// echte Seite — die stimmige Produktion trägt deshalb deren Adresse.
const PRODUKTION: UmgebungsWerte = {
  NODE_ENV: 'production',
  VERCEL_ENV: 'production',
  VERCEL_URL: 'farmer-zone-xyz789-team.vercel.app',
  NEXT_PUBLIC_APP_URL: 'https://farmerzone.at',
  DATABASE_URL: FREMDE_DB,
  STRIPE_SECRET_KEY: 'sk_live_abc',
  STRIPE_CONNECT_WEBHOOK_SECRET: 'whsec_connect_platzhalter',
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
    expect(u.appUrl).toBe('https://farmerzone.at')
    expect(u.trustedOrigins).toEqual(['https://farmerzone.at'])
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

  // Bis Nr. 42 ignorierte die Preview NEXT_PUBLIC_APP_URL ganz („die gehört der
  // Produktion"). Seit Nr. 43 (Register Z3) trägt die Testumgebung dort ihre
  // eigene Adresse — die Sorge von damals bleibt als Sperre: Die Adresse der
  // echten Seite gilt in einer Vorschau nie.
  it('ignoriert in der Preview eine NEXT_PUBLIC_APP_URL, die auf die echte Seite zeigt — die gehört der Produktion', () => {
    const u = bestimmeUmgebung({ ...PREVIEW, NEXT_PUBLIC_APP_URL: PRODUKTION_ADRESSE })
    expect(u.trustedOrigins).not.toContain(PRODUKTION_ADRESSE)
    expect(u.appUrl).toBe('https://farmer-zone-git-fix-testumgebung-team.vercel.app')
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

  it('erkennt eingeschränkte Schlüssel wie ihre vollen Geschwister (Nr. 42, Runde 1)', () => {
    // Auch ein eingeschränkter Live-Schlüssel kann echtes Geld bewegen — er zählt als live.
    expect(bestimmeUmgebung({ STRIPE_SECRET_KEY: 'rk_live_x' }).stripe).toBe('live')
    expect(bestimmeUmgebung({ STRIPE_SECRET_KEY: 'rk_test_x' }).stripe).toBe('test')
  })

  it('meldet fehlt bei fehlendem, leerem oder unbekanntem Schlüssel', () => {
    expect(bestimmeUmgebung({}).stripe).toBe('fehlt')
    expect(bestimmeUmgebung({ STRIPE_SECRET_KEY: '  ' }).stripe).toBe('fehlt')
    // Ein öffentlicher Schlüssel in der falschen Variable ist kein Geheimschlüssel.
    expect(bestimmeUmgebung({ STRIPE_SECRET_KEY: 'pk_live_x' }).stripe).toBe('fehlt')
    expect(bestimmeUmgebung({ STRIPE_SECRET_KEY: 'whsec_x' }).stripe).toBe('fehlt')
  })
})

describe('bestimmeUmgebung — Produktions-Deployment bei Vercel (Nr. 42, Runde 1)', () => {
  it('nur VERCEL_ENV=production ist das Produktions-Deployment', () => {
    expect(bestimmeUmgebung(PRODUKTION).vercelProduktion).toBe(true)
    // Fail-closed: nur genau dieser Wert, kein Trimmen, keine Großschreibung.
    expect(bestimmeUmgebung({ VERCEL_ENV: ' production ' }).vercelProduktion).toBe(false)
    expect(bestimmeUmgebung({ VERCEL_ENV: 'Production' }).vercelProduktion).toBe(false)
  })

  it('Vorschau, lokal, lokaler Produktions-Build, Test/CI und Unbekanntes sind es nicht', () => {
    expect(bestimmeUmgebung(PREVIEW).vercelProduktion).toBe(false)
    expect(bestimmeUmgebung(LOKAL).vercelProduktion).toBe(false)
    expect(bestimmeUmgebung({ NODE_ENV: 'production' }).vercelProduktion).toBe(false)
    expect(bestimmeUmgebung({ NODE_ENV: 'test' }).vercelProduktion).toBe(false)
    expect(bestimmeUmgebung({ VERCEL_ENV: 'development' }).vercelProduktion).toBe(false)
    expect(bestimmeUmgebung({}).vercelProduktion).toBe(false)
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

  // Seit der Modus-Wache aus Nr. 42 startet ein Live-Schlüssel in der Vorschau
  // nicht — „echte Zahlungen möglich" war nicht mehr wahr (Nr. 43, Runde 1).
  it('warnt in der Preview vor einem Live-Schlüssel — und sagt, was die Wache tut', () => {
    const u = bestimmeUmgebung({ ...PREVIEW, STRIPE_SECRET_KEY: 'sk_live_x' })
    expect(u.warnungen).toEqual([WARNUNG_LIVE_IN_VORSCHAU])
    // Der Satz stimmt mit der Wache überein: Stripe startet dort nicht.
    expect(stripeStartGesperrt(u)).toBe(true)
    expect(WARNUNG_LIVE_IN_VORSCHAU).toMatch(/startet nicht/)
    expect(WARNUNG_LIVE_IN_VORSCHAU).not.toMatch(/Zahlungen möglich/)
  })

  it('warnt genauso bei einem eingeschränkten Live-Schlüssel', () => {
    expect(bestimmeUmgebung({ ...PREVIEW, STRIPE_SECRET_KEY: 'rk_live_x' }).warnungen).toEqual([WARNUNG_LIVE_IN_VORSCHAU])
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

  it('warnt in Produktion, wenn der Connect-Endpunkt kein Secret hat — account.updated käme nie an', () => {
    const u = bestimmeUmgebung({ ...PRODUKTION, STRIPE_CONNECT_WEBHOOK_SECRET: undefined })
    expect(u.warnungen).toEqual([
      'Kein STRIPE_CONNECT_WEBHOOK_SECRET — gesperrte oder frisch freigegebene Hof-Konten bleiben unbemerkt.',
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

// ─── Testumgebung test.farmerzone.at (Register Z3, Nr. 43) ───────────────────
// Erfundene Adressen unter .example — nur PRODUKTION_ADRESSE ist die echte,
// öffentliche Adresse, und sie kommt aus dem Modul, nicht aus dem Test.
const TESTUMGEBUNG = 'https://test.farmerzone.example'
const STAGING: UmgebungsWerte = {
  ...PREVIEW,
  VERCEL_GIT_COMMIT_REF: 'staging',
  VERCEL_BRANCH_URL: 'farmer-zone-git-staging-team.vercel.app',
  NEXT_PUBLIC_APP_URL: TESTUMGEBUNG,
}

describe('httpsHerkunft — nur eine reine https-Adresse', () => {
  it('gibt die Herkunft normalisiert zurück: klein, ohne Schrägstrich und ohne Punkt am Ende', () => {
    expect(httpsHerkunft('https://test.farmerzone.example')).toBe(TESTUMGEBUNG)
    expect(httpsHerkunft('  https://Test.FarmerZone.example/  ')).toBe(TESTUMGEBUNG)
    // Ein Punkt am Ende meint denselben Host — eine Schreibweise für Links.
    expect(httpsHerkunft('https://test.farmerzone.example.')).toBe(TESTUMGEBUNG)
    // Bleibt nach dem Normalisieren ein Punkt am Ende, ist es keine Herkunft (Runde 2).
    expect(httpsHerkunft('https://test.farmerzone.example..')).toBeNull()
    expect(httpsHerkunft('https://test..farmerzone.example')).toBeNull()
    expect(httpsHerkunft('https://test.farmerzone.example:8443')).toBe('https://test.farmerzone.example:8443')
  })

  it('lehnt alles ab, was keine reine https-Herkunft ist', () => {
    for (const wert of [
      'http://test.farmerzone.example',
      'test.farmerzone.example',
      'https://test.farmerzone.example/pfad',
      'https://test.farmerzone.example/?x=1',
      'https://test.farmerzone.example/#anker',
      'https://nutzer:passwort@test.farmerzone.example',
      'https://*.vercel.app',
      'javascript:alert(1)',
      'keine adresse',
    ]) {
      expect(httpsHerkunft(wert), wert).toBeNull()
    }
  })

  it('behandelt Fehlendes, Leeres und Weißes als fehlend', () => {
    expect(httpsHerkunft(undefined)).toBeNull()
    expect(httpsHerkunft('')).toBeNull()
    expect(httpsHerkunft('   ')).toBeNull()
  })
})

describe('bestimmeUmgebung — eigene Adresse der Vorschau (Register Z3)', () => {
  it('Produktion: nur NEXT_PUBLIC_APP_URL — ohne https so, wie sie steht (bereinigt wird seit Nr. 56 nur eine https-Adresse)', () => {
    expect(bestimmeUmgebung({ ...PRODUKTION, NEXT_PUBLIC_TESTUMGEBUNG_URL: TESTUMGEBUNG }).trustedOrigins).toEqual([
      'https://farmerzone.at',
    ])
    // Der lokale Produktions-Build (pnpm start) läuft mit http://localhost — wie bisher.
    const lokalerBuild = bestimmeUmgebung({ NODE_ENV: 'production', NEXT_PUBLIC_APP_URL: 'http://localhost:3000' })
    expect(lokalerBuild.appUrl).toBe('http://localhost:3000')
    expect(lokalerBuild.trustedOrigins).toEqual(['http://localhost:3000'])
  })

  it('Vorschau ohne Variable unverändert: Branch-Adresse vorn, Deploy-Adresse dahinter, keine Warnung', () => {
    const u = bestimmeUmgebung({ ...PREVIEW, NEXT_PUBLIC_APP_URL: undefined })
    expect(u.appUrl).toBe('https://farmer-zone-git-fix-testumgebung-team.vercel.app')
    expect(u.trustedOrigins).toEqual([
      'https://farmer-zone-git-fix-testumgebung-team.vercel.app',
      'https://farmer-zone-abc123-team.vercel.app',
    ])
    expect(u.warnungen).toEqual([])
  })

  it('Vorschau mit Variable: Sie wird appUrl und vertraute Herkunft, die Vercel-Adressen bleiben dahinter', () => {
    const u = bestimmeUmgebung(STAGING)
    expect(u.appUrl).toBe(TESTUMGEBUNG)
    expect(u.trustedOrigins).toEqual([
      TESTUMGEBUNG,
      'https://farmer-zone-git-staging-team.vercel.app',
      'https://farmer-zone-abc123-team.vercel.app',
    ])
    expect(u.warnungen).toEqual([])
  })

  it('normalisiert die Adresse der Vorschau wie jede Herkunft', () => {
    expect(bestimmeUmgebung({ ...STAGING, NEXT_PUBLIC_APP_URL: 'https://Test.FarmerZone.example/' }).appUrl).toBe(TESTUMGEBUNG)
  })

  it('nimmt in der Vorschau nur https — sonst die Vercel-Adresse und eine Warnung im Banner', () => {
    for (const wert of ['http://test.farmerzone.example', 'https://test.farmerzone.example/pfad', 'https://*.vercel.app']) {
      const u = bestimmeUmgebung({ ...STAGING, NEXT_PUBLIC_APP_URL: wert })
      expect(u.appUrl, wert).toBe('https://farmer-zone-git-staging-team.vercel.app')
      expect(u.trustedOrigins.join(' '), wert).not.toContain('test.farmerzone')
      expect(u.warnungen, wert).toEqual(['NEXT_PUBLIC_APP_URL ist keine reine https-Adresse — die Vorschau nimmt ihre Vercel-Adresse.'])
    }
  })

  it('nimmt die echte Seite nie als Adresse einer Vorschau — mit www, Punkt am Ende, groß geschrieben oder mit Pfad', () => {
    const host = new URL(PRODUKTION_ADRESSE).hostname
    for (const wert of [
      PRODUKTION_ADRESSE,
      `${PRODUKTION_ADRESSE}/`,
      `https://www.${host}`,
      `https://${host}.`,
      // Mehrere Punkte am Ende: Erst normalisieren, dann prüfen — sonst bliebe die echte Seite mit Punkt übrig (Runde 2).
      `https://${host}..`,
      `https://${host}...`,
      // Kodierte und Unicode-Punkte normalisiert der URL-Parser zu „." (Nachprüfung 2).
      `https://${host}%2E%2E`,
      `https://${host}\u3002\u3002`,
      `HTTPS://${host.toUpperCase()}`,
      `https://${host}/pfad`,
      `http://${host}`,
    ]) {
      const u = bestimmeUmgebung({ ...STAGING, NEXT_PUBLIC_APP_URL: wert })
      expect(u.appUrl, wert).toBe('https://farmer-zone-git-staging-team.vercel.app')
      expect(u.trustedOrigins.join(' '), wert).not.toContain('farmerzone.at')
      expect(u.warnungen, wert).toEqual(['NEXT_PUBLIC_APP_URL zeigt auf die echte Seite — die Vorschau nimmt ihre Vercel-Adresse.'])
    }
  })

  it('führt eine Adresse, die schon die Branch-Adresse ist, nur einmal', () => {
    const u = bestimmeUmgebung({ ...STAGING, NEXT_PUBLIC_APP_URL: 'https://farmer-zone-git-staging-team.vercel.app' })
    expect(u.trustedOrigins).toEqual([
      'https://farmer-zone-git-staging-team.vercel.app',
      'https://farmer-zone-abc123-team.vercel.app',
    ])
  })

  it('kommt mit der eigenen Adresse auch ohne Vercel-Adressen aus — dann ohne Warnung zum Login', () => {
    const u = bestimmeUmgebung({ VERCEL_ENV: 'preview', NEXT_PUBLIC_APP_URL: TESTUMGEBUNG, DATABASE_URL: DEV_DB_POOLER, STRIPE_SECRET_KEY: 'sk_test_x' })
    expect(u.appUrl).toBe(TESTUMGEBUNG)
    expect(u.trustedOrigins).toEqual([TESTUMGEBUNG])
    expect(u.warnungen).toEqual([])
  })

  it('lokal unverändert: localhost:3000, auch wenn NEXT_PUBLIC_APP_URL etwas anderes sagt', () => {
    const u = bestimmeUmgebung({ ...LOKAL, NEXT_PUBLIC_APP_URL: TESTUMGEBUNG })
    expect(u.trustedOrigins).toEqual(['http://localhost:3000'])
  })
})

describe('bestimmeUmgebung — Link zur Testumgebung (Register Z3)', () => {
  it('reicht NEXT_PUBLIC_TESTUMGEBUNG_URL normalisiert durch', () => {
    expect(bestimmeUmgebung({ ...PRODUKTION, NEXT_PUBLIC_TESTUMGEBUNG_URL: 'https://Test.FarmerZone.example/' }).testumgebungUrl).toBe(TESTUMGEBUNG)
  })

  it('ohne Variable kein Link und keine Warnung', () => {
    const u = bestimmeUmgebung(PRODUKTION)
    expect(u.testumgebungUrl).toBeNull()
    expect(u.warnungen).toEqual([])
  })

  it('ohne reine https-Adresse kein Link, dafür eine Warnung (Produktion: an Sentry, Vorschau: im Banner)', () => {
    for (const wert of ['http://test.farmerzone.example', 'test.farmerzone.example', 'https://test.farmerzone.example/admin']) {
      const u = bestimmeUmgebung({ ...PRODUKTION, NEXT_PUBLIC_TESTUMGEBUNG_URL: wert })
      expect(u.testumgebungUrl, wert).toBeNull()
      expect(u.warnungen, wert).toEqual(['NEXT_PUBLIC_TESTUMGEBUNG_URL ist keine reine https-Adresse — der Link zur Testumgebung fehlt.'])
    }
  })

  it('führt nie unter dem Namen „Testumgebung" auf die echte Seite — auch nicht mit Punkt, Großschreibung oder Pfad', () => {
    const host = new URL(PRODUKTION_ADRESSE).hostname
    for (const wert of [
      PRODUKTION_ADRESSE,
      `https://${host}.`,
      `https://${host}..`,
      `https://${host}...`,
      `https://${host}%2E%2E`,
      `https://${host}\u3002\u3002`,
      `https://${host.toUpperCase()}/admin`,
      `https://www.${host}`,
    ]) {
      const u = bestimmeUmgebung({ ...PRODUKTION, NEXT_PUBLIC_TESTUMGEBUNG_URL: wert })
      expect(u.testumgebungUrl, wert).toBeNull()
      expect(u.warnungen, wert).toEqual(['NEXT_PUBLIC_TESTUMGEBUNG_URL zeigt auf die echte Seite — der Link zur Testumgebung fehlt.'])
    }
  })

  it('Gegenprobe: eine Unterdomain der echten Seite ist nicht die echte Seite', () => {
    const host = new URL(PRODUKTION_ADRESSE).hostname
    expect(bestimmeUmgebung({ ...PRODUKTION, NEXT_PUBLIC_TESTUMGEBUNG_URL: `https://test.${host}` }).testumgebungUrl).toBe(`https://test.${host}`)
  })

  it('verlinkt nicht auf sich selbst — in der Testumgebung gibt es den Link nicht', () => {
    const u = bestimmeUmgebung({ ...STAGING, NEXT_PUBLIC_TESTUMGEBUNG_URL: TESTUMGEBUNG })
    expect(u.testumgebungUrl).toBeNull()
    expect(u.warnungen).toEqual([])
  })
})

// ─── Stichtag der Live-Schaltung STRIPE_LIVE_AB (Register Z4, Nr. 55) ────────
// Nur ein ISO-Zeitpunkt MIT Zeitzone gilt. Alles andere wird ignoriert —
// Testzahlungen zählen dann weiter mit wie vor Nr. 55 — und meldet sich wie
// NEXT_PUBLIC_TESTUMGEBUNG_URL: Produktion an Sentry, Vorschau und lokal im Banner.
const OHNE_ZEITZONE = 'STRIPE_LIVE_AB hat keine Zeitzone (etwa +01:00 am Ende) — die Variable gilt nicht, Testzahlungen zählen mit.'
const UNGUELTIG = 'STRIPE_LIVE_AB ist kein gültiger Zeitpunkt (Form 2026-11-02T21:00:00+01:00) — die Variable gilt nicht, Testzahlungen zählen mit.'

describe('leseStripeLiveAb — nur ein Zeitpunkt mit Zeitzone', () => {
  it('liest Z und Versatz als denselben Zeitpunkt, mit und ohne Sekunden und Millisekunden', () => {
    const erwartet = Date.UTC(2026, 10, 2, 20, 0, 0)
    for (const wert of [
      '2026-11-02T21:00:00+01:00',
      '2026-11-02T20:00:00Z',
      '2026-11-02T21:00+01:00',
      '2026-11-02T15:00:00.000-05:00',
      '  2026-11-02T21:00:00+01:00  ',
    ]) {
      expect(leseStripeLiveAb(wert), wert).toEqual({ ab: new Date(erwartet) })
    }
    expect(leseStripeLiveAb('2026-11-02T21:00:00.5+01:00')).toEqual({ ab: new Date(erwartet + 500) })
  })

  it('fehlt die Variable oder ist sie leer, gibt es keinen Stichtag und kein Problem', () => {
    expect(leseStripeLiveAb(undefined)).toBeNull()
    expect(leseStripeLiveAb('')).toBeNull()
    expect(leseStripeLiveAb('   ')).toBeNull()
  })

  it('erkennt einen Zeitpunkt ohne Zeitzone — Vercel rechnet in UTC, Wien wäre ein bis zwei Stunden daneben', () => {
    for (const wert of ['2026-11-02T21:00:00', '2026-11-02T21:00', '2026-11-02', '2026-11-02 21:00:00']) {
      expect(leseStripeLiveAb(wert), wert).toEqual({ problem: 'ohne-zeitzone' })
    }
  })

  it('lehnt Unlesbares und unmögliche Kalenderwerte ab, statt sie umzurechnen', () => {
    for (const wert of [
      'morgen',
      '1730577600',
      '02.11.2026 21:00',
      '2026-13-01T00:00:00Z',
      '2026-02-30T12:00:00+01:00',
      '2026-11-31T12:00:00+01:00',
      '2026-11-02T24:00:00+01:00',
      '2026-11-02T21:60:00+01:00',
      '2026-11-02T21:00:60+01:00',
      '2026-11-02T21:00:00+15:00',
      '2026-11-02T21:00:00+01:60',
      '2026-11-02T21:00:00+0100',
      '2026-11-02t21:00:00z',
      '2026-11-02T21:00:00+01:00 Wien',
    ]) {
      expect(leseStripeLiveAb(wert), wert).toEqual({ problem: 'ungueltig' })
    }
  })

  it('nimmt nur Zeitzonen der Erde: −12:00 bis +14:00', () => {
    expect(leseStripeLiveAb('2026-11-02T09:00:00-12:00')).toEqual({ ab: new Date('2026-11-02T21:00:00Z') })
    expect(leseStripeLiveAb('2026-11-03T11:00:00+14:00')).toEqual({ ab: new Date('2026-11-02T21:00:00Z') })
    for (const wert of ['2026-11-02T09:00:00-12:01', '2026-11-02T09:00:00-13:00', '2026-11-02T09:00:00-14:00', '2026-11-03T11:00:00+14:01']) {
      expect(leseStripeLiveAb(wert), wert).toEqual({ problem: 'ungueltig' })
    }
  })

  it('kennt den Schalttag', () => {
    expect(leseStripeLiveAb('2028-02-29T12:00:00+01:00')).toEqual({ ab: new Date(Date.UTC(2028, 1, 29, 11)) })
    expect(leseStripeLiveAb('2027-02-29T12:00:00+01:00')).toEqual({ problem: 'ungueltig' })
  })
})

describe('stichtagWeitInDerZukunft — mehr als 24 Stunden voraus meldet sich (Nachbesserung Runde 1)', () => {
  const jetzt = new Date('2026-11-02T18:00:00Z')

  it('ein falsches Jahr liegt weit in der Zukunft', () => {
    expect(stichtagWeitInDerZukunft(new Date('2062-11-02T20:00:00Z'), jetzt)).toBe(true)
  })

  it('genau 24 Stunden voraus noch nicht, eine Millisekunde mehr schon', () => {
    expect(STICHTAG_ZUKUNFT_GRENZE_MS).toBe(24 * 60 * 60 * 1000)
    expect(stichtagWeitInDerZukunft(new Date(jetzt.getTime() + STICHTAG_ZUKUNFT_GRENZE_MS), jetzt)).toBe(false)
    expect(stichtagWeitInDerZukunft(new Date(jetzt.getTime() + STICHTAG_ZUKUNFT_GRENZE_MS + 1), jetzt)).toBe(true)
  })

  it('wenige Stunden voraus (Beginn des Redeploys), jetzt, vorbei oder kein Stichtag: kein Fehler', () => {
    expect(stichtagWeitInDerZukunft(new Date(jetzt.getTime() + 3 * 60 * 60 * 1000), jetzt)).toBe(false)
    expect(stichtagWeitInDerZukunft(jetzt, jetzt)).toBe(false)
    expect(stichtagWeitInDerZukunft(new Date('2026-10-01T00:00:00Z'), jetzt)).toBe(false)
    expect(stichtagWeitInDerZukunft(null, jetzt)).toBe(false)
  })
})

describe('bestimmeUmgebung — Stichtag STRIPE_LIVE_AB (Register Z4)', () => {
  it('ohne Variable kein Stichtag und keine Warnung — alles wie vor Nr. 55', () => {
    for (const werte of [PRODUKTION, PREVIEW, LOKAL]) {
      const u = bestimmeUmgebung(werte)
      expect(u.stripeLiveAb).toBeNull()
      expect(u.warnungen).toEqual([])
    }
  })

  it('reicht einen gültigen Zeitpunkt als Date durch, ohne Warnung', () => {
    const u = bestimmeUmgebung({ ...PRODUKTION, STRIPE_LIVE_AB: '2026-11-02T21:00:00+01:00' })
    expect(u.stripeLiveAb).toEqual(new Date('2026-11-02T20:00:00Z'))
    expect(u.warnungen).toEqual([])
  })

  it('ignoriert einen Wert ohne Zeitzone und warnt — in Produktion wie in Vorschau und lokal', () => {
    for (const werte of [PRODUKTION, PREVIEW, LOKAL]) {
      const u = bestimmeUmgebung({ ...werte, STRIPE_LIVE_AB: '2026-11-02T21:00:00' })
      expect(u.stripeLiveAb).toBeNull()
      expect(u.warnungen).toEqual([OHNE_ZEITZONE])
    }
  })

  it('ignoriert einen ungültigen Wert und warnt, ohne den Wert zu nennen', () => {
    const u = bestimmeUmgebung({ ...PRODUKTION, STRIPE_LIVE_AB: '2026-02-30T12:00:00+01:00' })
    expect(u.stripeLiveAb).toBeNull()
    expect(u.warnungen).toEqual([UNGUELTIG])
    expect(u.warnungen.join(' ')).not.toContain('2026-02-30')
  })
})

// ─── NEXT_PUBLIC_APP_URL in der Produktion (Nr. 56, Lauf 8 §6) ───────────────
// Bis Nr. 56 übernahm die Produktion den Wert roh: Ein Schrägstrich am Ende,
// ein Pfad oder eine Abfrage standen so in trustedOrigins, in baseURL und in
// jedem Link einer Mail. Jetzt die bereinigte https-Herkunft. Ein ungültiger
// Wert bleibt roh — NIE leer, APP_URL fiele sonst auf localhost — und meldet
// sich als Warnung (Produktion: an Sentry, einmal je Instanz, ohne den Wert).

describe('produktionsAdresse — NEXT_PUBLIC_APP_URL in der Produktion (Nr. 56)', () => {
  // Eine Abfrage („?") macht den Wert seit Register S16 ungültig (Block S16 unten).
  it('macht aus einer https-Adresse die reine Herkunft: klein, ohne Pfad, Anker, Zugangsdaten und Schrägstrich am Ende', () => {
    for (const [wert, herkunft] of [
      ['https://farmerzone.example', 'https://farmerzone.example'],
      ['https://FarmerZone.example/', 'https://farmerzone.example'],
      ['  https://farmerzone.example/  ', 'https://farmerzone.example'],
      ['https://farmerzone.example/pfad/tiefer#anker', 'https://farmerzone.example'],
      ['https://farmerzone.example.', 'https://farmerzone.example'],
      ['https://farmerzone.example:8443/', 'https://farmerzone.example:8443'],
      ['https://farmerzone.example:443', 'https://farmerzone.example'],
      ['https://nutzer:passwort@farmerzone.example', 'https://farmerzone.example'],
    ] as const) {
      expect(produktionsAdresse(wert), wert).toEqual({ herkunft })
    }
  })

  it('behält einen ungültigen Wert roh (nur ohne Ränder) — kein https oder kein gültiger Host', () => {
    for (const wert of [
      'http://farmerzone.example',
      'http://localhost:3000',
      'farmerzone.example',
      'ftp://farmerzone.example',
      'https://*.farmerzone.example',
      'https://farmerzone.example..',
      'https://far mer.example',
      'keine adresse',
    ]) {
      expect(produktionsAdresse(`  ${wert} `), wert).toEqual({ roh: wert })
    }
  })

  it('ohne Wert: null — kein Ersatz', () => {
    expect(produktionsAdresse(undefined)).toBeNull()
    expect(produktionsAdresse('')).toBeNull()
    expect(produktionsAdresse('   ')).toBeNull()
  })
})

describe('bestimmeUmgebung — Produktion nimmt NEXT_PUBLIC_APP_URL als bereinigte Herkunft (Nr. 56)', () => {
  it('bereinigt die Adresse für vertraute Herkünfte und appUrl — bei der echten Seite ohne Warnung', () => {
    // Seit S16: ohne „?" (sonst ungültig) und mit dem echten Host (sonst eine Warnung).
    const u = bestimmeUmgebung({ ...PRODUKTION, NEXT_PUBLIC_APP_URL: 'https://FarmerZone.at/start' })
    expect(u.trustedOrigins).toEqual(['https://farmerzone.at'])
    expect(u.appUrl).toBe('https://farmerzone.at')
    expect(u.warnungen).toEqual([])
  })

  it('ein ungültiger Wert bleibt roh — nie leer, sonst fiele APP_URL auf localhost — und meldet sich ohne den Wert', () => {
    const wert = 'http://farmerzone.example/geheim-123'
    const u = bestimmeUmgebung({ ...PRODUKTION, NEXT_PUBLIC_APP_URL: wert })
    expect(u.trustedOrigins).toEqual([wert])
    expect(u.appUrl).toBe(wert)
    expect(u.warnungen).toEqual([WARNUNG_APP_URL_UNGUELTIG])
    expect(u.warnungen.join(' ')).not.toMatch(/farmerzone|geheim/)
  })

  it('auch ein Wert mit „*" bleibt roh — Better Auth liest ihn als Muster; gewollt (nie leer), er meldet sich als Warnung (Runde 1)', () => {
    // Hält fest, was der Kommentar zu trustedOrigins sagt: Erzeugt wird nie
    // ein Platzhalter, aber ein eingetragener steht roh da.
    const wert = 'https://*.farmerzone.example'
    const u = bestimmeUmgebung({ ...PRODUKTION, NEXT_PUBLIC_APP_URL: wert })
    expect(u.trustedOrigins).toEqual([wert])
    // Seit S16 mit eigener Warnung „Muster".
    expect(u.warnungen).toEqual([WARNUNG_APP_URL_MUSTER])
  })

  it('fehlt der Wert, bleibt es ohne Ersatz — mit Warnung', () => {
    const u = bestimmeUmgebung({ ...PRODUKTION, NEXT_PUBLIC_APP_URL: '  ' })
    expect(u.trustedOrigins).toEqual([])
    expect(u.appUrl).toBeNull()
    expect(u.warnungen).toEqual([WARNUNG_APP_URL_FEHLT])
  })

  it('die Vercel-Adresse der Produktion bleibt, wie sie ist: eingetragen angenommen, nie aus VERCEL_URL ergänzt — seit S16 mit Warnung', () => {
    const u = bestimmeUmgebung({ ...PRODUKTION, NEXT_PUBLIC_APP_URL: 'https://farmer-zone-beispiel.vercel.app/' })
    expect(u.trustedOrigins).toEqual(['https://farmer-zone-beispiel.vercel.app'])
    expect(u.trustedOrigins).not.toContain(`https://${PRODUKTION.VERCEL_URL}`)
    expect(u.warnungen).toEqual([WARNUNG_APP_URL_FREMDER_HOST])
  })

  it('Vorschau und lokal: keine Warnung zur Adresse der Produktion', () => {
    expect(bestimmeUmgebung({ ...PREVIEW, NEXT_PUBLIC_APP_URL: undefined }).warnungen).toEqual([])
    expect(bestimmeUmgebung({ ...LOKAL, NEXT_PUBLIC_APP_URL: 'http://farmerzone.example' }).warnungen).toEqual([])
  })
})

describe('Produktion: die Warnung zu NEXT_PUBLIC_APP_URL geht an Sentry (Nr. 56)', () => {
  it('höchstens einmal je Instanz und ohne den Wert; APP_URL behält den Rohwert', async () => {
    // Frisch geladen: Umgebung und „schon gemeldet" leben auf Modulebene (umgebung-server.ts).
    vi.resetModules()
    vi.doMock('@sentry/nextjs', () => ({ captureMessage: vi.fn() }))
    vi.doMock('@/lib/env', () => ({
      env: {
        VERCEL_ENV: 'production',
        NEXT_PUBLIC_APP_URL: 'http://farmerzone.example/geheim-123',
        DATABASE_URL: FREMDE_DB,
        STRIPE_SECRET_KEY: 'sk_live_abc',
        STRIPE_CONNECT_WEBHOOK_SECRET: 'whsec_connect_platzhalter',
      },
    }))
    const server = await import('@/lib/umgebung-server')
    const sentry = await import('@sentry/nextjs')

    expect(server.UMGEBUNG.trustedOrigins).toEqual(['http://farmerzone.example/geheim-123'])
    expect(server.APP_URL).toBe('http://farmerzone.example/geheim-123')
    server.meldeUmgebungsWarnungen()
    server.meldeUmgebungsWarnungen()
    expect(sentry.captureMessage).toHaveBeenCalledTimes(1)
    const [satz, stufe] = vi.mocked(sentry.captureMessage).mock.calls[0]
    expect(satz).toContain(WARNUNG_APP_URL_UNGUELTIG)
    expect(stufe).toBe('warning')
    expect(String(satz)).not.toMatch(/farmerzone\.example|geheim/)
  })
})

// Register S16 (Nr. 64): trustedOrigins ohne Muster. Ein Wert mit „*" oder „?"
// gilt als ungültig (bleibt roh, Warnung „Muster"); ein https-Wert mit fremdem
// Host wird angenommen, meldet sich in der Produktion aber an Sentry — ohne den
// Wert, über meldeUmgebungsWarnungen einmal je Instanz.

describe('S16 — NEXT_PUBLIC_APP_URL in der Produktion: kein Muster, fremder Host mit Warnung (Nr. 64)', () => {
  const PROD_ECHT: UmgebungsWerte = { ...PRODUKTION, NEXT_PUBLIC_APP_URL: 'https://farmerzone.at' }

  it('„*" oder „?" irgendwo im Wert: ungültig, roh — auch wo die Herkunft sonst lesbar wäre', () => {
    for (const wert of ['https://farmerzone.at/?x=1', 'https://farmerzone.at?', 'https://farmerzone.at/*', 'https://*.farmerzone.at', 'https://farmerzone.at/pfad?']) {
      expect(produktionsAdresse(` ${wert} `), wert).toEqual({ roh: wert })
      const u = bestimmeUmgebung({ ...PROD_ECHT, NEXT_PUBLIC_APP_URL: wert })
      expect(u.trustedOrigins, wert).toEqual([wert])
      expect(u.warnungen, wert).toEqual([WARNUNG_APP_URL_MUSTER])
    }
    expect(WARNUNG_APP_URL_MUSTER).toMatch(/Muster/)
  })

  it('ein fremder https-Host wird angenommen und meldet sich — ohne den Wert; die echte Seite mit und ohne www nicht', () => {
    for (const [wert, herkunft] of [
      ['https://farmer-zone-beispiel.vercel.app/', 'https://farmer-zone-beispiel.vercel.app'],
      ['https://bäckerei.at/', 'https://xn--bckerei-5wa.at'],
      ['https://farmerzone.at@evil.example', 'https://evil.example'],
      ['https://farmerzone.at.evil.example/', 'https://farmerzone.at.evil.example'],
    ] as const) {
      expect(produktionsAdresse(wert), wert).toEqual({ herkunft })
      const u = bestimmeUmgebung({ ...PROD_ECHT, NEXT_PUBLIC_APP_URL: wert })
      expect(u.trustedOrigins, wert).toEqual([herkunft])
      expect(u.warnungen, wert).toEqual([WARNUNG_APP_URL_FREMDER_HOST])
      expect(u.warnungen.join(' '), wert).not.toMatch(/vercel|beispiel|xn--|evil|bäckerei/)
    }
    for (const wert of ['https://farmerzone.at', 'https://www.farmerzone.at/', 'https://FarmerZone.at./start#oben']) {
      expect(bestimmeUmgebung({ ...PROD_ECHT, NEXT_PUBLIC_APP_URL: wert }).warnungen, wert).toEqual([])
    }
  })

  it('ein Port macht auch die echte Seite zum fremden Host — angenommen, aber gemeldet; ohne Port und mit Standard-Port nicht (Nr. 70)', () => {
    // Better Auth vergleicht Herkünfte genau: Der Browser auf der echten Seite
    // sendet https://farmerzone.at ohne Port, eine Herkunft mit Port träfe er nie.
    for (const [wert, herkunft] of [
      ['https://farmerzone.at:8443', 'https://farmerzone.at:8443'],
      ['https://www.farmerzone.at:8443/start', 'https://www.farmerzone.at:8443'],
    ] as const) {
      expect(produktionsAdresse(wert), wert).toEqual({ herkunft })
      const u = bestimmeUmgebung({ ...PROD_ECHT, NEXT_PUBLIC_APP_URL: wert })
      expect(u.trustedOrigins, wert).toEqual([herkunft])
      expect(u.warnungen, wert).toEqual([WARNUNG_APP_URL_FREMDER_HOST])
      expect(u.warnungen.join(' '), wert).not.toMatch(/8443/)
    }
    // Gegenprobe: Der Standard-Port fällt schon im URL-Parser weg — die Warnung kommt nur mit einem Port.
    for (const wert of ['https://farmerzone.at', 'https://farmerzone.at:443']) {
      expect(bestimmeUmgebung({ ...PROD_ECHT, NEXT_PUBLIC_APP_URL: wert }).warnungen, wert).toEqual([])
    }
  })

  it('ein IPv6-Host bleibt roh und meldet sich als ungültig', () => {
    const wert = 'https://[2001:db8::1]/'
    expect(produktionsAdresse(wert)).toEqual({ roh: wert })
    const u = bestimmeUmgebung({ ...PROD_ECHT, NEXT_PUBLIC_APP_URL: wert })
    expect(u.trustedOrigins).toEqual([wert])
    expect(u.warnungen).toEqual([WARNUNG_APP_URL_UNGUELTIG])
  })

  it('Vorschau und lokal: keine Warnung zum Host, auch nicht bei fremdem', () => {
    expect(bestimmeUmgebung({ ...PREVIEW, NEXT_PUBLIC_APP_URL: 'https://test.farmerzone.example' }).warnungen).toEqual([])
    expect(bestimmeUmgebung({ ...LOKAL, NEXT_PUBLIC_APP_URL: 'https://farmer-zone-beispiel.vercel.app' }).warnungen).toEqual([])
  })

  it('in der Produktion geht der fremde Host einmal je Instanz an Sentry, ohne den Wert', async () => {
    // Frisch geladen: Umgebung und „schon gemeldet" leben auf Modulebene (umgebung-server.ts).
    vi.resetModules()
    vi.doMock('@sentry/nextjs', () => ({ captureMessage: vi.fn() }))
    vi.doMock('@/lib/env', () => ({
      env: {
        VERCEL_ENV: 'production',
        NEXT_PUBLIC_APP_URL: 'https://farmer-zone-beispiel.vercel.app/',
        DATABASE_URL: FREMDE_DB,
        STRIPE_SECRET_KEY: 'sk_live_abc',
        STRIPE_CONNECT_WEBHOOK_SECRET: 'whsec_connect_platzhalter',
      },
    }))
    const server = await import('@/lib/umgebung-server')
    const sentry = await import('@sentry/nextjs')

    expect(server.APP_URL).toBe('https://farmer-zone-beispiel.vercel.app')
    server.meldeUmgebungsWarnungen()
    server.meldeUmgebungsWarnungen()
    expect(sentry.captureMessage).toHaveBeenCalledTimes(1)
    const [satz, stufe] = vi.mocked(sentry.captureMessage).mock.calls[0]
    expect(satz).toContain(WARNUNG_APP_URL_FREMDER_HOST)
    expect(stufe).toBe('warning')
    expect(String(satz)).not.toMatch(/vercel|beispiel/)
  })
})
