import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { muteForAd } from './sounds'
import './styles.css'

window.klotskiMuteForAd = muteForAd
window.latrunculiMuteForAd = muteForAd

createRoot(document.getElementById('root')).render(<App />)
