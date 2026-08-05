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
  'Sobald wir deinen Hof freischalten, ist er sofort öffentlich erreichbar.'

/** Hinweis nach der Registrierung, bevor der Hof eingerichtet ist. */
export const FARM_PENDING_AFTER_SIGNUP =
  'Wir prüfen deinen Hof und melden uns bei dir. Bis dahin kannst du alles in Ruhe einrichten.'

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
