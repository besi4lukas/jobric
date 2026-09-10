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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={caveat.variable}>
      <body>
        <ClerkProvider afterSignOutUrl="/">{children}</ClerkProvider>
      </body>
    </html>
  )
}
