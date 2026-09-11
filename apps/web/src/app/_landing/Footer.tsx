import Link from 'next/link'

export function Footer() {
  return (
    <footer className="wrap site">
      <Link className="wordmark" href="/">
        <span className="plate footer-wordmark">Jobric</span>
      </Link>
      <span>© {new Date().getFullYear()} hello@jobric.app</span>
    </footer>
  )
}
