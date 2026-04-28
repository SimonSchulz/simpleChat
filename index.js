import http from 'http';
import { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';

const server = http.createServer();
const wss = new WebSocketServer({ server });

const clients = new Set();

function send(ws, data) {
    if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

function broadcast(data) {
    for (const client of clients) {
        send(client, data);
    }
}

wss.on('connection', (ws) => {
    const clientId = randomUUID();

    ws.id = clientId;
    clients.add(ws);

    send(ws, {
        type: 'system',
        payload: {
            text: `Welcome! Your id: ${clientId}`
        }
    });

    broadcast({
        type: 'system',
        payload: {
            text: `User ${clientId} connected`
        }
    });

    ws.on('message', (message) => {
        try {
            const text = message.toString().trim();

            if (text.startsWith('/')) {
                handleCommand(ws, text);
                return;
            }

            send(ws, {
                type: 'echo',
                payload: {
                    text,
                    time: new Date().toISOString()
                }
            });

        } catch {
            send(ws, {
                type: 'error',
                payload: { text: 'Invalid message' }
            });
        }
    });

    ws.on('close', () => {
        clients.delete(ws);

        broadcast({
            type: 'system',
            payload: {
                text: `User ${clientId} disconnected`
            }
        });
    });

    ws.on('error', () => {});
});

function handleCommand(ws, text) {
    const [cmd] = text.split(' ');

    switch (cmd) {
        case '/help':
            send(ws, {
                type: 'system',
                payload: {
                    text: 'Commands: /help, /ping, /whoami'
                }
            });
            break;

        case '/ping':
            send(ws, {
                type: 'system',
                payload: { text: 'pong' }
            });
            break;

        case '/whoami':
            send(ws, {
                type: 'system',
                payload: { text: `Your id: ${ws.id}` }
            });
            break;

        default:
            send(ws, {
                type: 'system',
                payload: { text: 'Unknown command' }
            });
    }
}

const PORT = process.env.PORT || 3000;

server.listen(PORT);