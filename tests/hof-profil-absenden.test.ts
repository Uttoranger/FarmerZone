/**
 * Das Hof-Profil mit echtem Absenden (Nachtlauf Nr. 65): das echte Formular
 * (src/components/settings/profile-form.tsx) einmal auf dem Server gerendert
 * und dann abgeschickt wie mit „Profil speichern" — react-hook-form mit dem
 * echten Schema (zodResolver), der echte onSubmit, der echte Maßstab
 * (profilWieImSchema, geaendertSeitLaden). Ersetzt die Textvergleiche, die
 * bis dahin in tests/unterseiten-kopf.test.ts standen.
 *
 * Ohne DOM (TESTING_GUIDELINES §1) geht das so: useForm ist nur umhüllt, um
 * an das Formular und an den Absende-Griff zu kommen, den die Komponente
 * selbst baut (`handleSubmit(onSubmit)`); useTransition führt den Rückruf
 * aus, statt beim Rendern auf dem Server zu werfen. Nachgebildet ist nur die
 * Grenze zur Aktion (speichereProfil) — speichernOhneWurf und alles im
 * Formular bleiben echt.
 *
 * Beweist:
 *  - Nur das Telefon geändert: speichereProfil bekommt genau `{ phone }` —
 *    auch mit Altwerten beim Laden, die das Schema anders ausgibt (E-Mail mit
 *    Großbuchstaben, leere Betriebsnummer). Danach geht es zur Übersicht.
 *  - Ein ungültiges Feld: nichts wird gespeichert.
 *  - Eine gescheiterte Anfrage: kein Sprung zur Übersicht.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { FieldValues, UseFormReturn } from 'react-hook-form'

const navigation = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({
  usePathname: () => '/settings/profile',
  useRouter: () => ({ push: navigation.push, refresh: vi.fn(), replace: vi.fn() }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children?: ReactNode }) => createElement('a', { href }, children),
}))
// Die Karte lädt Leaflet nur im Browser (ssr: false) — hier steht sie leer.
vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), addBreadcrumb: vi.fn() }))
vi.mock('@/server/actions/farm', () => ({
  updateProfile: vi.fn(),
  ladeProfilStand: vi.fn(),
  sucheHofStandort: vi.fn(),
  holeAdresseZumPunkt: vi.fn(),
}))
vi.mock('@/server/actions/appearance', () => ({ saveAppearanceAction: vi.fn() }))

// Die Grenze zur Aktion: Was hier ankommt, ist die Aussage des Tests.
const speicherweg = vi.hoisted(() => ({ speichereProfil: vi.fn() }))
vi.mock('@/components/mein-hof/abschnitt-speichern', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/mein-hof/abschnitt-speichern')>()),
  speichereProfil: speicherweg.speichereProfil,
}))

// Beim Rendern auf dem Server wirft startTransition — hier läuft der Rückruf, und der Test wartet auf ihn.
const uebergang = vi.hoisted(() => ({ laeufe: [] as Promise<unknown>[] }))
vi.mock('react', async (importOriginal) => {
  const echt = await importOriginal<typeof import('react')>()
  const useTransition = (): [boolean, (rueckruf: () => unknown) => void] => [
    false,
    (rueckruf) => {
      uebergang.laeufe.push(Promise.resolve().then(rueckruf))
    },
  ]
  return { ...echt, useTransition }
})

// Das echte useForm, nur umhüllt: Formular und Absende-Griff der Komponente festhalten.
const formular = vi.hoisted(() => ({
  form: null as UseFormReturn<FieldValues, unknown, unknown> | null,
  absenden: null as (() => Promise<void>) | null,
}))
vi.mock('react-hook-form', async (importOriginal) => {
  const echt = await importOriginal<typeof import('react-hook-form')>()
  function useForm(...args: Parameters<typeof echt.useForm>): ReturnType<typeof echt.useForm> {
    const form = echt.useForm(...args)
    const handleSubmit: typeof form.handleSubmit = (gueltig, ungueltig) => {
      const absenden = form.handleSubmit(gueltig, ungueltig)
      formular.form = form
      formular.absenden = () => absenden()
      return absenden
    }
    return { ...form, handleSubmit }
  }
  return { ...echt, useForm }
})

import { ProfileForm } from '@/components/settings/profile-form'
import { HOF_EMAIL_ANKER, HOF_EMAIL_TEXT } from '@/lib/hof-kontakt'
import type { FarmSettings } from '@/server/queries/farm'

/** So steht der Hof in der Datenbank — mit Altwerten aus der Zeit vor dem Schema. */
const HOF: FarmSettings = {
  id: 'hof-1',
  name: 'Hof Beispiel',
  ownerName: 'Max Mustermann',
  description: 'Gemüse und Eier aus Teststadt',
  address: 'Dorfstraße 1',
  postalCode: '8700',
  city: 'Teststadt',
  country: 'AT',
  latitude: 48.2,
  longitude: 13.4,
  phone: '+43 660 0000000',
  // Altwerte: Das Schema gibt die E-Mail klein und die leere Betriebsnummer als null aus.
  email: 'Hof@Example.com',
  betriebsnummer: '',
  betriebsstatus: null,
  logoUrl: null,
  bannerUrl: null,
  isPaused: false,
  pauseMessage: null,
  slug: 'hof-beispiel',
  pickupSlots: [],
}

