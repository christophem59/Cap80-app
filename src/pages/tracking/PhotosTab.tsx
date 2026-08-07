import { useEffect, useRef, useState } from 'react'
import type { PhotoAngle, PhotoEntry } from '../../domain/types'
import { todayLocal } from '../../domain/dates'
import { trailingAvg } from '../../domain/weight'
import { useWeights } from '../../repo/weights'
import {
  usePhotos,
  useThumbnail,
  savePhoto,
  deletePhoto,
  fetchFullResUrl,
  ANGLES,
  ANGLE_LABELS,
} from '../../repo/photos'

function fmtKg(n: number) {
  return n.toFixed(1).replace('.', ',')
}
function frDate(d: string) {
  return `${d.slice(8)}/${d.slice(5, 7)}/${d.slice(0, 4)}`
}
function monthLabel(ym: string) {
  const [y, m] = ym.split('-')
  const mois = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
  return `${mois[Number(m) - 1]} ${y}`
}

function Thumb({ id, className }: { id: string; className?: string }) {
  const url = useThumbnail(id)
  if (!url)
    return (
      <div
        className={`flex items-center justify-center bg-[var(--surface-2)] text-[10px] text-[var(--text-muted)] ${className ?? ''}`}
      >
        (sur un autre appareil)
      </div>
    )
  return <img src={url} alt="" className={`object-cover ${className ?? ''}`} />
}

/** Affiche la pleine résolution si le dépôt est configuré, sinon la vignette. */
function FullOrThumb({ entry }: { entry: PhotoEntry }) {
  const thumb = useThumbnail(entry.id)
  const [full, setFull] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    let created: string | null = null
    void fetchFullResUrl(entry.path).then((url) => {
      if (alive) {
        created = url
        setFull(url)
      } else if (url) URL.revokeObjectURL(url)
    })
    return () => {
      alive = false
      if (created) URL.revokeObjectURL(created)
    }
  }, [entry.path])
  const src = full ?? thumb
  if (!src)
    return <div className="aspect-[3/4] w-full rounded-lg bg-[var(--surface-2)]" />
  return <img src={src} alt="" className="aspect-[3/4] w-full rounded-lg object-cover" />
}

