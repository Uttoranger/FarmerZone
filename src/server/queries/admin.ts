import { prisma } from '@/lib/prisma'
import {
  gruendungsplaetze,
  vergebeneGruendungsplaetze,
  MAX_GRUENDUNGSHOEFE,
  type HofFuerPlatz,
} from '@/lib/gruendungshof'

/** Prüft das Betreiber-Recht. Einzige Stelle, an der isAdmin gelesen wird. */
export async function istAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true },
  })
  return user?.isAdmin === true
}

export type AdminHofZeile = {
  id: string
  name: string
  slug: string
  ownerEmail: string
  createdAt: Date
  approvedAt: Date | null
  archivedAt: Date | null
  /** Belegter Gründungsplatz (1-basiert) oder null. */
  gruendungsplatz: number | null
}

export type AdminUebersicht = {
  hoefe: AdminHofZeile[]
  vergebenePlaetze: number
  maxPlaetze: number
}

/**
 * Alle Höfe für den Admin-Bereich. Wartende zuerst, danach die freigeschalteten
 * in der Reihenfolge ihrer Freigabe — das ist zugleich die Reihenfolge der
 * Gründungsplätze, sodass die Liste sich selbst erklärt.
 */
export async function getAdminUebersicht(): Promise<AdminUebersicht> {
  const rows = await prisma.farm.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      approvedAt: true,
      archivedAt: true,
      owner: { select: { email: true } },
    },
  })

  const fuerPlatz: HofFuerPlatz[] = rows.map((r) => ({
    id: r.id,
    approvedAt: r.approvedAt,
    createdAt: r.createdAt,
    archivedAt: r.archivedAt,
  }))
  const plaetze = gruendungsplaetze(fuerPlatz)

  const hoefe: AdminHofZeile[] = rows
    .map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      ownerEmail: r.owner.email,
      createdAt: r.createdAt,
      approvedAt: r.approvedAt,
      archivedAt: r.archivedAt,
      gruendungsplatz: plaetze.get(r.id) ?? null,
    }))
    .sort((a, b) => {
      // Wartende Höfe nach oben — das ist die Arbeitsliste des Betreibers.
      const aWartet = a.approvedAt === null ? 0 : 1
      const bWartet = b.approvedAt === null ? 0 : 1
      if (aWartet !== bWartet) return aWartet - bWartet
      if (aWartet === 0) return a.createdAt.getTime() - b.createdAt.getTime()
      return (a.gruendungsplatz ?? Number.MAX_SAFE_INTEGER) - (b.gruendungsplatz ?? Number.MAX_SAFE_INTEGER)
    })

  return {
    hoefe,
    vergebenePlaetze: vergebeneGruendungsplaetze(fuerPlatz),
    maxPlaetze: MAX_GRUENDUNGSHOEFE,
  }
}
