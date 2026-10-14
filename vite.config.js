import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' so the build works from any sub-path (GitHub Pages, etc.)
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { host: true, port: 5174 },
})
