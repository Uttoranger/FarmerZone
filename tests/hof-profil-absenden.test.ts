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
async function sendeAb(felder: Record<string, unknown>): Promise<void> {
  renderToStaticMarkup(createElement(ProfileForm, { farm: HOF }))
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
    await sendeAb({ phone: '+43 660 2222222' })

    expect(speicherweg.speichereProfil).toHaveBeenCalledTimes(1)
    expect(speicherweg.speichereProfil).toHaveBeenCalledWith({ phone: '+43 660 2222222' })
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

    await sendeAb({ phone: '+43 660 2222222' })

    expect(speicherweg.speichereProfil).toHaveBeenCalledTimes(1)
    expect(navigation.push).not.toHaveBeenCalled()
  })
})
