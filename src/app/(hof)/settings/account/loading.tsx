import { EinstellungenUnterseiteLaden } from '@/components/hof-einstellungen/einstellungen-laden'

/**
 * Ladeansicht von /settings/account (Nachtlauf Nr. 22d) — ohne sie nähme Next.js
 * die der Übersicht (eine Ebene höher), und die Form spränge beim Umschalten.
 */
export default function UnterseiteLaden(): React.JSX.Element {
  return <EinstellungenUnterseiteLaden />
}
