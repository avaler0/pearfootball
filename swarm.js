import Hyperswarm from 'hyperswarm'
import crypto from 'crypto'

let swarm = null
let peerSocket = null

export function startSwarm(topicKey) {
  swarm = new Hyperswarm()

  const topic = crypto.createHash('sha256').update(topicKey).digest()
  swarm.join(topic, {
    announce: true,
    lookup: true
  })

  swarm.on('connection', (socket, info) => {
    peerSocket = socket

    socket.on('data', (data) => {
      try {
        const msg = JSON.parse(data.toString())
        window.receivePeerMessage && window.receivePeerMessage(msg)
      } catch (e) {
        console.error("Failed to parse message", e)
      }
    })

    socket.on('close', () => {
      peerSocket = null
      console.log('Peer disconnected')
    })

    console.log('Connected to peer', info.peer)
  })

  return swarm
}

export function send(msg) {
  if (peerSocket && peerSocket.writable) {
    peerSocket.write(JSON.stringify(msg))
  }
}