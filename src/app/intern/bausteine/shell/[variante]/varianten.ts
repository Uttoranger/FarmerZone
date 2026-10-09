/** Die Shell-Vorschauen unter /intern/bausteine/shell/<id>. Ohne 'use client', damit die Seite sie auf dem Server liest. */
export const SHELL_VARIANTEN = [
  { id: 'kunde', label: 'Kunde, abgemeldet' },
  { id: 'kunde-angemeldet', label: 'Kunde, angemeldet' },
  { id: 'kunde-hof', label: 'Kunde, mit Hof-Sitzung („Mein Hof")' },
  { id: 'kunde-fokus', label: 'Kunde, Fokus (ohne Unterleiste)' },
  { id: 'hof', label: 'Hof' },
  { id: 'admin', label: 'Admin' },
] as const

export type ShellVariante = (typeof SHELL_VARIANTEN)[number]['id']
