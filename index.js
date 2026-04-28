import http from 'http'
import { WebSocketServer } from 'ws'
import { randomUUID } from 'crypto'

const PORT = process.env.PORT || 3000

const server = http.createServer((req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*'
    })
    res.end('OK')
})

const wss = new WebSocketServer({ server })

const clients = new Map()
const rooms = new Map()

function send(ws, data) {
    if (ws.readyState === 1) {
        ws.send(JSON.stringify(data))
    }
}

function broadcast(roomId, data) {
    const room = rooms.get(roomId)
    if (!room) return

    for (const id of room) {
        const client = clients.get(id)
        if (client) send(client.ws, data)
    }
}

function join(id, roomId) {
    if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set())
    }

    rooms.get(roomId).add(id)
    clients.get(id).roomId = roomId
}

function leave(id) {
    const client = clients.get(id)
    if (!client?.roomId) return

    const room = rooms.get(client.roomId)
    room?.delete(id)

    if (room && room.size === 0) {
        rooms.delete(client.roomId)
    }

    client.roomId = null
}

wss.on('connection', (ws) => {
    const id = randomUUID()

    clients.set(id, { ws, roomId: null })

    send(ws, {
        type: 'system',
        payload: { text: `Hello! Your id: ${id}` }
    })

    ws.on('message', (msg) => {
        try {
            const data = JSON.parse(msg.toString())

            if (data.type === 'join') {
                leave(id)
                join(id, data.roomId)

                send(ws, {
                    type: 'system',
                    payload: { text: `Joined ${data.roomId}` }
                })

                return
            }

            if (data.type === 'message') {
                const roomId = clients.get(id)?.roomId
                if (!roomId) return

                broadcast(roomId, {
                    type: 'message',
                    payload: { text: data.text, user: id }
                })
            }

            if (data.type === 'typing') {
                const roomId = clients.get(id)?.roomId
                if (!roomId) return

                broadcast(roomId, {
                    type: 'typing',
                    payload: { user: id }
                })
            }
        } catch {
            send(ws, {
                type: 'error',
                payload: { text: 'Invalid message' }
            })
        }
    })

    ws.on('close', () => {
        leave(id)
        clients.delete(id)
    })
})

server.listen(PORT, '0.0.0.0')