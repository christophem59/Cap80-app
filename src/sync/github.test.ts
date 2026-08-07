import { describe, it, expect, vi, afterEach } from 'vitest'
import { GitHubClient, SyncAuthError, SyncConflictError } from './github'
import { utf8ToBase64 } from './base64'

const cfg = { owner: 'christophem59', repo: 'Cap80', token: 'ghp_fake' }
const client = new GitHubClient(cfg)

function res(status: number, body: unknown, asText = false): Response {
  const payload = asText ? String(body) : JSON.stringify(body)
  return new Response(payload, { status })
}

afterEach(() => vi.restoreAllMocks())

describe('GitHubClient (§5.2)', () => {
  it('validate : ok / not_found / auth', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(res(200, { name: 'Cap80' })))
    expect(await client.validate()).toEqual({ ok: true })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(res(404, {})))
    expect(await client.validate()).toEqual({ ok: false, reason: 'not_found' })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(res(401, {})))
    await expect(client.validate()).rejects.toBeInstanceOf(SyncAuthError)
  })

  it('getFile : présent (décode base64 avec sauts de ligne), absent, dépôt vide', async () => {
    const text = JSON.stringify({ schemaVersion: 1, records: [{ id: 'é' }] })
    const content = utf8ToBase64(text).replace(/(.{60})/g, '$1\n') // comme l'API
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(res(200, { content, sha: 'abc' })))
    expect(await client.getFile('weights.json')).toEqual({
      status: 'present',
      text,
      sha: 'abc',
    })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(res(404, {})))
    expect(await client.getFile('weights.json')).toEqual({ status: 'absent' })

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(res(409, 'Git Repository is empty.', true)),
    )
    expect(await client.getFile('weights.json')).toEqual({ status: 'empty' })
  })

  it('putFile : création (sans sha), conflit (409/422), auth (401)', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(res(201, { content: { sha: 'new' } }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await client.putFile('weights.json', 'BASE64', 'msg')).toEqual({ sha: 'new' })
    // Pas de sha fourni → pas de champ sha dans le corps.
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({
      message: 'msg',
      content: 'BASE64',
    })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(res(409, {})))
    await expect(client.putFile('weights.json', 'B', 'm', 'stale')).rejects.toBeInstanceOf(
      SyncConflictError,
    )

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(res(422, {})))
    await expect(client.putFile('weights.json', 'B', 'm', 'stale')).rejects.toBeInstanceOf(
      SyncConflictError,
    )

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(res(401, {})))
    await expect(client.putFile('weights.json', 'B', 'm')).rejects.toBeInstanceOf(SyncAuthError)
  })

  it("n'expose jamais le token dans un message d'erreur", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(res(500, {})))
    await expect(client.getFile('weights.json')).rejects.toThrow(
      expect.not.stringContaining('ghp_fake'),
    )
  })
})
