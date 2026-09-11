import { SignupForm } from './SignupForm'

export function ClosingCta() {
  return (
    <section className="section close" id="signup">
      <div className="wrap">
        <h2>
          Put the <em>spreadsheet</em>
          <br />
          down.
        </h2>
        <p className="lede">
          Connect Gmail in about ten seconds. We&apos;ll take it from there.
        </p>
        <SignupForm />
      </div>
    </section>
  )
}
