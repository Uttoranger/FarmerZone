import { prisma } from '@/lib/prisma'

export type AdminFarmRow = {
  id: string
  name: string
  slug: string
  ownerEmail: string
  createdAt: Date
  approvedAt: Date | null
  archivedAt: Date | null
}

/** Ist der angemeldete Nutzer Plattformbetreiber? Frisch aus der DB, nie aus der Session. */
export async function isAdminUser(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true },
  })
  return user?.isAdmin === true
}

/** Alle Höfe für den Admin-Bereich — wartende zuerst, dann die jüngsten. */
export async function getAdminFarms(): Promise<AdminFarmRow[]> {
  const farms = await prisma.farm.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      approvedAt: true,
      archivedAt: true,
      owner: { select: { email: true } },
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
  }))

  // Wartende zuerst — das ist die einzige Liste, in der der Betreiber
  // tatsächlich etwas tun muss. Innerhalb der Gruppen bleibt es bei
  // „jüngste zuerst" aus der Query.
  return [...rows.filter((r) => r.approvedAt === null), ...rows.filter((r) => r.approvedAt !== null)]
}
