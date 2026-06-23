import Link from 'next/link'
import { UnsubscribeClient } from './unsubscribe-client'

interface Props {
  searchParams: Promise<{ token?: string }>
}

export default async function UnsubscribePage({ searchParams }: Props) {
  const { token } = await searchParams

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">🔗</div>
          <h1 className="font-heading text-xl font-semibold text-foreground mb-2">
            Ungültiger Link
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            Dieser Abmelde-Link ist nicht gültig oder wurde bereits verwendet.
          </p>
          <Link href="/account/profile" className="text-sm text-primary underline underline-offset-2">
            Abonnements selbst verwalten →
          </Link>
        </div>
      </div>
    )
  }

  return <UnsubscribeClient token={token} />
}
