/**
 * Mein Hof: jeder Abschnitt speichert nur sein Feld (Nachtlauf Nr. 50,
 * Register N4) — gegen ein ECHTES Postgres.
 *
 * Die Ausgangslage: saveAppearanceAction schreibt bei JEDEM Aufruf Leitspruch,
 * Gründungsjahr, Über uns, Abschnitte und Werte (die Werte löscht sie und
 * legt sie neu an); updateProfile schreibt das ganze Profil. Ein Abschnitt,
 * der nur sein Feld schickte, löschte den Rest — einer, der den Stand vom
 * Öffnen der Seite mitschickte, schriebe nach einem anderen Abschnitt alte
 * Werte zurück.
 *
 * Beweist (Zustand in der Datenbank danach):
 *  - Jeder Abschnitt (Leitspruch/Gründungsjahr, Über uns, Werte, Abschnitte,
 *    Name, Adresse, Kontakt) ändert nur sein Feld; alle anderen bleiben, die
 *    Werte samt Reihenfolge und Untertitel.
 *  - Zwei Abschnitte nacheinander ohne Neuladen: Der zweite schreibt den
 *    ersten nicht zurück (frischer Stand vom Server). Gegenprobe: Mit dem
 *    Stand vom Öffnen der Seite ginge der erste verloren.
 *  - Das Hof-Profil in einem älteren Tab schickt nur, was dort geändert wurde
 *    — die Adresse aber nur als Ganzes: keine Mischadresse aus zwei Tabs.
 *  - Zwei Abschnitte zugleich: Sie laufen nacheinander, keiner geht verloren.
 *  - Logo, Titelbild und ein Galeriefoto ändern nur sich selbst — und ein
 *    Abschnitt danach lässt sie stehen.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), updateTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import { headers } from 'next/headers'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { speichereAuftritt, speichereProfil } from '@/components/mein-hof/abschnitt-speichern'
import { saveAppearanceAction, updateFarmBannerAction, updateFarmLogoAction } from '@/server/actions/appearance'
import { updateProfile } from '@/server/actions/farm'
import { addFarmPhotoAction } from '@/server/actions/farm-photos'
import { getAppearanceData } from '@/server/queries/appearance'
import { getFarmSettings, getPublicFarm } from '@/server/queries/farm'
import { DEFAULT_SECTIONS } from '@/server/queries/appearance'
import { auftrittBasis, auftrittStandAus, geaendertSeitLaden, profilBasis } from '@/lib/abschnitt-stand'
import { erstelleHofMitAnmeldung, raeumeAuf } from './setup/basis'

afterEach(async () => {
  vi.unstubAllEnvs()
  await raeumeAuf()
})

const ABSCHNITTE_VORHER = [
  { key: 'products', visible: true, order: 1 },
  { key: 'gallery', visible: false, order: 2 },
  { key: 'about', visible: true, order: 3 },
  { key: 'values', visible: true, order: 4 },
  { key: 'status', visible: false, order: 5 },
]

const WERTE_VORHER = [
  { icon: 'saisonal', title: 'Saisonal', subtitle: 'Was gerade wächst', sortOrder: 0 },
  { icon: 'regional', title: 'Regional', subtitle: null, sortOrder: 1 },
  { icon: 'handarbeit', title: 'Handarbeit', subtitle: 'Alles von Hand', sortOrder: 2 },
]

/** Ein angemeldeter Hof, bei dem JEDES Feld einen eigenen, erkennbaren Wert hat (abweichend: einzelne Felder anders). */
async function angemeldeterHof(abweichend: Partial<Prisma.FarmUncheckedCreateInput> = {}) {
  const { farm, ownerId, cookie } = await erstelleHofMitAnmeldung({
    tagline: 'Frisch vom Feld',
    foundedYear: 1950,
    aboutText: 'Seit drei Generationen bauen wir Gemüse an.',
    sectionsConfig: ABSCHNITTE_VORHER as Prisma.InputJsonValue,
    // Altbestand von fremder Adresse: bleibt erlaubt, solange er unverändert ist (bild-url.ts).
    logoUrl: 'https://bilder.example/logo-alt.webp',
    bannerType: 'PHOTO',
    bannerUrl: 'https://bilder.example/titel-alt.jpg',
    bannerValue: 'erde',
    bannerFocusY: 30,
    latitude: 48.2,
    longitude: 13.4,
    country: 'AT',
    betriebsnummer: 'LFBIS 0000000',
    betriebsstatus: 'PRIMAERPRODUKTION',
    pauseMessage: 'Im Urlaub bis Montag.',
    ...abweichend,
  })
  await prisma.farmValue.createMany({ data: WERTE_VORHER.map((w, i) => ({ ...w, id: `int-wert-${farm.id}-${i}`, farmId: farm.id })) })
  await prisma.farmPhoto.create({
    data: { id: `int-foto-${farm.id}`, farmId: farm.id, url: 'https://bilder.example/foto-alt.jpg', caption: 'Der Hof im Herbst', sortOrder: 0 },
  })
  vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)
  return { farm, ownerId }
}

