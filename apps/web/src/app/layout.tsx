import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Caveat } from 'next/font/google'
import './landing.css'

// Body, display and mono all resolve to native system stacks defined in
// landing.css (:root). Caveat is the one remaining webfont — it backs the
// handwritten brand accents, which have no system equivalent.
const caveat = Caveat({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
  variable: '--f-script',
  fallback: ['Segoe Script', 'cursive'],
})

export const metadata: Metadata = {
  title: 'Jobric: a calmer way to track your job search',
  description:
    'Jobric quietly reads your inbox for job-related email and keeps a gentle, up-to-date record of where you stand.',
}

// Beta ships with Google as the only social provider. Microsoft is still
// enabled in the Clerk Dashboard (so existing linked accounts keep working)
// but its button is hidden from the prebuilt <SignIn/> and <SignUp/> forms.
// Delete this block to bring it back.
//
// Clerk still counts Microsoft when sizing the button grid, so with two
// providers enabled it renders two columns and the hidden button leaves an
// empty one. Force a single column so Google spans the full width, and use
// the long button label — the "many in view" short form ("Google") is what
// Clerk picks when it believes several providers share a row.
const clerkAppearance = {
  elements: {
    socialButtons: { gridTemplateColumns: '1fr' },
    socialButtonsBlockButton__microsoft: { display: 'none' },
    socialButtonsIconButton__microsoft: { display: 'none' },
  },
} as const

const clerkLocalization = {
  socialButtonsBlockButtonManyInView: 'Continue with {{provider|titleize}}',
} as const

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={caveat.variable}>
      <body>
        <ClerkProvider
          afterSignOutUrl="/"
          appearance={clerkAppearance}
          localization={clerkLocalization}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  )
}
