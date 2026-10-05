import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { verlangeAdminSeite } from '@/server/admin-wache'
import { ShellVorschau } from './shell-vorschau'
import { SHELL_VARIANTEN } from './varianten'

export const metadata: Metadata = {
  title: 'Shell-Vorschau',
  robots: { index: false, follow: false },
}

/**
 * Eine Shell aus Gate 2 in voller Größe, mit erfundenem Inhalt — damit
 * Seitenleiste, Kopfzeile und Unterleiste so erscheinen, wie eine Route sie
 * später zeigt (feste Leisten brauchen das ganze Fenster). Nur für den
 * Betreiber, nie indexiert.
 */
export default async function ShellVorschauPage({
  params,
}: {
  params: Promise<{ variante: string }>
}): Promise<React.JSX.Element> {
  await verlangeAdminSeite()
  const { variante } = await params
  const bekannt = SHELL_VARIANTEN.find((v) => v.id === variante)
  if (!bekannt) notFound()
  return <ShellVorschau variante={bekannt.id} />
}
