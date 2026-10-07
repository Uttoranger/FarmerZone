import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { getAppearanceData } from '@/server/queries/appearance'
import { AppearanceClient } from './appearance-client'
import { ZurueckZuEinstellungen } from '@/components/hof-einstellungen/einstellungen-kopf'
import { UNTERSEITE_RAHMEN } from '@/components/hof-einstellungen/einstellungen-laden'

export const metadata: Metadata = { title: 'Mein Auftritt — FarmerZone' }
export const dynamic = 'force-dynamic'

/*
 * Mein Auftritt in der HofShell (Nachtlauf Nr. 22d): das bestehende Formular
 * unverändert in der Logik — Uploads über die Upload-Route mit der Sperre bis
 * zur E-Mail-Bestätigung (17b), Galerie-URLs nur aus dem eigenen Speicher
 * (19b, addFarmPhotoAction). Der Kopf mit h1 steht im Formular selbst; hier
 * nur der Rückweg. data-app-palette: Teile zeichnen noch mit --app-*.
 */
export default async function AppearancePage(): Promise<React.JSX.Element> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const data = await getAppearanceData(session.user.id)
  if (!data) redirect('/login')

  return (
    <div className={UNTERSEITE_RAHMEN}>
      <div className="mb-1">
        <ZurueckZuEinstellungen />
      </div>
      <div data-app-palette="neu">
        <AppearanceClient
          initialData={{
            farmId: data.farmId,
            tagline: data.tagline ?? '',
            foundedYear: data.foundedYear ? String(data.foundedYear) : '',
            aboutText: data.aboutText ?? '',
            logoUrl: data.logoUrl ?? null,
            bannerType: data.bannerType,
            bannerUrl: data.bannerUrl ?? null,
            bannerValue: data.bannerValue ?? 'tannengruen',
            sectionsConfig: data.sectionsConfig,
            farmValues: data.farmValues.map((v) => ({
              icon: v.icon,
              title: v.title,
              subtitle: v.subtitle ?? '',
            })),
            farmPhotos: data.farmPhotos,
            farmSlug: data.slug,
          }}
        />
      </div>
    </div>
  )
}
