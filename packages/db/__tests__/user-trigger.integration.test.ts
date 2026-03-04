import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'

const canRun = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY)

let admin: SupabaseClient<Database>
let createdUserId: string | null = null

const TEST_EMAIL = `test-${Date.now()}@jobric-test.com`
const TEST_PASSWORD = 'Test1234!Secure'

describe.skipIf(!canRun)('handle_new_user trigger', () => {
  beforeAll(() => {
    admin = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
    )
  })

  afterAll(async () => {
    if (createdUserId) {
      await admin.auth.admin.deleteUser(createdUserId)
    }
  })

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
