import { prisma } from '@/lib/prisma'
import type { FarmAktivitaet } from '@/lib/farm-aktivitaet'
import { alsLand, type Land } from '@/lib/laender'

export type AdminFarmRow = {
  id: string
  name: string
  slug: string
  ownerEmail: string
  createdAt: Date
  approvedAt: Date | null
  archivedAt: Date | null
  /** Das Land des Hofes — deutsche Höfe tragen in der Liste eine Marke und
   *  vor der Freischaltung eine Klär-Erinnerung (src/lib/laender.ts). */
  land: Land
  /** Lebenszeichen: was der Bauer seit der Anmeldung angelegt hat. */
  aktivitaet: FarmAktivitaet
}

/** Ist der angemeldete Nutzer Plattformbetreiber? Frisch aus der DB, nie aus der Session. */
export async function isAdminUser(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true },
  })
  return user?.isAdmin === true
}

/**
 * Alle Höfe für den Admin-Bereich — wartende zuerst, dann die jüngsten.
 *
 * Die Zählwerte kommen per `_count` aus DERSELBEN Abfrage. Ein `findMany` je
 * Hof wäre bequemer zu schreiben und bei zwölf Höfen auch nicht spürbar, würde
 * aber mit jeder Bot-Anmeldung teurer — und genau die sollen hier ja auffallen.
 *
 * Gezählt wird alles Angelegte, auch Unveröffentlichtes: ein deaktiviertes
 * Produkt und eine abgeschaltete Abholzeit sind trotzdem Lebenszeichen. Die
 * Frage lautet „hat hier jemand gearbeitet?", nicht „ist der Hof verkaufsfertig?".
 */
export async function getAdminFarms(): Promise<AdminFarmRow[]> {
  const farms = await prisma.farm.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      approvedAt: true,
      archivedAt: true,
      // Deutsche Höfe müssen in der Liste erkennbar sein — sie dürfen nicht
      // beiläufig freigeschaltet werden (Stripe DE, Steuer, Kennzeichnung).
      country: true,
      // Beide nur, um daraus ein Ja/Nein zu machen — der Rohtext und die
      // Bild-URL verlassen diese Funktion nicht.
      description: true,
      logoUrl: true,
      owner: { select: { email: true } },
      _count: { select: { products: true, farmPhotos: true, pickupSlots: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const rows = farms.map((f) => ({
    id: f.id,
    name: f.name,
    slug: f.slug,
    ownerEmail: f.owner.email,
    createdAt: f.createdAt,
    approvedAt: f.approvedAt,
    archivedAt: f.archivedAt,
    land: alsLand(f.country),
    aktivitaet: {
      produkte: f._count.products,
      fotos: f._count.farmPhotos,
      abholzeiten: f._count.pickupSlots,
      // `description` ist eine PFLICHTSPALTE (prisma/schema.prisma:165), im
      // Onboarding aber ein optionales Feld. Ein Hof ohne Beschreibung trägt
      // deshalb einen leeren String, kein null — ein `!== null` ginge hier
      // immer als „vorhanden" durch. Getrimmt, damit ein versehentliches
      // Leerzeichen nicht als Inhalt zählt.
      hatBeschreibung: f.description.trim().length > 0,
      hatLogo: (f.logoUrl ?? '').trim().length > 0,
    },
  }))

  // Wartende zuerst — das ist die einzige Liste, in der der Betreiber
  // tatsächlich etwas tun muss. Innerhalb der Gruppen bleibt es bei
  // „jüngste zuerst" aus der Query.
  return [...rows.filter((r) => r.approvedAt === null), ...rows.filter((r) => r.approvedAt !== null)]
}
