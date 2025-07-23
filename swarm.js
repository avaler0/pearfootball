import Hyperswarm from 'hyperswarm'
import crypto from 'hypercore-crypto'
import b4a from 'b4a'

const swarm = new Hyperswarm()
let peerSocket = null
let onPeerConnected = null

Pear.teardown(() => swarm.destroy())

export async function joinSwarm(topicBuffer, peerCallback = null) {
  onPeerConnected = peerCallback
  const discovery = swarm.join(topicBuffer, { client: true, server: true })
  await discovery.flushed()
}

swarm.on('connection', (socket, info) => {
  //const name = b4a.toString(info.remotePublicKey, 'hex')
  //console.log('Connected to peer:', name)

  console.log(info)
  console.log(info.publicKey)
  const name = b4a.toString(info.publicKey, 'hex')
  console.log('Connected to peer:', name)
  peerSocket = socket 
  console.log(socket)
  const socketname = b4a.toString(socket.remotePublicKey, 'hex')
  console.log('Connected to peer:', socketname)
  if (onPeerConnected) {
    onPeerConnected(socket, info)
  }



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

    if (window.onPeerDisconnected) {
      window.onPeerDisconnected()
    }
  })


})

export function send(msg) {
  if (peerSocket && peerSocket.writable) {
    peerSocket.write(JSON.stringify(msg))
  }
}