import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { playMoveSound, playWinSound, unlockAudio, isMuted, toggleMuted } from './sounds'
import { LANGS, LS_LANG_KEY, detectLang, normalizeLang, t } from './i18n'
import './styles.css'

const BOARD_W = 4
const BOARD_H = 5
const LS_COMPLETED_KEY = 'klotski_completed_v1'
const LS_LASTLEVEL_KEY = 'klotski_last_level_v1'
const LS_SKIP_UNLOCK_KEY = 'klotski_skip_unlock_v1'

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}
function canMove(blocks, b, dx, dy) {
  const nx = b.x + dx, ny = b.y + dy
  if (nx < 0 || ny < 0 || nx + b.w > BOARD_W || ny + b.h > BOARD_H) return false
  const moved = { ...b, x: nx, y: ny }
  return !blocks.some((o) => o !== b && overlap(moved, o))
}
const clone = (lvl) => lvl.map((b) => ({ ...b }))

// ===== ASCII 4x5 → blocks =====
const CHARS = {
  'R': { w: 2, h: 2, target: true },
  'V': { w: 1, h: 2, target: false },
  'H': { w: 2, h: 1, target: false },
  'S': { w: 1, h: 1, target: false },
}
function asciiToBlocks(ascii) {
  const rows = ascii.trim().split(/\r?\n/).map(l => l.trim().toUpperCase())
  if (rows.length !== BOARD_H) throw new Error(`Esperaba ${BOARD_H} filas, recibí ${rows.length}`)
  for (const [i, r] of rows.entries()) {
    if (r.length !== BOARD_W) throw new Error(`Fila ${i+1}: esperaba ${BOARD_W} columnas, recibí ${r.length}`)
  }
  const occ = Array.from({ length: BOARD_H }, () => Array(BOARD_W).fill(null))
  const blocks = []
  let counter = 0
  const occupy = (id, x, y) => {
    if (x < 0 || y < 0 || x >= BOARD_W || y >= BOARD_H) throw new Error(`Pieza sale del tablero en (${x},${y})`)
    if (occ[y][x] !== null) throw new Error(`Solape detectado en (${x},${y})`)
    occ[y][x] = id
  }
  for (let y=0;y<BOARD_H;y++){
    for (let x=0;x<BOARD_W;x++){
      const ch = rows[y][x]
      if (ch === '.') continue
      const def = CHARS[ch]
      if (!def) throw new Error(`Símbolo desconocido '${ch}' en (${x},${y})`)
      if (occ[y][x] !== null) continue
      const id = String.fromCharCode(65 + (counter % 26)) + (counter >= 26 ? Math.floor(counter / 26) : '')
      const { w, h } = def
      for (let dy=0;dy<h;dy++) for (let dx=0;dx<w;dx++) occupy(id, x+dx, y+dy)
      blocks.push({ id, x, y, w, h, target: !!def.target })
      counter++
    }
  }
  const targets = blocks.filter(b => b.target)
  if (targets.length !== 1) throw new Error(`Debe haber exactamente 1 'R'. Hay ${targets.length}.`)
  return blocks
}
function levelFrom(spec) { return typeof spec === 'string' ? asciiToBlocks(spec) : clone(spec) }

