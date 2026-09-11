import { SignOutButton } from '@clerk/nextjs'

export function SettingsFooter() {
  return (
    <footer className="settings-footer">
      <span className="note">
        Signing out leaves your Gmail connection in place.
      </span>
      <SignOutButton redirectUrl="/">
        <button type="button" className="btn btn-ghost">
          Sign out
        </button>
      </SignOutButton>
    </footer>
  )
}
