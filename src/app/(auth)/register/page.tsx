import { generateFormToken } from '@/lib/form-token'
import { RegisterForm } from './register-form'

// Die Seite ist eine Server-Komponente geworden, damit der signierte
// Zeitstempel BEIM RENDERN entsteht — das Formular selbst bleibt eine
// Client-Komponente (register-form.tsx). Gleiches Muster wie /admin:
// Server rechnet, Client bedient.
//
// force-dynamic ist hier keine Kosmetik: eine statisch vorgerenderte Seite
// würde allen Besuchern denselben, beliebig alten Token ausliefern — nach
// zwölf Stunden wäre die Registrierung für jeden abgelaufen.
export const dynamic = 'force-dynamic'

export default function RegisterPage() {
  return <RegisterForm formToken={generateFormToken()} />
}