/** Rendert das echte Formular, ändert Felder wie beim Tippen und schickt es ab. */
async function sendeAb(felder: Record<string, unknown>, farm: FarmSettings = HOF): Promise<void> {
  renderToStaticMarkup(createElement(ProfileForm, { farm }))
  const { form, absenden } = formular
  if (!form || !absenden) throw new Error('Das Formular hat keinen Absende-Griff gebaut')
  for (const [name, wert] of Object.entries(felder)) form.setValue(name, wert, { shouldDirty: true })
  await absenden()
  await Promise.all(uebergang.laeufe)
}

beforeEach(() => {
  vi.clearAllMocks()
  formular.form = null
  formular.absenden = null
  uebergang.laeufe = []
  speicherweg.speichereProfil.mockResolvedValue({})
})

describe('Hof-Profil absenden', () => {
  it('nur das Telefon geändert: speichereProfil bekommt genau { phone } — Altwerte beim Laden zählen nicht als geändert', async () => {
    await sendeAb({ phone: '+43 676 0000000' })

    expect(speicherweg.speichereProfil).toHaveBeenCalledTimes(1)
    expect(speicherweg.speichereProfil).toHaveBeenCalledWith({ phone: '+43 676 0000000' })
    // Nach dem Erfolg zurück zur Übersicht (Register N1).
    expect(navigation.push).toHaveBeenCalledWith('/settings')
  })

  it('ein ungültiges Telefon: nichts wird gespeichert, kein Sprung', async () => {
    await sendeAb({ phone: '12' })

    expect(speicherweg.speichereProfil).not.toHaveBeenCalled()
    expect(navigation.push).not.toHaveBeenCalled()
  })

  it('eine gescheiterte Anfrage: kein Sprung zur Übersicht', async () => {
    speicherweg.speichereProfil.mockRejectedValue(new TypeError('Failed to fetch'))

    await sendeAb({ phone: '+43 676 0000000' })

    expect(speicherweg.speichereProfil).toHaveBeenCalledTimes(1)
    expect(navigation.push).not.toHaveBeenCalled()
  })
})

describe('Hof-Profil: Bestand ohne Beschreibung und ohne Hof-E-Mail (Nr. 174)', () => {
  /** Ein Hof, der beim Anlegen beides leer gelassen hat – das Anlegen erlaubt es. */
  const OHNE: FarmSettings = { ...HOF, description: '', email: '' }

  it('ist speicherbar: nur das Telefon geändert → speichereProfil bekommt { phone }', async () => {
    await sendeAb({ phone: '+43 676 0000000' }, OHNE)

    expect(speicherweg.speichereProfil).toHaveBeenCalledWith({ phone: '+43 676 0000000' })
    expect(navigation.push).toHaveBeenCalledWith('/settings')
  })

  it('die Beschreibung leeren geht (freiwillig)', async () => {
    await sendeAb({ description: '' })

    expect(speicherweg.speichereProfil).toHaveBeenCalledWith({ description: '' })
  })

  it('ein Hof mit gespeicherter Hof-E-Mail kann sie leeren – dann gilt die Anmelde-Adresse (Nr. 194)', async () => {
    await sendeAb({ email: '' })

    expect(speicherweg.speichereProfil).toHaveBeenCalledWith({ email: '' })
  })

  it('Gegenprobe: eine kaputte Hof-E-Mail wird nicht gespeichert', async () => {
    await sendeAb({ email: 'kein-at-zeichen' }, OHNE)

    expect(speicherweg.speichereProfil).not.toHaveBeenCalled()
  })
})

