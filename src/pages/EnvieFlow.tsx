import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { SnackLog, SnackTrigger, SnackContext } from '../domain/types'
import { inferContext } from '../domain/snack'
import { createSnack, updateSnack, getAllSnacks } from '../repo/snacks'
import { AddFoodDialog } from './meals/AddFoodDialog'
import { todayLocal } from '../domain/dates'

// §7.9 — Ton NON NÉGOCIABLE : aucun jugement, aucune couleur d'alerte (pas de rouge),
// aucun score/série/badge. Vocabulaire : envie, épisode, c'est passé, noté.

const TRIGGERS: { id: SnackTrigger; label: string }[] = [
  { id: 'ennui', label: 'Ennui' },
  { id: 'faim', label: 'Faim' },
  { id: 'stress', label: 'Stress' },
  { id: 'fatigue', label: 'Fatigue' },
  { id: 'social', label: 'Social' },
  { id: 'habitude', label: 'Habitude' },
]

const CONTEXTS: { id: SnackContext; label: string }[] = [
  { id: 'bureau', label: 'Bureau' },
  { id: 'teletravail', label: 'Télétravail' },
  { id: 'ecran-soir', label: 'Écran (soir)' },
  { id: 'cuisine', label: 'Cuisine' },
  { id: 'transport', label: 'Transport' },
  { id: 'autre', label: 'Autre' },
]

const ZONE_LIBRE: Record<SnackTrigger, string[]> = {
  faim: ['Radis', 'Bâtonnets de carotte', 'Cornichons', 'Fromage blanc 0 %', 'Un bouillon chaud'],
  ennui: ['Un thé', 'Eau pétillante', 'Un grand verre d’eau', 'Sortir 5 min prendre l’air'],
  stress: ['Respirer 1 minute', 'Une tisane', 'Un thé', 'Sortir prendre l’air'],
  fatigue: ['Un grand verre d’eau', 'Un thé vert', 'S’allonger 10 min', 'Eau pétillante'],
  social: ['Eau pétillante citron', 'Un thé', 'Un café'],
  habitude: ['Un thé', 'Un verre d’eau', 'Un chewing-gum'],
  envie: ['Un thé', 'Eau pétillante', 'Un grand verre d’eau'],
}

function pick3(list: string[]): string[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, 3)
}

const TEMPO_SECONDS = 10 * 60

export function EnvieFlow() {
  const navigate = useNavigate()
  const [step, setStep] = useState<'trigger' | 'tempo' | 'ate'>('trigger')
  const [context, setContext] = useState<SnackContext>('autre')
  const [log, setLog] = useState<SnackLog | null>(null)

  // Contexte pré-sélectionné par déduction (heure + historique), modifiable d'un tap.
  useEffect(() => {
    void getAllSnacks().then((history) => setContext(inferContext(new Date(), history)))
  }, [])

  function done() {
    navigate('/')
  }

  async function chooseTrigger(trigger: SnackTrigger) {
    const created = await createSnack(trigger, context)
    setLog(created)
    setStep('tempo')
  }

  async function setOutcome(outcome: SnackLog['outcome'], note?: string) {
    if (log) await updateSnack({ ...log, outcome, ...(note ? { note } : {}) })
  }

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Une envie</h1>
        <button type="button" onClick={done} className="text-sm text-[var(--text-muted)] underline">
          Fermer
        </button>
      </div>

      {step === 'trigger' && (
        <TriggerStep context={context} setContext={setContext} onChoose={chooseTrigger} />
      )}
      {step === 'tempo' && log && (
        <TempoStep
          log={log}
          onExit={async (outcome, note) => {
            await setOutcome(outcome, note)
            if (outcome === 'mange') setStep('ate')
            else done()
          }}
        />
      )}
      {step === 'ate' && (
        <AteStep onClose={done} />
      )}
    </section>
  )
}