/** Alles, was ein Abschnitt berühren könnte — Hof, Werte (in Reihenfolge) und Fotos. */
async function stand(farmId: string) {
  const hof = await prisma.farm.findUniqueOrThrow({
    where: { id: farmId },
    select: {
      tagline: true,
      foundedYear: true,
      aboutText: true,
      sectionsConfig: true,
      logoUrl: true,
      bannerType: true,
      bannerUrl: true,
      bannerValue: true,
      bannerFocusY: true,
      name: true,
      ownerName: true,
      description: true,
      address: true,
      postalCode: true,
      city: true,
      country: true,
      phone: true,
      email: true,
      latitude: true,
      longitude: true,
      betriebsnummer: true,
      betriebsstatus: true,
      isPaused: true,
      pauseMessage: true,
    },
  })
  // Die Werte legt die Aktion bei jedem Speichern neu an — ihre Kennung zählt nicht, Inhalt und Reihenfolge schon.
  const werte = await prisma.farmValue.findMany({
    where: { farmId },
    orderBy: { sortOrder: 'asc' },
    select: { icon: true, title: true, subtitle: true, sortOrder: true },
  })
  const fotos = await prisma.farmPhoto.findMany({
    where: { farmId },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, url: true, caption: true, sortOrder: true },
  })
  return { hof, werte, fotos }
}

type Stand = Awaited<ReturnType<typeof stand>>

const NEUE_WERTE = [
  { icon: 'bio', title: 'Bio-zertifiziert', subtitle: 'Seit 2010', sortOrder: 0 },
  { icon: 'saisonal', title: 'Saisonal', subtitle: null, sortOrder: 1 },
]
const NEUE_ABSCHNITTE = [
  { key: 'products', visible: true, order: 1 },
  { key: 'gallery', visible: true, order: 2 },
  { key: 'about', visible: false, order: 3 },
  { key: 'values', visible: true, order: 4 },
  { key: 'status', visible: true, order: 5 },
]

