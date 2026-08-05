import { Clock } from 'lucide-react'
import {
  FARM_PENDING_OWNER_BANNER,
  FARM_PENDING_OWNER_HINT,
  FARM_PENDING_MAIL_SUBJECT,
} from '@/lib/farm-approval'
import { supportMailto } from '@/lib/support'

/**
 * Balken über jeder Farmer-Seite, solange der Hof auf die Freigabe wartet.
 * Bewusst ruhig statt alarmierend — hier ist nichts kaputt, es läuft nur noch
 * eine Prüfung. Der Bauer kann alles weiter bedienen.
 *
 * Die Hof-ID steht im Klartext, damit sie bei einer Rückfrage vorgelesen oder
 * abgeschrieben werden kann, und steckt zusätzlich im vorbefüllten mailto.
 */
export function PendingFarmBanner({ farmId, farmName }: { farmId: string; farmName: string }) {
  const mailto = supportMailto({
    subject: FARM_PENDING_MAIL_SUBJECT,
    anliegen: `Hallo, ich habe eine Frage zur Freischaltung meines Hofes „${farmName}" (ID: ${farmId}).`,
  })

  return (
    <div className="mx-4 mt-3 print:hidden">
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3">
        <div className="flex items-start gap-2">
          <Clock className="size-4 shrink-0 mt-0.5 text-amber-700" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-amber-900">{FARM_PENDING_OWNER_BANNER}</p>
            <p className="mt-1 text-sm leading-relaxed text-amber-900/80">
              {FARM_PENDING_OWNER_HINT}
            </p>
            <p className="mt-2 text-xs text-amber-900/70">
              Deine Hof-ID: <span className="font-mono break-all">{farmId}</span>
            </p>
            <a
              href={mailto}
              className="mt-2 inline-block text-sm font-medium text-amber-900 underline underline-offset-2"
            >
              Frage zur Freischaltung stellen
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
