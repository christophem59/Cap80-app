import type { ReactNode } from 'react'

// Gabarit d'écran vide pour le socle (lot 1). Chaque page annonce ce qui y arrivera
// dans son lot, plutôt que d'afficher un faux contenu.
export function PageScaffold({
  title,
  lot,
  children,
}: {
  title: string
  lot: string
  children?: ReactNode
}) {
  return (
    <section>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mb-6 text-sm text-[var(--text-muted)]">{lot}</p>
      <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--text-muted)]">
        {children ?? 'Écran à construire dans un prochain lot.'}
      </div>
    </section>
  )
}
