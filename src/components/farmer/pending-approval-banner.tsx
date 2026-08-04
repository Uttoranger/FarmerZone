import { Clock } from 'lucide-react'
import { SUPPORT_EMAIL } from '@/lib/support'
import {
  FARM_PENDING_OWNER_BANNER,
  FARM_PENDING_OWNER_HINT,
  farmPendingMailSubject,
  farmPendingMailBody,
} from '@/lib/farm-approval'

/**
 * Balken über jeder Farmer-Seite, solange der Hof auf die Freigabe wartet.
 * Bewusst nicht schließbar und ruhig gehalten — das ist kein Fehler, sondern
 * ein Zwischenstand. Der Bauer kann alles einrichten, nur öffentlich ist der
 * Hof noch nicht.
 *
 * Die Hof-ID steht im Klartext und ist der Grund für den Balken: Bei einer
 * Rückfrage soll der Bauer sie mitschicken können, ohne sie irgendwo suchen
 * zu müssen — der mailto-Link trägt sie bereits im Text.
 */
export function PendingApprovalBanner({ farmId, farmName }: { farmId: string; farmName: string }) {
  const params = new URLSearchParams({
    subject: farmPendingMailSubject(farmName),
    body: farmPendingMailBody(farmName, farmId),
  })
  // URLSearchParams kodiert Leerzeichen als "+", was manche Mail-Programme
  // wörtlich übernehmen — daher %20 (gleiches Muster wie src/lib/support.ts).
  const mailto = `mailto:${SUPPORT_EMAIL}?${params.toString().replace(/\+/g, '%20')}`

  return (
    <div className="mx-4 mt-3 print:hidden">
      <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-3">
        <div className="flex items-start gap-2">
          <Clock className="size-4 shrink-0 mt-0.5 text-sky-700" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-sky-900">{FARM_PENDING_OWNER_BANNER}</p>
            <p className="mt-1 text-xs leading-relaxed text-sky-800">{FARM_PENDING_OWNER_HINT}</p>
            <p className="mt-2 text-xs text-sky-800">
              Deine Hof-ID:{' '}
              <span className="font-mono font-medium break-all">{farmId}</span>
            </p>
            <p className="mt-1 text-xs text-sky-800">
              <a href={mailto} className="font-medium underline underline-offset-2 break-words">
                Frage zur Freischaltung stellen
              </a>{' '}
              — die Hof-ID ist in der Nachricht schon eingetragen.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
