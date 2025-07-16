import Hyperswarm from 'hyperswarm'
import crypto from 'hypercore-crypto'
import b4a from 'b4a'

const swarm = new Hyperswarm()
let peerSocket = null

Pear.teardown(() => swarm.destroy())

export async function joinSwarm(topicBuffer) {
  const discovery = swarm.join(topicBuffer, { client: true, server: true })
  await discovery.flushed()
}

swarm.on('connection', (socket, info) => {
  peerSocket = socket

  socket.on('data', (data) => {
    try {
      const msg = JSON.parse(data.toString())
      if (window.receivePeerMessage) window.receivePeerMessage(msg)
    } catch (e) {
      console.error("Invalid message from peer:", e)
    }
  })

  socket.on('close', () => {
    peerSocket = null
    console.log('Peer disconnected')
  })

  console.log('Connected to peer:', info.peer)
})

export function send(msg) {
  if (peerSocket && peerSocket.writable) {
    peerSocket.write(JSON.stringify(msg))
  }
}