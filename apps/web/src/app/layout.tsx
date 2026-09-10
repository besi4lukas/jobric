import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import {
  Instrument_Serif,
  Newsreader,
  JetBrains_Mono,
  Caveat,
} from 'next/font/google'
import './landing.css'

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--f-display',
  fallback: ['Iowan Old Style', 'Georgia', 'serif'],
})

const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--f-body',
  fallback: ['Georgia', 'serif'],
})

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--f-mono',
  fallback: ['ui-monospace', 'Menlo', 'monospace'],
})

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
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${newsreader.variable} ${jetBrainsMono.variable} ${caveat.variable}`}
    >
      <body>
        <ClerkProvider afterSignOutUrl="/">{children}</ClerkProvider>
      </body>
    </html>
  )
}
