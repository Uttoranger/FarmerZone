import type { Metadata } from 'next'
import { MARKE } from '@/lib/marke'
import { NICHT_ICH_TEXT, anmeldeZeitpunkt, einmalTokenSchema } from '@/lib/geraete'
import { ladeNichtIch } from '@/server/geraete'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import { NichtIchKarte, NichtIchUngueltig } from './nicht-ich-karte'

export const metadata: Metadata = {
  title: `${NICHT_ICH_TEXT.seitentitel} — ${MARKE}`,
  // Der Link trägt einen Einmal-Token (next.config.ts setzt dazu no-referrer).
  robots: { index: false, follow: false },
}

// Liest den Link bei jedem Aufruf — nie zwischenspeichern.
export const dynamic = 'force-dynamic'

/**
 * „Das war ich nicht" (Register E7, Ergänzung; Nr. 114; Mockup
 * system-h1-angemeldete-geraete, Schritte 5 und 6). Der Link aus der Mail
 * „Neue Anmeldung" öffnet NUR diese Seite: Beim Öffnen (GET) wird nichts
 * geändert, nicht einmal der Link verbraucht — Programme, die Links in Mails
 * vorab öffnen, lösen nichts aus. Erst der Knopf (Server-Action, POST) meldet
 * alle Geräte ab. Ungültig, benutzt oder abgelaufen: derselbe neutrale Satz.
 */
export default async function NichtIchSeite({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<React.JSX.Element> {
  const { t } = await searchParams
  const token = einmalTokenSchema.safeParse(t)
  const stand = token.success ? await ladeNichtIch(token.data, new Date()) : { gueltig: false as const }

  return (
    <KundeShellMitSitzung unterleiste={false}>
      <div className="mx-auto w-full max-w-[480px] px-4 pt-6 pb-12 md:pt-12">
        {token.success && stand.gueltig ? (
          <NichtIchKarte
            token={token.data}
            anmeldung={stand.geraet ? { wann: anmeldeZeitpunkt(stand.geraet.erstmalsAm), geraet: stand.geraet.name } : null}
          />
        ) : (
          <NichtIchUngueltig />
        )}
      </div>
    </KundeShellMitSitzung>
  )
}
