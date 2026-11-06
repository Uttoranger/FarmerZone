import Link from 'next/link'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import { AbmeldenKarte, KARTEN_TEXT } from './abmelden-karte'
import { UnsubscribeClient } from './unsubscribe-client'
import { TEXTLINK } from '@/components/anmelden/stil'

interface Props {
  searchParams: Promise<{ token?: string }>
}

// Seit Nr. 14 im neuen Design (KundeShell); Ablauf und Texte unverändert (E8).
export default async function UnsubscribePage({ searchParams }: Props): Promise<React.JSX.Element> {
  const { token } = await searchParams

  return (
    <KundeShellMitSitzung>
      {token ? (
        <UnsubscribeClient token={token} />
      ) : (
        <AbmeldenKarte ton="orange" titel="Link ungültig">
          <p className={KARTEN_TEXT}>
            Dieser Abmelde-Link ist nicht gültig oder wurde bereits verwendet.
          </p>
          <Link href="/account/profile" className={TEXTLINK}>
            Abonnements verwalten
          </Link>
        </AbmeldenKarte>
      )}
    </KundeShellMitSitzung>
  )
}
