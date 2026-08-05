// Hof-Freigabe: eine Quelle für die Wortlaute — Muster wie shop-pause.ts und
// farm-archive.ts, damit Server-Antwort, Kundensicht und Bauern-Oberfläche nie
// auseinanderlaufen.
//
// Drei Zustände, die sich nicht widersprechen dürfen. Die Prüfreihenfolge ist
// überall dieselbe — stillgelegt → nicht freigeschaltet → pausiert —, damit ein
// Hof immer den dauerhaftesten zutreffenden Grund nennt und nie eine falsche
// Zusage macht („bald wieder da" bei einem stillgelegten Hof wäre gelogen):
//
//   archivedAt   dauerhaft stillgelegt, vom Bauern selbst ausgelöst
//   approvedAt   noch nicht vom Betreiber freigeschaltet (null = wartet)
//   isPaused     vorübergehende Pause, Hofseite bleibt sichtbar
//
// Durchsetzungs-Doktrin wie bei Pause und Stilllegung: Die Sperre wird
// SERVERSEITIG erzwungen (/api/checkout und /api/reserve antworten mit 409),
// nicht durch ausgeblendete Schaltflächen.

/** Server-Antwort (HTTP 409) beim Bestell- oder Reservierungsversuch bei einem noch nicht freigeschalteten Hof. */
export const FARM_NOT_APPROVED_MESSAGE = 'Dieser Hof ist noch nicht freigeschaltet.'

/** Balken auf jeder Farmer-Seite, solange der Hof auf die Freigabe wartet. */
export const FARM_PENDING_OWNER_BANNER = 'Dein Hof wird noch geprüft — Kundinnen sehen ihn noch nicht'

/**
 * Erklärung unter dem Balken. Sagt bewusst NICHTS über freie Gründungsplätze —
 * darüber entscheidet der Betreiber im Gespräch, nicht die Oberfläche.
 */
export const FARM_PENDING_OWNER_HINT =
  'Du kannst deinen Hof in Ruhe fertig einrichten: Produkte, Fotos, Abholzeiten, Profil und Status ' +
  'sind vollständig nutzbar. Sobald wir deinen Hof freigeschaltet haben, ist deine Hofseite öffentlich ' +
  'erreichbar und Bestellungen sind möglich. Wir melden uns bei dir.'

/** Bestätigungshinweis direkt nach der Registrierung. */
export const REGISTRATION_PENDING_NOTICE =
  'Dein Hof wird jetzt von uns geprüft. Du kannst ihn sofort einrichten — öffentlich sichtbar und ' +
  'bestellbar wird er, sobald wir ihn freigeschaltet haben. Wir melden uns bei dir.'

/** Betreff des vorbefüllten Support-Mailtos im Warte-Balken. */
export const FARM_PENDING_MAIL_SUBJECT = 'Frage zur Freischaltung meines Hofes'
