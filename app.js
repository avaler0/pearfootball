import { send } from './swarm.js'

const canvas = document.getElementById("gameCanvas")
const ctx = canvas.getContext("2d")

const isHost = confirm("Host the game? OK = Host, Cancel = Join")
let remoteKeyState = {}

window.receivePeerMessage = (msg) => {
  if (isHost) {
    remoteKeyState = msg
  } else {
    player1 = msg.p1
    player2 = msg.p2
    ball = msg.ball
  }
}

// Game state
let player1 = { x: 100, y: 100, w: 20, h: 20, score: 0 }
let player2 = { x: 680, y: 400, w: 20, h: 20, score: 0 }
let ball = { x: 395, y: 295, r: 8, vx: 0, vy: 0 }

const goalWidth = 10
const goalHeight = 150
const leftGoal = { x: 0, y: (canvas.height - goalHeight) / 2, w: goalWidth, h: goalHeight }
const rightGoal = { x: canvas.width - goalWidth, y: (canvas.height - goalHeight) / 2, w: goalWidth, h: goalHeight }

let keys = {
  ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false
}

document.addEventListener("keydown", (e) => {
  if (e.key in keys) keys[e.key] = true
})

document.addEventListener("keyup", (e) => {
  if (e.key in keys) keys[e.key] = false
})

function resetBall() {
  ball.x = 395
  ball.y = 295
  ball.vx = 0
  ball.vy = 0
}

function kickBall(player) {
  const dx = ball.x - (player.x + player.w / 2)
  const dy = ball.y - (player.y + player.h / 2)
  const dist = Math.sqrt(dx * dx + dy * dy) || 1
  const speed = 5

  ball.vx = (dx / dist) * speed
  ball.vy = (dy / dist) * speed
}

function update() {
  if (isHost) {
    // Host controls Player 1
    if (keys.ArrowUp) player1.y -= 3
    if (keys.ArrowDown) player1.y += 3
    if (keys.ArrowLeft) player1.x -= 3
    if (keys.ArrowRight) player1.x += 3

    // Remote controls Player 2
    if (remoteKeyState.ArrowUp) player2.y -= 3
    if (remoteKeyState.ArrowDown) player2.y += 3
    if (remoteKeyState.ArrowLeft) player2.x -= 3
    if (remoteKeyState.ArrowRight) player2.x += 3

    // Move ball
    if (ball.vx !== 0 || ball.vy !== 0) {
      ball.x += ball.vx
      ball.y += ball.vy

      // Friction
      const friction = 0.95
      ball.vx *= friction
      ball.vy *= friction

      if (Math.abs(ball.vx) < 0.1) ball.vx = 0
      if (Math.abs(ball.vy) < 0.1) ball.vy = 0

      // Keep ball inside canvas
      if (ball.x - ball.r < 0) {
        ball.x = ball.r
        ball.vx = 0
      }
      if (ball.x + ball.r > canvas.width) {
        ball.x = canvas.width - ball.r
        ball.vx = 0
      }
      if (ball.y - ball.r < 0) {
        ball.y = ball.r
        ball.vy = 0
      }
      if (ball.y + ball.r > canvas.height) {
        ball.y = canvas.height - ball.r
        ball.vy = 0
      }
    }

    function ballHitsPlayer(player) {
      return (
        ball.x + ball.r > player.x &&
        ball.x - ball.r < player.x + player.w &&
        ball.y + ball.r > player.y &&
        ball.y - ball.r < player.y + player.h
      )
    }

    if (ballHitsPlayer(player1)) {
      kickBall(player1)
    }

    if (ballHitsPlayer(player2)) {
      kickBall(player2)
    }

    // Goal detection
    if (
      ball.x - ball.r <= leftGoal.x + leftGoal.w &&
      ball.y >= leftGoal.y &&
      ball.y <= leftGoal.y + leftGoal.h
    ) {
      player2.score++
      resetBall()
    }

    if (
      ball.x + ball.r >= rightGoal.x &&
      ball.y >= rightGoal.y &&
      ball.y <= rightGoal.y + rightGoal.h
    ) {
      player1.score++
      resetBall()
    }

    // Send state to client
    send({
      p1: player1,
      p2: player2,
      ball: ball
    })
  } else {
    // Send input to host
    send({
      ArrowUp: keys.ArrowUp,
      ArrowDown: keys.ArrowDown,
      ArrowLeft: keys.ArrowLeft,
      ArrowRight: keys.ArrowRight
    })
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Draw goals
  ctx.fillStyle = "#f00"
  ctx.fillRect(leftGoal.x, leftGoal.y, leftGoal.w, leftGoal.h)
  ctx.fillRect(rightGoal.x, rightGoal.y, rightGoal.w, rightGoal.h)

  // Draw players
  ctx.fillStyle = "#0f0"
  ctx.fillRect(player1.x, player1.y, player1.w, player1.h)

  ctx.fillStyle = "#00f"
  ctx.fillRect(player2.x, player2.y, player2.w, player2.h)

  // Draw ball
  ctx.fillStyle = "#fff"
  ctx.beginPath()
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2)
  ctx.fill()

  // Draw scores
  ctx.fillStyle = "#fff"
  ctx.font = "16px sans-serif"
  ctx.fillText(`P1: ${player1.score}`, 20, 20)
  ctx.fillText(`P2: ${player2.score}`, canvas.width - 80, 20)
}

function loop() {
  update()
  draw()
  requestAnimationFrame(loop)
}

loop()