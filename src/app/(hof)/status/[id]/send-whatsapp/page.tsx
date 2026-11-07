import type { Metadata } from 'next'
import { redirect, notFound } from 'next/navigation'
import { verlangeHofDerSitzung } from '@/server/hofbereich'
import { WerkzeugKopf } from '@/components/ui/werkzeug-kopf'
import { BeitraegeBrotkrumen } from '../../beitraege-brotkrumen'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getStatusPostForWhatsApp } from '@/server/queries/status-posts'
import { WhatsAppTapClient } from './whatsapp-tap-client'
import { MARKE } from '@/lib/marke'

/** Die h1 der Seite und der Tab — eine Schreibweise (Board s2-/w2-whatsapp-plakat). */
const WHATSAPP_SEITE_TITEL = 'WhatsApp versenden'

export const metadata: Metadata = { title: `${WHATSAPP_SEITE_TITEL} — ${MARKE}` }

export const dynamic = 'force-dynamic'

/*
 * WhatsApp an Abonnentinnen (je Person ein Tipp) in der HofShell (Nachtlauf
 * Nr. 22e; seit Nr. 66 ehrlich und fortsetzbar, Register W1): Hof der
 * Sitzung, fremde ID → 404; die Empfängerinnen live, dazu, wer schon
 * geöffnet bekam — gespeichert je Person über setzeWhatsAppGetippt. Zurück
 * führt in den Reiter „Beiträge" (UnterseitenKopf, seit Nr. 44 am Handy fest
 * oben).
 * Das Teilen über das Telefon (Mockup mobil-h4-teilen-ueber-das-telefon)
 * kommt mit Gate 7 (Nr. 21).
 */

interface Props {
  params: Promise<{ id: string }>
}

export default async function SendWhatsAppPage({ params }: Props) {
  const { userId } = await verlangeHofDerSitzung()

  const farm = await getFarmForUser(userId)
  if (!farm) redirect('/onboarding')

  const { id } = await params
  // Ob der Beitrag auf der Hofseite steht, bestimmt den Link in der Nachricht (Register T5). Besitz in der WHERE-Klausel wie bei der Liste.
  const data = await getStatusPostForWhatsApp(farm.id, id)
  if (!data) notFound()

  return (
    <div className="w-full max-w-[750px] px-4 pt-5 pb-12 md:px-8 md:pt-7 xl:px-10">
      {/* Werkzeug-Kopf (G1, Nr. 250): h1 „WhatsApp versenden“ in jedem Zustand, Unterzeile „Mein Hof › Beiträge“. */}
      <WerkzeugKopf titel={WHATSAPP_SEITE_TITEL} unterzeile={<BeitraegeBrotkrumen />} />
      <WhatsAppTapClient
        postId={data.id}
        title={data.title}
        body={data.body}
        farmSlug={data.farm.slug}
        showOnFarmPage={data.showOnFarmPage}
        abonnentinnen={data.abonnentinnen}
        getippt={data.getippt}
      />
    </div>
  )
}
