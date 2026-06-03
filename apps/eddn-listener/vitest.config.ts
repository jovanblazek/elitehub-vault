import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@elitehub/eddn-contracts': path.resolve(currentDir, '../../packages/eddn-contracts/src/index.ts'),
      '@elitehub/queue-contracts': path.resolve(currentDir, '../../packages/queue-contracts/src/index.ts'),
      '@elitehub/runtime-config': path.resolve(currentDir, '../../packages/runtime-config/src/index.ts'),
    },
  },
  test: {
    dir: 'src',
    environment: 'node',
  },
})
