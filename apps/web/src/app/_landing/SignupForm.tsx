import Link from 'next/link'

export function SignupForm() {
  return (
    <div className="cta-row">
      <Link className="btn-primary" href="/sign-up">
        <span>Sign up free</span>
        <span className="arrow">→</span>
      </Link>
    </div>
  )
}
