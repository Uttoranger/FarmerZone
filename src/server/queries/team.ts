import { prisma } from '@/lib/prisma'
import { eingestellteRechte, type EinstellbaresAdminRecht } from '@/lib/admin-rechte'
import { istAdminPasskey } from '@/lib/admin-anmeldung'
import { maskiereAdresse } from '@/lib/betrieb-mails'
import { formatTagKurz } from '@/lib/format'
import { kalendertagInWien } from '@/lib/wiener-tag'

/*
 * Was Einstellungen › Team zeigt (Register N35, Nachtlauf Nr. 190) — nur für
 * Inhaber (die Seite prüft mit verlangeAdminSeite({ recht: 'team' })). Frisch
 * aus der Datenbank, nie ein Date an den Browser; die Adresse nur gekürzt,
 * wenn kein Name da ist. Liest `adminRechte` nur über eingestellteRechte
 * (src/lib/admin-rechte.ts) — Wache tests/admin-rechte-wache.test.ts.
 */

export type TeamPerson = {
  id: string
  name: string
  du: boolean
  inhaber: boolean
  rechte: EinstellbaresAdminRecht[]
  eingeladenAm: string | null
  passkeys: number
  ersatzcodes: number
}

export type TeamDaten = { personen: TeamPerson[] }

export async function ladeTeam(ich: string): Promise<TeamDaten> {
  const konten = await prisma.user.findMany({
    where: { isAdmin: true },
    orderBy: [{ adminInhaber: 'desc' }, { adminSeit: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      email: true,
      adminInhaber: true,
      adminRechte: true,
      adminSeit: true,
      passkeys: { select: { createdAt: true } },
      _count: { select: { adminErsatzcodes: { where: { benutztAm: null } } } },
    },
  })
  const personen = konten.map((k) => ({
    id: k.id,
    name: k.name?.trim() || maskiereAdresse(k.email),
    du: k.id === ich,
    inhaber: k.adminInhaber,
    rechte: eingestellteRechte({ adminInhaber: k.adminInhaber, adminRechte: k.adminRechte }),
    eingeladenAm: k.adminSeit ? formatTagKurz(kalendertagInWien(k.adminSeit)) : null,
    passkeys: k.passkeys.filter((p) => istAdminPasskey(p.createdAt, k.adminSeit)).length,
    ersatzcodes: k._count.adminErsatzcodes,
  }))
  // Die eigene Zeile zuerst (Mockup: „Du“ oben).
  personen.sort((a, b) => Number(b.du) - Number(a.du))
  return { personen }
}
