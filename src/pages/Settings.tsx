import { useEffect, useRef, useState } from 'react'
import { setThemePref, useThemePref } from '../theme'
import type { ThemePref } from '../theme'
import { RepoConfigCard } from '../components/RepoConfigCard'
import { StepsImport } from './StepsImport'
import {
  useCanInstall,
  promptInstall,
  isStandalone,
  isPersisted,
  requestPersist,
  storageEstimateMb,
} from '../pwa/install'
import { exportBackup, importBackup } from '../repo/backup'
import { hardReset } from '../sync/reset'
import { buildDefaultProfile } from '../sync/init'
import { adoptRemoteProfile } from '../repo/profile'
import { calendarWeek, todayLocal } from '../domain/dates'

const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
]

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-soft">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {title}
      </h2>
      {children}
    </section>
  )
}

const btn = 'rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-medium'
const btnPrimary = 'rounded-xl px-3 py-2 text-sm font-semibold text-white'

/**
 * Réapplique le profil (programme, phases, date de départ) tel qu'il est dans le dépôt.
 *
 * Utile après une réinstallation : si l'app est repassée par l'écran de démarrage, le
 * profil local recréé est plus RÉCENT que celui du dépôt, donc la fusion automatique le
 * garde — et le vrai programme reste invisible alors qu'il est intact côté dépôt.
 */
function ProfileRestoreCard() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function restore() {
    setBusy(true)
    setMsg('Récupération…')
    try {
      const profile = await adoptRemoteProfile()
      if (!profile) {
        setMsg("Aucun profil dans le dépôt, ou dépôt non configuré.")
        return
      }
      const week = calendarWeek(profile.startDate, todayLocal())
      setMsg(`Profil récupéré — départ le ${profile.startDate}, semaine ${week} en cours.`)
    } catch {
      setMsg('Échec de la récupération. Vérifie la connexion et le token.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="Profil et programme">
      <p className="mb-3 text-xs leading-relaxed text-[var(--text-muted)]">
        Réapplique le profil enregistré dans le dépôt : date de départ, phases, objectifs.
        À utiliser si l'app est repartie sur un programme neuf après une réinstallation —
        ton programme réel, lui, n'a pas bougé côté dépôt.
      </p>
      <button type="button" className={btn} disabled={busy} onClick={() => void restore()}>
        Récupérer le profil du dépôt
      </button>
      {msg && <p className="mt-2 text-xs text-[var(--text-muted)]">{msg}</p>}
    </Card>
  )
}

function InstallStorageCard() {
  const canInstall = useCanInstall()
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null)

  const refresh = () => {
    void isPersisted().then(setPersisted)
    void storageEstimateMb().then(setEstimate)
  }
  useEffect(refresh, [])

  return (
    <Card title="Installation & stockage">
      {isStandalone() ? (
        <p className="text-sm text-[var(--text-muted)]">Application installée ✓</p>
      ) : canInstall ? (
        <button type="button" onClick={() => void promptInstall()} className={btnPrimary} style={{ background: 'var(--accent)' }}>
          Installer l'application
        </button>
      ) : (
        <p className="text-sm text-[var(--text-muted)]">
          Pour installer : menu Chrome ⋮ → « Installer l'application » (après quelques secondes
          d'utilisation).
        </p>
      )}

      <div className="mt-3 text-sm">
        <p className="text-[var(--text-muted)]">
          Stockage persistant :{' '}
          <span style={{ color: persisted ? 'var(--ok)' : 'var(--text-muted)' }}>
            {persisted == null ? '…' : persisted ? 'accordé' : 'non accordé'}
          </span>
          {estimate && ` · ${estimate.usage} / ${estimate.quota} Mo`}
        </p>
        {!persisted && (
          <button
            type="button"
            onClick={() => void requestPersist().then(refresh)}
            className={`${btn} mt-2`}
          >
            Demander la persistance
          </button>
        )}
      </div>
    </Card>
  )
}

function BackupCard() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string | null>(null)

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const { records } = await importBackup(await file.text())
      setMsg(`${records} enregistrement(s) importés. Rechargement…`)
      setTimeout(() => window.location.reload(), 1000)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Échec de l'import.")
    }
  }

  async function reset() {
    if (
      !window.confirm(
        'Repartir de zéro ? Les données de suivi (pesées, repas, pas, séances, ajustements) seront effacées en local ET dans ton dépôt privé. Ta config de synchro et tes aliments perso sont conservés. Tu repasseras par l’écran de démarrage.',
      )
    ) {
      return
    }
    setMsg('Réinitialisation…')
    try {
      await hardReset({ ...buildDefaultProfile(), onboarded: false })
      window.location.reload()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Échec de la réinitialisation.')
    }
  }

  return (
    <Card title="Sauvegarde locale">
      <p className="mb-2 text-xs text-[var(--text-muted)]">
        Export/import complet en JSON (en plus de la synchro GitHub). Utile pour transférer ou
        archiver hors ligne.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void exportBackup()} className={btnPrimary} style={{ background: 'var(--accent)' }}>
          Exporter (JSON)
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} className={btn}>
          Importer
        </button>
        <button type="button" onClick={() => void reset()} className={btn} style={{ color: 'var(--alert)' }}>
          Repartir de zéro
        </button>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" onChange={onImport} className="hidden" />
      {msg && <p className="mt-2 text-sm text-[var(--text-muted)]">{msg}</p>}
    </Card>
  )
}

export function Settings() {
  const pref = useThemePref()
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Réglages</h1>

      <Card title="Apparence">
        <div role="radiogroup" aria-label="Thème" className="flex gap-2">
          {THEME_OPTIONS.map((o) => {
            const active = pref === o.value
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setThemePref(o.value)}
                className={[
                  'flex-1 rounded-xl border px-3 py-2 text-sm font-medium',
                  active
                    ? 'border-transparent text-white'
                    : 'border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-2)]',
                ].join(' ')}
                style={active ? { background: 'var(--accent)' } : undefined}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      </Card>

      <RepoConfigCard />

      <ProfileRestoreCard />

      <InstallStorageCard />

      <StepsImport />

      <BackupCard />

      <Card title="À propos">
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-[var(--text-muted)]">Version</dt>
          <dd className="text-right">{__APP_VERSION__}</dd>
          <dt className="text-[var(--text-muted)]">Commit déployé</dt>
          <dd className="text-right font-mono">{__COMMIT_HASH__}</dd>
        </dl>
      </Card>
    </section>
  )
}
