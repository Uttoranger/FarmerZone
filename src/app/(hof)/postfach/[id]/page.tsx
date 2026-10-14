import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { ladeFadenHof } from '@/server/queries/postfach'
import { POSTFACH_TEXT, fadenEintraege, istNeuFuer, neuesteDerAnderenSeite, rundschreibenVomText } from '@/lib/postfach'
import { UnterseitenKopf } from '@/components/hofbereich/unterseiten-kopf'
import { MARKE } from '@/lib/marke'
import { FadenVerlauf, POSTFACH_RAHMEN, TeamZeichen } from '../teile'
import { AntwortFormular } from './antwort-formular'
import { FadenNachladen } from './faden-nachladen'

export const metadata: Metadata = { title: `${POSTFACH_TEXT.titel} — ${MARKE}`, robots: { index: false } }

export const dynamic = 'force-dynamic'

/*
 * Ein Faden im Postfach des Hofs (Register N12, Nachtlauf Nr. 87; Mockup
 * mobil-h6-unterhaltung): die Nachricht vom Team, die Antworten, darunter das
 * Feld „Antwort an das Team …". Nur ein Faden dieses Hofs — eine fremde
 * Kennung ist 404, wie eine unbekannte (ladeFadenHof mit farmId).
 *
 * Abweichend vom Mockup steht der Rückweg im Unterseiten-Kopf (Register N1,
 * „‹ Postfach") und darunter der Titel des Rundschreibens als h1 mit Absender
 * und Datum — der Kopf des Mockups (Zeichen, Absender, Datum) braucht eine h1.
 *
 * Öffnen setzt den Lesestand (FadenNachladen, nach dem Rendern über die
 * Action); der offene Faden lädt alle 60 s nach (router.refresh, kein
 * Polling-Endpunkt).
 */
export default async function FadenPage({ params }: { params: Promise<{ id: string }> }): Promise<React.JSX.Element> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')
  const farm = await getFarmForUser(session.user.id)
  if (!farm) redirect('/onboarding')

  // URL-Parameter mit Zod (CODING_STANDARDS §3): keine cuid, kein Faden — wie ?faden= im Admin.
  const id = z.cuid().safeParse((await params).id)
  if (!id.success) notFound()
  const faden = await ladeFadenHof(farm.id, id.data)
  if (!faden) notFound()

  const jetzt = new Date()
  const eintraege = fadenEintraege(faden.nachrichten, 'HOF', faden.gelesenBisAndere, jetzt)
  const neueste = neuesteDerAnderenSeite(faden.nachrichten, 'HOF')
  const fuss = faden.rundschreiben
    ? [faden.rundschreiben.wichtig ? POSTFACH_TEXT.wichtig : null, faden.rundschreiben.perMail ? POSTFACH_TEXT.auchPerMail : null]
        .filter((teil) => teil !== null)
        .join(' · ') || null
    : null

  return (
    <div className={POSTFACH_RAHMEN}>
      <UnterseitenKopf />
      <header className="mb-5 flex items-start gap-3">
        <TeamZeichen />
        <div className="min-w-0">
          <h1 className="font-heading text-[22px] leading-tight font-semibold break-words text-foreground md:text-[26px]">
            {faden.titel ?? POSTFACH_TEXT.ohneTitel}
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {POSTFACH_TEXT.absender}
            {faden.rundschreiben && ` · ${rundschreibenVomText(faden.rundschreiben.gesendetAm, jetzt)}`}
          </p>
        </div>
      </header>

      <FadenVerlauf eintraege={eintraege} seite="HOF" fussErste={fuss} nameAndereSeite={POSTFACH_TEXT.absender} />

      <AntwortFormular unterhaltungId={faden.id} />
      <FadenNachladen
        unterhaltungId={faden.id}
        nachrichtId={neueste?.id ?? null}
        ungelesen={neueste !== null && istNeuFuer('HOF', neueste, faden.gelesenBisEigene)}
      />
    </div>
  )
}
