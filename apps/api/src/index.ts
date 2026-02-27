import * as http from 'node:http'

const port = process.env['PORT'] ?? '3001'

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ status: 'ok', message: 'Jobric API' }))
})

server.listen(Number(port), () => {
  console.log(`API server running on port ${port}`)
})
