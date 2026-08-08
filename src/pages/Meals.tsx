import { useState } from 'react'
import { JournalTab } from './meals/JournalTab'
import { PropositionsTab } from './meals/PropositionsTab'
import { CoursesTab } from './meals/CoursesTab'
import { BatchTab } from './meals/BatchTab'
import { RecipeView } from './meals/RecipeView'

type Tab = 'journal' | 'semaine' | 'courses' | 'batch'

const TABS: { id: Tab; label: string }[] = [
  { id: 'journal', label: 'Journal' },
  { id: 'semaine', label: 'Semaine' },
  { id: 'courses', label: 'Courses' },
  { id: 'batch', label: 'Batch' },
]

export function Meals() {
  const [tab, setTab] = useState<Tab>('journal')
  const [recipeId, setRecipeId] = useState<string | null>(null)

  if (recipeId) {
    return (
      <section>
        <RecipeView recipeId={recipeId} onBack={() => setRecipeId(null)} />
      </section>
    )
  }

  return (
    <section>
      <h1 className="mb-3 text-2xl font-semibold tracking-tight">Repas</h1>

      <div
        role="tablist"
        aria-label="Sous-sections des repas"
        className="mb-4 flex rounded-lg bg-[var(--surface-2)] p-1"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={[
              'flex-1 rounded-md py-1.5 text-sm font-medium',
              tab === t.id
                ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm'
                : 'text-[var(--text-muted)]',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'journal' && <JournalTab />}
      {tab === 'semaine' && <PropositionsTab onOpenRecipe={setRecipeId} />}
      {tab === 'courses' && <CoursesTab />}
      {tab === 'batch' && <BatchTab onOpenRecipe={setRecipeId} />}
    </section>
  )
}
