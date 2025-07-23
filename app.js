import { send, joinSwarm } from './swarm.js'
import crypto from 'hypercore-crypto'
import b4a from 'b4a'
import { askUsername } from './username.js'
import Hypercore from 'hypercore'
import Hyperbee from 'hyperbee'
import path from 'path'


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
let hostUsername = ''
let guestUsername = ''
let remaining = 0
let matchInterval = null
let duration = 0
let enablePlayerMovement = false
let peerSocket = null
let gameOverHandled = false
const pitchImg = new Image()
pitchImg.src = './pitch.png' 
const player2Img = new Image()
player2Img.src = './player2.png'
let isHost = false
let remoteKeyState = {}
let core, bee


async function initLeaderboard() {
  const core = new Hypercore(path.join(Pear.config.storage, 'score'), Pear.config.args[0])

  await core.ready()
  bee = new Hyperbee(core, {
    keyEncoding: 'utf-8',
    valueEncoding: 'json'
  })
  await bee.ready()
}

await initLeaderboard()

async function incrementWins(winnerName) {
  if (!bee) return

  const node = await bee.get(winnerName)
  let wins = 0
  if (node && node.value && typeof node.value.wins === 'number') {
    wins = node.value.wins
  }
  wins += 1

  await bee.put(winnerName, { wins })
  console.log(`Updated wins for ${winnerName}: ${wins}`)
}

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

    case 'username':
      if (msg.guestUsername) guestUsername = msg.guestUsername; // Update guest username
      if (msg.hostUsername) hostUsername = msg.hostUsername;    // Update host username
      console.log('Guest username updated:', guestUsername); // Debugging log
      console.log('Host username updated:', hostUsername); // Debugging log
      break;

      case 'game-over':
        if (gameOverHandled) break;
        gameOverHandled = true
        gameStarted = false
        enablePlayerMovement = false
        document.getElementById('match-timer').innerText = ''

        if (msg.reason === 'opponent-left') {
          statusMsg.innerText = 'Opponent left — you win!'
        } else if (msg.winner === 'draw') {
          statusMsg.innerText = 'Draw! Overtime...'
          setTimeout(() => startGame(true), 2000)
          return
        } else {
          statusMsg.innerText = `Game Over. Winner: ${msg.winner}`
        }
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

window.onPeerDisconnected = () => {
  if (!gameOverHandled) {
    receivePeerMessage({ type: 'game-over', reason: 'opponent-left' })
  }
}

function hex(buf) {
  return b4a.toString(buf, 'hex')
}

function bufferFromHex(str) {
  return b4a.from(str, 'hex')
}

document.getElementById("createBtn").onclick = async () => {


  document.getElementById('start-controls').style.display = 'block';
  document.getElementById('gameCanvas').style.display = 'block';
  const topicBuffer = crypto.randomBytes(32)
  isHost = true

  await joinSwarm(topicBuffer, (socket,info) => {
    peerSocket = socket
    if (hostUsername) {
      socket.write(JSON.stringify({ type: 'username', hostUsername }))
      console.log('[HOST] Sent hostUsername to guest:', hostUsername)
    }
  })
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
  const matchTimer = document.getElementById('match-timer')
  matchTimer.style.display = 'block'
  matchTimer.innerText = '2:00'
  askUsername((name) => {
    hostUsername = name
    console.log('Host username:', hostUsername)
    console.log('sending host username:', hostUsername)
  })
  scheduleNextPowerUp()
  loop()


}

document.getElementById("joinBtn").onclick = async () => {
  document.getElementById('start-controls').style.display = 'block';
  const matchTimer = document.getElementById('match-timer')
  matchTimer.style.display = 'block'
  matchTimer.innerText = '2:00'
  const input = document.getElementById("joinKeyInput").value.trim()
  if (!input) {
    gameKeyDisplay.textContent = "Please enter a game key."
    return
  } 
  try {
    const topicBuffer = bufferFromHex(input)
    await joinSwarm(topicBuffer, (socket, info) => {
      peerSocket = socket})
    menu.style.display = "none"
    gameKeyDisplay.textContent = ""
    gameKeyElement.innerText = "" // don't show key for joiners
    loop()
    const matchTimer = document.getElementById('match-timer')
    matchTimer.style.display = 'block'
    matchTimer.innerText = '2:00'
    askUsername((name) => {
      guestUsername = name
      console.log('Player username:', name)
      console.log('sending guest username:', guestUsername)
      send({ type: 'username', guestUsername: guestUsername }); // Send guest username to host
    })
  } catch {
    gameKeyDisplay.textContent = "Invalid game key format."
  }
console.log(guestUsername)
}

