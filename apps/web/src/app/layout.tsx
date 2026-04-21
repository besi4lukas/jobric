import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './landing.css'

export const metadata: Metadata = {
  title: 'Jobric — a calmer way to track your job search',
  description:
    'Jobric quietly reads your inbox for job-related email and keeps a gentle, up-to-date record of where you stand.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;600;700&family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  )
}
