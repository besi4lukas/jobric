import Fastify from 'fastify'
import { loadConfig } from '@jobric/shared/config'
import { authRoutes } from './routes/auth'
import { metricsRoutes } from './routes/metrics'

const config = loadConfig()

const app = Fastify({ logger: true })

app.get('/health', async () => ({ status: 'ok', message: 'Jobric API' }))

app.register(authRoutes, { prefix: '/v1/auth' })
app.register(metricsRoutes, { prefix: '/v1' })

async function start(): Promise<void> {
  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' })
    console.log(
      `API server running on port ${config.PORT} [${config.NODE_ENV}]`,
    )
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
