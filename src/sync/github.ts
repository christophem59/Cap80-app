import { base64ToUtf8, base64ToBytes } from './base64'

// Client REST GitHub appelé directement depuis le navigateur (§5.2). api.github.com
// renvoie les en-têtes CORS nécessaires. Le token n'apparaît dans AUCUN message
// d'erreur et n'est envoyé qu'ici.

/** 401/403 : token invalide, expiré ou permission insuffisante → arrêter la sync. */
export class SyncAuthError extends Error {
  constructor() {
    super(
      "Accès refusé (token invalide, expiré ou permission insuffisante). Vérifie le token dans les réglages.",
    )
    this.name = 'SyncAuthError'
  }
}

/** 409/422 sur un PUT/DELETE : le sha fourni est périmé → refusionner et rejouer. */
export class SyncConflictError extends Error {
  constructor() {
    super('Conflit de version (sha périmé).')
    this.name = 'SyncConflictError'
  }
}

export interface GitHubConfig {
  owner: string
  repo: string
  token: string
}

export type GetFileResult =
  | { status: 'present'; text: string; sha: string }
  | { status: 'absent' } // 404 : fichier absent, dépôt sain
  | { status: 'empty' } // 409 : dépôt sans aucun commit

export interface DirEntry {
  name: string
  path: string
  sha: string
}

export class GitHubClient {
  constructor(private readonly cfg: GitHubConfig) {}

  private get base(): string {
    return `https://api.github.com/repos/${this.cfg.owner}/${this.cfg.repo}`
  }

  private headers(): HeadersInit {
    return {
      Authorization: `Bearer ${this.cfg.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    }
  }

  /** Valide la config : GET /repos. Ne lève pas sur 404 (dépôt introuvable). */
  async validate(): Promise<{ ok: true } | { ok: false; reason: 'not_found' }> {
    const res = await fetch(this.base, { headers: this.headers() })
    if (res.ok) return { ok: true }
    if (res.status === 401 || res.status === 403) throw new SyncAuthError()
    if (res.status === 404) return { ok: false, reason: 'not_found' }
    throw new Error(`Réponse inattendue de GitHub (${res.status}).`)
  }

  private static async isEmptyRepo(res: Response): Promise<boolean> {
    if (res.status !== 409) return false
    const body = await res.clone().text()
    return /empty/i.test(body)
  }

  async getFile(path: string): Promise<GetFileResult> {
    const res = await fetch(`${this.base}/contents/${encodeURI(path)}`, {
      headers: this.headers(),
    })
    if (res.ok) {
      const data = (await res.json()) as { content: string; sha: string }
      return { status: 'present', text: base64ToUtf8(data.content), sha: data.sha }
    }
    if (res.status === 404) return { status: 'absent' }
    if (await GitHubClient.isEmptyRepo(res)) return { status: 'empty' }
    if (res.status === 401 || res.status === 403) throw new SyncAuthError()
    throw new Error(`GET ${path} a échoué (${res.status}).`)
  }

  /**
   * Écrit un fichier. `sha` obligatoire pour une mise à jour, absent pour une
   * création (ou sur un dépôt vide : le premier PUT sans sha produit le commit
   * initial). `contentBase64` est déjà encodé (texte via utf8ToBase64, binaire via
   * bytesToBase64).
   */
  async putFile(
    path: string,
    contentBase64: string,
    message: string,
    sha?: string,
  ): Promise<{ sha: string }> {
    const res = await fetch(`${this.base}/contents/${encodeURI(path)}`, {
      method: 'PUT',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, content: contentBase64, ...(sha ? { sha } : {}) }),
    })
    if (res.ok) {
      const data = (await res.json()) as { content: { sha: string } }
      return { sha: data.content.sha }
    }
    if (res.status === 401 || res.status === 403) throw new SyncAuthError()
    if (res.status === 409 || res.status === 422) throw new SyncConflictError()
    throw new Error(`PUT ${path} a échoué (${res.status}).`)
  }

  /** Octets bruts d'un fichier (pour les binaires : photos pleine résolution). */
  async getFileBytes(path: string): Promise<Uint8Array | null> {
    const res = await fetch(`${this.base}/contents/${encodeURI(path)}`, {
      headers: this.headers(),
    })
    if (res.ok) {
      const data = (await res.json()) as { content: string }
      return base64ToBytes(data.content)
    }
    if (res.status === 404) return null
    if (res.status === 401 || res.status === 403) throw new SyncAuthError()
    throw new Error(`GET ${path} (octets) a échoué (${res.status}).`)
  }

  async deleteFile(path: string, sha: string, message: string): Promise<void> {
    const res = await fetch(`${this.base}/contents/${encodeURI(path)}`, {
      method: 'DELETE',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sha }),
    })
    if (res.ok) return
    if (res.status === 401 || res.status === 403) throw new SyncAuthError()
    if (res.status === 409 || res.status === 422) throw new SyncConflictError()
    if (res.status === 404) return // déjà supprimé : idempotent
    throw new Error(`DELETE ${path} a échoué (${res.status}).`)
  }

  /** Liste un dossier (pour steps-inbox/, §9). Dossier absent → tableau vide. */
  async listDir(path: string): Promise<DirEntry[]> {
    const res = await fetch(`${this.base}/contents/${encodeURI(path)}`, {
      headers: this.headers(),
    })
    if (res.ok) {
      const data = (await res.json()) as DirEntry[]
      return Array.isArray(data) ? data : []
    }
    if (res.status === 404) return []
    if (await GitHubClient.isEmptyRepo(res)) return []
    if (res.status === 401 || res.status === 403) throw new SyncAuthError()
    throw new Error(`GET ${path} (liste) a échoué (${res.status}).`)
  }
}