const FAELLE: [string, () => Promise<{ error?: string }>, (vorher: Stand) => Stand][] = [
  [
    'Leitspruch und Gründungsjahr',
    () => speichereAuftritt({ tagline: 'Gemüse vom Hügel', foundedYear: 1999 }),
    (v) => ({ ...v, hof: { ...v.hof, tagline: 'Gemüse vom Hügel', foundedYear: 1999 } }),
  ],
  [
    'Leitspruch und Gründungsjahr leeren',
    () => speichereAuftritt({ tagline: null, foundedYear: null }),
    (v) => ({ ...v, hof: { ...v.hof, tagline: null, foundedYear: null } }),
  ],
  ['Über uns', () => speichereAuftritt({ aboutText: 'Neuer Text über den Hof.' }), (v) => ({ ...v, hof: { ...v.hof, aboutText: 'Neuer Text über den Hof.' } })],
  ['Werte', () => speichereAuftritt({ farmValues: NEUE_WERTE }), (v) => ({ ...v, werte: NEUE_WERTE })],
  ['Abschnitte', () => speichereAuftritt({ sectionsConfig: NEUE_ABSCHNITTE }), (v) => ({ ...v, hof: { ...v.hof, sectionsConfig: NEUE_ABSCHNITTE } })],
  [
    'Name und Kurzbeschreibung',
    () => speichereProfil({ name: 'Hof Neuname', description: 'Gemüse, Eier und Brot aus Teststadt.' }),
    (v) => ({ ...v, hof: { ...v.hof, name: 'Hof Neuname', description: 'Gemüse, Eier und Brot aus Teststadt.' } }),
  ],
  [
    'Adresse',
    () => speichereProfil({ address: 'Neue Gasse 2', postalCode: '8701', city: 'Neustadt' }),
    (v) => ({ ...v, hof: { ...v.hof, address: 'Neue Gasse 2', postalCode: '8701', city: 'Neustadt' } }),
  ],
  [
    'Kontakt',
    () => speichereProfil({ phone: '+43 660 1111111', email: 'int-kontakt-neu@example.com' }),
    (v) => ({ ...v, hof: { ...v.hof, phone: '+43 660 1111111', email: 'int-kontakt-neu@example.com' } }),
  ],
]

describe('jeder Abschnitt ändert nur sein Feld', () => {
  it.each(FAELLE)('%s: alle anderen Felder bleiben, auch die Werte samt Reihenfolge', async (_name, speichern, erwartet) => {
    const { farm } = await angemeldeterHof()
    const vorher = await stand(farm.id)

    const antwort = await speichern()

    expect(antwort.error).toBeUndefined()
    expect(await stand(farm.id)).toEqual(erwartet(vorher))
  })
})

