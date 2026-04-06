import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const nextVersion = process.argv[2]

if (!nextVersion) {
  console.error('Expected next version as the first argument.')
  process.exit(1)
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

const packageJsonPaths = [
  'package.json',
  'apps/api/package.json',
  'apps/eddn-listener/package.json',
  'apps/eddn-worker/package.json',
  'packages/db/package.json',
  'packages/eddn-contracts/package.json',
  'packages/queue-contracts/package.json',
  'packages/runtime-config/package.json',
  'packages/typescript-config/package.json',
]

for (const relativePath of packageJsonPaths) {
  const absolutePath = path.join(rootDir, relativePath)
  const packageJson = JSON.parse(await readFile(absolutePath, 'utf8'))
  packageJson.version = nextVersion
  await writeFile(`${absolutePath}`, `${JSON.stringify(packageJson, null, 2)}\n`)
}
