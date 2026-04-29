import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="auth-shell">
      <SignIn routing="hash" />
    </div>
  )
}
