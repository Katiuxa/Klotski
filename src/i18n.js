export const LANGS = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'ru', label: 'Русский' },
]

export const LS_LANG_KEY = 'klotski_lang_v1'

const dict = {
  es: {
    tagline: 'Saca la pieza roja por la puerta inferior',
    completed: 'Completados',
    level: 'Nivel',
    moves: 'Movs',
    movesFull: 'Movimientos',
    selectLevel: 'Seleccionar nivel',
    tutorial: 'Tutorial',
    levelN: 'Nivel {n}',
    locked: 'bloqueado',
    reset: 'Reiniciar',
    winTitle: '¡Nivel superado!',
    nextLevel: 'Siguiente nivel',
    prevLevel: 'Nivel anterior',
    madeBy: 'Made with ❤️ by',
    mute: 'Silenciar',
    unmute: 'Activar sonido',
    language: 'Idioma',
    progress: 'Progreso',
    currentLevel: 'Nivel actual',
    reload: '华容道 — recargar',
    tabTutorial: 'Tutorial',
    tabLevel: 'Nivel {n}',
    skipLevelAria: 'Saltar nivel viendo un anuncio',
    skipLevelShort: 'Saltar<br>nivel',
    skipConfirmTitle: '¿Pasar de nivel?',
    skipConfirmBody: 'Puedes pasar al siguiente nivel a cambio de ver un anuncio. Este nivel no se marcará como completado. Solo una vez cada 24 horas.',
    skipWatchAd: 'Ver anuncio',
    skipCancel: 'Cancelar',
  },
  en: {
    tagline: 'Slide the red piece out through the bottom gate',
    completed: 'Completed',
    level: 'Level',
    moves: 'Moves',
    movesFull: 'Moves',
    selectLevel: 'Select level',
    tutorial: 'Tutorial',
    levelN: 'Level {n}',
    locked: 'locked',
    reset: 'Reset',
    winTitle: 'Level cleared!',
    nextLevel: 'Next level',
    prevLevel: 'Previous level',
    madeBy: 'Made with ❤️ by',
    mute: 'Mute',
    unmute: 'Unmute',
    language: 'Language',
    progress: 'Progress',
    currentLevel: 'Current level',
    reload: 'Huarongdao — reload',
    tabTutorial: 'Tutorial',
    tabLevel: 'Level {n}',
    skipLevelAria: 'Skip level by watching an ad',
    skipLevelShort: 'Skip<br>level',
    skipConfirmTitle: 'Skip this level?',
    skipConfirmBody: 'Watch an ad to move on to the next level. This level will not be marked as completed. Once every 24 hours.',
    skipWatchAd: 'Watch ad',
    skipCancel: 'Cancel',
  },
  fr: {
    tagline: 'Faites sortir la pièce rouge par la porte du bas',
    completed: 'Terminés',
    level: 'Niveau',
    moves: 'Coups',
    movesFull: 'Coups',
    selectLevel: 'Choisir le niveau',
    tutorial: 'Tutoriel',
    levelN: 'Niveau {n}',
    locked: 'verrouillé',
    reset: 'Recommencer',
    winTitle: 'Niveau réussi !',
    nextLevel: 'Niveau suivant',
    prevLevel: 'Niveau précédent',
    madeBy: 'Made with ❤️ by',
    mute: 'Couper le son',
    unmute: 'Activer le son',
    language: 'Langue',
    progress: 'Progression',
    currentLevel: 'Niveau actuel',
    reload: 'Huarongdao — recharger',
    tabTutorial: 'Tutoriel',
    tabLevel: 'Niveau {n}',
    skipLevelAria: 'Passer le niveau avec une pub',
    skipLevelShort: 'Passer<br>niv.',
    skipConfirmTitle: 'Passer ce niveau ?',
    skipConfirmBody: 'Regardez une publicité pour passer au niveau suivant. Ce niveau ne sera pas marqué comme terminé. Une fois toutes les 24 heures.',
    skipWatchAd: 'Voir la pub',
    skipCancel: 'Annuler',
  },
  de: {
    tagline: 'Schiebe das rote Teil durch das untere Tor hinaus',
    completed: 'Geschafft',
    level: 'Level',
    moves: 'Züge',
    movesFull: 'Züge',
    selectLevel: 'Level wählen',
    tutorial: 'Tutorial',
    levelN: 'Level {n}',
    locked: 'gesperrt',
    reset: 'Neu starten',
    winTitle: 'Level geschafft!',
    nextLevel: 'Nächstes Level',
    prevLevel: 'Vorheriges Level',
    madeBy: 'Made with ❤️ by',
    mute: 'Stummschalten',
    unmute: 'Ton an',
    language: 'Sprache',
    progress: 'Fortschritt',
    currentLevel: 'Aktuelles Level',
    reload: 'Huarongdao — neu laden',
    tabTutorial: 'Tutorial',
    tabLevel: 'Level {n}',
    skipLevelAria: 'Level mit Werbung überspringen',
    skipLevelShort: 'Skip<br>level',
    skipConfirmTitle: 'Level überspringen?',
    skipConfirmBody: 'Sieh dir eine Werbung an, um zum nächsten Level zu kommen. Dieses Level zählt nicht als geschafft. Einmal alle 24 Stunden.',
    skipWatchAd: 'Werbung ansehen',
    skipCancel: 'Abbrechen',
  },
  ru: {
    tagline: 'Выведите красную фигуру через нижнюю дверь',
    completed: 'Пройдено',
    level: 'Уровень',
    moves: 'Ходы',
    movesFull: 'Ходы',
    selectLevel: 'Выбрать уровень',
    tutorial: 'Обучение',
    levelN: 'Уровень {n}',
    locked: 'закрыт',
    reset: 'Заново',
    winTitle: 'Уровень пройден!',
    nextLevel: 'Следующий уровень',
    prevLevel: 'Предыдущий уровень',
    madeBy: 'Made with ❤️ by',
    mute: 'Без звука',
    unmute: 'Включить звук',
    language: 'Язык',
    progress: 'Прогресс',
    currentLevel: 'Текущий уровень',
    reload: 'Huarongdao — обновить',
    tabTutorial: 'Обучение',
    tabLevel: 'Уровень {n}',
    skipLevelAria: 'Пропустить уровень за рекламу',
    skipLevelShort: 'Skip<br>ур.',
    skipConfirmTitle: 'Пропустить уровень?',
    skipConfirmBody: 'Посмотрите рекламу, чтобы перейти к следующему уровню. Этот уровень не будет отмечен как пройденный. Раз в 24 часа.',
    skipWatchAd: 'Смотреть',
    skipCancel: 'Отмена',
  },
}

export function normalizeLang(code) {
  const c = String(code || '').toLowerCase().slice(0, 2)
  return dict[c] ? c : 'es'
}

export function detectLang() {
  try {
    const saved = localStorage.getItem(LS_LANG_KEY)
    if (saved && dict[normalizeLang(saved)] && String(saved).slice(0, 2).toLowerCase() === normalizeLang(saved)) {
      return normalizeLang(saved)
    }
  } catch { /* ignore */ }
  const list = []
  try {
    if (navigator.languages) list.push(...navigator.languages)
  } catch { /* ignore */ }
  try {
    if (navigator.language) list.push(navigator.language)
  } catch { /* ignore */ }
  for (const raw of list) {
    const two = String(raw || '').slice(0, 2).toLowerCase()
    if (dict[two]) return two
  }
  return 'es'
}

export function t(lang, key, vars = {}) {
  const table = dict[normalizeLang(lang)] || dict.es
  let s = table[key] ?? dict.es[key] ?? key
  for (const [k, v] of Object.entries(vars)) {
    s = s.replaceAll(`{${k}}`, String(v))
  }
  return s
}
