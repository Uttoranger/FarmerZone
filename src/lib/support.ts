// Support-Kontakt: eine Quelle für die Betreiber-Adresse und die daraus
// gebauten mailto-Links. Ändert sich die Adresse, ändert sie sich hier —
// nicht in jeder Seite einzeln.

export const SUPPORT_EMAIL = 'support@farmerzone.at'

type SupportMailOptions = {
  subject: string
  /** Was der Bauer möchte — erste Zeile des Textkörpers. */
  anliegen: string
  /** Hof-Slug, damit der Support den Hof ohne Rückfrage findet. */
  farmSlug?: string | null
  /** Aktuelle Login-Adresse, damit das Konto eindeutig ist. */
  loginEmail?: string | null
}

/**
 * Baut einen mailto-Link mit vorausgefülltem Betreff und Textkörper.
 * Der Textkörper trägt Anliegen, Hof-Slug und Login-Adresse, damit eine
 * Anfrage vollständig ankommt und nicht erst erfragt werden muss.
 */
export function supportMailto({
  subject,
  anliegen,
  farmSlug,
  loginEmail,
}: SupportMailOptions): string {
  const lines = [
    anliegen,
    '',
    `Hof-Slug: ${farmSlug || '(unbekannt)'}`,
    `Aktuelle Login-Adresse: ${loginEmail || '(unbekannt)'}`,
    '',
    'Vielen Dank!',
  ]
  const params = new URLSearchParams({ subject, body: lines.join('\n') })
  // URLSearchParams kodiert Leerzeichen als "+", was in mailto-Links von
  // manchen Mail-Programmen wörtlich übernommen wird — daher %20.
  return `mailto:${SUPPORT_EMAIL}?${params.toString().replace(/\+/g, '%20')}`
}
