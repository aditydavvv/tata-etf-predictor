import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/tata-etf-predictor/',
  server: {
    proxy: {
      '/yahoo': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/yahoo/, ''),
        secure: false,
      },
      '/yahoo2': {
        target: 'https://query2.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/yahoo2/, ''),
        secure: false,
      },
      '/groww': {
        target: 'https://groww.in',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/groww/, ''),
        secure: false,
      },
    },
  },
})