// ===== 30 niveles (1–4 se quedan; el resto ordenado por dificultad real) =====
const LEVELS = [
  // 1 tutorial (~2)
  levelFrom(`
SSSS
SRRS
SRRS
S..S
S..S
`),
  // 2 (~8)
  levelFrom(`
SSSS
SRRS
SRRS
SS.S
S..S
`),
  // 3 (~29)
  levelFrom(`
SRRS
SRRS
SSSS
SV.S
SV.S
`),
  // 4 (~28)
  levelFrom(`
SRRS
VRRV
VSSV
VSSV
V..V
`),
  // 5 (~32)
  levelFrom(`
VRR.
VRR.
HHHH
VSSS
V..S
`),
  // 6 (~35)
  levelFrom(`
HHHH
VRRV
VRRV
S..S
SSSS
`),
  // 7 (~36)
  levelFrom(`
HHHH
SRRS
SRRS
S..S
HHHH
`),
  // 8 (~37)
  levelFrom(`
RR..
RRHH
VVHH
VVSS
SSSS
`),
  // 9 (~42)
  levelFrom(`
SRRS
SRRS
VHHV
VSSV
S..S
`),
  // 10 (~44)
  levelFrom(`
VRRV
VHHV
VSSV
S..S
SSSS
`),
  // 11 (~46)
  levelFrom(`
SRRS
SRRS
HHHH
HHHH
.HH.
`),
  // 12 (~47)
  levelFrom(`
RRHH
RRHH
SS..
VVHH
VVHH
`),
  // 13 (~48)
  levelFrom(`
SSRR
SSRR
HHHH
V..S
VSSS
`),
  // 14 (~53)
  levelFrom(`
SRRS
SRRS
VVHH
VVHH
.HH.
`),
  // 15 (~56)
  levelFrom(`
VVRR
VVRR
HHSS
HH..
SSSS
`),
  // 16 (~59)
  levelFrom(`
VSSV
VRRV
SRRS
HHHH
S..S
`),
  // 17 (~64)
  levelFrom(`
VRRV
VRRV
VHHS
VSSS
S..S
`),
  // 18 (~66)
  levelFrom(`
VRRS
VRRS
VSVV
VSVV
..HH
`),
  // 19 (~67)
  levelFrom(`
SSSS
VRRV
VRRV
HHHH
S..S
`),
  // 20 (~77)
  levelFrom(`
VRRS
VRRS
HHSS
VHHV
V..V
`),
  // 21 将拥曹营 (~78)
  levelFrom(`
VRRV
VRRV
HHHH
S..S
SSSS
`),
  // 22 (~80)
  levelFrom(`
VSSV
VRRV
VRRV
HHHH
S..S
`),
  // 23 齐头并进 (~85)
  levelFrom(`
VRRV
VRRV
SSSS
VHHV
V..V
`),
  // 24 指挥若定 (~88)
  levelFrom(`
RRVV
RRVV
HHSS
V..V
VSSV
`),
  // 25 (~89)
  levelFrom(`
RRVV
RRVV
HHHH
SHHS
S..S
`),
  // 26 (~100)
  levelFrom(`
SRRS
VRRV
VVVV
SVVS
.HH.
`),
  // 27 (~110)
  levelFrom(`
VRRV
VRRV
HHHH
SV.S
SV.S
`),
  // 28 (~114)
  levelFrom(`
VRRS
VRRS
HHHH
HHHH
S..S
`),
  // 29 横刀立马 (~116)
  levelFrom(`
VRRV
VRRV
VHHV
VSSV
S..S
`),
  // 30 (~131)
  levelFrom(`
SRRS
VRRV
SV.V
SV.S
HHHH
`),
]

function isLevelUnlocked(i, completed, skipUnlockMax = 0) {
  if (i <= 0) return true
  if (i <= skipUnlockMax) return true
  for (let j = 0; j < i; j++) {
    if (!completed.has(j)) return false
  }
  return true
}

function clampToUnlocked(i, completed, skipUnlockMax = 0) {
  const n = Number.isFinite(i) ? i : 0
  if (n < 0) return 0
  if (isLevelUnlocked(n, completed, skipUnlockMax)) return Math.min(n, LEVELS.length - 1)
  let max = 0
  for (let j = 1; j < LEVELS.length; j++) {
    if (isLevelUnlocked(j, completed, skipUnlockMax)) max = j
    else break
  }
  return max
}

function readSkipUnlockMax() {
  try {
    const n = parseInt(localStorage.getItem(LS_SKIP_UNLOCK_KEY), 10)
    return Number.isFinite(n) && n > 0 ? n : 0
  } catch {
    return 0
  }
}

