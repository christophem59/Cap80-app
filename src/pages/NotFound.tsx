import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <section className="py-12 text-center">
      <h1 className="mb-2 text-2xl font-semibold">Page introuvable</h1>
      <p className="mb-6 text-sm text-[var(--text-muted)]">
        Cette adresse n'existe pas dans l'application.
      </p>
      <Link
        to="/"
        className="inline-block rounded-lg px-4 py-2 text-sm font-medium text-white"
        style={{ background: 'var(--accent)' }}
      >
        Retour à l'accueil
      </Link>
    </section>
  )
}
