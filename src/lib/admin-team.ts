import { ADMIN_RECHTE, type EinstellbaresAdminRecht } from '@/lib/admin-rechte'
import { MARKE } from '@/lib/marke'

/*
 * Einstellungen › Team (Register N35, Nachtlauf Nr. 190; Mockup
 * admin-einstellungen-team): die reinen Regeln und Sätze. Wer was darf,
 * entscheidet weiter allein `darf` (src/lib/admin-rechte.ts); hier stehen nur
 * die Vorlagen, die Regel „letzter Inhaber“ und die Wörter.
 */

/** Die zwei Vorlagen des Mockups. „ansehen“ hat jede Person immer; es steht nie in `adminRechte`. */
export const TEAM_VORLAGEN = {
  nurHelfen: { name: 'Nur helfen', rechte: ['mails_nochmal', 'adresse_anzeigen'] },
  wieInhaber: { name: 'Wie Inhaber, ohne Team', rechte: [...ADMIN_RECHTE] },
} as const satisfies Record<string, { name: string; rechte: readonly EinstellbaresAdminRecht[] }>

/**
 * Den letzten Inhaber kann niemand entfernen (N35): Wer einem Inhaber das
 * Recht nimmt oder ihn aus dem Team entfernt, braucht danach noch mindestens
 * einen anderen Inhaber. `andereInhaber` zählt ohne die betroffene Person.
 */
export function letzterInhaber(person: { adminInhaber: boolean }, andereInhaber: number): boolean {
  return person.adminInhaber && andereInhaber === 0
}

/** Unter dieser Sperre laufen alle Änderungen am Team nacheinander (pg_advisory_xact_lock) — sonst entzögen sich zwei Inhaber gleichzeitig gegenseitig das Recht. */
export const TEAM_SPERRE = 190_035

export type TeamAnlass = 'eingeladen' | 'rechte' | 'inhaber' | 'inhaber-entzogen' | 'entfernt'

