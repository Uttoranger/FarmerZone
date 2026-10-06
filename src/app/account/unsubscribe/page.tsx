import Link from 'next/link'
import { Unlink } from 'lucide-react'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import { AbmeldenKarte, TEXTLINK } from './abmelden-karte'
import { UnsubscribeClient } from './unsubscribe-client'

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
        <AbmeldenKarte symbol={Unlink} titel="Ungültiger Link">
          <p className="text-[13.5px] leading-normal text-muted-foreground">
            Dieser Abmelde-Link ist nicht gültig oder wurde bereits verwendet.
          </p>
          <Link href="/account/profile" className={TEXTLINK}>
            Abonnements selbst verwalten
          </Link>
        </AbmeldenKarte>
      )}
    </KundeShellMitSitzung>
  )
}
