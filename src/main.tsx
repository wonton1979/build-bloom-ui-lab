import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './features/auth/AuthProvider'
import { CartProvider } from './features/cart/CartProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider><CartProvider><App /></CartProvider></AuthProvider>
  </StrictMode>,
)