describe('zwei Abschnitte nacheinander, ohne neu zu laden', () => {
  it('Über uns, dann Werte: der zweite schreibt den ersten nicht zurück', async () => {
    const { farm } = await angemeldeterHof()
    const vorher = await stand(farm.id)

    expect((await speichereAuftritt({ aboutText: 'Erst Über uns.' })).error).toBeUndefined()
    expect((await speichereAuftritt({ farmValues: NEUE_WERTE })).error).toBeUndefined()

    expect(await stand(farm.id)).toEqual({ ...vorher, hof: { ...vorher.hof, aboutText: 'Erst Über uns.' }, werte: NEUE_WERTE })
  })

  it('Gegenprobe: mit dem Stand vom Öffnen der Seite ginge „Über uns" verloren', async () => {
    const { farm, ownerId } = await angemeldeterHof()
    const beimOeffnen = auftrittStandAus((await getAppearanceData(ownerId))!)

    await speichereAuftritt({ aboutText: 'Erst Über uns.' })
    // So speicherte ein Abschnitt, der den Stand aus den Props der Seite mitschickt.
    await saveAppearanceAction({ ...auftrittBasis(beimOeffnen), farmValues: NEUE_WERTE })

    expect((await stand(farm.id)).hof.aboutText).toBe('Seit drei Generationen bauen wir Gemüse an.')
  })

  it('Name, dann Kontakt: der neue Name bleibt', async () => {
    const { farm } = await angemeldeterHof()

    await speichereProfil({ name: 'Hof Neuname', description: 'Gemüse, Eier und Brot aus Teststadt.' })
    await speichereProfil({ phone: '+43 660 1111111', email: 'int-kontakt-neu@example.com' })

    expect((await stand(farm.id)).hof).toMatchObject({ name: 'Hof Neuname', phone: '+43 660 1111111' })
  })

  it('Gegenprobe Profil: mit dem Stand vom Öffnen der Seite ginge der Name verloren', async () => {
    const { farm, ownerId } = await angemeldeterHof()
    const beimOeffnen = (await getFarmSettings(ownerId))!

    await speichereProfil({ name: 'Hof Neuname', description: 'Gemüse, Eier und Brot aus Teststadt.' })
    await updateProfile({ ...profilBasis(beimOeffnen), phone: '+43 660 1111111' })

    expect((await stand(farm.id)).hof.name).toBe('Hof Test')
  })

  it('Hof-Profil in einem älteren Tab: nur, was dort geändert wurde — Name und Kurzbeschreibung aus Mein Hof bleiben', async () => {
    const { farm, ownerId } = await angemeldeterHof()
    // So lädt das Hof-Profil seine Startwerte (profile-form.tsx) — dann bleibt der Tab offen.
    const beimOeffnen = profilBasis((await getFarmSettings(ownerId))!)

    await speichereProfil({ name: 'Hof Neuname', description: 'Gemüse, Eier und Brot aus Teststadt.' })
    // Im älteren Tab ändert jemand nur die Telefonnummer und speichert, wie profile-form.tsx es tut.
    const formular = { ...beimOeffnen, phone: '+43 660 2222222' }
    expect((await speichereProfil(geaendertSeitLaden(beimOeffnen, formular))).error).toBeUndefined()

    expect((await stand(farm.id)).hof).toMatchObject({
      name: 'Hof Neuname',
      description: 'Gemüse, Eier und Brot aus Teststadt.',
      phone: '+43 660 2222222',
    })
  })

  it('Hof-Profil in einem älteren Tab ändert nur den Ort: keine Mischadresse mit der Adresse aus Mein Hof', async () => {
    const { farm, ownerId } = await angemeldeterHof()
    const beimOeffnen = profilBasis((await getFarmSettings(ownerId))!)

    // Inzwischen speichert das Adress-Blatt in Mein Hof eine ganz neue Adresse.
    expect((await speichereProfil({ address: 'Neue Gasse 2', postalCode: '8701', city: 'Neustadt' })).error).toBeUndefined()
    // Im älteren Tab ändert jemand nur den Ort und speichert, wie profile-form.tsx es tut.
    const formular = { ...beimOeffnen, city: 'Testau' }
    expect((await speichereProfil(geaendertSeitLaden(beimOeffnen, formular))).error).toBeUndefined()

    // Die Adresse dieses Tabs als Ganzes — nicht „Neue Gasse 2, 8701 Testau".
    expect((await stand(farm.id)).hof).toMatchObject({
      address: 'Teststraße 1',
      postalCode: '8700',
      city: 'Testau',
      country: 'AT',
      latitude: 48.2,
      longitude: 13.4,
    })
  })

  it('Gegenprobe: Feld für Feld gemischt ergäbe die Mischadresse', async () => {
    const { farm } = await angemeldeterHof()

    await speichereProfil({ address: 'Neue Gasse 2', postalCode: '8701', city: 'Neustadt' })
    // So speicherte der ältere Tab, wenn nur der Ort als geändert mitginge.
    await speichereProfil({ city: 'Testau' })

    expect((await stand(farm.id)).hof).toMatchObject({ address: 'Neue Gasse 2', postalCode: '8701', city: 'Testau' })
  })

  it('zwei Abschnitte zugleich: sie laufen nacheinander, keiner geht verloren', async () => {
    const { farm } = await angemeldeterHof()
    const vorher = await stand(farm.id)

    const antworten = await Promise.all([
      speichereAuftritt({ aboutText: 'Zugleich A.' }),
      speichereAuftritt({ tagline: 'Zugleich B' }),
      speichereAuftritt({ farmValues: NEUE_WERTE }),
    ])

    expect(antworten.map((a) => a.error)).toEqual([undefined, undefined, undefined])
    expect(await stand(farm.id)).toEqual({
      ...vorher,
      hof: { ...vorher.hof, aboutText: 'Zugleich A.', tagline: 'Zugleich B' },
      werte: NEUE_WERTE,
    })
  })
})

