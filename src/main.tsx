import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './style.css'

const root = document.getElementById('root')
if (!root) throw new Error('앱 루트가 없습니다.')

createRoot(root).render(<App />)
