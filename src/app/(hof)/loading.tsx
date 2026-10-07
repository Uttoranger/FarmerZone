import { HofSeiteLaden } from '@/components/hofbereich/hof-laden'

/**
 * Rückfall der Routengruppe (hof) (Nachtlauf Nr. 31): Eine Route ohne eigene
 * Ladeansicht zeigt beim Tab-Wechsel sofort diese statt nichts — und Next.js
 * kann bis hierher vorladen. Jede Route hat trotzdem ihre eigene in der Form
 * ihrer Seite (tests/ladeansichten.test.ts); diese greift nur für neue.
 */
export default function HofLaden(): React.JSX.Element {
  return <HofSeiteLaden />
}
