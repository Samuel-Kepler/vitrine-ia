import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    // e2e/ é do Playwright (npm run test:e2e)
    exclude: [...configDefaults.exclude, 'e2e/**', '_backup_pre_upgrade/**'],
  },
})