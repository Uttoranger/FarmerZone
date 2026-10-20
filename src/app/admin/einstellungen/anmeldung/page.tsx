import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { verlangeAdminSeite } from '@/server/admin-wache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ladeAngemeldeteGeraete } from '@/server/geraete'
import { ANMELDUNG_EINSTELLUNG_TEXT } from '@/lib/admin-anmeldung'
import { anmeldeZeitpunkt } from '@/lib/geraete'
import { ADMIN_EINSTELLUNGEN_HREF, EINSTELLUNGEN_TEXT } from '@/lib/plattform-einstellung'
import { MARKE } from '@/lib/marke'
import { cn } from '@/lib/utils'
import { ADMIN_RAHMEN } from '@/components/admin/admin-teile'
import { Seitenkopf } from '@/components/admin/seitenkopf'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { AngemeldeteGeraete } from '@/components/konto/angemeldete-geraete'
import { AnmeldungVerwalten, type PasskeyZeile } from './anmeldung-verwalten'

export const metadata: Metadata = { title: `${ANMELDUNG_EINSTELLUNG_TEXT.titel} — Admin — ${MARKE}` }
// Passkeys, Ersatzcodes und Sitzungen der eigenen Sitzung — nie aus einem Cache.
export const dynamic = 'force-dynamic'

/**
 * /admin/einstellungen/anmeldung — Einstellungen › Anmeldung (Register N20;
 * Nr. 115; Mockup system-admin-anmeldung-passkey, Schritt 6): Passkeys
 * (Name, eingerichtet; „Entfernen" frisch bestätigt, der letzte nicht),
 * „Passkey hinzufügen", Ersatzcodes (n übrig, „Neue erstellen") und die
 * angemeldeten Geräte (Baustein aus Nr. 114).
 */
export default async function AdminAnmeldungPage(): Promise<React.JSX.Element> {
  const userId = await verlangeAdminSeite()

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')
  const jetzt = new Date()
  const [passkeys, uebrig, zuletzt, geraete] = await Promise.all([
    prisma.passkey.findMany({ where: { userId }, select: { id: true, name: true, createdAt: true }, orderBy: { createdAt: 'asc' } }),
    prisma.adminErsatzcode.count({ where: { userId, benutztAm: null } }),
    prisma.adminErsatzcode.findFirst({ where: { userId, benutztAm: { not: null } }, select: { benutztAm: true }, orderBy: { benutztAm: 'desc' } }),
    ladeAngemeldeteGeraete(userId, session.session.id, jetzt),
  ])
  const zeilen: PasskeyZeile[] = passkeys.map((p) => ({
    id: p.id,
    name: p.name ?? ANMELDUNG_EINSTELLUNG_TEXT.ohneName,
    eingerichtet: p.createdAt ? anmeldeZeitpunkt(p.createdAt) : '',
  }))
  const T = ANMELDUNG_EINSTELLUNG_TEXT

  return (
    <div className={cn(ADMIN_RAHMEN, 'flex max-w-[760px] flex-col gap-4 lg:gap-[18px]')}>
      <Link
        href={ADMIN_EINSTELLUNGEN_HREF}
        className={cn('inline-flex min-h-11 items-center gap-1 self-start rounded-full text-[13.5px] font-semibold text-muted-foreground hover:text-foreground', FOKUS_RAHMEN)}
      >
        <ChevronLeft className="size-4" strokeWidth={1.8} aria-hidden="true" />
        {EINSTELLUNGEN_TEXT.titel}
      </Link>
      <Seitenkopf titel={T.titel} satz={T.satz} />
      <AnmeldungVerwalten
        passkeys={zeilen}
        ersatzcodesUebrig={uebrig}
        ersatzcodeZeile={zuletzt?.benutztAm ? T.zuletztBenutzt(zuletzt.benutztAm) : T.nieBenutzt}
        jetztText={anmeldeZeitpunkt(jetzt)}
      />
      {/* Der Baustein trägt seine eigene Überschrift „Angemeldete Geräte". */}
      <AngemeldeteGeraete zeilen={geraete} />
      <p className="text-[12.5px] leading-snug text-muted-foreground">{T.regel}</p>
    </div>
  )
}
