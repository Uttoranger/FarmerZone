import type { Metadata } from 'next'
import { MARKE } from '@/lib/marke'
import { einmalTokenSchema } from '@/lib/geraete'
import { EMAIL_AENDERN_ART, EMAIL_BESTAETIGEN_TEXT } from '@/lib/konto-anfragen'
import { leseEinmalLink } from '@/server/geraete'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import { EmailBestaetigenKarte } from './email-bestaetigen-karte'

export const metadata: Metadata = {
  title: `${EMAIL_BESTAETIGEN_TEXT.seitentitel} — ${MARKE}`,
  // Der Link trägt einen Einmal-Token (next.config.ts setzt dazu no-referrer).
  robots: { index: false, follow: false },
}

// Liest den Link bei jedem Aufruf — nie zwischenspeichern.
export const dynamic = 'force-dynamic'

/**
 * „Neue Anmelde-Adresse bestätigen“ (Register N36, Nr. 190): Der Link aus der
 * Mail an die neue Adresse öffnet NUR diese Seite. Beim Öffnen (GET) wird
 * nichts geändert, nicht einmal der Link verbraucht — Programme, die Links in
 * Mails vorab öffnen, lösen nichts aus. Erst der Knopf (Server-Action)
 * ändert die Adresse; dafür tippt die Person die neue Adresse noch einmal.
 * Ungültig, benutzt oder abgelaufen: derselbe neutrale Satz.
 */
export default async function EmailBestaetigenSeite({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<React.JSX.Element> {
  const { t } = await searchParams
  const token = einmalTokenSchema.safeParse(t)
  const gueltig = token.success ? (await leseEinmalLink(token.data, EMAIL_AENDERN_ART, new Date())) !== null : false

  return (
    <KundeShellMitSitzung unterleiste={false}>
      <div className="mx-auto w-full max-w-[480px] px-4 pt-6 pb-12 md:pt-12">
        <EmailBestaetigenKarte token={token.success && gueltig ? token.data : null} />
      </div>
    </KundeShellMitSitzung>
  )
}
