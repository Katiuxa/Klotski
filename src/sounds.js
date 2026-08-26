/** Low-latency SFX via Web Audio (preloaded buffers). */

const LS_MUTE_KEY = 'klotski_muted_v1'

let muted = false
try {
  muted = localStorage.getItem(LS_MUTE_KEY) === '1'
} catch { /* ignore */ }

let ctx = null
let moveBuf = null
let winBuf = null
let unlocking = null

function writeStr(view, offset, str) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
}

function buildWav(seconds, sampleFn) {
  const sampleRate = 22050
  const n = Math.floor(sampleRate * seconds)
  const dataSize = n * 2
  const buf = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buf)

  writeStr(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(view, 8, 'WAVE')
  writeStr(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeStr(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    let s = sampleFn(t, i, n)
    s = Math.max(-1, Math.min(1, s))
    view.setInt16(44 + i * 2, (s * 32767) | 0, true)
  }
  return buf
}

function moveSample(t) {
  // Crisp short wood tap — tight envelope for snappy Android response
  const env = Math.exp(-t * 70)
  const click = Math.sin(2 * Math.PI * 1100 * t) * 0.5
  const body = Math.sin(2 * Math.PI * 260 * t) * 0.4
  const noise = (Math.random() * 2 - 1) * Math.exp(-t * 120) * 0.35
  return (click + body + noise) * env
}

function winSample(t) {
  const notes = [523.25, 659.25, 784.0]
  let s = 0
  for (let i = 0; i < notes.length; i++) {
    const start = i * 0.09
    if (t < start) continue
    const u = t - start
    if (u > 0.22) continue
    const env = Math.exp(-u * 7) * Math.min(1, u / 0.012)
    s += Math.sin(2 * Math.PI * notes[i] * u) * env * 0.32
  }
  return s
}

function getCtx() {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  if (!ctx) ctx = new AC()
  return ctx
}

async function ensureReady() {
  const ac = getCtx()
  if (!ac) return null
  if (ac.state === 'suspended') {
    try { await ac.resume() } catch { /* ignore */ }
  }
  if (!moveBuf || !winBuf) {
    const moveWav = buildWav(0.07, moveSample)
    const winWav = buildWav(0.4, winSample)
    moveBuf = await ac.decodeAudioData(moveWav.slice(0))
    winBuf = await ac.decodeAudioData(winWav.slice(0))
  }
  return ac
}

function playBuffer(buffer, gainVal = 1) {
  if (muted || !buffer) return
  const ac = getCtx()
  if (!ac || ac.state !== 'running') {
    ensureReady().then((ready) => {
      if (ready && ready.state === 'running') playBuffer(buffer, gainVal)
    })
    return
  }
  try {
    const src = ac.createBufferSource()
    const gain = ac.createGain()
    gain.gain.value = gainVal
    src.buffer = buffer
    src.connect(gain)
    gain.connect(ac.destination)
    src.start(0)
  } catch { /* ignore */ }
}

/** Unlock + preload on first user gesture (call from pointerdown). */
export function unlockAudio() {
  if (unlocking) return unlocking
  unlocking = ensureReady()
    .then(() => true)
    .catch(() => false)
  return unlocking
}

export function isMuted() {
  return muted
}

export function setMuted(value) {
  muted = !!value
  try { localStorage.setItem(LS_MUTE_KEY, muted ? '1' : '0') } catch { /* ignore */ }
  if (!muted) unlockAudio()
}

export function toggleMuted() {
  setMuted(!muted)
  return muted
}

export function playMoveSound() {
  if (muted) return
  if (moveBuf && ctx && ctx.state === 'running') {
    playBuffer(moveBuf, 0.9)
    return
  }
  unlockAudio().then(() => playBuffer(moveBuf, 0.9))
}

export function playWinSound() {
  if (muted) return
  if (winBuf && ctx && ctx.state === 'running') {
    playBuffer(winBuf, 0.95)
    return
  }
  unlockAudio().then(() => playBuffer(winBuf, 0.95))
}