export const TEAM_TEXT = {
  titel: 'Team',
  zeile: (inhaber: number, weitere: number): string =>
    `${inhaber} ${inhaber === 1 ? 'Inhaber' : 'Inhaber'} · ${weitere} ${weitere === 1 ? 'weitere Person' : 'weitere Personen'}`,
  einladen: 'Person einladen …',
  einladenTitel: 'Person ins Team einladen',
  einladenSatz:
    'Nur ein bestehendes Konto, per genauer E-Mail-Adresse. Die Person richtet danach in 24 Stunden ihren Passkey über die Admin-Einrichtung ein und hat zuerst nur „ansehen“.',
  einladenFeld: 'Genaue E-Mail-Adresse',
  einladenKnopf: 'Mit Passkey einladen',
  // Dieselbe Antwort, ob es das Konto gibt oder nicht (Freigabe Lauf 26, §2).
  eingeladen: 'Wenn es ein Konto mit dieser Adresse gibt, ist die Person jetzt eingeladen und hat eine Mail bekommen.',
  du: 'Du',
  inhaber: 'Inhaber',
  eingeladenMarke: 'eingeladen',
  passkeyFehlt: 'Passkey fehlt',
  passkeys: (n: number): string => (n === 1 ? '1 Passkey' : `${n} Passkeys`),
  ersatzcodes: (n: number): string => (n === 1 ? '1 Ersatzcode übrig' : `${n} Ersatzcodes übrig`),
  rechteZahl: (n: number): string => `${n} von ${ADMIN_RECHTE.length} einstellbaren Rechten`,
  seit: (tag: string): string => `eingeladen am ${tag}`,
  rechteVon: (name: string): string => `Rechte von ${name}`,
  rechteSatz: 'einzeln einstellbar',
  vorlage: 'Vorlage:',
  immer: 'immer',
  nurInhaber: 'nur Inhaber',
  ansehen: 'Heute, Höfe, Bestellungen, Postfach ansehen',
  ansehenSatz: 'Grundrecht jeder Person im Team',
  speichern: 'Rechte mit Passkey speichern',
  gespeichert: 'Die Rechte sind gespeichert. Die Person hat eine Mail bekommen.',
  inhaberMachen: 'Zum Inhaber machen …',
  inhaberEntziehen: 'Inhaber-Recht entziehen …',
  entfernen: 'Aus dem Team entfernen …',
  entfernenTitel: (name: string): string => `${name} aus dem Team entfernen?`,
  entfernenSatz: 'Die Person verliert sofort jeden Zugang zum Admin-Bereich und bekommt eine Mail. Ihr Konto und ihr Hof bleiben.',
  inhaberTitel: (name: string, machen: boolean): string => (machen ? `${name} zum Inhaber machen?` : `${name} das Inhaber-Recht entziehen?`),
  inhaberSatz: (machen: boolean): string =>
    machen
      ? 'Ein Inhaber darf alles – auch Team, Rechte und den Notfallzugang. Die Person bekommt eine Mail.'
      : 'Die Person behält danach nur ihre einzeln eingestellten Rechte und bekommt eine Mail.',
  bestaetigen: 'Mit Passkey bestätigen',
  erledigt: 'Erledigt. Die Person hat eine Mail bekommen.',
  regel:
    'Jede Änderung fragt nach deinem Passkey, gilt sofort, schickt der Person eine Mail und steht im Protokoll. Zwei Rechte bleiben immer beim Inhaber, damit niemand sich selbst mehr Rechte geben kann.',
  letzterInhaber: 'Den letzten Inhaber kann niemand entfernen. Mach zuerst eine andere Person zum Inhaber.',
  nichtImTeam: 'Diese Person ist nicht im Team. Lade die Seite neu.',
  nochmal: 'Gerade ändert jemand anderes das Team. Versuch es gleich noch einmal.',
  notfallTitel: 'Notfallzugang',
  notfallSatz:
    'Fällst du aus, kommt deine Vertretung mit versiegelten Ersatzcodes an den Admin-Bereich. Ersatzcodes für dein eigenes Konto erzeugst du unter „Anmeldung“.',
  notfallLink: 'Ersatzcodes unter „Anmeldung“',
  notfallOffen: 'Ersatzcodes für eine Vertrauensperson kommen mit einem späteren Lauf.',
  leer: 'Außer dir ist noch niemand im Team.',
} as const

/** Sicherheitsmail an die Person, deren Rechte sich geändert haben (Sofort, nie nochmal). */
export const TEAM_MAIL = {
  betreff: {
    eingeladen: 'Du bist jetzt im Admin-Team',
    rechte: 'Deine Rechte im Admin-Team wurden geändert',
    inhaber: 'Du bist jetzt Inhaber im Admin-Team',
    'inhaber-entzogen': 'Dein Inhaber-Recht im Admin-Team wurde entzogen',
    entfernt: 'Du bist nicht mehr im Admin-Team',
  } satisfies Record<TeamAnlass, string>,
  anrede: (name: string | null): string => (name ? `Hallo ${name},` : 'Hallo,'),
  satz: {
    eingeladen: `du wurdest ins Admin-Team von ${MARKE} eingeladen. Richte in den nächsten 24 Stunden deinen Passkey ein – melde dich dafür an und öffne den Admin-Bereich.`,
    rechte: 'eine Inhaberin oder ein Inhaber hat deine Rechte im Admin-Team geändert.',
    inhaber: 'du bist jetzt Inhaber im Admin-Team und darfst alles, auch Team und Rechte.',
    'inhaber-entzogen': 'dein Inhaber-Recht wurde entzogen. Du behältst deine einzeln eingestellten Rechte.',
    entfernt: 'du hast keinen Zugang zum Admin-Bereich mehr. Dein Konto bleibt, wie es ist.',
  } satisfies Record<TeamAnlass, string>,
  rechteTitel: 'Deine Rechte jetzt:',
  nichtDu: 'Kennst du diese Änderung nicht? Antworte nicht auf diese Mail, sondern sag es sofort einer Inhaberin oder einem Inhaber.',
} as const
