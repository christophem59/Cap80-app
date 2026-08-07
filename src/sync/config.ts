// Configuration de synchronisation, stockée UNIQUEMENT sur l'appareil (§1.2, §5.1).
// Le token n'est jamais loggé, jamais inclus dans un message d'erreur, jamais envoyé
// ailleurs que sur api.github.com.

const OWNER_KEY = 'suivi.repo.owner'
const REPO_KEY = 'suivi.repo.name'
const TOKEN_KEY = 'suivi.repo.token'

export interface RepoConfig {
  owner: string
  repo: string
}

export function getRepoConfig(): RepoConfig | null {
  const owner = localStorage.getItem(OWNER_KEY)
  const repo = localStorage.getItem(REPO_KEY)
  if (!owner || !repo) return null
  return { owner, repo }
}

export function setRepoConfig(cfg: RepoConfig): void {
  localStorage.setItem(OWNER_KEY, cfg.owner.trim())
  localStorage.setItem(REPO_KEY, cfg.repo.trim())
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token.trim())
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

/** Efface toute la configuration de synchronisation (bouton « supprimer »). */
export function clearSyncConfig(): void {
  localStorage.removeItem(OWNER_KEY)
  localStorage.removeItem(REPO_KEY)
  localStorage.removeItem(TOKEN_KEY)
}

export function isConfigured(): boolean {
  return !!getRepoConfig() && !!getToken()
}
