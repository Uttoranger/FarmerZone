'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { approveFarmAction, revokeFarmApprovalAction, rejectFarmAction } from '@/server/actions/admin'
import { KONDITIONEN_DERZEIT } from '@/lib/konditionen'
import type { AdminHofZeile } from '@/lib/admin-hoefe'
import { BestellDialog, DialogFehler } from '@/components/hof-bestellungen/bestell-dialog'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { useFrischBestaetigt } from '@/components/admin/frisch-bestaetigen'

export type HofAktion = { hof: AdminHofZeile; art: 'approve' | 'revoke' | 'reject' }

const TITEL: Record<HofAktion['art'], string> = {
  approve: 'Hof freischalten?',
  revoke: 'Freigabe zurücknehmen?',
  reject: 'Endgültig löschen?',
}

const KNOPF: Record<HofAktion['art'], string> = {
  approve: 'Freischalten',
  revoke: 'Zurücknehmen',
  reject: 'Endgültig löschen',
}

/**
 * Die Rückfrage vor Freischalten, Zurücknehmen und Ablehnen (Nr. 22f) — ab
 * 768 px Dialog, darunter Blatt (BestellDialog). Die Wirkung bleibt in den
 * bestehenden Actions: Freischalten prüft E-Mail und Stripe selbst, Ablehnen
 * seine vier Guards. Ein Fehler steht inline im Dialog, der Erfolg als Toast.
 */
export function HofAktionDialog({
  aktion,
  onClose,
}: {
  aktion: HofAktion | null
  onClose: () => void
}): React.JSX.Element {
  const [laeuft, startTransition] = useTransition()
  const [fehler, setFehler] = useState<string | null>(null)
  // Zurücknehmen und Ablehnen sind heikel (Register N20): frisch mit Passkey bestätigt.
  const frischZuruecknehmen = useFrischBestaetigt(revokeFarmApprovalAction)
  const frischAblehnen = useFrischBestaetigt(rejectFarmAction)
  const art = aktion?.art ?? 'approve'
  const hof = aktion?.hof

  function schliessen() {
    setFehler(null)
    onClose()
  }

  function ausfuehren() {
    if (!aktion) return
    const { hof, art } = aktion
    setFehler(null)
    startTransition(async () => {
      const ergebnis =
        art === 'approve'
          ? await approveFarmAction(hof.id)
          : art === 'revoke'
            ? await frischZuruecknehmen.ausfuehren(hof.id)
            : await frischAblehnen.ausfuehren(hof.id)
      if (ergebnis.error) {
        // Der Grund (Stripe fehlt, Bestellungen am Hof …) steht im Dialog —
        // der Betreiber sieht, warum nichts passiert ist.
        setFehler(ergebnis.error)
        return
      }
      toast.success(
        art === 'approve'
          ? `${hof.name} freigeschaltet`
          : art === 'revoke'
            ? `Freigabe für ${hof.name} zurückgenommen`
            : `${hof.name} abgelehnt und gelöscht`
      )
      schliessen()
    })
  }

  return (
    <BestellDialog
      offen={aktion !== null}
      onOffenChange={(offen) => {
        if (!offen) schliessen()
      }}
      titel={TITEL[art]}
      unterzeile={hof?.name}
      hauptaktion={{ text: KNOPF[art], onClick: ausfuehren, ton: art === 'approve' ? 'gruen' : 'orange', laeuft }}
    >
      {frischZuruecknehmen.dialog}
      {frischAblehnen.dialog}
      <div className="flex flex-col gap-3 text-[14px] text-muted-foreground">
        {art === 'approve' ? (
          <>
            <p>
              <strong className="font-semibold break-words text-foreground">{hof?.name}</strong> wird sofort öffentlich
              erreichbar und kann Bestellungen entgegennehmen.
            </p>
            {/* Die Plätze sind eine Konditions-, keine Zugangsgrenze — der Satz sagt nur, was die Freischaltung
                für die Konditionen bedeutet (fertig vom Server: freischaltHinweis, Register K2). */}
            {hof?.freischaltHinweis && <Hinweiskarte ton={hof.freischaltHinweis.ton}>{hof.freischaltHinweis.text}</Hinweiskarte>}
            {/* Nur ein Hinweis (Register K1): Was öffentlich gilt, steht neben
                der Gründungsplatz-Zusage, die bis zur Abrechnung (Gate 8) bleibt. */}
            <p className="text-[12.5px]">{KONDITIONEN_DERZEIT}</p>
          </>
        ) : art === 'revoke' ? (
          <p>
            Die Hofseite von <strong className="font-semibold break-words text-foreground">{hof?.name}</strong> ist
            danach nicht mehr erreichbar und Bestellungen werden abgelehnt. Es wird nichts gelöscht — der Hof behält
            Zugang zu allen Daten.
            {hof?.gruendungsplatz != null &&
              (hof.gruendungFest ? (
                <> Sein Gründungsplatz und das Ende bleiben festgeschrieben.</>
              ) : (
                <> Sein Gründungsplatz wird frei, die nachfolgenden Höfe rücken auf.</>
              ))}
          </p>
        ) : (
          <>
            <p>
              <strong className="font-semibold break-words text-foreground">{hof?.name}</strong> wird gelöscht — samt dem
              Konto <span className="break-all">{hof?.ownerEmail}</span>, den Produkten, Abholzeiten und Fotos.
            </p>
            <Hinweiskarte ton="orange">
              Endgültig, nicht umkehrbar. Für echte Höfe gibt es das Zurücknehmen der Freigabe — das löscht nichts.
            </Hinweiskarte>
            <p>Höfe mit Bestellungen oder Verkäufen lehnt der Server ab.</p>
          </>
        )}
        <DialogFehler text={fehler} />
      </div>
    </BestellDialog>
  )
}
