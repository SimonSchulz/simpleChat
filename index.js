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

    for (const clientId of room) {
        const client = clients.get(clientId)
        if (client) send(client.ws, data)
    }
}

function joinRoom(clientId, roomId) {
    if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set())
    }

    rooms.get(roomId).add(clientId)
    clients.get(clientId).roomId = roomId
}

function leaveRoom(clientId) {
    const client = clients.get(clientId)
    if (!client?.roomId) return

    const room = rooms.get(client.roomId)
    room?.delete(clientId)

    if (room && room.size === 0) {
        rooms.delete(client.roomId)
    }

    client.roomId = null
}

wss.on('connection', (ws) => {
    const id = randomUUID()

    clients.set(id, { ws, roomId: null })

    console.log(`Connected: ${id}`)

    send(ws, {
        type: 'system',
        payload: { text: `Hello! Your id: ${id}` }
    })

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString())

            if (data.type === 'join') {
                leaveRoom(id)
                joinRoom(id, data.roomId)

                send(ws, {
                    type: 'system',
                    payload: { text: `Joined room: ${data.roomId}` }
                })

                broadcast(data.roomId, {
                    type: 'system',
                    payload: { text: `User ${id} joined` }
                })

                return
            }

            if (data.type === 'leave') {
                const roomId = clients.get(id)?.roomId
                leaveRoom(id)

                if (roomId) {
                    broadcast(roomId, {
                        type: 'system',
                        payload: { text: `User ${id} left` }
                    })
                }

                return
            }

            if (data.type === 'message') {
                const roomId = clients.get(id)?.roomId
                if (!roomId) return

                broadcast(roomId, {
                    type: 'message',
                    payload: {
                        text: data.text,
                        user: id
                    }
                })

                return
            }

            if (data.type === 'typing') {
                const roomId = clients.get(id)?.roomId
                if (!roomId) return

                broadcast(roomId, {
                    type: 'typing',
                    payload: { user: id }
                })

                return
            }

        } catch {
            send(ws, {
                type: 'error',
                payload: { text: 'Invalid message' }
            })
        }
    })

    ws.on('close', () => {
        const roomId = clients.get(id)?.roomId

        leaveRoom(id)
        clients.delete(id)

        if (roomId) {
            broadcast(roomId, {
                type: 'system',
                payload: { text: `User ${id} disconnected` }
            })
        }

        console.log(`Disconnected: ${id}`)
    })

    ws.on('error', () => {})
})

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on ${PORT}`)
})