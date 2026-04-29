import http from 'http'
import { WebSocketServer } from 'ws'

const PORT = process.env.PORT || 3000

const server = http.createServer((req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*'
    })
    res.end('OK')
})

const wss = new WebSocketServer({ server })

function send(ws, data) {
    if (ws.readyState === 1) {
        ws.send(JSON.stringify(data))
    }
}

async function searchProducts(query) {
    const res = await fetch(`https://dummyjson.com/products/search?q=${encodeURIComponent(query)}`)
    return res.json()
}

function formatProduct(p) {
    return `
${p.title}
Price: $${p.price}
Brand: ${p.brand}
Category: ${p.category}
Rating: ${p.rating}
Stock: ${p.stock}
Return policy: ${p.returnPolicy}
`.trim()
}

wss.on('connection', (ws) => {
    let username = 'Guest'
    let attempts = 0
    let mode = 'search'
    let lastResults = []

    ws.on('message', async (msg) => {
        try {
            const data = JSON.parse(msg.toString())

            if (data.type === 'init') {
                username = data.username || 'Guest'
                attempts = 0
                mode = 'search'

                send(ws, {
                    type: 'system',
                    payload: { text: `${username} connected` }
                })

                setTimeout(() => {
                    send(ws, {
                        type: 'bot',
                        payload: {
                            text: `Hello ${username}, enter a product name to search`
                        }
                    })
                }, 800)

                return
            }

            if (data.type === 'message') {
                const text = data.text.trim()

                send(ws, { type: 'typing' })

                setTimeout(async () => {
                    if (mode === 'select') {
                        const index = Number(text)

                        if (!isNaN(index) && lastResults[index - 1]) {
                            const product = lastResults[index - 1]

                            send(ws, {
                                type: 'bot',
                                payload: { text: formatProduct(product) }
                            })

                            mode = 'search'
                            attempts = 0

                            setTimeout(() => {
                                send(ws, {
                                    type: 'bot',
                                    payload: {
                                        text: 'You can search for another product'
                                    }
                                })
                            }, 800)

                            return
                        } else {
                            send(ws, {
                                type: 'bot',
                                payload: { text: 'Please enter a valid number from the list' }
                            })
                            return
                        }
                    }

                    const result = await searchProducts(text)

                    if (!result.products.length) {
                        attempts++

                        if (attempts >= 3) {
                            send(ws, {
                                type: 'bot',
                                payload: {
                                    text:
                                        'Unfortunately, I cannot help you. Contact support:\nemail@example.com\n+48 123 456 789'
                                }
                            })

                            attempts = 0

                            setTimeout(() => {
                                send(ws, {
                                    type: 'bot',
                                    payload: {
                                        text: 'Try searching for a product again'
                                    }
                                })
                            }, 800)

                            return
                        }

                        send(ws, {
                            type: 'bot',
                            payload: {
                                text:
                                    'Sorry, no products found. Please try again'
                            }
                        })

                        return
                    }

                    attempts = 0

                    if (result.products.length === 1) {
                        send(ws, {
                            type: 'bot',
                            payload: {
                                text: formatProduct(result.products[0])
                            }
                        })

                        return
                    }

                    lastResults = result.products.slice(0, 10)
                    mode = 'select'

                    const list = lastResults
                        .map((p, i) => `${i + 1}. ${p.title} - $${p.price}`)
                        .join('\n')

                    send(ws, {
                        type: 'bot',
                        payload: {
                            text: `Found multiple products:\n${list}\n\nEnter number`
                        }
                    })
                }, 1000)
            }
        } catch {
            send(ws, {
                type: 'error',
                payload: { text: 'Invalid message' }
            })
        }
    })
})

server.listen(PORT, '0.0.0.0')