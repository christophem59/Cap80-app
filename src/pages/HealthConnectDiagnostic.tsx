import { useRef, useState } from 'react'
import { unzipSync, strFromU8 } from 'fflate'

// §9 niveau 2, point 2 — Le format interne du ZIP Health Connect n'est PAS documenté.
// C'est le seul endroit du cahier des charges qui demande d'EXPLORER avant de coder :
// cet écran liste les entrées du ZIP et un extrait de chacune, à faire tourner sur un
// export réel. Le parseur (dédup par app source, §9 point 3) n'est écrit qu'ensuite.

interface Entry {
  name: string
  bytes: number
  excerpt: string
  isText: boolean
}

function looksText(name: string): boolean {
  return /\.(json|csv|txt|xml)$/i.test(name)
}

export function HealthConnectDiagnostic() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setError(null)
    setEntries(null)
    try {
      const buf = new Uint8Array(await file.arrayBuffer())
      // DecompressionStream ne peut PAS lire un ZIP (conteneur, pas un flux) → fflate.
      const unzipped = unzipSync(buf)
      const out: Entry[] = Object.entries(unzipped).map(([name, data]) => {
        const isText = looksText(name)
        let excerpt = ''
        if (isText) {
          excerpt = strFromU8(data.subarray(0, 800))
        } else {
          excerpt = `(binaire, ${data.length} octets)`
        }
        return { name, bytes: data.length, excerpt, isText }
      })
      out.sort((a, b) => a.name.localeCompare(b.name))
      setEntries(out)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de lire ce ZIP.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Pas — import Health Connect (diagnostic)
      </h2>
      <p className="mb-3 text-xs text-[var(--text-muted)]">
        Health Connect exporte un ZIP (Paramètres → Health Connect → Sauvegarde et
        restauration → Export planifié). Le format interne n'est pas documenté : cet outil
        liste ce que contient ton export. Charge le fichier, puis montre-moi le résultat —
        j'écrirai le parseur ensuite.
      </p>
      <input ref={fileRef} type="file" accept=".zip,application/zip" onChange={onFile} className="hidden" />
      <button
        type="button"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
        className="w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: 'var(--accent)' }}
      >
        {busy ? 'Lecture…' : 'Choisir un export Health Connect (.zip)'}
      </button>

      {error && (
        <p className="mt-2 text-sm" style={{ color: 'var(--alert)' }}>
          {error}
        </p>
      )}

      {entries && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-[var(--text-muted)]">{entries.length} entrée(s) dans le ZIP :</p>
          {entries.map((en) => (
            <details key={en.name} className="rounded-lg border border-[var(--border)] p-2">
              <summary className="cursor-pointer text-sm">
                {en.name}{' '}
                <span className="text-xs text-[var(--text-muted)]">({en.bytes} o)</span>
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-[var(--surface-2)] p-2 text-[11px]">
                {en.excerpt}
                {en.isText && en.bytes > 800 ? '\n…(tronqué)' : ''}
              </pre>
            </details>
          ))}
        </div>
      )}
    </section>
  )
}
