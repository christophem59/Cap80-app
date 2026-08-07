import { useState } from 'react'
import {
  getRepoConfig,
  getToken,
  setRepoConfig,
  setToken,
  clearSyncConfig,
} from '../sync/config'
import { GitHubClient, SyncAuthError } from '../sync/github'
import { initializeDataRepo } from '../sync/init'
import { pullAndReconcile, refreshPending, sync } from '../sync/manager'

type Feedback = { kind: 'ok' | 'error' | 'info'; text: string } | null

const FEEDBACK_COLOR = {
  ok: 'var(--ok)',
  error: 'var(--alert)',
  info: 'var(--text-muted)',
} as const

export function RepoConfigCard() {
  const cfg = getRepoConfig()
  const [owner, setOwner] = useState(cfg?.owner ?? 'christophem59')
  const [repo, setRepo] = useState(cfg?.repo ?? '')
  const [token, setTokenValue] = useState(getToken() ?? '')
  const [reveal, setReveal] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [busy, setBusy] = useState(false)

  function persist() {
    setRepoConfig({ owner, repo })
    setToken(token)
  }

  async function handleValidate() {
    if (!owner.trim() || !repo.trim() || !token.trim()) {
      setFeedback({ kind: 'error', text: 'Renseigne le propriétaire, le dépôt et le token.' })
      return
    }
    persist()
    setBusy(true)
    setFeedback({ kind: 'info', text: 'Vérification…' })
    try {
      const res = await new GitHubClient({ owner, repo, token }).validate()
      if (res.ok) {
        setFeedback({ kind: 'ok', text: 'Token et dépôt valides ✓' })
        await refreshPending()
      } else {
        setFeedback({ kind: 'error', text: `Dépôt "${owner}/${repo}" introuvable (ou non autorisé par le token).` })
      }
    } catch (e) {
      setFeedback({
        kind: 'error',
        text: e instanceof SyncAuthError ? e.message : 'Erreur réseau lors de la vérification.',
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleInit() {
    persist()
    setBusy(true)
    setFeedback({ kind: 'info', text: 'Initialisation du dépôt…' })
    try {
      const report = await initializeDataRepo(new GitHubClient({ owner, repo, token }))
      await pullAndReconcile()
      await refreshPending()
      void sync()
      const created = report.created.length
      setFeedback({
        kind: 'ok',
        text: created
          ? `Dépôt initialisé : ${created} fichier(s) créé(s).`
          : 'Dépôt déjà initialisé, rien à créer.',
      })
    } catch (e) {
      setFeedback({
        kind: 'error',
        text: e instanceof SyncAuthError ? e.message : "Échec de l'initialisation.",
      })
    } finally {
      setBusy(false)
    }
  }

  function handleDelete() {
    clearSyncConfig()
    setOwner('christophem59')
    setRepo('')
    setTokenValue('')
    setFeedback({ kind: 'info', text: 'Configuration supprimée de cet appareil.' })
    void refreshPending()
  }

  const inputCls =
    'w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm'

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Dépôt de données et token
      </h2>
      <p className="mb-3 text-xs text-[var(--text-muted)]">
        Crée un <strong>fine-grained token</strong> limité au seul dépôt de données,
        permission <strong>Contents : Read and write</strong>, avec une expiration (1 an).{' '}
        <a
          href="https://github.com/settings/personal-access-tokens/new"
          target="_blank"
          rel="noreferrer"
          className="underline"
          style={{ color: 'var(--accent)' }}
        >
          Créer un token
        </a>
        . Le token reste sur cet appareil et n'est envoyé qu'à api.github.com.
      </p>

      <div className="space-y-2">
        <label className="block text-xs text-[var(--text-muted)]">
          Propriétaire (owner)
          <input className={inputCls} value={owner} onChange={(e) => setOwner(e.target.value)} />
        </label>
        <label className="block text-xs text-[var(--text-muted)]">
          Dépôt de données (privé)
          <input
            className={inputCls}
            value={repo}
            placeholder="Cap80"
            onChange={(e) => setRepo(e.target.value)}
          />
        </label>
        <label className="block text-xs text-[var(--text-muted)]">
          Token
          <div className="flex gap-2">
            <input
              className={inputCls}
              type={reveal ? 'text' : 'password'}
              value={token}
              autoComplete="off"
              placeholder="github_pat_…"
              onChange={(e) => setTokenValue(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setReveal((r) => !r)}
              className="shrink-0 rounded-lg border border-[var(--border)] px-3 text-xs"
            >
              {reveal ? 'Masquer' : 'Révéler'}
            </button>
          </div>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={handleValidate}
          className="rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          style={{ background: 'var(--accent)' }}
        >
          Enregistrer et vérifier
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={handleInit}
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-50"
        >
          Initialiser le dépôt
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-muted)]"
        >
          Supprimer
        </button>
      </div>

      {feedback && (
        <p className="mt-3 text-xs" style={{ color: FEEDBACK_COLOR[feedback.kind] }}>
          {feedback.text}
        </p>
      )}
    </section>
  )
}
