// Hof-Freischaltung: eine Quelle für die Wortlaute — analog zu farm-archive.ts
// und shop-pause.ts, damit Server-Antwort, Kundensicht und Bauern-Oberfläche
// nie auseinanderlaufen.
//
// Abgrenzung zu den beiden anderen Zuständen:
//   isPaused    vorübergehend, vom Bauern gesetzt — Hofseite bleibt sichtbar.
//   archivedAt  dauerhaft, vom Bauern gesetzt — Hofseite ist 404.
//   approvedAt  Freigabe durch den PLATTFORMBETREIBER. null = noch nie
//               freigeschaltet oder Freigabe zurückgenommen; die Hofseite
//               verhält sich wie eine unbekannte Farm (404), Checkout und
//               Reservierung lehnen ab. Der Bauer kann weiterhin alles
//               einrichten — Produkte, Fotos, Abholzeiten, Profil.
//
// Prüfreihenfolge in /api/checkout und /api/reserve:
//   archiviert → nicht freigeschaltet → pausiert.
// Begründung: Der dauerhafte Zustand sticht den administrativen, und beide
// stechen den vorübergehenden. So bekommt niemand ein „bald wieder da", wo
// gar nichts wiederkommt.
//
// Durchsetzungs-Doktrin (wie bei Pause und Stilllegung): Die Sperre wird
// SERVERSEITIG erzwungen und nicht durch ausgeblendete Schaltflächen.

/** Server-Antwort (HTTP 409) beim Versuch, bei einem nicht freigeschalteten Hof zu bestellen oder zu reservieren. */
export const FARM_NOT_APPROVED_MESSAGE = 'Dieser Hof ist noch nicht freigeschaltet.'

/** Balken auf jeder Farmer-Seite, solange der Hof auf die Freigabe wartet. */
export const FARM_PENDING_OWNER_BANNER =
  'Dein Hof wird noch geprüft — Kundinnen sehen ihn noch nicht'

/** Erklärung unter dem Balken: was der Bauer jetzt schon tun kann. */
export const FARM_PENDING_OWNER_HINT =
  'Du kannst schon alles einrichten: Produkte, Fotos, Abholzeiten und dein Profil. ' +
  'Sobald dein Hof freigeschaltet ist, bekommst du eine E-Mail und er ist sofort öffentlich erreichbar.'

/** Hinweis nach der Registrierung, bevor der Hof eingerichtet ist. */
export const FARM_PENDING_AFTER_SIGNUP =
  'Dein Hof wird kurz geprüft. Du bekommst eine E-Mail, sobald er freigeschaltet ist — ' +
  'bis dahin kannst du alles in Ruhe einrichten.'

// === ABLEHNEN & LÖSCHEN ===
//
// Gegenstück zur Freigabe: Bot-Anmeldungen hinterlassen Karteileichen, die
// jemand wieder loswerden muss. Gelöscht wird ausschließlich ein Hof OHNE
// Freigabe, und nur, wenn nachweislich keine Geschäftsdaten daran hängen.
//
// Warum die Nachweispflicht: Die Fremdschlüssel geben das Löschen nicht
// einfach her (prisma/migrations/0_init/migration.sql:440 und :449 stehen auf
// ON DELETE RESTRICT, :443 auf SET NULL). Ohne Guard würde der Löschversuch
// entweder mit einem Datenbankfehler abbrechen oder — schlimmer — stillschweigend
// die Kundenzuordnung bestehender Bestellungen auf null setzen.

/** Freigeschaltete Höfe sind tabu: erst die Freigabe zurücknehmen, dann neu entscheiden. */
export const FARM_REJECT_APPROVED_MESSAGE =
  'Freigeschaltete Höfe können nicht gelöscht werden. Nimm zuerst die Freigabe zurück.'

/** Bestell- und Verkaufsdaten unterliegen der Aufbewahrungspflicht — sie überleben jede Ablehnung. */
export const FARM_REJECT_HAS_DATA_MESSAGE =
  'Dieser Hof hat bereits Bestellungen oder Verkäufe. Er wird nicht gelöscht — Geschäftsdaten unterliegen der Aufbewahrungspflicht.'

/** Der Inhaber hat selbst als Kunde bestellt: sein Konto hängt an fremden Bestellungen. */
export const FARM_REJECT_OWNER_HAS_ORDERS_MESSAGE =
  'Der Inhaber dieses Hofes hat selbst schon bestellt. Sein Konto wird nicht gelöscht — die Bestellungen hängen daran.'

/** Notbremse gegen den teuersten Fehlgriff: das eigene Betreiber-Konto. */
export const FARM_REJECT_OWNER_IS_ADMIN_MESSAGE =
  'Der Inhaber dieses Hofes ist Plattformbetreiber. Dieses Konto wird nicht gelöscht.'

/** Betreff der vorausgefüllten Rückfrage-Mail des Bauern an den Support. */
export function farmPendingMailSubject(farmName: string): string {
  return `Freischaltung: ${farmName}`
}

/** Textkörper der Rückfrage-Mail — die Hof-ID steht drin, damit nichts erfragt werden muss. */
export function farmPendingMailBody(farmName: string, farmId: string): string {
  return [
    `Hallo, ich habe eine Frage zur Freischaltung meines Hofes „${farmName}".`,
    '',
    `Hof-ID: ${farmId}`,
    '',
    'Vielen Dank!',
  ].join('\n')
}
