import { NavLink } from 'react-router-dom'
import type { ComponentType, SVGProps } from 'react'
import {
  TodayIcon,
  TrackingIcon,
  MealsIcon,
  WorkoutsIcon,
  ProgramIcon,
} from './icons'

type Tab = {
  to: string
  label: string
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  end?: boolean
}

// §7 : Aujourd'hui · Suivi · Repas · Séances · Programme.
const TABS: Tab[] = [
  { to: '/', label: "Aujourd'hui", Icon: TodayIcon, end: true },
  { to: '/suivi', label: 'Suivi', Icon: TrackingIcon },
  { to: '/repas', label: 'Repas', Icon: MealsIcon },
  { to: '/seances', label: 'Séances', Icon: WorkoutsIcon },
  { to: '/programme', label: 'Programme', Icon: ProgramIcon },
]

export function BottomNav() {
  return (
    <nav
      className="sticky bottom-0 z-10 border-t border-[var(--border)] bg-[var(--surface)]"
      // §11 : respecter la zone sûre de la barre de navigation gestuelle Android.
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navigation principale"
    >
      <ul className="mx-auto flex max-w-2xl">
        {TABS.map(({ to, label, Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                [
                  // Cible tactile ≥ 48 px de haut (§11).
                  'flex min-h-[56px] flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium',
                  isActive
                    ? 'text-[var(--accent)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]',
                ].join(' ')
              }
            >
              <Icon width={24} height={24} />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
