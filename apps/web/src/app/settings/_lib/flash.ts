import { cookies } from 'next/headers'

// Set by app/api/gmail/callback/route.ts after the OAuth round-trip.
const FLASH_COOKIE_NAME = 'gmail_oauth_flash'

const FLASH_MESSAGES: Record<string, string> = {
  access_denied:
    'You declined to share access. Connect Gmail to track your applications.',
  email_in_use:
    'That Gmail address is already linked to another Jobric account.',
  generic: "Couldn't connect Gmail. Please try again.",
}

export async function readFlashMessage(): Promise<string | null> {
  const cookieStore = await cookies()
  const code = cookieStore.get(FLASH_COOKIE_NAME)?.value
  if (!code) return null
  return FLASH_MESSAGES[code] ?? FLASH_MESSAGES.generic!
}
