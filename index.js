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

wss.on('connection', (ws) => {
    let username = 'Guest'
    let attempts = 0
    let mode = 'search'
    let lastResults = []
    let initialized = false

    ws.on('message', async (msg) => {
        try {
            const data = JSON.parse(msg.toString())

            if (data.type === 'init') {
                if (initialized) return
                initialized = true

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
                }, 500)

                return
            }

            if (data.type === 'message') {
                const text = data.text.trim()

                send(ws, { type: 'typing' })

                setTimeout(async () => {
                    if (mode === 'select') {
                        const index = Number(text)

                        let product = null

                        if (!isNaN(index)) {
                            product = lastResults[index - 1]
                        } else {
                            product = lastResults.find((p) =>
                                p.title.toLowerCase().includes(text.toLowerCase())
                            )
                        }

                        if (product) {
                            send(ws, {
                                type: 'product',
                                payload: {
                                    id: product.id,
                                    title: product.title,
                                    price: product.price,
                                    thumbnail: product.thumbnail,
                                    brand: product.brand,
                                    category: product.category,
                                    rating: product.rating,
                                    stock: product.stock,
                                    returnPolicy: product.returnPolicy
                                }
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
                            }, 500)

                            return
                        }

                        send(ws, {
                            type: 'bot',
                            payload: {
                                text: 'Enter a valid number or product name from the list'
                            }
                        })

                        return
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
                            }, 500)

                            return
                        }

                        send(ws, {
                            type: 'bot',
                            payload: {
                                text: 'Sorry, no products found. Please try again'
                            }
                        })

                        return
                    }

                    attempts = 0

                    if (result.products.length === 1) {
                        const p = result.products[0]

                        send(ws, {
                            type: 'product',
                            payload: {
                                title: p.title,
                                price: p.price,
                                brand: p.brand,
                                category: p.category,
                                rating: p.rating,
                                stock: p.stock,
                                returnPolicy: p.returnPolicy
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
                            text: `Found multiple products:\n${list}\n\nEnter number or name`
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