export function PhotosTab() {
  const photos = usePhotos()
  const weights = useWeights()
  const [angle, setAngle] = useState<PhotoAngle>('face')
  const [mode, setMode] = useState<'grille' | 'comparer'>('grille')
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const today = todayLocal()
      const w = trailingAvg(weights, today) ?? weights[0]?.weightKg ?? null
      await savePhoto(today, angle, file, w == null ? null : Math.round(w * 10) / 10)
    } finally {
      setBusy(false)
    }
  }

  // Groupe par mois (photos triées récent → ancien).
  const byMonth = new Map<string, PhotoEntry[]>()
  for (const p of photos) {
    const ym = p.date.slice(0, 7)
    byMonth.set(ym, [...(byMonth.get(ym) ?? []), p])
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="text-sm font-semibold">Nouvelle photo</h2>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Pour des comparaisons fiables : même lumière, même heure, même tenue, même
          distance. Choisis l'angle avant de prendre la photo.
        </p>
        <div className="mt-3 flex gap-2">
          {ANGLES.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAngle(a)}
              className={[
                'flex-1 rounded-lg border py-2 text-sm font-medium',
                angle === a
                  ? 'border-transparent text-white'
                  : 'border-[var(--border)] text-[var(--text-muted)]',
              ].join(' ')}
              style={angle === a ? { background: 'var(--accent)' } : undefined}
            >
              {ANGLE_LABELS[a]}
            </button>
          ))}
        </div>
        {/* Caméra (capture) et galerie/fichiers (sans capture) : deux entrées distinctes
            pour laisser le choix sur mobile. */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onFile}
          className="hidden"
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          onChange={onFile}
          className="hidden"
        />
        <p className="mt-3 mb-1 text-xs text-[var(--text-muted)]">
          Angle : <strong>{ANGLE_LABELS[angle]}</strong>
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => cameraRef.current?.click()}
            className="flex-1 rounded-lg py-3 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'var(--accent)' }}
          >
            {busy ? 'Traitement…' : 'Prendre une photo'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => galleryRef.current?.click()}
            className="flex-1 rounded-lg border border-[var(--border)] py-3 text-sm font-semibold disabled:opacity-50"
          >
            Importer une photo
          </button>
        </div>
      </section>

      {photos.length > 0 && (
        <div role="tablist" className="flex rounded-lg bg-[var(--surface-2)] p-1">
          {(['grille', 'comparer'] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={[
                'flex-1 rounded-md py-1.5 text-sm font-medium capitalize',
                mode === m ? 'bg-[var(--surface)] shadow-sm' : 'text-[var(--text-muted)]',
              ].join(' ')}
            >
              {m === 'grille' ? 'Grille' : 'Comparer'}
            </button>
          ))}
        </div>
      )}

      {photos.length === 0 && (
        <p className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--text-muted)]">
          Aucune photo pour l'instant. Le mois prochain, reprends la même série pour
          comparer.
        </p>
      )}

      {mode === 'grille' &&
        [...byMonth.entries()].map(([ym, list]) => (
          <section key={ym}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {monthLabel(ym)}
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {list.map((p) => (
                <div key={p.id} className="overflow-hidden rounded-lg border border-[var(--border)]">
                  <Thumb id={p.id} className="aspect-[3/4] w-full" />
                  <div className="flex items-center justify-between px-1.5 py-1 text-[10px]">
                    <span>
                      {ANGLE_LABELS[p.angle]} · {p.date.slice(8)}/{p.date.slice(5, 7)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void deletePhoto(p.id)}
                      className="text-[var(--text-muted)] underline"
                    >
                      suppr.
                    </button>
                  </div>
                  {p.weightKgAtDate != null && (
                    <div className="px-1.5 pb-1 text-[10px] tabular-nums text-[var(--text-muted)]">
                      {fmtKg(p.weightKgAtDate)} kg
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}

      {mode === 'comparer' && <CompareView photos={photos} defaultAngle={angle} />}
    </div>
  )
}

function CompareView({ photos, defaultAngle }: { photos: PhotoEntry[]; defaultAngle: PhotoAngle }) {
  const [angle, setAngle] = useState<PhotoAngle>(defaultAngle)
  const forAngle = photos.filter((p) => p.angle === angle).sort((a, b) => (a.date < b.date ? -1 : 1))
  const [aDate, setADate] = useState<string>('')
  const [bDate, setBDate] = useState<string>('')

  // Valeurs par défaut : la plus ancienne à gauche, la plus récente à droite.
  useEffect(() => {
    if (forAngle.length) {
      setADate(forAngle[0].date)
      setBDate(forAngle[forAngle.length - 1].date)
    }
  }, [angle]) // eslint-disable-line react-hooks/exhaustive-deps

  const a = forAngle.find((p) => p.date === aDate)
  const b = forAngle.find((p) => p.date === bDate)

  const selectCls = 'w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm'

  return (
    <section className="space-y-3">
      <div className="flex gap-2">
        {ANGLES.map((x) => (
          <button
            key={x}
            type="button"
            onClick={() => setAngle(x)}
            className={[
              'flex-1 rounded-lg border py-1.5 text-sm',
              angle === x ? 'border-transparent text-white' : 'border-[var(--border)] text-[var(--text-muted)]',
            ].join(' ')}
            style={angle === x ? { background: 'var(--accent)' } : undefined}
          >
            {ANGLE_LABELS[x]}
          </button>
        ))}
      </div>

      {forAngle.length < 2 ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--text-muted)]">
          Il faut au moins deux photos « {ANGLE_LABELS[angle]} » à des dates différentes
          pour comparer.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {[
            [aDate, setADate, a] as const,
            [bDate, setBDate, b] as const,
          ].map(([date, setDate, entry], i) => (
            <div key={i} className="space-y-2">
              <select className={selectCls} value={date} onChange={(e) => setDate(e.target.value)}>
                {forAngle.map((p) => (
                  <option key={p.id} value={p.date}>
                    {frDate(p.date)}
                  </option>
                ))}
              </select>
              {entry ? <FullOrThumb entry={entry} /> : null}
              <p className="text-center text-xs tabular-nums text-[var(--text-muted)]">
                {entry?.weightKgAtDate != null ? `${fmtKg(entry.weightKgAtDate)} kg` : '—'}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
