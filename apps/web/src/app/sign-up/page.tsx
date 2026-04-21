import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="auth-shell">
      <SignUp routing="hash" />
    </div>
  )
}