export default function App() {
  const [completed, setCompleted] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_COMPLETED_KEY)
      const arr = raw ? JSON.parse(raw) : []
      return new Set(arr)
    } catch { return new Set() }
  })

  // Restaurar último nivel (solo si está desbloqueado)
  const [skipUnlockMax, setSkipUnlockMax] = useState(() => readSkipUnlockMax())
  const [levelIndex, setLevelIndex] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_LASTLEVEL_KEY)
      const n = raw ? parseInt(raw, 10) : 0
      let done = new Set()
      try {
        const rawC = localStorage.getItem(LS_COMPLETED_KEY)
        done = new Set(rawC ? JSON.parse(rawC) : [])
      } catch { /* ignore */ }
      return clampToUnlocked(n, done, readSkipUnlockMax())
    } catch {
      return 0
    }
  })

  const [blocks, setBlocks] = useState(() => clone(LEVELS[levelIndex]))
  const [moves, setMoves] = useState(0)
  const [won, setWon] = useState(false)
  const [soundOn, setSoundOn] = useState(() => !isMuted())
  const [lang, setLang] = useState(() => detectLang())
  const [langOpen, setLangOpen] = useState(false)
  const [levelOpen, setLevelOpen] = useState(false)
  const [skipConfirmOpen, setSkipConfirmOpen] = useState(false)
  const [skipBusy, setSkipBusy] = useState(false)
  const [skipAvailable, setSkipAvailable] = useState(() => {
    try {
      return !(window.GameAds && typeof window.GameAds.canSkipLevel === 'function') || window.GameAds.canSkipLevel()
    } catch {
      return true
    }
  })

  const boardRef = useRef(null)
  const dragInfo = useRef(null)
  const blocksRef = useRef(blocks)
  const winSoundPlayed = useRef(false)
  const firstClearRef = useRef(false)
  const langMenuRef = useRef(null)
  const levelMenuRef = useRef(null)
  const [activeId, setActiveId] = useState(null)

  useEffect(() => {
    blocksRef.current = blocks
  }, [blocks])

  function refreshSkipAvailable() {
    try {
      if (window.GameAds && typeof window.GameAds.canSkipLevel === 'function') {
        setSkipAvailable(!!window.GameAds.canSkipLevel())
        return
      }
    } catch { /* ignore */ }
    setSkipAvailable(true)
  }

  function goToLevel(i) {
    const next = clampToUnlocked(i, completed, skipUnlockMax)
    setLevelIndex(next)
  }

  function changeLang(code) {
    const next = normalizeLang(code)
    setLang(next)
    setLangOpen(false)
    try { localStorage.setItem(LS_LANG_KEY, next) } catch { /* ignore */ }
  }

  function onToggleSound() {
    unlockAudio()
    const nowMuted = toggleMuted()
    setSoundOn(!nowMuted)
    if (!nowMuted) playMoveSound()
  }

  async function confirmSkipWithAd() {
    if (skipBusy || levelIndex >= LEVELS.length - 1) return
    setSkipBusy(true)
    try {
      let result = { ok: false, reason: 'unavailable' }
      if (window.GameAds && typeof window.GameAds.showRewardedSkip === 'function') {
        result = await window.GameAds.showRewardedSkip()
      }
      if (!result || !result.ok) {
        refreshSkipAvailable()
        setSkipBusy(false)
        return
      }
      const nextIdx = Math.min(levelIndex + 1, LEVELS.length - 1)
      const newMax = Math.max(skipUnlockMax, nextIdx)
      setSkipUnlockMax(newMax)
      try { localStorage.setItem(LS_SKIP_UNLOCK_KEY, String(newMax)) } catch { /* ignore */ }
      setSkipConfirmOpen(false)
      setWon(false)
      setLevelIndex(nextIdx)
      refreshSkipAvailable()
    } catch {
      refreshSkipAvailable()
    } finally {
      setSkipBusy(false)
    }
  }

  // Guardar el último nivel al cambiar
  useEffect(() => {
    try { localStorage.setItem(LS_LASTLEVEL_KEY, String(levelIndex)) } catch { /* ignore */ }
    const next = clone(LEVELS[levelIndex])
    blocksRef.current = next
    setBlocks(next)
    setMoves(0)
    setWon(false)
    winSoundPlayed.current = false
    try {
      if (window.GameAds && typeof window.GameAds.onMatchStart === "function") {
        window.GameAds.onMatchStart({
          level: levelIndex + 1,
          alreadyCleared: completed.has(levelIndex)
        })
      }
    } catch { /* ignore */ }
  }, [levelIndex])

  useEffect(() => {
    try {
      if (window.GameAds && typeof window.GameAds.syncNoAdsFab === "function") {
        window.GameAds.syncNoAdsFab()
      }
    } catch { /* ignore */ }
    refreshSkipAvailable()
  }, [])

  useEffect(() => {
    try {
      if (window.GameAds && typeof window.GameAds.setPaused === "function") {
        window.GameAds.setPaused(levelOpen || won || skipConfirmOpen)
      }
    } catch { /* ignore */ }
  }, [levelOpen, won, skipConfirmOpen])

  // Si el progreso cambia y el nivel actual queda inválido, corregir
  useEffect(() => {
    const safe = clampToUnlocked(levelIndex, completed, skipUnlockMax)
    if (safe !== levelIndex) setLevelIndex(safe)
  }, [completed, skipUnlockMax]) // eslint-disable-line react-hooks/exhaustive-deps

  // Título de la pestaña + lang attr
  useEffect(() => {
    const num = levelIndex + 1
    const label = num === 1 ? t(lang, 'tabTutorial') : t(lang, 'tabLevel', { n: num })
    document.title = `华容道 — ${label}`
    document.documentElement.lang = lang
  }, [levelIndex, lang])

  // Cerrar menús al click fuera / Escape
  useEffect(() => {
    if (!langOpen && !levelOpen && !skipConfirmOpen) return
    function onDoc(e) {
      if (langOpen && langMenuRef.current && !langMenuRef.current.contains(e.target)) setLangOpen(false)
      if (levelOpen && levelMenuRef.current && !levelMenuRef.current.contains(e.target)) setLevelOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') {
        setLangOpen(false)
        setLevelOpen(false)
        if (!skipBusy) setSkipConfirmOpen(false)
      }
    }
    document.addEventListener('pointerdown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [langOpen, levelOpen, skipConfirmOpen, skipBusy])

  // Detectar victoria y marcar completado
  useEffect(() => {
    const tBlock = blocks.find(b => b.target)
    if (tBlock && tBlock.x === 1 && tBlock.y === 3) {
      if (!winSoundPlayed.current) {
        winSoundPlayed.current = true
        playWinSound()
      }
      const firstClear = !completed.has(levelIndex)
      firstClearRef.current = firstClear
      setWon(true)
      if (firstClear) {
        const next = new Set(completed)
        next.add(levelIndex)
        setCompleted(next)
        try { localStorage.setItem(LS_COMPLETED_KEY, JSON.stringify([...next])) } catch {}
      }
    }
  }, [blocks]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!won) return
    try {
      if (window.GameAds && typeof window.GameAds.onMatchEnd === "function") {
        window.GameAds.onMatchEnd({
          level: levelIndex + 1,
          firstClear: firstClearRef.current === true
        })
      }
    } catch { /* ignore */ }
  }, [won])

  function getThresholdPx() {
    const rect = boardRef.current?.getBoundingClientRect()
    if (!rect) return 24
    const cell = Math.min(rect.width / BOARD_W, rect.height / BOARD_H)
    return cell * 0.6
  }

  function onPointerDown(e, id) {
    unlockAudio()
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    dragInfo.current = { id, startX: e.clientX, startY: e.clientY }
    setActiveId(id)
  }
  function onPointerMove(e) {
    if (!dragInfo.current) return
    e.preventDefault()
    const { id, startX, startY } = dragInfo.current
    const dx = e.clientX - startX
    const dy = e.clientY - startY
    const TH = getThresholdPx()
    if (Math.abs(dx) < TH && Math.abs(dy) < TH) return

    const prev = blocksRef.current
    const arr = clone(prev)
    const b = arr.find(x => x.id === id)
    if (!b) {
      dragInfo.current = { id, startX: e.clientX, startY: e.clientY }
      return
    }

    let moved = false
    if (Math.abs(dx) > Math.abs(dy)) {
      const step = dx > 0 ? 1 : -1
      if (canMove(arr, b, step, 0)) { b.x += step; moved = true }
    } else {
      const step = dy > 0 ? 1 : -1
      if (canMove(arr, b, 0, step)) { b.y += step; moved = true }
    }

    dragInfo.current = { id, startX: e.clientX, startY: e.clientY }
    if (!moved) return

    blocksRef.current = arr
    setBlocks(arr)
    setMoves(m => m + 1)
    playMoveSound()
  }
  function onPointerUp(e) {
    try { e.currentTarget.releasePointerCapture?.(e.pointerId) } catch {}
    dragInfo.current = null
    setActiveId(null)
  }

  function resetLevel() {
    const next = clone(LEVELS[levelIndex])
    blocksRef.current = next
    setBlocks(next)
    setMoves(0)
    setWon(false)
    winSoundPlayed.current = false
    try {
      if (window.GameAds && typeof window.GameAds.onMatchStart === "function") {
        window.GameAds.onMatchStart({
          level: levelIndex + 1,
          alreadyCleared: completed.has(levelIndex)
        })
      }
    } catch { /* ignore */ }
  }

  const cells = useMemo(() => {
    const arr = []
    for (let y = 0; y < BOARD_H; y++)
      for (let x = 0; x < BOARD_W; x++) arr.push(<div key={`c-${x}-${y}`} className="grid-cell" />)
    return arr
  }, [])

  const canGoNext = levelIndex < LEVELS.length - 1 && isLevelUnlocked(levelIndex + 1, completed, skipUnlockMax)
  const canGoPrev = levelIndex > 0
  const nextLocked = levelIndex < LEVELS.length - 1 && !isLevelUnlocked(levelIndex + 1, completed, skipUnlockMax)
  const showSkipFab = nextLocked && skipAvailable && !won

  const optionLabel = (i) => {
    const num = i + 1
    const name = num === 1 ? t(lang, 'tutorial') : t(lang, 'levelN', { n: num })
    if (completed.has(i)) return `${name} ✓`
    if (!isLevelUnlocked(i, completed, skipUnlockMax)) return `${name} · ${t(lang, 'locked')}`
    return name
  }

  const currentLevelLabel = optionLabel(levelIndex)

  return (
    <div className="container">
      <div className="atmosphere" aria-hidden="true" />

      <div className="topbar">
        <div className="topbar-left" ref={langMenuRef}>
          <button
            type="button"
            className="icon-btn"
            aria-label={t(lang, 'language')}
            title={t(lang, 'language')}
            aria-expanded={langOpen}
            aria-haspopup="listbox"
            onClick={() => { setLevelOpen(false); setLangOpen(o => !o) }}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path d="M3 12h18M12 3c2.5 2.8 4 6 4 9s-1.5 6.2-4 9c-2.5-2.8-4-6-4-9s1.5-6.2 4-9z" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
          {langOpen && (
            <ul className="lang-menu" role="listbox" aria-label={t(lang, 'language')}>
              {LANGS.map((l) => (
                <li key={l.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={lang === l.code}
                    className={lang === l.code ? 'is-active' : undefined}
                    onClick={() => changeLang(l.code)}
                  >
                    {l.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="topbar-end hero-end">
        <button
          type="button"
          className="icon-btn"
          aria-label={soundOn ? t(lang, 'mute') : t(lang, 'unmute')}
          title={soundOn ? t(lang, 'mute') : t(lang, 'unmute')}
          onClick={onToggleSound}
        >
          {soundOn ? (
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M4 10v4h3l5 4V6L7 10H4z" fill="currentColor" />
              <path d="M16 9.5a4 4 0 010 5M18.5 7a7 7 0 010 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M4 10v4h3l5 4V6L7 10H4z" fill="currentColor" />
              <path d="M16 9l5 5M21 9l-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          )}
        </button>
        </div>
      </div>

      <header className="header">
        <div className="brand">
          <div className="brand-zh">华容道</div>
          <div className="brand-en">Huarongdao</div>
        </div>
      </header>

      <div className="stats">
        <div className="stat" title={t(lang, 'movesFull')}>
          {t(lang, 'moves')} <strong>{moves}</strong>
        </div>
      </div>

      <div className="controls">
        <button
          type="button"
          className="btn btn-icon"
          onClick={() => goToLevel(levelIndex - 1)}
          disabled={!canGoPrev}
          aria-label={t(lang, 'prevLevel')}
          title={t(lang, 'prevLevel')}
        >◀</button>

        <div className="level-picker" ref={levelMenuRef}>
          <button
            type="button"
            className="select select-level level-trigger"
            aria-label={t(lang, 'selectLevel')}
            aria-expanded={levelOpen}
            aria-haspopup="listbox"
            onClick={() => { setLangOpen(false); setLevelOpen(o => !o) }}
          >
            <span className="level-trigger-text">{currentLevelLabel}</span>
            <span className="level-caret" aria-hidden="true">▾</span>
          </button>
          {levelOpen && (
            <ul className="level-menu" role="listbox" aria-label={t(lang, 'selectLevel')}>
              {LEVELS.map((_, i) => {
                const unlocked = isLevelUnlocked(i, completed, skipUnlockMax)
                return (
                  <li key={i}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={levelIndex === i}
                      disabled={!unlocked}
                      className={levelIndex === i ? 'is-active' : undefined}
                      onClick={() => {
                        if (!unlocked) return
                        goToLevel(i)
                        setLevelOpen(false)
                      }}
                    >
                      {optionLabel(i)}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <button
          type="button"
          className="btn btn-icon"
          onClick={() => goToLevel(levelIndex + 1)}
          disabled={!canGoNext}
          aria-label={t(lang, 'nextLevel')}
          title={t(lang, 'nextLevel')}
        >▶</button>

        <button className="btn btn-primary" onClick={resetLevel} title={t(lang, 'reset')}>
          {t(lang, 'reset')}
        </button>
      </div>

      <div className="board-wrap">
        <div className="board-frame">
          <div className="board" ref={boardRef}>
            <div className="grid">{cells}</div>

            <div
              className="goal"
              style={{
                bottom: 0,
                width: `${(2 / BOARD_W) * 100}%`,
                height: `${(1 / BOARD_H) * 100}%`
              }}
            >
              <div className="layer1"></div>
              <div className="layer2"></div>
              <div className="dash"></div>
              <div className="goal-label">门</div>
            </div>

            {blocks.map((b) => {
              const left = (b.x / BOARD_W) * 100
              const top = (b.y / BOARD_H) * 100
              const width = (b.w / BOARD_W) * 100
              const height = (b.h / BOARD_H) * 100
              const isTarget = !!b.target
              const isSmall = b.w === 1 && b.h === 1
              const isVertical = b.w === 1 && b.h === 2
              const isHorizontal = b.w === 2 && b.h === 1
              let fillClass = 'fill-fallback'
              if (isTarget) fillClass = 'fill-target'
              else if (isVertical) fillClass = 'fill-vert'
              else if (isHorizontal) fillClass = 'fill-horiz'
              else if (isSmall) fillClass = 'fill-small'

              return (
                <motion.div
                  key={b.id}
                  onPointerDown={(e) => onPointerDown(e, b.id)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  className={`block ${fillClass}`}
                  style={{
                    left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`,
                    zIndex: activeId === b.id ? 30 : (isSmall ? 20 : 10),
                    cursor: 'grab'
                  }}
                  initial={{ scale: 0.985 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 22 }}
                >
                  <div className="corner-marks" aria-hidden="true">
                    <span className="corner tl" />
                    <span className="corner tr" />
                    <span className="corner bl" />
                    <span className="corner br" />
                  </div>
                  {isTarget && (
                    <div className="target-mark">
                      <div className="target-seal">曹</div>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>

        <div className="board-under">
          {showSkipFab ? (
            <button
              type="button"
              className="skip-level-fab"
              aria-label={t(lang, 'skipLevelAria')}
              title={t(lang, 'skipLevelAria')}
              onClick={() => {
                unlockAudio()
                setLevelOpen(false)
                setLangOpen(false)
                setSkipConfirmOpen(true)
              }}
            >
              <span className="skip-level-fab__txt" dangerouslySetInnerHTML={{ __html: t(lang, 'skipLevelShort') }} />
            </button>
          ) : (
            <span className="board-under-spacer" aria-hidden="true" />
          )}
        </div>
      </div>

      <AnimatePresence>
        {skipConfirmOpen && (
          <motion.div
            className="modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { if (!skipBusy) setSkipConfirmOpen(false) }}
          >
            <motion.div
              className="modal-panel"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2>{t(lang, 'skipConfirmTitle')}</h2>
              <p>{t(lang, 'skipConfirmBody')}</p>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn"
                  disabled={skipBusy}
                  onClick={() => setSkipConfirmOpen(false)}
                >
                  {t(lang, 'skipCancel')}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={skipBusy}
                  onClick={confirmSkipWithAd}
                >
                  {skipBusy ? '…' : t(lang, 'skipWatchAd')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {won && (
          <motion.div
            className="modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="modal-panel"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
            >
              <div className="modal-seal" aria-hidden="true">通</div>
              <h2>{t(lang, 'winTitle')}</h2>
              <p>{t(lang, 'movesFull')}: {moves}</p>
              <div className="modal-actions">
                <button className="btn" onClick={resetLevel}>{t(lang, 'reset')}</button>
                <button
                  className="btn btn-primary"
                  onClick={() => goToLevel(levelIndex + 1)}
                  disabled={!canGoNext}
                >
                  {t(lang, 'nextLevel')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="made" role="contentinfo" aria-label={`${t(lang, 'madeBy')} Metamovidas`}>
        {t(lang, 'madeBy')} <span className="brand-meta">Metamovidas</span>
      </div>
    </div>
  )
}
