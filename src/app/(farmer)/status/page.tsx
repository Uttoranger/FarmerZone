import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import { Plus, Megaphone } from 'lucide-react'
import { PageHeader } from '@/components/farmer/page-header'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getStatusPostsForFarm } from '@/server/queries/status-posts'
import { StatusPostCard } from './status-post-card'

export const dynamic = 'force-dynamic'

export default async function StatusPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getFarmForUser(session.user.id)
  if (!farm) redirect('/login')

  const posts = await getStatusPostsForFarm(farm.id)

  const active = posts.filter((p) => p.isActive)
  const past = posts.filter((p) => !p.isActive && !p.isDraft)
  const drafts = posts.filter((p) => p.isDraft)

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <PageHeader
        title="Status & Updates"
        subtitle="Informiere deine Kunden über Neuigkeiten vom Hof"
        action={posts.length > 0 ? (
          <Link
            href="/status/new"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-accent text-accent-foreground text-sm font-semibold hover:bg-accent-hover transition-colors"
          >
            <Plus className="size-4" />
            Neuer Status
          </Link>
        ) : undefined}
      />

      {posts.length === 0 ? (
        <div className="text-center py-16">
          <div className="size-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Megaphone className="size-7 text-muted-foreground" />
          </div>
          <p className="font-medium text-foreground mb-1">Noch kein Status erstellt</p>
          <p className="text-sm text-muted-foreground mb-6">
            Erstelle deinen ersten Status, um Kunden über Neuigkeiten zu informieren.
          </p>
          <Link
            href="/status/new"
            className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-accent text-accent-foreground text-sm font-semibold hover:bg-accent-hover transition-colors"
          >
            <Plus className="size-4" />
            Ersten Status erstellen
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Aktiv
              </h2>
              <div className="flex flex-col gap-3">
                {active.map((post) => (
                  <StatusPostCard key={post.id} post={post} />
                ))}
              </div>
            </section>
          )}

          {drafts.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Entwürfe
              </h2>
              <div className="flex flex-col gap-3">
                {drafts.map((post) => (
                  <StatusPostCard key={post.id} post={post} />
                ))}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Vergangen
              </h2>
              <div className="flex flex-col gap-3">
                {past.map((post) => (
                  <StatusPostCard key={post.id} post={post} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
