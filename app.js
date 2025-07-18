import { send, joinSwarm } from './swarm.js'
import crypto from 'hypercore-crypto'
import b4a from 'b4a'

const canvas = document.getElementById("gameCanvas")
const ctx = canvas.getContext("2d")
const menu = document.getElementById("menu")
const gameKeyDisplay = document.getElementById("gameKeyDisplay")
const gameKeyElement = document.getElementById("gameKey")
const BASE_SPEED = 1
const BOOST_MULTIPLIER = 4
const boosterImg = new Image()
boosterImg.src = './pear.svg'  // path relative to index.html or your server root
const player1Img = new Image()
player1Img.src = './player1.png'

const player2Img = new Image()
player2Img.src = './player2.png'


let isHost = false
let remoteKeyState = {}

window.receivePeerMessage = (msg) => {
  // Host logic: receive remote input
  if (isHost && msg.ArrowUp !== undefined) {
    remoteKeyState = msg;
    return;
  }

  // Common game logic
  switch (msg.type) {
    case 'player-ready':
      opponentReady = true;
      checkStartConditions();
      break;

    case 'game-over':
      statusMsg.innerText = 'Game Over';
      enablePlayerMovement = false;
      gameStarted = false;
      document.getElementById('match-timer').innerText = '';
      break;

    default:
      // Sync state from host if not host
      if (!isHost && msg.p1 && msg.p2 && msg.ball) {
        player1 = msg.p1;
        player2 = msg.p2;
        ball = msg.ball;
        powerUp = msg.powerUp || null;
        speedBoost = msg.speedBoost || {
          p1: { active: false, endTime: 0 },
          p2: { active: false, endTime: 0 }
        };
      }
      break;
  }
};

function hex(buf) {
  return b4a.toString(buf, 'hex')
}

function bufferFromHex(str) {
  return b4a.from(str, 'hex')
}

document.getElementById("createBtn").onclick = async () => {
  const topicBuffer = crypto.randomBytes(32)
  isHost = true
  await joinSwarm(topicBuffer)
  menu.style.display = "none"
  const topicHex = hex(topicBuffer)
  gameKeyElement.innerText = `Game Key: ${topicHex}`
  gameKeyElement.onclick = () => {
    navigator.clipboard.writeText(topicHex)
    gameKeyElement.innerText = `Copied! ${topicHex}`
    setTimeout(() => {
      gameKeyElement.innerText = `Game Key: ${topicHex}`
    }, 1500)
  }
  scheduleNextPowerUp()
  loop()
}

document.getElementById("joinBtn").onclick = async () => {
  const input = document.getElementById("joinKeyInput").value.trim()
  if (!input) {
    gameKeyDisplay.textContent = "Please enter a game key."
    return
  }
  try {
    const topicBuffer = bufferFromHex(input)
    await joinSwarm(topicBuffer)
    menu.style.display = "none"
    gameKeyDisplay.textContent = ""
    gameKeyElement.innerText = "" // don't show key for joiners
    loop()
  } catch {
    gameKeyDisplay.textContent = "Invalid game key format."
  }
}

let player1 = { x: 100, y: 100, w: 20, h: 20, score: 0 }
let player2 = { x: 680, y: 400, w: 20, h: 20, score: 0 }
let ball = { x: 395, y: 295, r: 8, vx: 0, vy: 0 }
let powerUp = null
let powerUpTimeout = null
let nextPowerUpDelay = 0

let speedBoost = {
  p1: { active: false, endTime: 0 },
  p2: { active: false, endTime: 0 }
}

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