describe('Logo, Titelbild und Galeriefoto (Abnahme Nr. 50: kein anderes Feld ändert sich)', () => {
  const SPEICHER = 'int50speicher'
  const bild = (farmId: string, zweck: string) => `https://${SPEICHER}.public.blob.vercel-storage.com/farms/${farmId}/${zweck}/1.webp`

  it('jedes Bild ändert nur sich selbst; ein Abschnitt danach lässt die Bilder stehen', async () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', `vercel_blob_rw_${SPEICHER}_nurFuerTests`)
    const { farm } = await angemeldeterHof()
    const vorher = await stand(farm.id)

    expect((await updateFarmLogoAction(bild(farm.id, 'logo'))).error).toBeUndefined()
    expect((await updateFarmBannerAction('PHOTO', bild(farm.id, 'banner'))).error).toBeUndefined()
    const foto = await addFarmPhotoAction({ url: bild(farm.id, 'gallery') })
    expect(foto.error).toBeUndefined()

    const nachBildern = await stand(farm.id)
    expect(nachBildern).toEqual({
      ...vorher,
      hof: { ...vorher.hof, logoUrl: bild(farm.id, 'logo'), bannerType: 'PHOTO', bannerUrl: bild(farm.id, 'banner') },
      fotos: [...vorher.fotos, { id: foto.photo?.id, url: bild(farm.id, 'gallery'), caption: null, sortOrder: 1 }],
    })

    // Danach ein Abschnitt: Logo und Titelbild schickt er nie mit, sie bleiben.
    await speichereAuftritt({ aboutText: 'Nach den Bildern.' })
    expect(await stand(farm.id)).toEqual({ ...nachBildern, hof: { ...nachBildern.hof, aboutText: 'Nach den Bildern.' } })
  })

  it('„Titelbild entfernen": zurück auf den Verlauf des Hofs — sonst ändert sich nichts', async () => {
    const { farm } = await angemeldeterHof()
    const vorher = await stand(farm.id)

    // Derselbe Aufruf wie im Baustein (bild-bausteine.tsx).
    expect((await updateFarmBannerAction('GRADIENT', null)).error).toBeUndefined()

    // Der Verlauf (bannerValue) bleibt, wie er war — die Hofseite zeigt ihn wieder.
    expect(await stand(farm.id)).toEqual({ ...vorher, hof: { ...vorher.hof, bannerType: 'GRADIENT', bannerUrl: null } })
  })
})

describe('Abschnitte NULL — wie bei jedem Seed-Hof und jedem neuen Hof', () => {
  it('das erste Speichern schreibt die Standard-Abschnitte; die Hofseite zeigt vorher und nachher dieselben', async () => {
    // Ohne sectionsConfig angelegt: die Spalte ist NULL.
    const { farm } = await angemeldeterHof({ sectionsConfig: undefined })
    const spalte = async () => (await prisma.farm.findUniqueOrThrow({ where: { id: farm.id }, select: { sectionsConfig: true } })).sectionsConfig
    expect(await spalte()).toBeNull()
    const vorher = (await getPublicFarm(farm.slug))?.sectionsConfig

    expect((await speichereAuftritt({ tagline: 'Gemüse vom Hügel' })).error).toBeUndefined()

    // Gespeichert stehen jetzt die Standard-Abschnitte (getAppearanceData liest NULL als Standard) ...
    expect(await spalte()).toEqual(DEFAULT_SECTIONS)
    // ... und für Kundinnen ändert sich nichts: dieselben wirksamen Abschnitte wie vorher.
    expect(vorher).toEqual(DEFAULT_SECTIONS)
    expect((await getPublicFarm(farm.slug))?.sectionsConfig).toEqual(vorher)
  })
})

describe('ein zu langer Altwert sperrt — die Meldung nennt den Abschnitt', () => {
  it('„Über uns" mit 1001 Zeichen: Der Leitspruch wird nicht gespeichert, die Meldung nennt „Über uns", nichts ändert sich', async () => {
    // Ein Altwert über der Grenze, wie er nur aus der Zeit vor dem Schema stammen kann.
    const { farm } = await angemeldeterHof({ aboutText: 'x'.repeat(1001) })
    const vorher = await stand(farm.id)

    const antwort = await speichereAuftritt({ tagline: 'Gemüse vom Hügel' })

    expect(antwort.error).toBe('„Über uns“: Der Text darf höchstens 1000 Zeichen haben — bitte kürzen. Erst danach lässt sich speichern.')
    expect(await stand(farm.id)).toEqual(vorher)
  })
})
