import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), basicSsl()],
  
  // For GitHub Pages: if your repo is at https://username.github.io/Qr_Hunt_Web/
  // set base to '/Qr_Hunt_Web/'
  // If you use a custom domain (e.g. qrhunt.com), keep it as '/'
  base: '/Qr_Hunt_Web/',
})
