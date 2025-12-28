import type { ChildProcess } from 'child_process'
import { fork } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import { EDDNQueue } from '../mq/queues/eddn/index.js'
import logger from '../utils/logger.js'
import { EDDNJournalMessage } from './types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const JOURNAL_PROCESS_JOB_NAME = 'journal-processing'
const FILE_NAME = 'eddnProcess.js'
const MAX_RESTARTS = 3

const IS_PRODUCTION = process.env.NODE_ENV === 'production'
const IS_DEBUG_EDDN_WORKER = process.env.DEBUG_EDDN_LISTENER === 'true'

export default function startEDDNListenerProcess() {
  if (!IS_PRODUCTION && !IS_DEBUG_EDDN_WORKER) {
    throw new Error('EDDN listener is only available in production')
  }

  let process: ChildProcess | null = null
  let restartCount = 0
  let isShuttingDown = false

  const start = () => {
    process = fork(path.join(__dirname, FILE_NAME))

    process.on('spawn', () => {
      logger.info('[EDDN Listener] Listener process spawned')
    })

    process.on('message', async (eddnJournalMessage: EDDNJournalMessage) => {
      // Only check for presence of StarSystem to be sure, other checks are done in the worker
      if (eddnJournalMessage?.message?.StarSystem) {
        await EDDNQueue.add(
          `${JOURNAL_PROCESS_JOB_NAME}:${eddnJournalMessage.message.event}:${eddnJournalMessage.message.StarSystem}`,
          eddnJournalMessage
        )
      }
    })

    process.on('exit', (code) => {
      logger.warn(`[EDDN Listener] Process exited with code ${code}`)
      if (!isShuttingDown && code !== 0 && code !== null && restartCount < MAX_RESTARTS) {
        logger.warn(
          `[EDDN Listener] Process exited with code ${code} (restart ${
            restartCount + 1
          }/${MAX_RESTARTS})`
        )
        restartCount += 1
        start()
      }
    })
  }

  const shutdown = () => {
    if (!process) {
      logger.warn('[EDDN Manager] Shutdown requested but no active process')
      return
    }
    isShuttingDown = true
    logger.info('[EDDN Manager] Initiating graceful shutdown of listener process')

    // TODO: Revisit this shutdown logic
    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (process) {
          process.kill('SIGKILL')
        }
        resolve()
      }, 5000)

      if (process && process.connected) {
        process.once('message', (message) => {
          if (message === 'shutdown_complete') {
            clearTimeout(timeout)
            // oxlint-disable-next-line no-multiple-resolved
            resolve()
          }
        })
        process.send('shutdown')
      } else {
        // If process is not connected, resolve immediately
        clearTimeout(timeout)
        // oxlint-disable-next-line no-multiple-resolved
        resolve()
      }
    })
  }

  start()
  return { process, shutdown }
}
