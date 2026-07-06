'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from './input'

type Props = Omit<React.ComponentProps<'input'>, 'type'>

export function PasswordInput({ className, ...props }: Props) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input
        {...props}
        type={show ? 'text' : 'password'}
        className={cn('pr-10', className)}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={show ? 'Passwort verbergen' : 'Passwort anzeigen'}
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}
