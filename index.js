import http from 'http'
import { WebSocketServer } from 'ws'

const PORT = process.env.PORT || 3000

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('OK')
})

const wss = new WebSocketServer({ server })

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const text = message.toString()

        wss.clients.forEach((client) => {
            if (client.readyState === 1) {
                client.send(
                    JSON.stringify({
                        type: 'message',
                        payload: { text }
                    })
                )
            }
        })
    })
})

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on ${PORT}`)
})