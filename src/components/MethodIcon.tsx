import { MethodId } from '@/types/recipe'

const ICONS: Record<string, React.ReactNode> = {
  v60: (
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4h18L12 18" />
      <path d="M12 18v3" />
      <path d="M10 21h4" />
    </svg>
  ),
  origami: (
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4h18L12 18" />
      <path d="M7.5 11.5h9" />
      <path d="M12 18v3" />
      <path d="M10 21h4" />
    </svg>
  ),
  orea_v4: (
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4h12l-2 13H8L6 4z" />
      <path d="M12 17v4" />
      <path d="M10 21h4" />
    </svg>
  ),
  hario_switch: (
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16L12 16z" />
      <circle cx="12" cy="19.5" r="2.5" />
    </svg>
  ),
  kalita_wave: (
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4h10l2 14H5L7 4z" />
      <path d="M12 18v3" />
      <path d="M10 21h4" />
    </svg>
  ),
  chemex: (
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3h14L12 12l6 9H6l6-9L5 3z" />
      <path d="M9.5 12h5" />
    </svg>
  ),
  ceado_hoop: (
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="7" y="4" width="10" height="13" rx="1" />
      <path d="M10 17v4" />
      <path d="M14 17v4" />
      <path d="M9 21h6" />
    </svg>
  ),
  pulsar: (
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="3" width="8" height="15" rx="1" />
      <circle cx="12" cy="20" r="2" />
    </svg>
  ),
  aeropress: (
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="7" y="9" width="10" height="12" rx="1" />
      <rect x="10" y="3" width="4" height="9" rx="0.5" />
      <path d="M7 16h10" />
    </svg>
  ),
}

interface MethodIconProps {
  method: MethodId | string
  size?: number
  className?: string
}

export default function MethodIcon({ method, size = 24, className = '' }: MethodIconProps) {
  const icon = ICONS[method]
  if (!icon) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <span
      style={{ width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
      className={className}
    >
      {icon}
    </span>
  )
}
