import { useLayoutEffect, useId, useRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { X, Sparkles, Loader2 } from 'lucide-react'
import { cn } from '../lib/utils'

export function Logo({ small = false }: { small?: boolean }) {
  return <span className={cn('brand', small && 'brand-small')}>
    <svg className="brand-symbol" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <defs><linearGradient id={small ? 'brand-mini' : 'brand-main'} x1="4" y1="4" x2="38" y2="36" gradientUnits="userSpaceOnUse"><stop stopColor="#d9bbff"/><stop offset=".52" stopColor="#b181f4"/><stop offset="1" stopColor="#ef9fd4"/></linearGradient></defs>
      <path d="M21.7 4.5c-9-1.3-17.4 6-16.5 15.4.6 6.1 4.7 10.5 10.3 10.5 5.1 0 8.3-3.6 7.9-8.1-.3-3.4-2.8-5.6-5.5-5.1-2.8.5-3.8 3.6-2.3 5.5M18.3 35.5c9 1.3 17.4-6 16.5-15.4-.6-6.1-4.7-10.5-10.3-10.5-5.1 0-8.3 3.6-7.9 8.1.3 3.4 2.8 5.6 5.5 5.1 2.8-.5 3.8-3.6 2.3-5.5" stroke={`url(#${small ? 'brand-mini' : 'brand-main'})`} strokeWidth="3.8" strokeLinecap="round"/>
    </svg>
    {!small && <span>dream<span className="brand-light">soul</span><span className="brand-dot">.</span></span>}
  </span>
}
export function Button({ children, className, variant = 'primary', loading = false, disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; loading?: boolean }) {
  return <button className={cn('button', `button-${variant}`, className)} disabled={disabled || loading} {...props}>{loading && <Loader2 size={17} className="spin"/>}{children}</button>
}
export function Avatar({ src, name, className }: { src?: string; name: string; className?: string }) {
  return <img className={cn('avatar', className)} src={src || '/images/luna.webp'} alt={name} onError={event => { if (!event.currentTarget.src.endsWith('/images/luna.webp')) event.currentTarget.src = '/images/luna.webp' }} />
}
export function Modal({ open, onClose, title, children, className }: { open: boolean; onClose: () => void; title: string; children: ReactNode; className?: string }) {
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useLayoutEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.querySelector<HTMLElement>('button, input, select, textarea, a[href]')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current()
      if (event.key !== 'Tab') return
      const focusable = panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, textarea, a[href]')
      if (!focusable?.length) return
      const first = focusable[0], last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { last.focus(); event.preventDefault() }
      else if (!event.shiftKey && document.activeElement === last) { first.focus(); event.preventDefault() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener('keydown', onKey); previous?.focus() }
  }, [open])
  if (!open) return null
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className={cn('modal-panel', className)} ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="modal-heading"><h2 id={titleId}>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20}/></button></div>
      {children}
    </div>
  </div>
}
export function EmptyState({ icon, title, description, children }: { icon?: ReactNode; title: string; description: string; children?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon">{icon || <Sparkles size={27}/>}</span><h3>{title}</h3><p>{description}</p>{children}</div>
}
export function CharacterSkeleton() {
  return <div className="character-skeleton" aria-label="Loading character"><div className="skeleton skeleton-image"/><div className="skeleton skeleton-title"/><div className="skeleton skeleton-line"/><div className="skeleton skeleton-short"/></div>
}
