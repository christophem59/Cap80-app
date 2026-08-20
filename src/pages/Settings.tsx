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
import {
  getReminderPrefs,
  setReminderPrefs,
  applyReminderPrefs,
  requestNotificationPermission,
  notificationPermission,
  sendTestNotification,
  type ReminderPrefs,
} from '../pwa/reminders'
import {
  pushSupported,
  getVapidPublicKey,
  setVapidPublicKey,
  enablePush,
  disablePush,
  isPushActive,
  refreshSubscriptionUpload,
} from '../pwa/push'

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

function RemindersCard() {
  const [prefs, setPrefs] = useState<ReminderPrefs>(() => getReminderPrefs())
  const [perm, setPerm] = useState(() => notificationPermission())
  const [msg, setMsg] = useState<string | null>(null)
  const [vapid, setVapid] = useState(() => getVapidPublicKey())
  const [pushActive, setPushActive] = useState(false)
  const [pushMsg, setPushMsg] = useState<string | null>(null)
  const [pushBusy, setPushBusy] = useState(false)

  useEffect(() => {
    void isPushActive().then(setPushActive)
  }, [])

  function persist(next: ReminderPrefs) {
    setPrefs(next)
    setReminderPrefs(next)
    void applyReminderPrefs()
    void refreshSubscriptionUpload() // tient le back à jour (horaires/types) si abonné.
  }

  async function togglePush(on: boolean) {
    setPushMsg(null)
    setPushBusy(true)
    try {
      if (on) {
        const err = await enablePush()
        if (err) {
          setPushMsg(err)
        } else {
          setPushActive(true)
          setPushMsg('Notifications en arrière-plan activées ✅')
        }
      } else {
        await disablePush()
        setPushActive(false)
        setPushMsg('Notifications en arrière-plan désactivées.')
      }
    } finally {
      setPushBusy(false)
    }
  }

  async function toggleEnabled(on: boolean) {
    setMsg(null)
    if (on) {
      const p = await requestNotificationPermission()
      setPerm(p)
      if (p !== 'granted') {
        setMsg(
          p === 'denied'
            ? 'Notifications bloquées par le navigateur. Autorise-les dans les paramètres du site, puis réessaie. (Les rappels in-app restent affichés sur l’écran Aujourd’hui.)'
            : 'Autorisation des notifications refusée.',
        )
        persist({ ...prefs, enabled: false })
        return
      }
    }
    persist({ ...prefs, enabled: on })
  }

  async function test() {
    const ok = await sendTestNotification()
    setMsg(ok ? 'Notification de test envoyée.' : 'Impossible d’envoyer la notification (autorisation ?).')
  }

  const row = (
    label: string,
    onKey: 'weigh' | 'meals' | 'steps',
    timeKey: 'weighTime' | 'mealsTime' | 'stepsTime',
  ) => (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={prefs[onKey]}
          disabled={!prefs.enabled}
          onChange={(e) => persist({ ...prefs, [onKey]: e.target.checked })}
        />
        {label}
      </label>
      <input
        type="time"
        value={prefs[timeKey]}
        disabled={!prefs.enabled || !prefs[onKey]}
        onChange={(e) => persist({ ...prefs, [timeKey]: e.target.value })}
        className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm disabled:opacity-50"
      />
    </div>
  )

  return (
    <Card title="Rappels">
      {perm === 'unsupported' ? (
        <p className="text-sm text-[var(--text-muted)]">
          Les notifications ne sont pas prises en charge par ce navigateur. Les rappels
          s’afficheront quand même sur l’écran Aujourd’hui.
        </p>
      ) : (
        <>
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">Activer les rappels</span>
            <input
              type="checkbox"
              checked={prefs.enabled}
              onChange={(e) => void toggleEnabled(e.target.checked)}
            />
          </label>

          <div className="mt-2 border-t border-[var(--border)] pt-2">
            {row('Pesée du matin', 'weigh', 'weighTime')}
            {row('Saisie des repas', 'meals', 'mealsTime')}
            {row('Saisie des pas', 'steps', 'stepsTime')}
          </div>

          {prefs.enabled && (
            <button type="button" onClick={() => void test()} className={`${btn} mt-2`}>
              Tester la notification
            </button>
          )}

          {pushSupported() && (
            <div className="mt-3 border-t border-[var(--border)] pt-3">
              <p className="text-sm font-medium">Notifications en arrière-plan (app fermée)</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Nécessite la mise en place du back (workflow GitHub Actions du dépôt privé) et la
                clé publique VAPID ci-dessous. Voir push-backend/README.
              </p>
              <label className="mt-2 block text-xs font-medium text-[var(--text-muted)]">
                Clé publique VAPID
              </label>
              <input
                type="text"
                value={vapid}
                placeholder="B*****…"
                onChange={(e) => {
                  setVapid(e.target.value)
                  setVapidPublicKey(e.target.value)
                }}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
              />
              <div className="mt-2 flex items-center gap-2">
                {pushActive ? (
                  <button
                    type="button"
                    disabled={pushBusy}
                    onClick={() => void togglePush(false)}
                    className={`${btn} disabled:opacity-60`}
                  >
                    Désactiver l’arrière-plan
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={pushBusy || !prefs.enabled}
                    onClick={() => void togglePush(true)}
                    className={`${btnPrimary} disabled:opacity-60`}
                    style={{ background: 'var(--accent)' }}
                  >
                    {pushBusy ? 'Activation…' : 'Activer l’arrière-plan'}
                  </button>
                )}
                <span className="text-xs" style={{ color: pushActive ? 'var(--ok)' : 'var(--text-muted)' }}>
                  {pushActive ? 'Abonné' : 'Non abonné'}
                </span>
              </div>
              {pushMsg && <p className="mt-2 text-xs text-[var(--text-muted)]">{pushMsg}</p>}
            </div>
          )}

          <p className="mt-3 text-xs text-[var(--text-muted)]">
            Rappel affiché sur l’écran Aujourd’hui (toujours) et en notification à l’ouverture si
            la saisie manque. Les notifications en arrière-plan utilisent le Web Push via le
            workflow du dépôt privé.
          </p>
        </>
      )}
      {msg && <p className="mt-2 text-sm text-[var(--text-muted)]">{msg}</p>}
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

      <RemindersCard />

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