let player1 = { x: 125, y: canvas.height / 2+25, w: 40, h: 40, score: 0 }
let player2 = { x: 650, y: canvas.height / 2+25, w: 40, h: 40, score: 0 }
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
const leftGoal = { x: 0, y: (canvas.height - goalHeight) / 2 + 50, w: goalWidth, h: goalHeight }
const rightGoal = { x: canvas.width - goalWidth, y: (canvas.height - goalHeight) / 2 +50, w: goalWidth, h: goalHeight }

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
    const minY = 100;
    const maxY = 560 // or lower if you want a buffer
    p.x = Math.max(0, Math.min(canvas.width - p.w, p.x))
    p.y = Math.max(minY, Math.min(maxY, p.y))
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
  
    const minY = 100;     // same as player clamp minY
    const maxY = 560+player1.h;     // same as player clamp maxY
    
    if (ball.y - ball.r < minY || ball.y + ball.r > maxY) {
      ball.vy *= -1
      ball.y = Math.max(minY + ball.r, Math.min(maxY - ball.r, ball.y))
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

  const paddingTop = 100 // reserve 100px for title bar

  if (pitchImg.complete) {
    pitchImg.onload = () => {
      const canvas = document.getElementById('gameCanvas');
      canvas.style.display = 'none';
    };
    const canvasAspect = canvas.width / (canvas.height - paddingTop)
    const imgAspect = pitchImg.width / pitchImg.height

    if (imgAspect > canvasAspect) {
      // Image is wider relative to canvas — scale by height and crop sides
      // You can implement if needed, currently skipping
    } else {
      // Scale image to fit canvas width
      const scale = canvas.width / pitchImg.width

      // Calculate the source crop height based on available canvas height minus padding
      const cropHeight = (canvas.height - paddingTop) / scale

      // Calculate cropY to crop equally from top and bottom, keeping center aligned
      let cropY = (pitchImg.height - cropHeight) / 2

      // Clamp cropY to image boundaries
      if (cropY < 0) cropY = 0
      if (cropY + cropHeight > pitchImg.height) cropY = pitchImg.height - cropHeight

      ctx.drawImage(
        pitchImg,
        0, cropY,                    // source x, y
        pitchImg.width, cropHeight,  // source width, height
        0, paddingTop,               // destination x, y (start drawing after padding)
        canvas.width, canvas.height - paddingTop // destination width, height (fit below padding)
      )
    }
  } else {
    ctx.fillStyle = "#1e7f3f"
    ctx.fillRect(0, paddingTop, canvas.width, canvas.height - paddingTop)
  }

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
  ctx.font = "16px monospace"
  
  const leftLabel = `${hostUsername}: ${player1.score}`
  const rightLabel = `${guestUsername}: ${player2.score}`
  
  ctx.fillText(leftLabel, 20, 40)
  ctx.fillText(rightLabel, canvas.width - ctx.measureText(rightLabel).width - 20, 40)
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
      console.log('Game started!!')
      statusMsg.innerText = 'Game started!';
      startGame();
    }
  }, 1000);
}

function startGame(overtime = false) {
  gameStarted = true;
  enablePlayerMovement = true;
  //set duration and time remaining
  duration = overtime ? 30 * 1000 : 0.5 * 60 * 1000
  remaining = duration / 1000

  const timerEl = document.getElementById('match-timer')
  timerEl.style.display = 'block';

  if (matchInterval) clearInterval(matchInterval); // clear previous interval if needed

  matchInterval = setInterval(() => {
    const min = Math.floor(remaining / 60);
    const sec = remaining % 60;
    timerEl.innerText = `${min}:${sec.toString().padStart(2, '0')}`;

    if (remaining === 0) {
      clearInterval(matchInterval);

      console.log('is there a peer socket?', peerSocket)
      if (!peerSocket) {
        declareWinner('opponent-left');
        return;
      }

      if (player1.score === player2.score) {
        console.log('[GAME] Draw — starting overtime');
        statusMsg.innerText = 'Draw! Overtime starting...';
        setTimeout(() => startGame(true), 2000); // start overtime
      } else {
        declareWinner('time-up');
      }

      return; // stop here
    }

    remaining--; // decrement after check
  }, 1000);
}

function updateTimerDisplay() {
  const timerEl = document.getElementById('match-timer');
  if (!timerEl) return;

  const min = Math.floor(remaining / 60);
  const sec = Math.floor(remaining % 60);
  timerEl.innerText = `${min}:${sec.toString().padStart(2, '0')}`;
}

async function declareWinner(reason) {
  gameStarted = false
  enablePlayerMovement = false

  let winner = 'draw'

  if (player1.score === player2.score) {
    winner = 'draw'
  } else if (reason === 'opponent-left') {
    winner = isHost ? hostUsername : guestUsername
  } else if (player1.score > player2.score) {
    winner = hostUsername
  } else {
    winner = guestUsername
  }

  await incrementWins(winner)


  const result = {
    type: 'game-over',
    reason,
    winner,
    scores: {
      [hostUsername]: player1.score,
      [guestUsername]: player2.score
    }
  }

  statusMsg.innerText = `Game Over. ${winner === 'draw' ? 'Draw!' : `Winner: ${winner}`}`
  send(result)
}

// Sync readiness with opponent
function broadcast(message) {
  send(message);
}

/*if (socket) {
  socket.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'player-ready') {
      opponentReady = true;
      checkStartConditions();
    }
  });
}*/