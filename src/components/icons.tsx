// Icônes SVG inline (24×24, stroke = currentColor). Pas de dépendance d'icônes.
import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>

const base = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function TodayIcon(p: P) {
  // Anneau (rappel des anneaux de progression du §7.1).
  return (
    <svg {...base} {...p} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.5" />
    </svg>
  )
}

export function TrackingIcon(p: P) {
  // Courbe descendante (perte de poids).
  return (
    <svg {...base} {...p} aria-hidden="true">
      <path d="M3 6l6 6 3-3 8 8" />
      <path d="M3 20h18" />
    </svg>
  )
}

export function MealsIcon(p: P) {
  // Fourchette + couteau.
  return (
    <svg {...base} {...p} aria-hidden="true">
      <path d="M6 3v7a2 2 0 0 0 4 0V3M8 10v11" />
      <path d="M16 3c-1.5 0-2.5 2-2.5 4.5S15 12 16 12v9" />
    </svg>
  )
}

export function WorkoutsIcon(p: P) {
  // Haltère.
  return (
    <svg {...base} {...p} aria-hidden="true">
      <path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" />
    </svg>
  )
}

export function ProgramIcon(p: P) {
  // Presse-papier / plan.
  return (
    <svg {...base} {...p} aria-hidden="true">
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4h6v3H9zM8 11h8M8 15h5" />
    </svg>
  )
}

export function SettingsIcon(p: P) {
  // Rouage classique (roue dentée), distinct du soleil du mode clair.
  return (
    <svg {...base} {...p} aria-hidden="true">
      <path d="M19.14 12.94a7.6 7.6 0 0 0 .05-.94 7.6 7.6 0 0 0-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39.96a7 7 0 0 0-1.62-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.5.5 0 0 0-.61.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.03.31-.05.62-.05.94s.02.63.05.94L2.82 15.06a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.42.34.68.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.04.24.25.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.26.12.54.02.68-.22l1.92-3.32a.5.5 0 0 0-.12-.64z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function SunIcon(p: P) {
  return (
    <svg {...base} {...p} aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

export function MoonIcon(p: P) {
  return (
    <svg {...base} {...p} aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  )
}

export function AutoIcon(p: P) {
  // Demi-lune / demi-soleil = « système ».
  return (
    <svg {...base} {...p} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18a9 9 0 0 0 0-18z" fill="currentColor" stroke="none" />
    </svg>
  )
}
