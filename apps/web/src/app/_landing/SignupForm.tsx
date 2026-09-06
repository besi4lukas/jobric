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
    </form>
  )
}