function TriggerStep({
  context,
  setContext,
  onChoose,
}: {
  context: SnackContext
  setContext: (c: SnackContext) => void
  onChoose: (t: SnackTrigger) => void
}) {
  return (
    <>
      <div>
        <p className="mb-1 text-xs text-[var(--text-muted)]">Où es-tu ? (modifiable)</p>
        <div className="flex flex-wrap gap-2">
          {CONTEXTS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setContext(c.id)}
              className={[
                'rounded-full border px-3 py-1.5 text-xs',
                context === c.id
                  ? 'border-transparent text-white'
                  : 'border-[var(--border)] text-[var(--text-muted)]',
              ].join(' ')}
              style={context === c.id ? { background: 'var(--accent)' } : undefined}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-lg font-medium">Qu'est-ce qui se passe ?</p>
        <div className="grid grid-cols-2 gap-3">
          {TRIGGERS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onChoose(t.id)}
              className="min-h-[72px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-base font-semibold"
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

function TempoStep({
  log,
  onExit,
}: {
  log: SnackLog
  onExit: (outcome: SnackLog['outcome'], note?: string) => void
}) {
  const [left, setLeft] = useState(TEMPO_SECONDS)
  useEffect(() => {
    const started = Date.now()
    const id = setInterval(() => {
      const elapsed = Math.floor((Date.now() - started) / 1000)
      setLeft(Math.max(0, TEMPO_SECONDS - elapsed))
    }, 500)
    return () => clearInterval(id)
  }, [])

  const suggestions = useMemo(() => pick3(ZONE_LIBRE[log.trigger] ?? ZONE_LIBRE.envie), [log.trigger])
  const mm = String(Math.floor(left / 60)).padStart(2, '0')
  const ss = String(left % 60).padStart(2, '0')

  // §7.9 : si ennui + après le dîner, mettre en avant « sortir marcher ».
  const hour = Number(log.time.slice(0, 2))
  const showWalk = log.trigger === 'ennui' && hour >= 20

  return (
    <>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-center">
        <p className="text-5xl font-semibold tabular-nums" style={{ color: 'var(--accent)' }}>
          {mm}:{ss}
        </p>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Tu ne dis pas non, tu dis dans 10 minutes.
        </p>
      </section>

      {showWalk && (
        <button
          type="button"
          onClick={() => onExit('passe', 'sortie marcher 30 min')}
          className="w-full rounded-xl py-3 text-sm font-semibold text-white"
          style={{ background: 'var(--accent)' }}
        >
          Sortir marcher 30 min
        </button>
      )}

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Si tu veux quelque chose, pioche ici
        </p>
        <ul className="space-y-1 text-sm">
          {suggestions.map((s) => (
            <li key={s}>• {s}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm italic text-[var(--text-muted)]">
          Est-ce que tu mangerais une pomme, là, tout de suite ?
        </p>
      </section>

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => onExit('passe')}
          className="w-full rounded-xl border border-[var(--border)] py-3 text-sm font-medium"
        >
          C'est passé
        </button>
        <button
          type="button"
          onClick={() => onExit('zone-libre')}
          className="w-full rounded-xl border border-[var(--border)] py-3 text-sm font-medium"
        >
          J'ai pris dans la zone libre
        </button>
        <button
          type="button"
          onClick={() => onExit('mange')}
          className="w-full rounded-xl border border-[var(--border)] py-3 text-sm font-medium"
        >
          J'ai mangé
        </button>
      </div>
    </>
  )
}

function AteStep({ onClose }: { onClose: () => void }) {
  const [adding, setAdding] = useState(false)
  return (
    <>
      <p className="text-lg font-medium">C'est noté.</p>
      {!adding ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex-1 rounded-xl py-3 text-sm font-semibold text-white"
            style={{ background: 'var(--accent)' }}
          >
            Ajouter au journal
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-[var(--border)] py-3 text-sm font-semibold"
          >
            Passer
          </button>
        </div>
      ) : (
        <AddFoodDialog date={todayLocal()} slot="extra" onClose={onClose} />
      )}
    </>
  )
}
