'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function SignupForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')

  return (
    <form
      className="cta-row"
      onSubmit={(e) => {
        e.preventDefault()
        const q = email ? `?email=${encodeURIComponent(email)}` : ''
        router.push(`/sign-up${q}`)
      }}
    >
      <div className="email-form">
        <input
          type="email"
          placeholder="you@gmail.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button className="btn-primary" type="submit">
          <span>Sign up free</span>
          <span className="arrow">→</span>
        </button>
      </div>
      <span className="hero-note">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth={1.5}
        >
          <path d="M4 12s3-7 8-7 8 7 8 7-3 7-8 7-8-7-8-7z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        read-only access
      </span>
    </form>
  )
}
