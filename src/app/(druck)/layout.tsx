import { SentryNutzer } from '@/components/farmer/sentry-nutzer'
import { verlangeHofDerSitzung } from '@/server/hofbereich'

/*
 * Die Druckseiten des Hofs (Abholzettel, Packliste): Papier, keine Navigation.
 * Eine eigene Routengruppe, weil (hof) jede Seite in die HofShell setzt und
 * eine Shell auf dem Papier nichts zu suchen hat. Adressen ändern sich nicht
 * (Proxy, Lesezeichen bleiben).
 *
 * Papier ist hell und bleibt es in beiden Themes: nur die Tokens, die im
 * neuen Design (data-design="neu") in Hell und Dunkel gleich sind — Crème
 * (accent-foreground) als Grund, fast Schwarz (primary-foreground) als Schrift,
 * Abstufungen über die Deckkraft. Wie das QR-Plakat. Die Seiten prüfen
 * Sitzung und Hof selbst über dieselbe Wache (tests/hof-seiten-wache.test.ts);
 * hier steht sie, damit die Sentry-Kennung (nur die Farm-ID) bekannt ist —
 * je Anfrage einmal geladen (React `cache` in der Wache).
 */
export default async function DruckLayout({ children }: { children: React.ReactNode }): Promise<React.JSX.Element> {
  const { farmId } = await verlangeHofDerSitzung()
  return (
    <div data-design="neu" className="min-h-screen bg-accent-foreground text-primary-foreground [print-color-adjust:exact]">
      <SentryNutzer farmId={farmId} />
      {children}
    </div>
  )
}
