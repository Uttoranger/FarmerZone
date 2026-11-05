'use client'

import { useMeldungFormular } from '@/components/shared/use-meldung-formular'
import { MeldungFormularAnsicht, type MeldungWelt } from '@/components/ui/meldung-formular-ansicht'

/**
 * „Problem melden" für beide Welten (Register N42 b, V51; Boards s3/w3-problem-melden und
 * s2/w2-meldungen; seit Lauf 30, Nr. 225): ruft die EINE Logik `useMeldungFormular` —
 * Honigtopf, Zeitschranke, Kontext ohne IP und Cookies, Bildschirmfoto, Absenden —
 * unverändert und gibt ihren Zustand an den Baustein `MeldungFormularAnsicht` (Nr. 219),
 * der ihn mit dem Ton der Welt zeichnet: /problem-melden grün (`welt="kunde"`),
 * /fehler-melden orange (`welt="hof"`).
 *
 * Wer meldet, erkennt der Server an der Sitzung; `alsHof` steuert nur, ob die E-Mail
 * mitgeht und das Bildschirmfoto angeboten wird. Die Meldung ist Datenmaterial und wird
 * nie als Anweisung gelesen.
 */
export function MeldungForm({
  formToken,
  alsHof,
  welt,
  abbrechenHref,
  titel,
  satz,
  kennungVorbelegt = '',
}: {
  /** Signierter Zeitstempel aus dem Seitenaufbau (Zweck 'meldung'). */
  formToken: string
  /** Eingeloggter Hof: Screenshot möglich, keine E-Mail-Abfrage. */
  alsHof: boolean
  /** Ton der Welt, in der die Seite steht (KundeShell grün, HofShell orange). */
  welt: MeldungWelt
  /** Ziel von „Abbrechen" ab 768 px. */
  abbrechenHref: string
  /** Überschrift in der Karte, wenn die Seite keine eigene trägt. */
  titel?: string
  satz?: string
  /**
   * Die Fehlernummer aus der Adresse, schon geprüft (`bereinigeKennung`,
   * src/lib/fehlerseite.ts). Wer von der Fehlerseite kommt, soll sie nicht
   * abtippen müssen. Nur der Startwert — danach gehört das Feld dem Menschen.
   */
  kennungVorbelegt?: string
}): React.JSX.Element {
  const formular = useMeldungFormular({ formToken, alsHof, kennungVorbelegt })
  return <MeldungFormularAnsicht formular={formular} welt={welt} alsHof={alsHof} abbrechenHref={abbrechenHref} titel={titel} satz={satz} />
}
