import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { supabase } from '@jobric/db'

interface SignUpBody {
  email: string
  password: string
  fullName?: string
}

interface SignInBody {
  email: string
  password: string
}

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    '/signup',
    async (
      request: FastifyRequest<{ Body: SignUpBody }>,
      reply: FastifyReply,
    ) => {
      const { email, password, fullName } = request.body

      if (!email || !password) {
        return reply
          .status(400)
          .send({ message: 'Email and password are required' })
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      })

      if (error) {
        return reply.status(400).send({ message: error.message })
      }

      return reply.status(201).send({
        message: 'User created successfully',
        user: data.user,
        session: data.session,
      })
    },
  )

  fastify.post(
    '/signin',
    async (
      request: FastifyRequest<{ Body: SignInBody }>,
      reply: FastifyReply,
    ) => {
      const { email, password } = request.body

      if (!email || !password) {
        return reply
          .status(400)
          .send({ message: 'Email and password are required' })
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        return reply.status(401).send({ message: error.message })
      }

      return reply.status(200).send({
        user: data.user,
        session: data.session,
      })
    },
  )

  fastify.post(
    '/signout',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const { error } = await supabase.auth.signOut()

      if (error) {
        return reply.status(500).send({ message: error.message })
      }

      return reply.status(200).send({ message: 'Signed out successfully' })
    },
  )

  fastify.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization

    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ message: 'Missing authorization token' })
    }

    const token = authHeader.slice(7)
    const { data, error } = await supabase.auth.getUser(token)

    if (error) {
      return reply.status(401).send({ message: error.message })
    }

    return reply.status(200).send({ user: data.user })
  })
}
