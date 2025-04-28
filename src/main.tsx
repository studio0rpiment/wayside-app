// In src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Import GSAP and register plugins
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

// Import ScrollProvider
import { ScrollProvider } from './context/ScrollContext'

console.log('Base URL:', import.meta.env.BASE_URL);


// Register ScrollTrigger with GSAP
gsap.registerPlugin(ScrollTrigger)

ScrollTrigger.defaults({
  markers: false });
  
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ScrollProvider >
      <App />
    </ScrollProvider>
  </React.StrictMode>,
)