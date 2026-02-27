import * as http from 'node:http'
import { loadConfig } from '@jobric/shared/config'

const config = loadConfig()

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ status: 'ok', message: 'Jobric API' }))
})

server.listen(config.PORT, () => {
  console.log(`API server running on port ${config.PORT} [${config.NODE_ENV}]`)
})
