import { useState } from 'react'
import type { Profile, Sex } from '../domain/types'
import { getProfile } from '../repo/profile'
import { hardReset } from '../sync/reset'
import { todayLocal, addDays } from '../domain/dates'

// Écran de démarrage (onboarding). Saisie des infos perso qui manquaient à l'app :
// taille, naissance, sexe, poids de départ/cible, activité, date de départ. À la
// validation : reset complet (dépôt privé + local, config synchro conservée) puis
// le programme démarre à la date choisie.

const ACTIVITY_OPTIONS: { value: number; label: string }[] = [
  { value: 1.2, label: 'Sédentaire (peu ou pas d’exercice)' },
  { value: 1.4, label: 'Léger (marche, 1-2 séances/sem)' },
  { value: 1.6, label: 'Modéré (3-4 séances/sem)' },
  { value: 1.75, label: 'Actif (5-6 séances/sem)' },
  { value: 1.9, label: 'Très actif (travail physique)' },
]

const field = 'w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm'
const lbl = 'block text-xs font-medium text-[var(--text-muted)] mb-1'

export function Onboarding() {
  const current = getProfile()
  const [startDate, setStartDate] = useState(todayLocal())
  const [sex, setSex] = useState<Sex>(current.sex)
  const [birthYear, setBirthYear] = useState(String(current.birthYear))
  const [heightCm, setHeightCm] = useState(String(current.heightCm))
  const [startWeightKg, setStartWeightKg] = useState('')
  const [targetWeightKg, setTargetWeightKg] = useState('')
  const [activityFactor, setActivityFactor] = useState(current.activityFactor)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const thisYear = new Date().getFullYear()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const by = Number(birthYear)
    const h = Number(heightCm)
    const sw = Number(startWeightKg)
    const tw = Number(targetWeightKg)

    if (!by || by < 1920 || by > thisYear - 10) return setError('Année de naissance invalide.')
    if (!h || h < 120 || h > 230) return setError('Taille invalide (en cm).')
    if (!sw || sw < 30 || sw > 400) return setError('Poids de départ invalide (en kg).')
    if (!tw || tw < 30 || tw > 400) return setError('Poids cible invalide (en kg).')
    if (tw >= sw) return setError('Le poids cible doit être inférieur au poids de départ.')
    if (!startDate) return setError('Choisis une date de départ.')

    const next: Profile = {
      ...current,
      heightCm: h,
      birthYear: by,
      sex,
      startWeightKg: sw,
      targetWeightKg: tw,
      activityFactor,
      // `startDate` = début de la semaine 1. Le programme débute par une semaine de
      // calibrage (semaine 0 = les 7 jours précédant startDate, §6.3). La date choisie
      // est ce 1er jour de calibrage → startDate = date + 7 jours pour être en semaine 0.
      startDate: addDays(startDate, 7),
      strictLoggingUntil: undefined,
      onboarded: true,
      updatedAt: new Date().toISOString(),
    }

    setBusy(true)
    try {
      await hardReset(next)
      window.location.reload()
    } catch (err) {
      setBusy(false)
      setError(err instanceof Error ? err.message : 'Échec du démarrage. Réessaie.')
    }
  }

  return (
    <div className="flex min-h-[100svh] flex-col bg-[var(--bg)]">
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Bienvenue sur Cap80 👋</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Quelques infos pour lancer ton programme. Elles restent sur ton appareil et dans ton
          dépôt privé. Valider <strong>repart de zéro</strong> : les données de suivi (pesées,
          repas, pas, séances) sont vidées et le programme démarre à la date choisie.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className={lbl} htmlFor="ob-date">Date de départ (semaine de calibrage)</label>
            <input id="ob-date" type="date" className={field} value={startDate}
              onChange={(e) => setStartDate(e.target.value)} />
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              Le programme commence par une semaine d’observation (<strong>semaine 0</strong>) :
              tu manges normalement et tu pèses. La Phase 1 (semaine 1) démarre 7 jours plus tard.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl} htmlFor="ob-sw">Poids de départ (kg)</label>
              <input id="ob-sw" type="number" inputMode="decimal" step="0.1" className={field}
                value={startWeightKg} onChange={(e) => setStartWeightKg(e.target.value)}
                placeholder="ex. 100" />
            </div>
            <div>
              <label className={lbl} htmlFor="ob-tw">Poids cible (kg)</label>
              <input id="ob-tw" type="number" inputMode="decimal" step="0.1" className={field}
                value={targetWeightKg} onChange={(e) => setTargetWeightKg(e.target.value)}
                placeholder="ex. 80" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl} htmlFor="ob-h">Taille (cm)</label>
              <input id="ob-h" type="number" inputMode="numeric" className={field}
                value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
            </div>
            <div>
              <label className={lbl} htmlFor="ob-by">Année de naissance</label>
              <input id="ob-by" type="number" inputMode="numeric" className={field}
                value={birthYear} onChange={(e) => setBirthYear(e.target.value)} />
            </div>
          </div>

          <div>
            <label className={lbl}>Sexe</label>
            <div role="radiogroup" className="flex gap-2">
              {(['male', 'female'] as Sex[]).map((s) => (
                <button key={s} type="button" role="radio" aria-checked={sex === s}
                  onClick={() => setSex(s)}
                  className={[
                    'flex-1 rounded-xl border px-3 py-2 text-sm font-medium',
                    sex === s ? 'border-transparent text-white' : 'border-[var(--border)] text-[var(--text)]',
                  ].join(' ')}
                  style={sex === s ? { background: 'var(--accent)' } : undefined}>
                  {s === 'male' ? 'Homme' : 'Femme'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={lbl} htmlFor="ob-act">Niveau d’activité</label>
            <select id="ob-act" className={field} value={activityFactor}
              onChange={(e) => setActivityFactor(Number(e.target.value))}>
              {ACTIVITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm" style={{ color: 'var(--alert)' }}>{error}</p>}

          <button type="submit" disabled={busy}
            className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: 'var(--accent)' }}>
            {busy ? 'Démarrage…' : 'Lancer mon programme'}
          </button>
          <p className="text-center text-[11px] text-[var(--text-muted)]">
            Le programme (phases, calories, séances) est modifiable ensuite dans l’onglet Programme.
          </p>
        </form>
      </main>
    </div>
  )
}
