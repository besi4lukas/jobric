import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { supabaseAdmin } from '@jobric/db'

interface RefreshBody {
  userId: string
}

interface UserIdParams {
  userId: string
}

export async function metricsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    '/metrics/refresh',
    async (
      request: FastifyRequest<{ Body: RefreshBody }>,
      reply: FastifyReply,
    ) => {
      const { userId } = request.body

      const { error } = await supabaseAdmin.rpc('refresh_user_metrics', {
        target_user_id: userId,
      })

      if (error) {
        return reply
          .status(500)
          .send({ message: 'Failed to refresh metrics', error })
      }

      return reply
        .status(200)
        .send({ message: 'Metrics refreshed successfully' })
    },
  )

  fastify.get(
    '/metrics/:userId',
    async (
      request: FastifyRequest<{ Params: UserIdParams }>,
      reply: FastifyReply,
    ) => {
      const { userId } = request.params

      const { data, error } = await supabaseAdmin
        .from('user_metrics')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error) {
        return reply
          .status(500)
          .send({ message: 'Failed to fetch metrics', error })
      }

      if (!data) {
        return reply.status(404).send({ message: 'Metrics not found' })
      }

      return reply.status(200).send(data)
    },
  )
}
