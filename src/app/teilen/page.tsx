import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TeilenClient } from './teilen-client'

/**
 * /teilen — das Ziel des Web Share Target (app/manifest.ts).
 *
 * Der Weg hierher: Der Bauer teilt ein Foto aus der Galerie an die
 * installierte App, der Service Worker (public/sw.js) fängt den POST ab,
 * legt die Dateien in der Cache-Ablage ab und leitet per 303 auf diese
 * Seite. Sie liest die Ablage, lässt das Ziel wählen (Titelbild oder
 * Hofgalerie) und lädt über den BESTEHENDEN Upload-Weg hoch.
 *
 * Bewusst AUSSERHALB der (farmer)-Gruppe: Deren Layout leitet nackt auf
 * /login — hier braucht der Login-Umweg aber ein Rückkehr-Ziel, sonst
 * stranden die geteilten Fotos in der Ablage, während der Bauer auf der
 * Übersicht landet. Die Prüfung selbst ist dieselbe wie im Farmer-Layout.
 */
export default async function TeilenSeite() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login?von=/teilen')

  const role = (session.user as typeof session.user & { role: string }).role
  if (role !== 'FARMER') redirect('/login?von=/teilen')

  const farm = await prisma.farm.findUnique({
    where: { ownerId: session.user.id },
    select: { slug: true, bannerUrl: true },
  })
  if (!farm) redirect('/onboarding')

  return <TeilenClient hofSlug={farm.slug} bisherigesTitelbild={farm.bannerUrl} />
}
