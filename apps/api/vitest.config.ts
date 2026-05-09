import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@elitehub/queue-contracts': path.resolve(currentDir, '../../packages/queue-contracts/src/index.ts'),
    },
  },
  test: {
    dir: 'src',
    environment: 'node',
  },
})