function scheduleNextPowerUp() {
    const delay = 10000 + Math.random() * 15000 // 10–25 sec
    nextPowerUpDelay = Date.now() + delay
  }
  
  function applySpeedBoost(playerKey) {
    speedBoost[playerKey].active = true
    speedBoost[playerKey].endTime = Date.now() + 10000 // 30 sec
    powerUp = null
    clearTimeout(powerUpTimeout)
    scheduleNextPowerUp()
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
  if (!gameStarted) return;
  if (isHost) {
    if (keys.ArrowUp) player1.y -= 3
    if (keys.ArrowDown) player1.y += 3
    if (keys.ArrowLeft) player1.x -= 3
    if (keys.ArrowRight) player1.x += 3

    if (remoteKeyState.ArrowUp) player2.y -= 3
    if (remoteKeyState.ArrowDown) player2.y += 3
    if (remoteKeyState.ArrowLeft) player2.x -= 3
    if (remoteKeyState.ArrowRight) player2.x += 3

    // Clamp player positions within canvas bounds
    function clampPlayer(p) {
    p.x = Math.max(0, Math.min(canvas.width - p.w, p.x))
    p.y = Math.max(0, Math.min(canvas.height - p.h, p.y))
    }
  
    clampPlayer(player1)
    clampPlayer(player2)

    if (ball.vx !== 0 || ball.vy !== 0) {
      ball.x += ball.vx
      ball.y += ball.vy
      ball.vx *= 0.95
      ball.vy *= 0.95
      if (Math.abs(ball.vx) < 0.1) ball.vx = 0
      if (Math.abs(ball.vy) < 0.1) ball.vy = 0
    }

    // Bounce the ball off the pitch boundaries
    if (ball.x - ball.r < 0 || ball.x + ball.r > canvas.width) {
    ball.vx *= -1
    ball.x = Math.max(ball.r, Math.min(canvas.width - ball.r, ball.x))
    }
  
    if (ball.y - ball.r < 0 || ball.y + ball.r > canvas.height) {
    ball.vy *= -1
    ball.y = Math.max(ball.r, Math.min(canvas.height - ball.r, ball.y))
    }

    function ballHits(p) {
      return (
        ball.x + ball.r > p.x &&
        ball.x - ball.r < p.x + p.w &&
        ball.y + ball.r > p.y &&
        ball.y - ball.r < p.y + p.h
      )
    }

    if (ballHits(player1)) kickBall(player1)
    if (ballHits(player2)) kickBall(player2)

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

    send({
        p1: player1,
        p2: player2,
        ball,
        powerUp,
        speedBoost
      })
  } else {
    send(keys)
  }
  // 1. Handle power-up spawn timer
if (!powerUp && Date.now() > nextPowerUpDelay) {
    powerUp = {
      x: Math.random() * (canvas.width - 20) + 10,
      y: Math.random() * (canvas.height - 20) + 10,
      r: 10
    }
  
    // Remove power-up after 10 seconds if not picked up
    powerUpTimeout = setTimeout(() => {
      powerUp = null
      scheduleNextPowerUp()
    }, 10000)
  }
  
  // 2. Handle pickup detection
  function touchesPowerUp(p) {
    return (
      powerUp &&
      p.x < powerUp.x + powerUp.r &&
      p.x + p.w > powerUp.x - powerUp.r &&
      p.y < powerUp.y + powerUp.r &&
      p.y + p.h > powerUp.y - powerUp.r
    )
  }
  
  if (powerUp) {
    if (touchesPowerUp(player1)) {
      applySpeedBoost('p1')
    } else if (touchesPowerUp(player2)) {
      applySpeedBoost('p2')
    }
  }
  
  // 3. Adjust player speed
    let p1Speed = speedBoost.p1.active ? BASE_SPEED * BOOST_MULTIPLIER : BASE_SPEED
    let p2Speed = speedBoost.p2.active ? BASE_SPEED * BOOST_MULTIPLIER : BASE_SPEED
  
  if (keys.ArrowUp) player1.y -= p1Speed
  if (keys.ArrowDown) player1.y += p1Speed
  if (keys.ArrowLeft) player1.x -= p1Speed
  if (keys.ArrowRight) player1.x += p1Speed
  
  if (remoteKeyState.ArrowUp) player2.y -= p2Speed
  if (remoteKeyState.ArrowDown) player2.y += p2Speed
  if (remoteKeyState.ArrowLeft) player2.x -= p2Speed
  if (remoteKeyState.ArrowRight) player2.x += p2Speed
  
  // 4. Expire old boosts
  const now = Date.now()
  if (speedBoost.p1.active && now > speedBoost.p1.endTime) speedBoost.p1.active = false
  if (speedBoost.p2.active && now > speedBoost.p2.endTime) speedBoost.p2.active = false
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  ctx.fillStyle = "#f00"
  ctx.fillRect(leftGoal.x, leftGoal.y, leftGoal.w, leftGoal.h)
  ctx.fillRect(rightGoal.x, rightGoal.y, rightGoal.w, rightGoal.h)

  if (player1Img.complete) {
    ctx.drawImage(player1Img, player1.x, player1.y, player1.w, player1.h)
  } else {
    ctx.fillStyle = "#0f0"
    ctx.fillRect(player1.x, player1.y, player1.w, player1.h)
  }
  
  if (player2Img.complete) {
    ctx.drawImage(player2Img, player2.x, player2.y, player2.w, player2.h)
  } else {
    ctx.fillStyle = "#00f"
    ctx.fillRect(player2.x, player2.y, player2.w, player2.h)
  }

  ctx.fillStyle = "#fff"
  ctx.beginPath()
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2)
  ctx.fill()

  if (powerUp && boosterImg.complete) {
    const size = powerUp.r * 2
    ctx.drawImage(boosterImg, powerUp.x - size/2, powerUp.y - size/2, size, size)
  }

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

let gameStarted = false;
let playerReady = false;
let opponentReady = false;

const startBtn = document.getElementById('start-btn');
const statusMsg = document.getElementById('status-msg');

startBtn.addEventListener('click', () => {
  if (!gameStarted) {
    playerReady = true;
    startBtn.disabled = true;
    startBtn.innerText = "Waiting...";
    statusMsg.innerText = 'Waiting for opponent...';
    broadcast({ type: 'player-ready' });
    checkStartConditions();
  }
});

function checkStartConditions() {
  if (playerReady && opponentReady) {
    startCountdown();
  }
}

function startCountdown() {
  let count = 5;
  statusMsg.innerText = `Starting in ${count}...`;
  const countdown = setInterval(() => {
    count--;
    if (count > 0) {
      statusMsg.innerText = `Starting in ${count}...`;
    } else {
      clearInterval(countdown);
      statusMsg.innerText = 'Game started!';
      startGame();
    }
  }, 1000);
}

function startGame() {
  gameStarted = true;
  enablePlayerMovement = true;
  const matchDuration = 2 * 60 * 1000; // 2 minutes

  let matchSeconds = 120;
  const timerEl = document.getElementById('match-timer');

  const matchInterval = setInterval(() => {
    const min = Math.floor(matchSeconds / 60);
    const sec = matchSeconds % 60;
    timerEl.innerText = `${min}:${sec.toString().padStart(2, '0')}`;
    matchSeconds--;

    if (matchSeconds < 0) {
      clearInterval(matchInterval);
      statusMsg.innerText = 'Game Over';
      enablePlayerMovement = false;
      gameStarted = false;
      timerEl.innerText = '';

      const result = {
        type: 'game-over',
        timestamp: Date.now(),
        playerId: playerId, // Use your identifier
        score: yourScore,   // Add score tracking logic here if needed
      };
      broadcast(result);
  }
}, 1000);
}

// Sync readiness with opponent
function broadcast(message) {
  send(message);
}

if (socket) {
  socket.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'player-ready') {
      opponentReady = true;
      checkStartConditions();
    }
  });
}