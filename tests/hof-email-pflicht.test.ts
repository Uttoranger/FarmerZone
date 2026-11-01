/**
 * Hof-E-Mail Pflicht für aktive Höfe (Nr. 212, § 4 Abs. 1 Z 3 FAGG).
 *
 * Beweist mit erfundenen Daten, ohne Datenbank und Netz:
 *  - hofEmailFehlt: leer und nur Leerzeichen → fehlt; gesetzt → nicht;
 *  - hofKontaktEmail bleibt unverändert (Rückfall auf die Anmelde-Adresse für Bestandshöfe);
 *  - die Karte in Heute: Titel, Satz, Link zu den Einstellungen; die Seite zeigt sie nur bei leerem Feld
 *    (Regel hofEmailFehlt, Verdrahtung am Quelltext der Seite);
 *  - Admin-Hof-Akte: „Hof-E-Mail fehlt“ bei leerem Feld, sonst „wie Anmeldung“ / „eigene Adresse“ — nie die Adresse;
 *  - Hof einrichten: das Feld trägt den Erklärsatz, ist nicht „freiwillig“, ist LEER vorgegeben (nicht mit der
 *    Anmelde-Adresse) und lässt sich leer nicht absenden; dieselbe Adresse wie die Anmeldung darf die Inhaberin eintippen.
 */
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/server/actions/onboarding', () => ({ createFarm: vi.fn() }))

import { HOF_EMAIL_TEXT, hofEmailFehlt, hofKontaktEmail } from '@/lib/hof-kontakt'
import { hofEmailText } from '@/lib/admin-hof-akte'
import { HofEmailKarte } from '@/components/heute/hof-email-karte'
import { HofAnlegenFormular } from '@/components/einrichten/hof-anlegen-formular'
import { hofAnlegenFormularSchema } from '@/schemas/hofprofil'

describe('hofEmailFehlt und hofKontaktEmail', () => {
  it('leer und nur Leerzeichen fehlen; eine Adresse fehlt nicht', () => {
    expect(hofEmailFehlt({ email: '' })).toBe(true)
    expect(hofEmailFehlt({ email: '   ' })).toBe(true)
    expect(hofEmailFehlt({ email: 'kontakt@testhof.example' })).toBe(false)
  })

  it('hofKontaktEmail unverändert: leer → Anmelde-Adresse, gesetzt → Hof-E-Mail', () => {
    expect(hofKontaktEmail({ email: '  ', owner: { email: 'login@example.com' } })).toBe('login@example.com')
    expect(hofKontaktEmail({ email: 'kontakt@testhof.example', owner: { email: 'login@example.com' } })).toBe('kontakt@testhof.example')
  })
})

describe('Karte „E-Mail-Adresse für Kundschaft eintragen“', () => {
  const html = renderToStaticMarkup(createElement(HofEmailKarte))

  it('Titel, Satz und Link zu den Einstellungen', () => {
    expect(html).toContain(HOF_EMAIL_TEXT.karteTitel)
    expect(html).toContain('Rücktrittsbelehrung')
    expect(html).toContain(`href="${HOF_EMAIL_TEXT.einstellungenPfad}"`)
    expect(html).toContain(HOF_EMAIL_TEXT.karteLink)
  })

  it('Heute zeigt sie nur bei leerem Feld — über hofEmailFehlt, nie über eine eigene Prüfung', () => {
    const seite = readFileSync('src/app/(hof)/dashboard/page.tsx', 'utf8')
    expect(seite).toContain('{hofEmailFehlt(farm) && <HofEmailKarte />}')
  })
})

describe('Admin-Hof-Akte: hofEmailText', () => {
  it('leer → „Hof-E-Mail fehlt“; gleich der Anmeldung → „wie Anmeldung“; sonst „eigene Adresse“', () => {
    expect(hofEmailText('', 'login@example.com')).toBe('Hof-E-Mail fehlt')
    expect(hofEmailText('  ', 'login@example.com')).toBe('Hof-E-Mail fehlt')
    expect(hofEmailText('LOGIN@example.com', 'login@example.com')).toBe('wie Anmeldung')
    expect(hofEmailText('kontakt@testhof.example', 'login@example.com')).toBe('eigene Adresse')
  })
})

describe('Hof einrichten: Schritt Kontakt', () => {
  const html = renderToStaticMarkup(createElement(HofAnlegenFormular, { personName: 'Max Mustermann' }))
  const quelle = readFileSync('src/components/einrichten/hof-anlegen-formular.tsx', 'utf8')
  const gueltig = {
    name: 'Hof Test',
    ownerName: 'Max Mustermann',
    description: '',
    address: 'Teststraße 1',
    postalCode: '1010',
    city: 'Wien',
    phone: '+43 660 0000000',
  }

  it('Erklärsatz aus einer Quelle, Label ohne „freiwillig“', () => {
    expect(html).toContain(HOF_EMAIL_TEXT.erklaerung)
    expect(html).toContain(HOF_EMAIL_TEXT.label)
    expect(html).not.toContain('E-Mail des Hofs (freiwillig)')
  })

  it('das Feld ist leer vorgegeben — keine Anmelde-Adresse, kein Wert im Markup, keine Eigenschaft dafür', () => {
    expect(quelle).toMatch(/phone: '', email: '' \}/)
    expect(quelle).not.toMatch(/\{ personName, email \}/)
    expect(html.match(/<input[^>]*type="email"[^>]*>/)?.[0]).not.toMatch(/value=/)
    // Gegenprobe: Der Inhabername bleibt vorbelegt (er steht im Konto, nicht in Belehrung und Bestellung).
    expect(quelle).toMatch(/ownerName: personName/)
  })

  it('leer lässt sich nicht absenden: der Resolver (hofAnlegenFormularSchema) meldet den Satz am Feld', () => {
    for (const email of ['', '   ']) {
      const r = hofAnlegenFormularSchema.safeParse({ ...gueltig, email })
      expect(r.success ? [] : r.error.issues.map((i) => [i.path[0], i.message])).toEqual([['email', HOF_EMAIL_TEXT.pflicht]])
    }
  })

  it('Gegenprobe: dieselbe Adresse wie die Anmeldung darf die Inhaberin bewusst eintippen', () => {
    expect(hofAnlegenFormularSchema.safeParse({ ...gueltig, email: 'login@example.com' }).success).toBe(true)
  })
})
