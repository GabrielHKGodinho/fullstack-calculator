/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // The frontend always calls relative /api/... URLs. In development Vite
    // forwards them to the Go server, so the browser sees one origin and no
    // CORS is needed. In Docker, Go serves both the API and the built files.
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      // The HTML report goes in reportsDirectory and the text table next to
      // it, so the committed report is docs/coverage/frontend/ plus
      // docs/coverage/frontend.txt (SPEC 8). The file lists every file and has
      // no colors or local paths, unlike the console output.
      reportsDirectory: './coverage/frontend',
      reporter: ['text', 'html', ['text', { file: '../frontend.txt', skipFull: false }]],
      include: ['src/**/*.{ts,tsx}'],
      // types.ts only declares types, so it has no code to cover.
      exclude: ['src/main.tsx', 'src/calculator/types.ts', 'src/test/**', 'src/**/*.test.{ts,tsx}'],
    },
  },
})
