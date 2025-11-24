import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: './', // Ensures assets are linked relatively, making it compatible with GitHub Pages
  plugins: [react()],
  server: {
    host: true,
    port: 3000
  }
})