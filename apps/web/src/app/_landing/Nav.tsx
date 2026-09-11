import Link from 'next/link'
import { SignedIn, SignedOut } from '@clerk/nextjs'

export function Nav() {
  return (
    <div className="wrap">
      <nav className="top" aria-label="Main">
        <Link className="wordmark" href="/">
          <span className="plate">Jobric</span>
        </Link>
        <ul className="nav-links">
          <li>
            <a href="#how">How it works</a>
          </li>
          <li>
            <a href="#dashboard">Dashboard</a>
          </li>
          <li>
            <a href="#privacy">Privacy</a>
          </li>
        </ul>
        <SignedOut>
          <ul>
            <li>
              <Link className="nav-cta" href="/sign-up">
                Sign up free
              </Link>
            </li>
            <li>
              <Link className="nav-cta" href="/sign-in">
                Sign in
              </Link>
            </li>
          </ul>
        </SignedOut>
        <SignedIn>
          <Link className="nav-cta" href="/dashboard">
            Open dashboard
          </Link>
        </SignedIn>
      </nav>
    </div>
  )
}
