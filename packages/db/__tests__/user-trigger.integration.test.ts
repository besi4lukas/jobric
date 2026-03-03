import { describe, it, expect, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'

const supabaseUrl = process.env.SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_KEY!

const admin = createClient<Database>(supabaseUrl, serviceKey)

const TEST_EMAIL = `test-${Date.now()}@jobric-test.com`
const TEST_PASSWORD = 'Test1234!Secure'

let createdUserId: string | null = null

afterAll(async () => {
  if (createdUserId) {
    await admin.auth.admin.deleteUser(createdUserId)
  }
})

describe('handle_new_user trigger', () => {
  it('creates a public.users row when a new auth user signs up', async () => {
    const { data: authData, error: authError } =
      await admin.auth.admin.createUser({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: 'Test User' },
      })

    expect(authError).toBeNull()
    expect(authData.user).toBeDefined()
    createdUserId = authData.user!.id

    const { data: publicUser, error: queryError } = await admin
      .from('users')
      .select('*')
      .eq('id', createdUserId)
      .single()

    expect(queryError).toBeNull()
    expect(publicUser).not.toBeNull()
    expect(publicUser!.email).toBe(TEST_EMAIL)
    expect(publicUser!.full_name).toBe('Test User')
    expect(publicUser!.id).toBe(createdUserId)
    expect(publicUser!.created_at).toBeDefined()
  })
})