describe('Hof-Profil: Felder (Nr. 174)', () => {
  const html = () => renderToStaticMarkup(createElement(ProfileForm, { farm: HOF }))
  const feld = (id: string): string => html().match(new RegExp(`<(?:input|textarea|select)[^>]*id="${id}"[^>]*>`))?.[0] ?? ''

  it('Telefon, E-Mail und PLZ wählen die passende Tastatur und das Autofill', () => {
    expect(feld('phone')).toMatch(/type="tel"/)
    expect(feld('phone')).toMatch(/autoComplete="tel"/)
    expect(feld('email')).toMatch(/type="email"/)
    expect(feld('email')).toMatch(/autoComplete="email"/)
    expect(feld('postalCode')).toMatch(/inputMode="numeric"/)
    expect(feld('postalCode')).toMatch(/autoComplete="postal-code"/)
  })

  it('„Weiter" in den Feldern, „Fertig" am letzten (Betriebsnummer)', () => {
    for (const id of ['name', 'ownerName', 'address', 'postalCode', 'city', 'phone', 'email']) expect(feld(id), id).toMatch(/enterKeyHint="next"/)
    expect(feld('betriebsnummer')).toMatch(/enterKeyHint="done"/)
  })

  it('freiwillig steht am Feld, kein „*" an Pflichtfeldern; die Hof-E-Mail erklärt sich', () => {
    const markup = html()
    expect(markup).toContain('Beschreibung (freiwillig)')
    expect(markup).not.toMatch(/ \*<\/label>/)
    expect(markup).toMatch(/aria-describedby="email-hilfe"/)
  })

  it('Nr. 212: die Hof-E-Mail heißt nicht mehr „freiwillig“; die Hilfe ist der Erklärsatz, nicht „leer → Anmelde-Adresse“ (mit und ohne gespeicherte Adresse)', () => {
    for (const email of [HOF.email, '']) {
      const markup = renderToStaticMarkup(createElement(ProfileForm, { farm: { ...HOF, email } }))
      expect(markup).toContain(`>${HOF_EMAIL_TEXT.profilLabel}</label>`)
      expect(markup).not.toContain('Hof-E-Mail (freiwillig)')
      expect(markup).toMatch(/id="email-hilfe"[^>]*>Diese Adresse sehen deine Kundinnen und Kunden in der Bestellung und in der Rücktrittsbelehrung\.</)
      expect(markup).not.toMatch(/id="email-hilfe"[^>]*>[^<]*Anmelde-Adresse/)
    }
    // Gegenprobe: Die Beschreibung bleibt freiwillig.
    expect(html()).toContain('Beschreibung (freiwillig)')
  })

  it('Nr. 212: das Feld trägt die id des Ankers, auf den die Karte in Heute zeigt', () => {
    expect(HOF_EMAIL_TEXT.einstellungenPfad).toBe(`/settings/profile#${HOF_EMAIL_ANKER}`)
    expect(feld(HOF_EMAIL_ANKER)).toMatch(/type="email"/)
  })

  it('das Formular ist noValidate: Die Sätze am Feld gelten, nicht die Blase des Browsers (type="email")', () => {
    expect(html().match(/<form[^>]*>/)?.[0]).toContain('noValidate')
  })

  it('die Auswahlfelder haben 16 px (text-base), kein text-sm', () => {
    const select = html().match(/<select[^>]*>/g) ?? []
    expect(select.length).toBeGreaterThanOrEqual(2)
    for (const s of select) {
      expect(s).toContain('text-base')
      expect(s).not.toMatch(/(^|\s)text-sm/)
    }
  })
})
