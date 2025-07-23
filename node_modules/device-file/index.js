const fs = require('fs')
const fsx = require('fs-native-extensions')
const b4a = require('b4a')

const PLATFORM = global.Bare ? global.Bare.platform : global.process.platform
const IS_WIN = PLATFORM === 'win32'
const IS_LINUX = PLATFORM === 'linux'
const MODIFIED_SLACK = 5000
const EMPTY = b4a.alloc(0)
const ATTR = IS_LINUX ? 'user.device-file' : 'device-file'

const nl = IS_WIN ? '\r\n' : '\n'

exports.create = writeDeviceFile
exports.resume = verifyDeviceFile

async function writeDeviceFile (filename, data = {}) {
  let s = ''

  for (const [key, value] of Object.entries(data)) {
    if (value === null) continue
    s += key + '=' + value + nl
  }

  const fd = await open(filename, 'w')
  const st = await fstat(fd)

  const created = Date.now()

  s += 'device/platform=' + PLATFORM + nl
  s += 'device/inode=' + st.ino + nl
  s += 'device/created=' + created + nl

  if (await setAttr(fd, ATTR, b4a.from('original'))) {
    s += 'device/attribute=original' + nl
  }

  await write(fd, b4a.from(s))
  await close(fd)
}

async function verifyDeviceFile (filename, data = {}) {
  let fd = 0

  try {
    fd = await open(filename, 'r')
  } catch {
    fd = 0
  }

  if (fd === 0) return null

  const buf = await read(fd)
  const result = {}

  const s = b4a.toString(buf).trim().split('\n')

  let inode = 0
  let created = 0
  let attr = ''
  let platform = ''

  for (const ln of s) {
    const i = ln.indexOf('=')
    if (i === -1) continue

    const k = ln.slice(0, i).trim()
    const v = ln.slice(i + 1).trim()

    switch (k) {
      case 'device/platform':
        platform = v
        break
      case 'device/inode':
        inode = Number(v)
        break
      case 'device/created':
        created = Number(v)
        break
      case 'device/attribute':
        attr = v
        break
      default:
        result[k] = v
        break
    }
  }

  for (const [k, v] of Object.entries(data)) {
    if (v === null) continue
    if (result[k] === undefined) continue // allow upserts
    if (result[k] !== ('' + v)) {
      throw new Error('Invalid device file, ' + k + ' has changed')
    }
  }

  const st = await fstat(fd)
  const at = await getAttr(fd, ATTR)
  await close(fd)

  const sameAttr = b4a.toString(at || EMPTY) === attr
  const modified = Math.max(st.mtime.getTime(), st.birthtime.getTime())

  if (platform && platform !== PLATFORM) {
    throw new Error('Invalid device file, was made on different platform')
  }

  if (!sameAttr) {
    throw new Error('Invalid device file, was moved unsafely')
  }

  if (st.ino !== inode || (created && Math.abs(modified - created) >= MODIFIED_SLACK)) {
    throw new Error('Invalid device file, was modified')
  }

  return result
}

async function getAttr (fd, name) {
  try {
    return await fsx.getAttr(fd, name)
  } catch {
    return null
  }
}

async function setAttr (fd, name, value) {
  try {
    await fsx.setAttr(fd, name, value)
    return true
  } catch {
    return false
  }
}

function fstat (fd) {
  return new Promise((resolve, reject) => {
    fs.fstat(fd, (err, st) => {
      if (err) reject(err)
      resolve(st)
    })
  })
}

function close (fd) {
  return new Promise((resolve, reject) => {
    fs.close(fd, (err, st) => {
      if (err) reject(err)
      resolve(st)
    })
  })
}

function write (fd, buf) {
  return new Promise((resolve, reject) => {
    let offset = 0

    onwrite(null, 0)

    function onwrite (err, wrote) {
      if (err) return reject(err)
      if (offset === buf.byteLength) return resolve()
      offset += wrote
      fs.write(fd, buf, offset, buf.byteLength - offset, offset, onwrite)
    }
  })
}

function read (fd) {
  const buf = b4a.allocUnsafe(4096)

  return new Promise((resolve, reject) => {
    let offset = 0

    fs.read(fd, buf, 0, buf.byteLength, 0, onread)

    function onread (err, read) {
      if (err) return reject(err)
      if (read === 0) return resolve(buf.subarray(0, offset))
      offset += read
      fs.read(fd, buf, offset, buf.byteLength - offset, offset, onread)
    }
  })
}

function open (filename, flags) {
  return new Promise((resolve, reject) => {
    fs.open(filename, flags, (err, fd) => {
      if (err) reject(err)
      resolve(fd)
    })
  })
}
